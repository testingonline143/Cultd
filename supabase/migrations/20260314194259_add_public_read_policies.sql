/*
  # Add RLS policies for public data access

  1. Security Changes
    - Add public read policies for clubs table (public browsing)
    - Add public read policies for club_faqs table
    - Add public read policies for club_schedule_entries table
    - Add public read policies for club_moments table
    - Add public read policies for events table (public events)
    
  2. Notes
    - These policies allow anonymous users to browse public content
    - Write operations still require authentication
*/

-- Clubs: Anyone can view active clubs
CREATE POLICY "Anyone can view active clubs"
  ON clubs FOR SELECT
  USING (is_active = true);

-- Club FAQs: Anyone can view FAQs
CREATE POLICY "Anyone can view club faqs"
  ON club_faqs FOR SELECT
  USING (true);

-- Club Schedule: Anyone can view schedules
CREATE POLICY "Anyone can view club schedules"
  ON club_schedule_entries FOR SELECT
  USING (true);

-- Club Moments: Anyone can view moments
CREATE POLICY "Anyone can view club moments"
  ON club_moments FOR SELECT
  USING (true);

-- Events: Anyone can view public events
CREATE POLICY "Anyone can view public events"
  ON events FOR SELECT
  USING (is_public = true AND is_cancelled = false);

-- Club Ratings: Anyone can view ratings
CREATE POLICY "Anyone can view club ratings"
  ON club_ratings FOR SELECT
  USING (true);

-- Club Page Sections: Anyone can view visible sections
CREATE POLICY "Anyone can view club page sections"
  ON club_page_sections FOR SELECT
  USING (is_visible = true);

-- Users: Anyone can view basic user profiles
CREATE POLICY "Anyone can view user profiles"
  ON users FOR SELECT
  USING (true);