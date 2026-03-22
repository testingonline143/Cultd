-- ============================================================
-- CultFam: Supabase Setup SQL
-- Run this entire script in your Supabase Dashboard → SQL Editor
-- ============================================================

-- PART 1: Create all tables
-- ============================================================
CREATE TABLE "club_announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"author_user_id" varchar NOT NULL,
	"author_name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "club_faqs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "club_moments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"caption" text NOT NULL,
	"image_url" text,
	"emoji" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"author_user_id" varchar,
	"author_name" text
);

CREATE TABLE "club_page_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"emoji" text DEFAULT '📌' NOT NULL,
	"layout" text DEFAULT 'full' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "club_polls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"question" text NOT NULL,
	"options" text[] NOT NULL,
	"is_open" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "club_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"club_name" text NOT NULL,
	"category" text NOT NULL,
	"vibe" text DEFAULT 'casual' NOT NULL,
	"short_desc" text NOT NULL,
	"city" text DEFAULT 'Tirupati' NOT NULL,
	"schedule" text NOT NULL,
	"motivation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"created_at" timestamp DEFAULT now(),
	"suggested_commission_type" varchar,
	"suggested_commission_value" integer,
	"commission_note" varchar
);

CREATE TABLE "club_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "club_schedule_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"day_of_week" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"activity" text NOT NULL,
	"location" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "clubs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"emoji" text NOT NULL,
	"short_desc" text NOT NULL,
	"full_desc" text NOT NULL,
	"organizer_name" text NOT NULL,
	"organizer_years" text,
	"organizer_avatar" text,
	"organizer_response" text,
	"member_count" integer DEFAULT 0 NOT NULL,
	"schedule" text NOT NULL,
	"location" text NOT NULL,
	"city" text DEFAULT 'Tirupati' NOT NULL,
	"vibe" text DEFAULT 'casual' NOT NULL,
	"active_since" text,
	"whatsapp_number" text,
	"health_status" text DEFAULT 'green' NOT NULL,
	"health_label" text DEFAULT 'Very Active' NOT NULL,
	"last_active" text,
	"founding_taken" integer DEFAULT 0,
	"founding_total" integer DEFAULT 20,
	"bg_color" text,
	"time_of_day" text DEFAULT 'morning' NOT NULL,
	"is_active" boolean DEFAULT true,
	"highlights" text[],
	"creator_user_id" varchar,
	"co_organiser_user_ids" text[],
	"join_question_1" text,
	"join_question_2" text,
	"cover_image_url" text,
	"slug" text,
	"created_at" timestamp DEFAULT now(),
	"razorpay_contact_id" varchar,
	"razorpay_fund_account_id" varchar,
	"bank_account_name" varchar,
	"bank_account_number" varchar,
	"bank_ifsc" varchar,
	"upi_id" varchar,
	"payout_method" varchar DEFAULT 'bank',
	"payouts_enabled" boolean DEFAULT false,
	"commission_type" varchar DEFAULT 'percentage',
	"commission_value" integer DEFAULT 700,
	"commission_set_by_admin" boolean DEFAULT false,
	"commission_note" varchar,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);

CREATE TABLE "event_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_image_url" text,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "event_form_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"question" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "event_form_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "event_rsvps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text DEFAULT 'going' NOT NULL,
	"checkin_token" varchar DEFAULT gen_random_uuid(),
	"checked_in" boolean DEFAULT false,
	"checked_in_at" timestamp,
	"ticket_type_id" integer,
	"ticket_type_name" text,
	"created_at" timestamp DEFAULT now(),
	"razorpay_order_id" varchar,
	"razorpay_payment_id" varchar,
	"payment_status" varchar DEFAULT 'free'
);

