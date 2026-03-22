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
--> statement-breakpoint
CREATE TABLE "club_faqs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "club_polls" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"question" text NOT NULL,
	"options" text[] NOT NULL,
	"is_open" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "club_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "event_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_image_url" text,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_form_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"question" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_form_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "kudos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"giver_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"kudo_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moment_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"user_image_url" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moment_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "section_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX "club_announcements_club_id_idx" ON "club_announcements" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_faqs_club_id_idx" ON "club_faqs" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_moments_club_id_idx" ON "club_moments" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_page_sections_club_id_idx" ON "club_page_sections" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_polls_club_id_idx" ON "club_polls" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_ratings_club_id_idx" ON "club_ratings" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "club_schedule_entries_club_id_idx" ON "club_schedule_entries" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "event_comments_event_id_idx" ON "event_comments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_form_questions_event_id_idx" ON "event_form_questions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_form_responses_event_id_idx" ON "event_form_responses" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_form_responses_user_id_idx" ON "event_form_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_rsvps_event_id_idx" ON "event_rsvps" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_rsvps_user_id_idx" ON "event_rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_rsvps_status_idx" ON "event_rsvps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_ticket_types_event_id_idx" ON "event_ticket_types" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_club_id_idx" ON "events" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "join_requests_club_id_idx" ON "join_requests" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "join_requests_user_id_idx" ON "join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "join_requests_status_idx" ON "join_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "kudos_giver_event_unique" ON "kudos" USING btree ("event_id","giver_id");--> statement-breakpoint
CREATE INDEX "kudos_receiver_id_idx" ON "kudos" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "moment_comments_moment_id_idx" ON "moment_comments" USING btree ("moment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moment_likes_unique" ON "moment_likes" USING btree ("moment_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_is_read_idx" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "platform_transactions_club_id_idx" ON "platform_transactions" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "platform_transactions_user_id_idx" ON "platform_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_transactions_status_idx" ON "platform_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "poll_votes_poll_id_idx" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "section_events_section_id_idx" ON "section_events" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");