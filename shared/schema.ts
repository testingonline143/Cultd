import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export { users, sessions } from "./models/auth";
export type { User, UpsertUser } from "./models/auth";

export const clubs = pgTable("clubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  emoji: text("emoji").notNull(),
  shortDesc: text("short_desc").notNull(),
  fullDesc: text("full_desc").notNull(),
  organizerName: text("organizer_name").notNull(),
  organizerYears: text("organizer_years"),
  organizerAvatar: text("organizer_avatar"),
  organizerResponse: text("organizer_response"),
  memberCount: integer("member_count").notNull().default(0),
  schedule: text("schedule").notNull(),
  location: text("location").notNull(),
  city: text("city").notNull().default("Tirupati"),
  vibe: text("vibe").notNull().default("casual"),
  activeSince: text("active_since"),
  whatsappNumber: text("whatsapp_number"),
  healthStatus: text("health_status").notNull().default("green"),
  healthLabel: text("health_label").notNull().default("Very Active"),
  lastActive: text("last_active"),
  foundingTaken: integer("founding_taken").default(0),
  foundingTotal: integer("founding_total").default(20),
  bgColor: text("bg_color"),
  timeOfDay: text("time_of_day").notNull().default("morning"),
  isActive: boolean("is_active").default(true),
  highlights: text("highlights").array(),
  creatorUserId: varchar("creator_user_id"),
  coOrganiserUserIds: text("co_organiser_user_ids").array(),
  joinQuestion1: text("join_question_1"),
  joinQuestion2: text("join_question_2"),
  coverImageUrl: text("cover_image_url"),
  slug: text("slug").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  // Payment / payout fields
  razorpayContactId: varchar("razorpay_contact_id"),
  razorpayFundAccountId: varchar("razorpay_fund_account_id"),
  bankAccountName: varchar("bank_account_name"),
  bankAccountNumber: varchar("bank_account_number"),
  bankIfsc: varchar("bank_ifsc"),
  upiId: varchar("upi_id"),
  payoutMethod: varchar("payout_method").default("bank"),
  payoutsEnabled: boolean("payouts_enabled").default(false),
  // Commission fields
  commissionType: varchar("commission_type").default("percentage"),
  commissionValue: integer("commission_value").default(700),
  commissionSetByAdmin: boolean("commission_set_by_admin").default(false),
  commissionNote: varchar("commission_note"),
});

export const clubPageSections = pgTable("club_page_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull().default("📌"),
  layout: text("layout").notNull().default("full"),
  position: integer("position").notNull().default(0),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_page_sections_club_id_idx").on(t.clubId)]);

export const sectionEvents = pgTable("section_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: varchar("section_id").notNull(),
  eventId: varchar("event_id").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("section_events_section_id_idx").on(t.sectionId)]);

export const joinRequests = pgTable("join_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  clubName: text("club_name").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  userId: varchar("user_id"),
  status: text("status").notNull().default("pending"),
  markedDone: boolean("marked_done").default(false),
  isFoundingMember: boolean("is_founding_member").default(false),
  answer1: text("answer_1"),
  answer2: text("answer_2"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("join_requests_club_id_idx").on(t.clubId),
  index("join_requests_user_id_idx").on(t.userId),
  index("join_requests_status_idx").on(t.status),
]);

export const userQuizAnswers = pgTable("user_quiz_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  interests: text("interests").array().notNull(),
  experienceLevel: text("experience_level").notNull(),
  vibePreference: text("vibe_preference").notNull(),
  availability: text("availability").array().notNull(),
  collegeOrWork: text("college_or_work"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  locationText: text("location_text").notNull(),
  locationUrl: text("location_url"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  maxCapacity: integer("max_capacity").notNull(),
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").default(true),
  isCancelled: boolean("is_cancelled").default(false),
  recurrenceRule: text("recurrence_rule"),
  formMandatory: boolean("form_mandatory").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("events_club_id_idx").on(t.clubId),
  index("events_starts_at_idx").on(t.startsAt),
]);

export const eventFormQuestions = pgTable("event_form_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  question: text("question").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("event_form_questions_event_id_idx").on(t.eventId)]);

export const eventFormResponses = pgTable("event_form_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  questionId: varchar("question_id").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("event_form_responses_event_id_idx").on(t.eventId),
  index("event_form_responses_user_id_idx").on(t.userId),
]);

export const eventTicketTypes = pgTable("event_ticket_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  eventId: varchar("event_id").notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("event_ticket_types_event_id_idx").on(t.eventId)]);

export const eventRsvps = pgTable("event_rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("going"),
  checkinToken: varchar("checkin_token").default(sql`gen_random_uuid()`),
  checkedIn: boolean("checked_in").default(false),
  checkedInAt: timestamp("checked_in_at"),
  ticketTypeId: integer("ticket_type_id"),
  ticketTypeName: text("ticket_type_name"),
  createdAt: timestamp("created_at").defaultNow(),
  // Payment fields
  razorpayOrderId: varchar("razorpay_order_id"),
  razorpayPaymentId: varchar("razorpay_payment_id"),
  paymentStatus: varchar("payment_status").default("free"),
}, (t) => [
  index("event_rsvps_event_id_idx").on(t.eventId),
  index("event_rsvps_user_id_idx").on(t.userId),
  index("event_rsvps_status_idx").on(t.status),
]);

export const clubRatings = pgTable("club_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  userId: varchar("user_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_ratings_club_id_idx").on(t.clubId)]);

export const clubFaqs = pgTable("club_faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_faqs_club_id_idx").on(t.clubId)]);