CREATE TABLE "event_ticket_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_ticket_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" varchar NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_text" text NOT NULL,
	"location_url" text,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"max_capacity" integer NOT NULL,
	"cover_image_url" text,
	"is_public" boolean DEFAULT true,
	"is_cancelled" boolean DEFAULT false,
	"recurrence_rule" text,
	"form_mandatory" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "join_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"club_name" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"user_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"marked_done" boolean DEFAULT false,
	"is_founding_member" boolean DEFAULT false,
	"answer_1" text,
	"answer_2" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "kudos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"giver_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"kudo_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "moment_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_image_url" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "moment_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link_url" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "platform_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"rsvp_id" varchar NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"razorpay_order_id" varchar NOT NULL,
	"razorpay_payment_id" varchar NOT NULL,
	"razorpay_transfer_id" varchar,
	"total_amount" integer NOT NULL,
	"base_amount" integer NOT NULL,
	"platform_fee" integer NOT NULL,
	"currency" varchar DEFAULT 'INR' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "poll_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "section_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE "user_quiz_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"interests" text[] NOT NULL,
	"experience_level" text NOT NULL,
	"vibe_preference" text NOT NULL,
	"availability" text[] NOT NULL,
	"college_or_work" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"bio" text,
	"city" text,
	"role" text DEFAULT 'user' NOT NULL,
	"quiz_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE INDEX "club_announcements_club_id_idx" ON "club_announcements" USING btree ("club_id");
CREATE INDEX "club_faqs_club_id_idx" ON "club_faqs" USING btree ("club_id");
CREATE INDEX "club_moments_club_id_idx" ON "club_moments" USING btree ("club_id");
CREATE INDEX "club_page_sections_club_id_idx" ON "club_page_sections" USING btree ("club_id");
CREATE INDEX "club_polls_club_id_idx" ON "club_polls" USING btree ("club_id");
CREATE INDEX "club_ratings_club_id_idx" ON "club_ratings" USING btree ("club_id");
CREATE INDEX "club_schedule_entries_club_id_idx" ON "club_schedule_entries" USING btree ("club_id");
CREATE INDEX "event_comments_event_id_idx" ON "event_comments" USING btree ("event_id");
CREATE INDEX "event_form_questions_event_id_idx" ON "event_form_questions" USING btree ("event_id");
CREATE INDEX "event_form_responses_event_id_idx" ON "event_form_responses" USING btree ("event_id");
CREATE INDEX "event_form_responses_user_id_idx" ON "event_form_responses" USING btree ("user_id");
CREATE INDEX "event_rsvps_event_id_idx" ON "event_rsvps" USING btree ("event_id");
CREATE INDEX "event_rsvps_user_id_idx" ON "event_rsvps" USING btree ("user_id");
CREATE INDEX "event_rsvps_status_idx" ON "event_rsvps" USING btree ("status");
CREATE INDEX "event_ticket_types_event_id_idx" ON "event_ticket_types" USING btree ("event_id");
CREATE INDEX "events_club_id_idx" ON "events" USING btree ("club_id");
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");
CREATE INDEX "join_requests_club_id_idx" ON "join_requests" USING btree ("club_id");
CREATE INDEX "join_requests_user_id_idx" ON "join_requests" USING btree ("user_id");
CREATE INDEX "join_requests_status_idx" ON "join_requests" USING btree ("status");
CREATE UNIQUE INDEX "kudos_giver_event_unique" ON "kudos" USING btree ("event_id","giver_id");
CREATE INDEX "kudos_receiver_id_idx" ON "kudos" USING btree ("receiver_id");
CREATE INDEX "moment_comments_moment_id_idx" ON "moment_comments" USING btree ("moment_id");
CREATE UNIQUE INDEX "moment_likes_unique" ON "moment_likes" USING btree ("moment_id","user_id");
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");
CREATE INDEX "platform_transactions_club_id_idx" ON "platform_transactions" USING btree ("club_id");
CREATE INDEX "platform_transactions_user_id_idx" ON "platform_transactions" USING btree ("user_id");
CREATE INDEX "platform_transactions_status_idx" ON "platform_transactions" USING btree ("status");
CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");
CREATE INDEX "section_events_section_id_idx" ON "section_events" USING btree ("section_id");
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");

-- ============================================================
-- PART 2: Seed data
-- ============================================================
-- CultFam data export
-- Exported at 2026-03-22T09:23:16.422Z

