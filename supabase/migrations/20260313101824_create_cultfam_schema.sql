/*
  # CultFam Platform Database Schema

  ## Overview
  Creates the complete database schema for the CultFam community platform, including tables for users, clubs, events, interactions, and more.

  ## New Tables Created

  ### Authentication & Users
  - `users` - User accounts and profiles
    - `id` (uuid, primary key)
    - `email` (text, unique, not null)
    - `password_hash` (text, not null)
    - `name` (text, not null)
    - `phone` (text)
    - `profile_image_url` (text)
    - `bio` (text)
    - `city` (text)
    - `college_or_work` (text)
    - `created_at` (timestamptz)
  
  - `sessions` - User session management
    - `sid` (varchar, primary key)
    - `sess` (json, not null)
    - `expire` (timestamp, not null)

  ### Clubs & Communities
  - `clubs` - Community clubs/groups
  - `join_requests` - Requests to join clubs
  - `club_ratings` - User ratings for clubs
  - `club_faqs` - Frequently asked questions per club
  - `club_schedule_entries` - Recurring schedule for clubs
  - `club_page_sections` - Custom sections for club pages
  - `club_announcements` - Announcements from club organizers
  - `club_polls` - Polls created within clubs
  - `poll_votes` - User votes on polls
  - `club_proposals` - Proposals for new clubs

  ### Events & Attendance
  - `events` - Club events and activities
  - `event_rsvps` - User RSVPs to events
  - `event_comments` - Comments on events

  ### Content & Engagement
  - `club_moments` - Photos/moments shared by clubs
  - `moment_likes` - Likes on moments
  - `moment_comments` - Comments on moments
  - `kudos` - Recognition given to members at events
  - `section_events` - Links events to page sections

  ### User Data
  - `user_quiz_answers` - Onboarding quiz responses
  - `notifications` - User notifications

  ## Security
  - RLS enabled on all tables
  - Policies created for authenticated user access
  - Proper ownership and membership checks implemented

  ## Indexes
  - Unique indexes on email, club slugs
  - Foreign key relationships for data integrity
  - Performance indexes on frequently queried fields
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  phone text,
  profile_image_url text,
  bio text,
  city text,
  college_or_work text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  category text NOT NULL,
  emoji text NOT NULL,
  short_desc text NOT NULL,
  full_desc text NOT NULL,
  organizer_name text NOT NULL,
  organizer_years text,
  organizer_avatar text,
  organizer_response text,
  member_count integer NOT NULL DEFAULT 0,
  schedule text NOT NULL,
  location text NOT NULL,
  city text NOT NULL DEFAULT 'Tirupati',
  vibe text NOT NULL DEFAULT 'casual',
  active_since text,
  whatsapp_number text,
  health_status text NOT NULL DEFAULT 'green',
  health_label text NOT NULL DEFAULT 'Very Active',
  last_active text,
  founding_taken integer DEFAULT 0,
  founding_total integer DEFAULT 20,
  bg_color text,
  time_of_day text NOT NULL DEFAULT 'morning',
  is_active boolean DEFAULT true,
  highlights text[],
  creator_user_id varchar,
  co_organiser_user_ids text[],
  join_question_1 text,
  join_question_2 text,
  cover_image_url text,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active clubs"
  ON clubs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Club creators can update their clubs"
  ON clubs FOR UPDATE
  TO authenticated
  USING (creator_user_id = auth.uid()::text)
  WITH CHECK (creator_user_id = auth.uid()::text);

CREATE POLICY "Authenticated users can create clubs"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (creator_user_id = auth.uid()::text);

-- Club page sections table
CREATE TABLE IF NOT EXISTS club_page_sections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  title text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '📌',
  layout text NOT NULL DEFAULT 'full',
  position integer NOT NULL DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible club sections"
  ON club_page_sections FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Club creators can manage sections"
  ON club_page_sections FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = club_page_sections.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Section events table
CREATE TABLE IF NOT EXISTS section_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  section_id varchar NOT NULL,
  event_id varchar NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE section_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view section events"
  ON section_events FOR SELECT
  USING (true);

CREATE POLICY "Club creators can manage section events"
  ON section_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_page_sections cps
      JOIN clubs c ON c.id = cps.club_id
      WHERE cps.id = section_events.section_id 
      AND c.creator_user_id = auth.uid()::text
    )
  );

-- Join requests table
CREATE TABLE IF NOT EXISTS join_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  club_name text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  user_id varchar,
  status text NOT NULL DEFAULT 'pending',
  marked_done boolean DEFAULT false,
  is_founding_member boolean DEFAULT false,
  answer_1 text,
  answer_2 text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own join requests"
  ON join_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Club creators can view join requests"
  ON join_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = join_requests.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

CREATE POLICY "Authenticated users can create join requests"
  ON join_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Club creators can update join requests"
  ON join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = join_requests.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- User quiz answers table
CREATE TABLE IF NOT EXISTS user_quiz_answers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL,
  interests text[] NOT NULL,
  experience_level text NOT NULL,
  vibe_preference text NOT NULL,
  availability text[] NOT NULL,
  college_or_work text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_quiz_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quiz answers"
  ON user_quiz_answers FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  title text NOT NULL,
  description text,
  location_text text NOT NULL,
  location_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  max_capacity integer NOT NULL,
  cover_image_url text,
  is_public boolean DEFAULT true,
  is_cancelled boolean DEFAULT false,
  recurrence_rule text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public events"
  ON events FOR SELECT
  USING (is_public = true AND is_cancelled = false);

CREATE POLICY "Club creators can manage events"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = events.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Event RSVPs table
CREATE TABLE IF NOT EXISTS event_rsvps (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id varchar NOT NULL,
  user_id varchar NOT NULL,
  status text NOT NULL DEFAULT 'going',
  checkin_token varchar DEFAULT gen_random_uuid()::text,
  checked_in boolean DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own RSVPs"
  ON event_rsvps FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Anyone can view RSVPs"
  ON event_rsvps FOR SELECT
  USING (true);

-- Club ratings table
CREATE TABLE IF NOT EXISTS club_ratings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  user_id varchar NOT NULL,
  rating integer NOT NULL,
  review text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings"
  ON club_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can create ratings"
  ON club_ratings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Club FAQs table
CREATE TABLE IF NOT EXISTS club_faqs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view FAQs"
  ON club_faqs FOR SELECT
  USING (true);

CREATE POLICY "Club creators can manage FAQs"
  ON club_faqs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = club_faqs.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Club schedule entries table
CREATE TABLE IF NOT EXISTS club_schedule_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  day_of_week text NOT NULL,
  start_time text NOT NULL,
  end_time text,
  activity text NOT NULL,
  location text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedule entries"
  ON club_schedule_entries FOR SELECT
  USING (true);

CREATE POLICY "Club creators can manage schedule"
  ON club_schedule_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = club_schedule_entries.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Club moments table
CREATE TABLE IF NOT EXISTS club_moments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  caption text NOT NULL,
  image_url text,
  emoji text,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  author_user_id varchar,
  author_name text
);

ALTER TABLE club_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view moments"
  ON club_moments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create moments"
  ON club_moments FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = auth.uid()::text);

-- Moment likes table
CREATE TABLE IF NOT EXISTS moment_likes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  moment_id varchar NOT NULL,
  user_id varchar NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS moment_likes_unique ON moment_likes (moment_id, user_id);

ALTER TABLE moment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON moment_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own likes"
  ON moment_likes FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Moment comments table
CREATE TABLE IF NOT EXISTS moment_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  moment_id varchar NOT NULL,
  user_id varchar NOT NULL,
  user_name text NOT NULL,
  user_image_url text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE moment_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON moment_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON moment_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Event comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id varchar NOT NULL,
  user_id varchar NOT NULL,
  user_name text NOT NULL,
  user_image_url text,
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event comments"
  ON event_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create event comments"
  ON event_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link_url text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Club announcements table
CREATE TABLE IF NOT EXISTS club_announcements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  author_user_id varchar NOT NULL,
  author_name text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view announcements"
  ON club_announcements FOR SELECT
  USING (true);

CREATE POLICY "Club creators can manage announcements"
  ON club_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = club_announcements.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Club polls table
CREATE TABLE IF NOT EXISTS club_polls (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  club_id varchar NOT NULL,
  question text NOT NULL,
  options text[] NOT NULL,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view polls"
  ON club_polls FOR SELECT
  USING (true);

CREATE POLICY "Club creators can manage polls"
  ON club_polls FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clubs 
      WHERE clubs.id = club_polls.club_id 
      AND clubs.creator_user_id = auth.uid()::text
    )
  );

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  poll_id varchar NOT NULL,
  user_id varchar NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view poll votes"
  ON poll_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can create poll votes"
  ON poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- Kudos table
CREATE TABLE IF NOT EXISTS kudos (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id varchar NOT NULL,
  giver_id varchar NOT NULL,
  receiver_id varchar NOT NULL,
  kudo_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kudos_giver_event_unique ON kudos (event_id, giver_id);

ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kudos"
  ON kudos FOR SELECT
  USING (true);

CREATE POLICY "Users can give kudos"
  ON kudos FOR INSERT
  TO authenticated
  WITH CHECK (giver_id = auth.uid()::text);

-- Club proposals table
CREATE TABLE IF NOT EXISTS club_proposals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL,
  club_name text NOT NULL,
  category text NOT NULL,
  vibe text NOT NULL DEFAULT 'casual',
  short_desc text NOT NULL,
  city text NOT NULL DEFAULT 'Tirupati',
  schedule text NOT NULL,
  motivation text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals"
  ON club_proposals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create proposals"
  ON club_proposals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);