export const clubScheduleEntries = pgTable("club_schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  activity: text("activity").notNull(),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_schedule_entries_club_id_idx").on(t.clubId)]);

export const clubMoments = pgTable("club_moments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  caption: text("caption").notNull(),
  imageUrl: text("image_url"),
  emoji: text("emoji"),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  authorUserId: varchar("author_user_id"),
  authorName: text("author_name"),
}, (t) => [index("club_moments_club_id_idx").on(t.clubId)]);

export const momentLikes = pgTable("moment_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  momentId: varchar("moment_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [uniqueIndex("moment_likes_unique").on(t.momentId, t.userId)]);

export const momentComments = pgTable("moment_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  momentId: varchar("moment_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userImageUrl: text("user_image_url"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("moment_comments_moment_id_idx").on(t.momentId)]);

export const eventComments = pgTable("event_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userImageUrl: text("user_image_url"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("event_comments_event_id_idx").on(t.eventId)]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  linkUrl: text("link_url"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
  index("notifications_is_read_idx").on(t.isRead),
]);

export const clubAnnouncements = pgTable("club_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  authorUserId: varchar("author_user_id").notNull(),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isPinned: boolean("is_pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_announcements_club_id_idx").on(t.clubId)]);

export const clubPolls = pgTable("club_polls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clubId: varchar("club_id").notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  isOpen: boolean("is_open").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("club_polls_club_id_idx").on(t.clubId)]);

export const pollVotes = pgTable("poll_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pollId: varchar("poll_id").notNull(),
  userId: varchar("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("poll_votes_poll_id_idx").on(t.pollId)]);

export const kudos = pgTable("kudos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  giverId: varchar("giver_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  kudoType: text("kudo_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("kudos_giver_event_unique").on(t.eventId, t.giverId),
  index("kudos_receiver_id_idx").on(t.receiverId),
]);

export const clubProposals = pgTable("club_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  clubName: text("club_name").notNull(),
  category: text("category").notNull(),
  vibe: text("vibe").notNull().default("casual"),
  shortDesc: text("short_desc").notNull(),
  city: text("city").notNull().default("Tirupati"),
  schedule: text("schedule").notNull(),
  motivation: text("motivation").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").defaultNow(),
  // Commission fields set by admin during approval
  suggestedCommissionType: varchar("suggested_commission_type"),
  suggestedCommissionValue: integer("suggested_commission_value"),
  commissionNote: varchar("commission_note"),
});

export const platformTransactions = pgTable("platform_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  rsvpId: varchar("rsvp_id").notNull(),
  clubId: varchar("club_id").notNull(),
  userId: varchar("user_id").notNull(),
  razorpayOrderId: varchar("razorpay_order_id").notNull(),
  razorpayPaymentId: varchar("razorpay_payment_id").notNull(),
  razorpayTransferId: varchar("razorpay_transfer_id"),
  totalAmount: integer("total_amount").notNull(),
  baseAmount: integer("base_amount").notNull(),
  platformFee: integer("platform_fee").notNull(),
  currency: varchar("currency").notNull().default("INR"),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("platform_transactions_club_id_idx").on(t.clubId),
  index("platform_transactions_user_id_idx").on(t.userId),
  index("platform_transactions_status_idx").on(t.status),
]);

export const insertEventFormQuestionSchema = createInsertSchema(eventFormQuestions).omit({ id: true, createdAt: true });
export const insertEventFormResponseSchema = createInsertSchema(eventFormResponses).omit({ id: true, createdAt: true });
export const insertEventTicketTypeSchema = createInsertSchema(eventTicketTypes).omit({ createdAt: true });
export const insertPlatformTransactionSchema = createInsertSchema(platformTransactions).omit({ id: true, createdAt: true });

export const insertClubSchema = createInsertSchema(clubs).omit({ id: true, createdAt: true });
export const insertJoinRequestSchema = createInsertSchema(joinRequests).omit({ id: true, createdAt: true });
export const insertQuizAnswersSchema = createInsertSchema(userQuizAnswers).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({ id: true, checkinToken: true, createdAt: true });
export const insertClubRatingSchema = createInsertSchema(clubRatings).omit({ id: true, createdAt: true });
export const insertClubFaqSchema = createInsertSchema(clubFaqs).omit({ id: true, createdAt: true });
export const insertClubScheduleEntrySchema = createInsertSchema(clubScheduleEntries).omit({ id: true, createdAt: true });
export const insertClubMomentSchema = createInsertSchema(clubMoments).omit({ id: true, createdAt: true });
export const insertMomentCommentSchema = createInsertSchema(momentComments).omit({ id: true, createdAt: true });
export const insertEventCommentSchema = createInsertSchema(eventComments).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertClubAnnouncementSchema = createInsertSchema(clubAnnouncements).omit({ id: true, createdAt: true });
export const insertClubPollSchema = createInsertSchema(clubPolls).omit({ id: true, createdAt: true });
export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({ id: true, createdAt: true });
export const insertKudoSchema = createInsertSchema(kudos).omit({ id: true, createdAt: true });
export const insertClubPageSectionSchema = createInsertSchema(clubPageSections).omit({ id: true, createdAt: true });
export const insertSectionEventSchema = createInsertSchema(sectionEvents).omit({ id: true, createdAt: true });
export const insertClubProposalSchema = createInsertSchema(clubProposals).omit({ id: true, createdAt: true, status: true, reviewNote: true });

export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;
export type QuizAnswers = typeof userQuizAnswers.$inferSelect;
export type InsertQuizAnswers = z.infer<typeof insertQuizAnswersSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type ClubRating = typeof clubRatings.$inferSelect;
export type InsertClubRating = z.infer<typeof insertClubRatingSchema>;
export type ClubFaq = typeof clubFaqs.$inferSelect;
export type InsertClubFaq = z.infer<typeof insertClubFaqSchema>;
export type ClubScheduleEntry = typeof clubScheduleEntries.$inferSelect;
export type InsertClubScheduleEntry = z.infer<typeof insertClubScheduleEntrySchema>;
export type ClubMoment = typeof clubMoments.$inferSelect;
export type InsertClubMoment = z.infer<typeof insertClubMomentSchema>;
export type MomentComment = typeof momentComments.$inferSelect;
export type InsertMomentComment = z.infer<typeof insertMomentCommentSchema>;
export type EventComment = typeof eventComments.$inferSelect;
export type InsertEventComment = z.infer<typeof insertEventCommentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type ClubAnnouncement = typeof clubAnnouncements.$inferSelect;
export type InsertClubAnnouncement = z.infer<typeof insertClubAnnouncementSchema>;
export type ClubPoll = typeof clubPolls.$inferSelect;
export type InsertClubPoll = z.infer<typeof insertClubPollSchema>;
export type PollVote = typeof pollVotes.$inferSelect;
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type Kudo = typeof kudos.$inferSelect;
export type InsertKudo = z.infer<typeof insertKudoSchema>;
export type ClubPageSection = typeof clubPageSections.$inferSelect;
export type InsertClubPageSection = z.infer<typeof insertClubPageSectionSchema>;
export type SectionEvent = typeof sectionEvents.$inferSelect;
export type InsertSectionEvent = z.infer<typeof insertSectionEventSchema>;
export type ClubProposal = typeof clubProposals.$inferSelect;
export type InsertClubProposal = z.infer<typeof insertClubProposalSchema>;
export type EventFormQuestion = typeof eventFormQuestions.$inferSelect;
export type InsertEventFormQuestion = z.infer<typeof insertEventFormQuestionSchema>;
export type EventFormResponse = typeof eventFormResponses.$inferSelect;
export type InsertEventFormResponse = z.infer<typeof insertEventFormResponseSchema>;
export type EventTicketType = typeof eventTicketTypes.$inferSelect;
export type InsertEventTicketType = z.infer<typeof insertEventTicketTypeSchema>;
export type PlatformTransaction = typeof platformTransactions.$inferSelect;
export type InsertPlatformTransaction = z.infer<typeof insertPlatformTransactionSchema>;

export const CATEGORIES = [
  "Trekking",
  "Books",
  "Cycling",
  "Photography",
  "Fitness",
  "Art",
  "Football",
  "Cricket",
  "Chess",
  "Music",
  "Gaming",
  "Dance",
  "Cooking",
  "Yoga",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<string, string> = {
  Trekking: "🏔️",
  Books: "📚",
  Cycling: "🚴",
  Photography: "📷",
  Fitness: "💪",
  Art: "🎨",
  Football: "⚽",
  Cricket: "🏏",
  Chess: "♟️",
  Music: "🎵",
  Gaming: "🎮",
  Dance: "💃",
  Cooking: "🍳",
  Yoga: "🧘",
};

export const CITIES = [
  "Tirupati",
  "Chennai",
  "Bengaluru",
  "Hyderabad",
  "Kochi",
  "Vizag",
  "Vijayawada",
  "Nellore",
  "Guntur",
  "Warangal",
  "Coimbatore",
] as const;

export type City = (typeof CITIES)[number];

export const HOBBY_ICONS: { name: string; emoji: string }[] = [
  { name: "Football", emoji: "⚽" },
  { name: "Cricket", emoji: "🏏" },
  { name: "Chess", emoji: "♟️" },
  { name: "Music", emoji: "🎵" },
  { name: "Books", emoji: "📚" },
  { name: "Gaming", emoji: "🎮" },
  { name: "Dance", emoji: "💃" },
  { name: "Photography", emoji: "📷" },
  { name: "Trekking", emoji: "🏔️" },
  { name: "Art", emoji: "🎨" },
  { name: "Cooking", emoji: "🍳" },
  { name: "Yoga", emoji: "🧘" },
];