SET session_replication_role = 'replica';

-- users (1 rows)
INSERT INTO "users" ("id", "email", "first_name", "last_name", "profile_image_url", "bio", "city", "role", "quiz_completed", "created_at", "updated_at") VALUES ('86c75838-42e1-41bd-b1bd-dfc81d817ef9', 'govardhanpadamatikona@gmail.com', NULL, NULL, NULL, NULL, NULL, 'user', TRUE, '2026-03-22T09:12:31.997Z', '2026-03-22T09:18:02.725Z') ON CONFLICT DO NOTHING;

-- clubs (7 rows)
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Tirupati Fitness Tribe', 'Fitness', '💪', 'Outdoor bootcamp, yoga, and running. Free community fitness for all ages.', 'We meet at Bairagipatteda Park every morning at 6 AM. Bootcamp on Monday-Wednesday-Friday, yoga on Tuesday-Thursday, and group runs on Saturday. All ages and levels welcome. No equipment needed, just show up ready to move.', 'Suresh Babu', '5 years running', '🧔', 'Responds within 1 hr', 0, 'Mon-Sat, 6:00 AM', 'Bairagipatteda Park', 'Tirupati', 'casual', '2020', '919000000005', 'green', 'Very Active', 'Met this morning', 20, 20, '#fde8e8', 'morning', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'Tirupati Cyclists', 'Cycling', '🚴', 'Early morning rides through Tirupati city and surrounding villages. All bikes welcome.', 'We ride every Saturday and Sunday at 5:45 AM from RTC Bus Stand. Routes from 20km to 60km. Road bikes, MTBs, and hybrids all welcome. Safety first — helmet always required, no exceptions.', 'Suresh Reddy', '4 years running', '👨', 'Responds within 1 hr', 0, 'Sat & Sun, 5:45 AM', 'RTC Bus Stand', 'Tirupati', 'casual', '2021', '919000000003', 'green', 'Very Active', 'Rode yesterday', 14, 20, '#e8f0fe', 'morning', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('a54be685-9699-4d29-88a5-983270d72e5d', 'Lens & Light Tirupati', 'Photography', '📷', 'Photography walks around Tirupati''s temples, markets, and nature spots.', 'Monthly photo walks plus editing workshops and print exhibitions. From phone cameras to DSLRs — all are welcome. Tirumala at dawn, Govindaraja Swamy temple at golden hour, the chaos of Balaji Nagar market — Tirupati is full of frames waiting to be captured.', 'Anitha Devi', '2 years running', '👩‍🦱', 'Responds within 6 hrs', 0, '2nd Sunday, 6:00 AM', 'Govindaraja Temple Gate', 'Tirupati', 'casual', '2023', '919000000004', 'green', 'Active', 'Met last Saturday', 8, 20, '#f3e8ff', 'morning', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('67ede284-b1df-4f8d-abec-bd3a8a928591', 'Telugu Writers Circle', 'Books', '✍️', 'For aspiring Telugu writers — poetry, short stories, and essays.', 'Share your work in a safe, encouraging space. Monthly anthology publications and open mic events. Whether you write in Telugu or English, if you love putting words on paper, this is your tribe. We celebrate every voice.', 'Lakshmi Naidu', '1 year running', '👩‍🏫', 'Responds within 8 hrs', 0, '3rd Sunday, 4:00 PM', 'District Library', 'Tirupati', 'casual', '2024', '919000000006', 'green', 'Active', 'Met last Sunday', 6, 20, '#fff3e0', 'evening', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('e64bc534-13f1-4890-85f0-f6ab33491294', 'Tirupati Reads', 'Books', '📚', 'Monthly book club for fiction, non-fiction, and Telugu literature lovers.', 'Started by a group of college friends, Tirupati Reads has grown into a warm community of 50+ book lovers. We read one book a month, meet at a local café, and genuinely argue about whether the ending was worth it. Telugu and English books both welcome.', 'Priya Sharma', '2 years running', '👩', 'Responds within 4 hrs', 0, 'First Saturday, 6:00 PM', 'Café Tirupati, TP Area', 'Tirupati', 'casual', '2023', '919000000002', 'green', 'Very Active', 'Met last Saturday', 11, 20, '#fef9e7', 'evening', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('8c6375d8-98e1-4618-83b7-17ef716db3d4', 'Tirupati Sketchers', 'Art', '🎨', 'Urban sketching and watercolour sessions across Tirupati''s temples and streets.', 'Bring your sketchbook and discover the city through art. We sketch temples, streets, markets, and nature spots. All mediums welcome — pencil, ink, watercolour, digital. Monthly exhibitions at local cafes.', 'Kiran Mohan', '1 year running', '👨‍🎨', 'Responds within 12 hrs', 0, '2nd & 4th Sunday, 9:00 AM', 'TTD Kalyanamastu', 'Tirupati', 'casual', '2024', '919000000007', 'yellow', 'Growing', 'Met last weekend', 4, 20, '#e8f5e9', 'weekends', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "clubs" ("id", "name", "category", "emoji", "short_desc", "full_desc", "organizer_name", "organizer_years", "organizer_avatar", "organizer_response", "member_count", "schedule", "location", "city", "vibe", "active_since", "whatsapp_number", "health_status", "health_label", "last_active", "founding_taken", "founding_total", "bg_color", "time_of_day", "is_active", "highlights", "creator_user_id", "co_organiser_user_ids", "join_question_1", "join_question_2", "cover_image_url", "slug", "created_at", "razorpay_contact_id", "razorpay_fund_account_id", "bank_account_name", "bank_account_number", "bank_ifsc", "upi_id", "payout_method", "payouts_enabled", "commission_type", "commission_value", "commission_set_by_admin", "commission_note") VALUES ('2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Tirumala Trekkers', 'Trekking', '🏔️', 'Weekly treks around Tirumala hills and Eastern Ghats. All fitness levels welcome.', 'We''ve been trekking together since 2022. Every Sunday morning we hit a new trail — from Tirumala Ghat roads to Talakona, Gunjana, and Kapila Theertham. We go at the slowest person''s pace. Beginners always welcome.', 'Ravi Kumar', '3 years running', '👨‍🦱', 'Responds within 2 hrs', 0, 'Every Sunday, 5:30 AM', 'Alipiri Gate', 'Tirupati', 'casual', '2022', '919000000001', 'green', 'Very Active', 'Met last Sunday', 16, 20, '#e8f4e8', 'morning', TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-21T17:39:28.822Z', NULL, NULL, NULL, NULL, NULL, NULL, 'bank', FALSE, 'percentage', 700, FALSE, NULL) ON CONFLICT DO NOTHING;

-- user_quiz_answers (1 rows)
INSERT INTO "user_quiz_answers" ("id", "user_id", "interests", "experience_level", "vibe_preference", "availability", "college_or_work", "created_at") VALUES ('23a15025-9853-4912-b5c3-20ded7544c5a', '86c75838-42e1-41bd-b1bd-dfc81d817ef9', '{"Cricket"}', 'beginner', 'moderate', '{"early_morning"}', 'student', '2026-03-22T09:12:54.242Z') ON CONFLICT DO NOTHING;

-- club_faqs (18 rows)
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('f2947d27-4be0-4dcb-9a68-f629d61318c8', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Do I need trekking experience?', 'Not at all! We welcome all fitness levels. We go at the slowest person''s pace and have easier routes for beginners.', 0, '2026-03-21T17:39:28.876Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('c82a943d-293f-40f8-bab4-0d26be4cb824', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'What should I bring?', 'Comfortable shoes, 1-2 litres of water, a light snack, sunscreen, and a cap. We''ll share a detailed checklist when you join.', 1, '2026-03-21T17:39:28.882Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('1d3a86b9-e601-417e-b23a-64beaf48c397', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Is there any fee to join?', 'No membership fee. You only pay for transport if we carpool (usually split equally). Everything else is free.', 2, '2026-03-21T17:39:28.887Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('7b3decdf-e340-44bd-8cfa-084f829bacc2', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'How do you pick the book each month?', 'Members suggest books and we vote in the WhatsApp group. The most voted book wins. We alternate between Telugu and English.', 0, '2026-03-21T17:39:28.892Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('c299f22d-22ab-400b-992a-996f3f8b2223', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'What if I haven''t finished the book?', 'Come anyway! Half the fun is hearing others'' perspectives. No pressure to finish — just bring your thoughts on whatever you read.', 1, '2026-03-21T17:39:28.896Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('86979020-1bbe-4d04-94a4-f9962ffd1719', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'Do I need to buy the book?', 'We share PDFs and audiobook links when available. Some members swap physical copies too.', 2, '2026-03-21T17:39:28.900Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('b950246e-6160-4d92-b200-d768c71e0ffd', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'What kind of bike do I need?', 'Any bike works — road bike, MTB, hybrid, even a regular cycle. As long as it has working brakes, you''re good.', 0, '2026-03-21T17:39:28.904Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('23ea78a8-60f5-4666-a591-c5b09908ead4', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'Is a helmet mandatory?', 'Yes, absolutely. No helmet, no ride. Safety is our number one rule. We can help you find an affordable one.', 1, '2026-03-21T17:39:28.908Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('926d8e74-0209-4c36-aa3d-80ac0dccbc64', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'How far do you ride?', 'Routes range from 20km to 60km. We always have a shorter route option for beginners. Nobody gets left behind.', 2, '2026-03-21T17:39:28.913Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('6e700ed4-589d-48ce-8520-d8cd0cee9437', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Can I join with just a phone camera?', 'Of course! Some of our best shots have been taken on phones. It''s about the eye, not the equipment.', 0, '2026-03-21T17:39:28.920Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('18c59b53-0876-45cf-8a55-6f29aa895ff5', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Do you teach editing?', 'Yes, we run monthly editing workshops covering Lightroom, Snapseed, and basic color grading. All free for members.', 1, '2026-03-21T17:39:28.924Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('9d786453-435f-49f2-a000-62e4e2206126', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Do I need to be fit to join?', 'Nope! We have all ages and levels. The trainers modify exercises for beginners. Just show up and move.', 0, '2026-03-21T17:39:28.927Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('02b1c2cb-dcfd-4b02-bea0-991365661616', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'What should I wear?', 'Comfortable workout clothes, running shoes, and bring a water bottle. We exercise outdoors so dress for the weather.', 1, '2026-03-21T17:39:28.934Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('066441d1-89e1-4f79-afc1-a78b68baf7a4', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Is there a trainer?', 'Yes, we have two certified trainers who volunteer their time. Bootcamp and yoga sessions are instructor-led.', 2, '2026-03-21T17:39:28.937Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('fcbedba9-e042-4f9b-9c93-548e67482bb7', '67ede284-b1df-4f8d-abec-bd3a8a928591', 'Do I have to write in Telugu?', 'No! We welcome writers in both Telugu and English. Many of our members write in both languages.', 0, '2026-03-21T17:39:28.943Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('ab908982-d173-42a0-979d-627b99900ce9', '67ede284-b1df-4f8d-abec-bd3a8a928591', 'Will my work be published?', 'We publish a monthly digital anthology featuring member submissions. Your work gets read by the whole community.', 1, '2026-03-21T17:39:28.946Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('daf52dfc-c258-43a1-b5a9-785c3894d01b', '8c6375d8-98e1-4618-83b7-17ef716db3d4', 'I''m a complete beginner — can I join?', 'Absolutely. Half our members started with zero drawing experience. We have mentors who help beginners with basics.', 0, '2026-03-21T17:39:28.950Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_faqs" ("id", "club_id", "question", "answer", "sort_order", "created_at") VALUES ('b0ddd01a-c391-4cfb-82d0-6ac7015990b5', '8c6375d8-98e1-4618-83b7-17ef716db3d4', 'What materials should I bring?', 'A sketchbook and any pencil/pen. That''s it! As you grow, you can explore watercolours, ink, or digital — but start simple.', 1, '2026-03-21T17:39:28.955Z') ON CONFLICT DO NOTHING;

-- club_schedule_entries (14 rows)
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('32b27549-3d4e-4d01-bbda-4108a0608881', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Sunday', '5:30 AM', '10:00 AM', 'Weekly Trek', 'Alipiri Gate', '2026-03-21T17:39:28.960Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('bbc1ceef-dcf1-4a52-b33c-f2683780b290', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'Saturday', '6:00 PM', '8:00 PM', 'Book Discussion', 'Cafe Tirupati, TP Area', '2026-03-21T17:39:28.963Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('d6315b42-6c81-42c5-92a0-b35cf8982d67', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'Saturday', '5:45 AM', '8:00 AM', 'Weekend Long Ride', 'RTC Bus Stand', '2026-03-21T17:39:28.967Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('0be09419-5177-452c-a256-6ca031aa9de7', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'Sunday', '5:45 AM', '7:30 AM', 'Recovery Ride', 'RTC Bus Stand', '2026-03-21T17:39:28.970Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('e5ea1fd8-4411-48c5-ae88-dac1cd91b37a', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Sunday', '6:00 AM', '9:00 AM', 'Photo Walk', 'Govindaraja Temple Gate', '2026-03-21T17:39:28.973Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('38542af3-1691-4b9f-b931-c9a01982f86a', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Saturday', '4:00 PM', '6:00 PM', 'Editing Workshop', 'Community Hall, TP Area', '2026-03-21T17:39:28.976Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('5e896b0c-755f-4dfd-9334-60105c96fe7e', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Monday', '6:00 AM', '7:00 AM', 'Bootcamp', 'Bairagipatteda Park', '2026-03-21T17:39:28.981Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('1c81cc81-bd6f-4328-a432-71f8ae8d433b', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Tuesday', '6:00 AM', '7:00 AM', 'Yoga', 'Bairagipatteda Park', '2026-03-21T17:39:28.985Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('8869637f-0ad6-4970-afaf-51aabc238bca', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Wednesday', '6:00 AM', '7:00 AM', 'Bootcamp', 'Bairagipatteda Park', '2026-03-21T17:39:28.988Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('b4c2b3d9-9b56-4a97-9efd-162febfdfb86', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Thursday', '6:00 AM', '7:00 AM', 'Yoga', 'Bairagipatteda Park', '2026-03-21T17:39:28.993Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('75417514-a080-4589-b322-195b8002d6bb', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Friday', '6:00 AM', '7:00 AM', 'Bootcamp', 'Bairagipatteda Park', '2026-03-21T17:39:28.996Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('79ce65be-8983-4192-8017-a3e0768dc423', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Saturday', '5:30 AM', '7:00 AM', 'Group Run', 'Bairagipatteda Park', '2026-03-21T17:39:29.001Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('664edebe-20b1-4468-8407-987411426cc7', '67ede284-b1df-4f8d-abec-bd3a8a928591', 'Sunday', '4:00 PM', '6:00 PM', 'Writing Circle', 'District Library', '2026-03-21T17:39:29.004Z') ON CONFLICT DO NOTHING;
INSERT INTO "club_schedule_entries" ("id", "club_id", "day_of_week", "start_time", "end_time", "activity", "location", "created_at") VALUES ('716872ef-942a-4838-ba08-4663aca1f408', '8c6375d8-98e1-4618-83b7-17ef716db3d4', 'Sunday', '9:00 AM', '12:00 PM', 'Urban Sketching', 'TTD Kalyanamastu', '2026-03-21T17:39:29.010Z') ON CONFLICT DO NOTHING;

-- club_moments (17 rows)
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('20ba921f-2071-4596-95d1-1055bda1eb0a', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Welcome to 12 new members who joined this month! Our biggest batch yet.', NULL, 'heart', 0, '2026-03-07T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('144bdc6a-3879-4618-b9b8-1b1ac9179546', '67ede284-b1df-4f8d-abec-bd3a8a928591', 'Open mic night was magical. First-time writers reading their work aloud — so much courage.', NULL, 'heart', 0, '2026-03-08T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('11f79318-f001-417e-8ed1-a6fbdb4d1b76', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'Donated 15 helmets to new members who couldn''t afford one. Safety first, always.', NULL, 'heart', 0, '2026-03-09T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('eb80ce97-1412-4b50-8eac-1dccdad3fe9d', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Our cafe exhibition at Brew & Bite was a hit! 40+ prints displayed, 8 sold.', NULL, '🔥', 0, '2026-03-10T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('620bc8a5-40d6-4559-a4f4-e6f52cb44828', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'New record: 31 members at Saturday''s meetup. Had to pull extra chairs from the cafe!', NULL, '🔥', 0, '2026-03-11T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('61bb7da8-e1d8-4d5e-869e-a01b7c75f9e8', '8c6375d8-98e1-4618-83b7-17ef716db3d4', 'Watercolour workshop with guest artist from Hyderabad. Everyone learned wet-on-wet technique!', NULL, '🔥', 0, '2026-03-12T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('2c0f59e7-b08f-48ab-9a4a-9388edd39bb3', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Group ran 10 km together on Saturday. 5 members hit their first ever 10 km!', NULL, '⭐', 0, '2026-03-13T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('59babb58-d725-4e88-aee3-16c5730c6c3a', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'Talakona waterfall trek completed. 28 km, 6 hours, zero injuries. Proud of this crew.', NULL, '⭐', 0, '2026-03-14T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('195d3fb1-afc0-476a-9d57-d52232df6fec', '67ede284-b1df-4f8d-abec-bd3a8a928591', 'Monthly anthology published! 14 poems and 3 short stories. Our best edition yet.', NULL, '⭐', 0, '2026-03-15T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('6b5b14b6-1ece-4820-b943-364e36379823', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', 'New personal best on the Ghat road route — average speed up to 22 km/h as a group!', NULL, '⭐', 0, '2026-03-16T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('081c3e78-c5a6-4e1b-8f50-893b2e4c8548', 'a54be685-9699-4d29-88a5-983270d72e5d', 'Golden hour shoot at Govindaraja temple — captured some stunning shots. Gallery coming soon!', NULL, '⭐', 0, '2026-03-17T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('bf3885a4-cffc-4c8e-971e-cb10e3caad86', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Yoga Thursday was so peaceful. 30 members under the banyan tree at sunrise.', NULL, 'heart', 0, '2026-03-17T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('4171f8ac-e909-41bd-90b4-75cae216c725', '8c6375d8-98e1-4618-83b7-17ef716db3d4', 'Sketched the Balaji Nagar market chaos. 15 sketchers, 15 completely different perspectives.', NULL, '⭐', 0, '2026-03-18T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('1b5cf11a-5721-4c87-9738-f7189df02e20', 'e64bc534-13f1-4890-85f0-f6ab33491294', 'Just finished discussing ''Maa Nanna Bali'' by Sriramana. Heated debate on the ending — best session yet!', NULL, '⭐', 0, '2026-03-18T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('3a96ef81-6a9e-46d0-a93e-e6cb96c9570c', '2f2d3efb-9782-4b39-9159-37c5fb6a5c80', 'First trek of the year! 42 people showed up at Alipiri Gate at 5:30 AM. Energy was unreal.', NULL, '🔥', 0, '2026-03-19T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('3e0129fd-bc48-442e-812e-12e7c8a66164', 'c75c0116-5da7-4229-8a9b-5b7393f320a3', 'Monday bootcamp hit 45 people today! Park was packed. Love this energy.', NULL, '🔥', 0, '2026-03-20T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "club_moments" ("id", "club_id", "caption", "image_url", "emoji", "likes_count", "created_at", "author_user_id", "author_name") VALUES ('966766b8-b882-4efa-a206-1bd3bfaf13a8', 'fd5017b3-4188-49c5-80a6-9edbc4cbe5ef', '60 km Chandragiri Fort ride done! Beautiful sunrise views. 18 riders completed the route.', NULL, '🔥', 0, '2026-03-20T17:39:28.876Z', NULL, NULL) ON CONFLICT DO NOTHING;

SET session_replication_role = 'origin';