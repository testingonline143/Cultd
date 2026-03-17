# CultFam - Tirupati Club Discovery Platform

## Overview

CultFam is a club discovery platform for Indian cities. It helps users find and join local community clubs (trekking, books, cycling, photography, fitness, art, etc.). The landing page features a bold dark gradient hero with floating category icons, a category showcase grid, horizontally scrolling club cards, a simplified 3-step "How It Works" section, and a dark organizer CTA section.

The project follows a full-stack TypeScript monorepo pattern with a React frontend, Express backend, and PostgreSQL database.

## User Preferences

Preferred communication style: Simple, everyday language.
Design preference: Warm editorial design with cream background (#F5F0E8) and terra cotta accent (#C4622D). Playfair Display (`font-display`) for serif headings, Outfit (`font-sans`) for body text, Bebas Neue (`font-mono`) for display numbers/stats. Ink (#1A1410) for dark text, gold (#C9A84C) for ratings/highlights. Cards use warm-white (#FDFAF5) with subtle warm borders (rgba(26,20,16,0.1)). Custom Tailwind colors: `terra`, `ink`, `gold`, `cream`. CSS utility classes: `glass-card` (warm white card with border), `neon-text` (terra text), `neon-glow` (warm shadow), `neon-border` (terra-tinted border). Single light theme (no dark mode). Emojis used for category icons.

## System Architecture

### Frontend (client/)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter — pages: Home (/), Explore (/explore), Events (/events), Create (/create), Profile (/profile), Admin (/admin), Organizer Dashboard (/organizer), Onboarding Quiz (/onboarding), Matched Clubs (/matched-clubs), Club Detail (/club/:id), Event Detail (/event/:id), Scan Event (/scan/:eventId), Public Club Page (/c/:slug), Page Builder (/organizer/page-builder?club=ID), 404
- **Navigation**: Landing page (/) uses scroll-aware top Navbar (transparent over dark hero, solid cream after scroll). Inner app pages use fixed bottom tab bar (`client/src/components/bottom-nav.tsx`). **Regular users** see 5 tabs: HOME (/home), EXPLORE (/explore), EVENTS (/events), ALERTS (/notifications), PROFILE (/profile). **Organizers/admins** see 6 tabs: HOME, EXPLORE, EVENTS, ALERTS, DASHBOARD (/organizer), PROFILE. Bell icon shows unread notification count badge. Bottom nav visible on /organizer, /create, /notifications. HOME tab (/home) shows a clean mobile feed with city selector pills, "Find Your Tribe" masthead, "Happening Today", and "Trending Clubs". Admin/onboarding/club-detail/event-detail pages use top Navbar only. Regular users access club creation via "Start a Club" CTA on Explore page (links to /create).
- **Styling**: Tailwind CSS with CSS variables for theming (warm cream editorial design, single light theme)
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives, stored in `client/src/components/ui/`
- **Animations**: Framer Motion for scroll-triggered animations and transitions
- **State Management**: TanStack React Query for server state; React useState for local state
- **Auth**: Replit Auth integration via `client/src/hooks/use-auth.ts` — uses session cookies, fetches user from `/api/auth/user`. Supports Google, GitHub, Apple, and email sign-in via `/api/login`.
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers
- **Build Tool**: Vite with React plugin
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend (server/)
- **Framework**: Express 5 on Node.js with TypeScript (run via tsx)
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Auth**: Replit Auth via `server/replit_integrations/auth/` — `setupAuth(app)` configures session middleware + OpenID Connect; `isAuthenticated` middleware protects routes; user data accessed via `req.user.claims.sub`
- **Endpoints**:
  - `GET /api/auth/user` — get current authenticated user
  - `GET /api/login` — redirect to Replit Auth login
  - `GET /api/logout` — logout and clear session
  - `GET /api/clubs` — list all clubs (supports `?category=` query param for filtering)
  - `GET /api/clubs/:id` — get single club with full details
  - `POST /api/join` — submit a join request (authenticated); creates with status 'pending' (does NOT auto-increment counts); duplicate prevention by userId+clubId; rejected requests can be re-submitted
  - `POST /api/clubs/create` — **instant club creation** (authenticated, creates live club immediately, sets creatorUserId)
  - `GET /api/organizer/my-club` — get authenticated user's club (by creatorUserId)
  - `GET /api/organizer/join-requests/:clubId` — get join requests for organizer's club (authenticated, verifies ownership)
  - `PATCH /api/organizer/join-requests/:id/contacted` — mark join request as contacted
  - `PATCH /api/organizer/join-requests/:id/approve` — approve a join request (increments memberCount and foundingTaken)
  - `PATCH /api/organizer/join-requests/:id/reject` — reject a join request
  - `DELETE /api/organizer/clubs/:clubId/members/:requestId` — remove a member (decrements counts)
  - `GET /api/organizer/clubs/:clubId/members` — get approved members for a club
  - `GET /api/organizer/clubs/:clubId/pending-count` — get pending request count for a club
  - `DELETE /api/clubs/:id/leave` — leave a club (authenticated user, decrements counts)
  - `GET /api/clubs/:id/join-status` — get current user's join status for a club
  - `PATCH /api/organizer/club/:id` — update club details (authenticated, verifies ownership)
  - `POST /api/clubs/:id/events` — create event for a club (authenticated, verifies ownership)
  - `GET /api/admin/clubs` — list all clubs for admin monitoring (admin only)
  - `PATCH /api/admin/clubs/:id/deactivate` — deactivate a club (admin only)
  - `PATCH /api/admin/clubs/:id/activate` — reactivate a club (admin only)
  - `GET /api/admin/join-requests` — list all join requests, newest first (admin only)
  - `PATCH /api/admin/join-requests/:id/done` — mark join request as done (admin only)
  - `POST /api/admin/join-requests/:id/approve` — approve a join request directly (admin only, body: { clubId })
  - `POST /api/admin/join-requests/:id/reject` — reject a join request (admin only)
  - `GET /api/admin/analytics` — full platform analytics incl. moments/comments/weekly growth (admin only)
  - `GET /api/admin/activity-feed` — recent joins, clubs, events activity (admin only)
  - `PATCH /api/admin/events/:eventId/restore` — restore a cancelled event (admin only)
  - `GET /api/admin/users/:id/detail` — user detail: clubs, events, moments, join history (admin only)
  - `GET /api/admin/polls` — all club polls platform-wide with vote counts (admin only)
  - `PATCH /api/admin/polls/:id/close` — close any poll (admin only)
  - `POST /api/admin/broadcast` — send notification to all users (body: title, message, linkUrl?) (admin only)
  - `GET /api/admin/growth` — 8-week new users/events/moments per week (admin only)
  - `PATCH /api/admin/clubs/:id/health` — override club healthStatus and healthLabel (admin only)
  - `PATCH /api/user/profile` — update authenticated user's name and bio
  - `GET /api/user/join-requests` — get authenticated user's join requests
  - `GET /api/user/events` — get authenticated user's RSVP'd events
  - `GET /api/stats` — returns live platform stats (5-minute cache)
  - `GET /api/events` — list upcoming events with RSVP arrays (supports ?city=&limit= params)
  - `GET /api/events/:id` — get single event with rsvps and club info
  - `GET /api/clubs/:id/events` — get events for a specific club
  - `POST /api/events/:id/rsvp` — RSVP to an event (authenticated, requires approved club membership)
  - `DELETE /api/events/:id/rsvp` — cancel RSVP (authenticated)
  - `GET /api/rsvps/:rsvpId/qr` — generate personal QR ticket PNG for an RSVP (authenticated, owner only)
  - `POST /api/checkin` — organizer scans member QR to check them in (authenticated, organizer only, body: { token })
  - `GET /api/events/:id/attendance` — get attendance summary with attendee list (organizer only)
  - `GET /api/events/:id/attendees` — get attendees with check-in status (organizer only)
  - `POST /api/quiz` — submit quiz answers (authenticated)
  - `GET /api/quiz/matches` — get matched clubs based on quiz answers (authenticated)
  - `GET /api/clubs/:id/activity` — get club activity signals
  - `GET /api/activity/feed` — get recent platform-wide join activity
  - `GET /api/clubs-with-activity` — get all clubs with recentJoins count
  - `GET /api/clubs/:id/members` — public list of approved members with foundingMember flag
  - `POST /api/moments/:id/like` — like a moment (auth); `DELETE` — unlike
  - `GET /api/moments/:id/like-status` — check like status for current user
  - `GET /api/events/:id/comments` — public event discussion comments
  - `POST /api/events/:id/comments` — post event comment (auth, max 300 chars)
  - `GET /api/user/founding-status` — list clubs where user is a founding member
  - `GET /api/organizer/my-clubs` — get ALL clubs created by authenticated user (for multi-club support)
  - `GET /api/clubs/:id/ratings` — get average rating + user's existing rating (if authenticated)
  - `POST /api/clubs/:id/ratings` — submit/update 1-5 star rating with optional review (authenticated)
  - `GET /api/clubs/:id/faqs` — get club FAQs ordered by sort order
  - `POST /api/clubs/:id/faqs` — add FAQ (organizer only, verifies creatorUserId)
  - `PATCH /api/clubs/:id/faqs/:faqId` — update FAQ (organizer only, verifies record belongs to club)
  - `DELETE /api/clubs/:id/faqs/:faqId` — delete FAQ (organizer only, verifies record belongs to club)
  - `GET /api/clubs/:id/schedule` — get club schedule entries
  - `POST /api/clubs/:id/schedule` — add schedule entry (organizer only)
  - `PATCH /api/clubs/:id/schedule/:entryId` — update schedule entry (organizer only, verifies record belongs to club)
  - `DELETE /api/clubs/:id/schedule/:entryId` — delete schedule entry (organizer only, verifies record belongs to club)
  - `GET /api/clubs/:id/moments` — get club moments (newest first)
  - `POST /api/clubs/:id/moments` — add moment with caption + optional emoji (organizer only)
  - `DELETE /api/clubs/:id/moments/:momentId` — delete moment (organizer only, verifies record belongs to club)
  - `GET /api/clubs/:id/join-count` — get count of join requests for a club
  - `GET /api/notifications` — get authenticated user's notifications (newest first)
  - `GET /api/notifications/unread-count` — get unread notification count for authenticated user
  - `PATCH /api/notifications/:id/read` — mark a single notification as read
  - `PATCH /api/notifications/read-all` — mark all notifications as read for authenticated user
  - `PATCH /api/clubs/:clubId/events/:eventId` — edit event details (organizer only, cannot edit cancelled events)
  - `DELETE /api/clubs/:clubId/events/:eventId` — cancel event (sets isCancelled=true, organizer only)
  - `GET /api/clubs/:id/members-preview` — get first 10 approved members (name, profileImageUrl) for social proof
  - `GET /api/admin/analytics` — platform-wide analytics (user/club/event/rsvp/checkin counts, city breakdown) (admin only)
  - `GET /api/admin/users` — list all users with role, city, club count (admin only)
  - `PATCH /api/admin/users/:id/role` — change user role to user/organiser/admin (admin only)
  - `GET /api/admin/events` — list all events with club info, rsvp/checkin counts (admin only)
  - `GET /api/organizer/clubs/:clubId/insights` — organizer insights (member/event stats, attendance rate, top event, recent activity)
  - `GET /api/organizer/clubs/:clubId/analytics` — rich analytics (memberGrowth 8-week, perEventStats with attendance rates, mostActiveMembers top 5, engagementRate, noShowRate)
  - `DELETE /api/admin/events/:eventId` — cancel any event (admin only)
  - `PATCH /api/clubs/:id/moments/:momentId` — edit moment caption/emoji (organizer only)
  - `GET /api/user/attendance-stats` — per-club attendance stats for authenticated user (attended/totalRsvps per club)
  - `GET /api/clubs/:id/members` — member directory for authenticated approved members or club owner
  - `POST /api/events/:id/rsvp` — **extended**: creates "waitlisted" status when event is at capacity; promotes first waitlisted user when capacity frees up (via DELETE /api/events/:id/rsvp); GET /api/events/:id returns `waitlistCount` and `myRsvp` with status
  - `POST /api/checkin` — QR token check-in; validates token against eventId, marks RSVP checkedIn=true
  - `POST /api/checkin/manual` — manual check-in by rsvpId (organizer only); for when QR scan fails or phone is dead
  - `GET /api/events/:id/attendance` — returns totalRsvps, checkedIn, notYetArrived, attendees list (with rsvpId, name, checkedIn, checkedInAt)
- **Validation**: Zod schemas generated from Drizzle table definitions via drizzle-zod
- **Dev Server**: Vite middleware is used in development for HMR; static file serving in production
- **Build**: esbuild bundles the server to `dist/index.cjs`; Vite builds client to `dist/public/`

### Database
- **Database**: PostgreSQL (required, connected via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-orm/node-postgres` driver
- **Schema Location**: `shared/schema.ts` re-exports from `shared/models/auth.ts` — shared between client and server
- **Tables**:
  - `users` — id (UUID), email (unique), firstName, lastName, profileImageUrl, bio, city, **role** (text, default 'user', values: 'user'|'organiser'|'admin'), quizCompleted, createdAt, updatedAt
  - `sessions` — sid (PK), sess (jsonb), expire (timestamp) — used by express-session for Replit Auth
  - `clubs` — id (UUID), name, category, emoji, shortDesc, fullDesc, organizerName, organizerYears, organizerAvatar, organizerResponse, memberCount, schedule, location, city, vibe, activeSince, whatsappNumber, healthStatus, healthLabel, lastActive, foundingTaken, foundingTotal, bgColor, timeOfDay, isActive, highlights (text[]), **creatorUserId** (links to auth user), **coOrganiserUserIds** (text[], nullable), **joinQuestion1/joinQuestion2** (text, nullable), coverImageUrl, **slug** (text, nullable — URL-safe identifier for public page), createdAt
  - `join_requests` — id (UUID), clubId, clubName, name, phone, userId (nullable, links to auth user — stores who submitted the join request), markedDone, **status** (text, default 'pending', values: 'pending'|'approved'|'rejected'), **answer1/answer2** (text, nullable — join question answers), createdAt
  - `club_announcements` — id (UUID), clubId, authorUserId, authorName, title (text), body (text), isPinned (boolean, default false), createdAt
  - `club_polls` — id (UUID), clubId, question (text), options (text[]), isOpen (boolean, default true), createdAt
  - `poll_votes` — id (UUID), pollId, userId, optionIndex (integer), createdAt. Unique on pollId+userId (one vote per user per poll)
  - `user_quiz_answers` — id (UUID), userId, interests (text[]), experienceLevel, vibePreference, availability (text[]), collegeOrWork, createdAt
  - `events` — id (UUID), clubId, title, description, locationText, locationUrl, startsAt, endsAt, maxCapacity, coverImageUrl, isPublic, isCancelled (boolean, default false), **recurrenceRule** (text, nullable: "weekly"|"biweekly"|"monthly"), createdAt
  - `notifications` — id (UUID), userId, type (text: "join_approved"|"join_rejected"|"new_event"), title, message, linkUrl, isRead (boolean, default false), createdAt
  - `event_rsvps` — id (UUID), eventId, userId, status, checkinToken (UUID, auto-generated), checkedIn, checkedInAt, createdAt
  - `club_ratings` — id (UUID), clubId, userId, rating (integer 1-5), review (text, optional), createdAt. Unique constraint on clubId+userId (one rating per user per club, upsert on conflict).
  - `club_faqs` — id (UUID), clubId, question (text), answer (text), sortOrder (integer, default 0), createdAt
  - `club_schedule_entries` — id (UUID), clubId, dayOfWeek (text), startTime (text), endTime (text), activity (text), location (text), createdAt
  - `club_moments` — id (UUID), clubId, caption (text), imageUrl (text, nullable), emoji (text, nullable), createdAt
  - `club_page_sections` — id (UUID), clubId, title (text), description (text, nullable), emoji (text, default "📌"), layout (text, default "full"), position (integer), isVisible (boolean, default true), createdAt
  - `section_events` — id (UUID), sectionId, eventId, position (integer), createdAt
- **Migrations**: Raw SQL migrations applied in server startup; drizzle-kit for reference
- **Seeding**: `server/seed.ts` contains hardcoded club data for initial population

### Shared Code (shared/)
- `shared/schema.ts` re-exports users/sessions from `shared/models/auth.ts`, defines all other Drizzle tables, Zod insert schemas, TypeScript types, CATEGORIES, CITIES constants
- `shared/models/auth.ts` defines the `users` and `sessions` tables with Replit Auth-compatible schema
- This is imported by both client and server via the `@shared/` path alias

### Storage Layer
- `server/storage.ts` defines an `IStorage` interface and `DatabaseStorage` class implementing it
- All database access goes through this storage abstraction
- Key methods: getClubs, getClubsByCreator, incrementMemberCount, decrementMemberCount, createJoinRequest, approveJoinRequest, rejectJoinRequest, deleteJoinRequest, getJoinRequest, getJoinRequestsByUser, getPendingJoinRequestCount, getApprovedMembersByClub, hasExistingJoinRequest, getUserJoinStatus, hasUserJoinedClub (only counts approved), markJoinRequestDone, updateClub, createClub, createEvent, createRsvp, checkInRsvp, getClubAverageRating, getUserRating, upsertRating, getClubFaqs, createFaq, updateFaq, deleteFaq, getClubSchedule, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, getClubMoments, createMoment, updateMoment, deleteMoment, getJoinRequestCountByClub (only counts approved), getAdminAnalytics, getAllUsers, getAllEventsAdmin, getOrganizerInsights, getClubAnalytics (memberGrowth/perEventStats/mostActiveMembers/engagementRate/noShowRate)

### Auth System
- **Replit Auth**: Uses OpenID Connect via `server/replit_integrations/auth/` (auto-generated integration)
- **Session**: express-session with connect-pg-simple, stored in `sessions` table
- **User Model**: Users are upserted on login via Replit Auth callback (id, email, firstName, lastName, profileImageUrl)
- **Frontend Hook**: `client/src/hooks/use-auth.ts` — `useAuth()` returns `{ user, isLoading, isAuthenticated, logout }`
- **Protected Routes**: Backend uses `isAuthenticated` middleware; frontend checks `isAuthenticated` flag
- **Old auth removed**: No more OTP, phone-based auth, localStorage sessions, or x-user-id headers

### Theme System
- Single warm light theme — no dark mode toggle
- ThemeProvider in `client/src/components/theme-provider.tsx` enforces light mode
- CSS variables defined in `client/src/index.css` with warm cream/terra palette
- Custom CSS vars: `--terra`, `--terra-light`, `--terra-pale`, `--ink`, `--cream`, `--gold`, `--warm-white`, `--warm-border`, `--warm-shadow`
- Google Fonts: Playfair Display (serif headings), Outfit (body), Bebas Neue (display numbers)

### Key Features
- **Instant club creation**: Authenticated users fill a rich form (name, category, description, schedule, location, organizer name, WhatsApp, city) → club goes live immediately → redirected to organizer dashboard
- **Membership approval flow**: Join requests start as 'pending'. Organizers approve/reject from dashboard. Member count and founding spots only increment on approval. Users can leave clubs (decrements counts). Organizers can remove members. Duplicate join prevention by userId+clubId.
- **RSVP gating**: Only approved club members (or the club creator) can RSVP to club events. Non-members see an error with a link to the club page.
- **Admin dashboard** (/admin): Requires Replit Auth + `ADMIN_USER_ID` env var match. Tabbed interface: Analytics (platform-wide stats grid + city breakdown), Clubs (monitor/deactivate/activate), Users (search, view, change roles), Events (all events across clubs with status/attendance), Requests (join requests). Non-admin users see "Access Denied"
- **Replit Auth sign-in**: Google, GitHub, Apple, email sign-in via `/api/login`; session-based auth
- **Organizer dashboard** (/organizer): Identifies organizer by creatorUserId; club overview with quick action cards (pending requests, create event, next event with RSVP fill-rate progress bar + "Filling up!" badge), manage join requests with CSV member export, create events, edit club details, QR codes for events, attendance tracking. **Insights tab** has 6 sections: Key Metrics (4 stat boxes), Engagement Health (engagement rate + no-show rate), 8-week Member Growth CSS bar chart, Per-Event Attendance Breakdown (horizontal progress bars), Top Members (ranked by RSVP count), Recent Activity (top event + recent joins/RSVPs). Overview tab city stat box replaces old schedule box; schedule moved to club header card.
- **Onboarding quiz** (/onboarding): 5-step quiz (interests, availability, vibe, experience, user type) with progress bar, slide transitions, loading screen → matched clubs page
- **Quiz gate**: New users redirected to quiz after first login; returning users skip quiz. "Redo Quiz" option in profile.
- **Club detail page** (/club/:id): Dedicated shareable page with full club info, italic tagline (shortDesc), founding member spots card, 3-col stats (Members/Active/Rating with Bebas Neue), horizontal tab bar (Meet-ups/Schedule/Moments/About/FAQs), "Usually Meet At" venue card, events listing, join form, organizer info, WhatsApp link, sticky "Join the Tribe" bottom bar
- **Explore page** (/explore): Search, category/city/vibe filters, uses shared `ClubCard` component with health status, founding spots, and recent joins; gradient scroll hint on category filter bar
- **Deactivated club handling**: Club detail page and modal show "inactive" notice for deactivated clubs; explore page filters them out
- **Authenticated joins**: `POST /api/join` requires authentication; join forms show "Sign In to Join" for unauthenticated users; WhatsApp purpose explained in form
- **Events system**: Organizers create events with QR codes, users RSVP, homepage shows upcoming events. **Event duplication**: organizers can one-tap duplicate any event (past or upcoming) — pre-fills title, description, location, and capacity into the create form with a new date picker. "Duplicating from" banner shows source event and can be cleared.
- **Public event pages** (/event/:id): Standalone shareable event detail page with dark hero gradient, category+club tag, avatar-stack joining pill with spots-left badge, info cards (Date & Time, Location with Maps link), host card with crown icon and WhatsApp "Talk" button, "About This Meet-up" in bordered card, "People Coming" section with user names from RSVP data, sticky bottom bar with spots counter and "Book My Spot" CTA. Post-RSVP "You're in!" celebration with WhatsApp share prompt. Event cards on homepage and club detail page are clickable and link to event detail page.
- **QR ticket check-in** (organizer scans member): Members get personal QR ticket after RSVP (shown on event detail page via `/api/rsvps/:rsvpId/qr` AND via "Show Ticket" button on profile page). Organizers open `/scan/:eventId` to scan member QR codes with phone camera (html5-qrcode). Each QR encodes `{ token, eventId, userId }` — token validated server-side via `POST /api/checkin`. Live attendance dashboard with real-time counts and attendee list. **Organizer UX enhancements**: "EVENT TODAY" dark banner with large "Check In Attendees" CTA auto-surfaces on event day; event cards have prominent "Scan & Check In" primary button with "Copy scanner link" for sharing with co-organizers; past events show attendance summary with progress bar and percentage; Edit/Duplicate/Cancel are secondary actions.
- **WhatsApp sharing**: Share buttons on club cards, detail pages, event pages, and modals using Web Share API with WhatsApp fallback. Post-RSVP share prompts on event cards and event detail page.
- **Open Graph meta tags**: Server-side OG tags for club pages and event pages (bot detection) for rich previews on WhatsApp/social media. Event OG tags include date, time, location, and club name.
- **Profile page** (/profile): Editable name + bio (200 char), profile photo upload (tap avatar to change, multer + /uploads/ static serving, max 5MB, jpeg/png/webp/gif), joined clubs list, RSVP'd events with "Show Ticket" QR access for upcoming events and Attended/Missed badges for past events, request history, redo quiz button, **Attendance History section** (per-club attendance rate with progress bar, via `/api/user/attendance-stats`)
- **Live stats**: Homepage stats bar shows real counts from DB (totalMembers, totalClubs, upcomingEvents) with 5-minute cache
- **Multi-city**: Supports Tirupati, Chennai, Bengaluru, Hyderabad, Kochi, Vizag, Vijayawada, Nellore, Guntur, Warangal, Coimbatore. Home feed has city selector pills with localStorage persistence.
- **In-app notifications**: Bell icon (ALERTS tab) in bottom nav with unread count badge. Notifications created when: join request approved/rejected, new event created for club members. Notifications page shows all notifications with read/unread styling, mark-as-read on click, "Mark All Read" button.
- **Event management**: Organizers can edit event details (title, description, location, date, capacity) and cancel events from dashboard. Cancelled events shown greyed out with "Cancelled" badge and hidden from public listings.
- **Enhanced club editing**: Organizers can edit full description, organizer name, and WhatsApp number from dashboard in addition to existing fields.
- **Social proof / Activity signals**: "X joined this week" badge on club cards, member preview section on club detail (avatars + names of first 10 members), reviews highlight card (average rating + count), enhanced moments feed with timestamps and context icons, Club Highlights editable by organizers
- **Mobile-first app layout**: Bottom tab bar navigation (Home/Explore/Events/Create/Profile), pages designed as focused views — Home is a feed with "Find Your Tribe" masthead and "Trending Clubs", Explore has full-width image-style club cards, Events has calendar-style cards with filters, Create has tabbed New Club / New Event forms
- **WhatsApp button prominence**: Full-width green "Chat on WhatsApp" button on club detail page, placed between stats grid and tabs, visible to all users (unauthenticated and members alike)
- **Recurring events**: `recurrenceRule` field on events (weekly/biweekly/monthly); when creating a recurring event, the backend auto-generates 4 future instances; organizer event cards show a "Recurring" badge with Repeat icon; create form has a "Repeats" dropdown
- **Event waitlist**: When an event reaches maxCapacity, new RSVPs get `status="waitlisted"`; cancelling an RSVP auto-promotes the first waitlisted user and sends them a notification; event detail shows "Join Waitlist" button and "On Waitlist" badge; event detail API returns `waitlistCount` and `myRsvp`
- **Time-of-day discovery filter**: Explore page has TIME filter pills (Any / Morning / Evening / Weekends) that filter clubs by their `timeOfDay` field; threaded through storage and API as `?timeOfDay=` query param
- **Member directory tab**: Authenticated approved members and the club owner can see a "Members" tab on club detail page showing all approved members with avatars, names, and join dates; powered by `GET /api/clubs/:id/members`
- **Home feed event reminder**: "Happening Soon" card on home feed shows upcoming RSVPd events within 48 hours; RSVP confirmation creates an `rsvp_confirmed` notification
- **Club announcements**: Organisers post announcements (title + body) with optional "Pin to club page" and "Notify all members" toggles; pinned announcement shows as a prominent terra-pale banner above the tabs on club detail; full broadcast via in-app notifications; managed from "Broadcast" tab in organiser dashboard
- **Club polls**: Organisers create polls (question + 2-6 options) from ContentManager → Polls section; members vote from club detail "Polls" tab (authenticated users only); live vote % bars, optimistic UI; one vote per user per poll; organiser can close polls; polls show on both organiser dashboard (with Close + Delete) and member view (vote buttons or results)
- **Join questions**: Organisers set up to 2 custom screening questions in Edit Club; questions appear in join request form on club detail page (Q1 required, Q2 optional); answers stored in join_requests table; visible in organiser requests view as expandable "View Answers" section with question labels
- **Co-organiser management**: Creator can add trusted approved members as co-organisers (dropdown of eligible members); co-organisers appear in `GET /api/organizer/my-clubs` and have full dashboard access; creator-only features (Edit Club tab, Co-organisers card) are hidden from co-organisers; managed via GET/POST/DELETE `/api/organizer/clubs/:clubId/co-organisers`
- **Club gallery tab**: Photo-only tab on club detail (appears only when ≥1 moment has an imageUrl); 2-column aspect-square grid; tap to open fullscreen overlay with close button; powered by moments data
- **Recurring events UI**: Create event form has "Repeat" segmented control (Once / Weekly / Bi-weekly / Monthly) after the location field; selecting a repeat option shows "We'll create 4 instances automatically" note; backend auto-generates 4 future instances
- **Anonymous Kudos system**: After attending an event (24h+ ago), users see a "Give a Kudo" prompt card on the home feed. Tapping opens a bottom sheet to select an attendee and kudo type (Most Welcoming, Most Energetic, Best Conversation, Always On Time). One kudo per user per event. Giver is anonymous to receiver. Receiver gets an in-app notification. Profile page has "Kudos Received" section showing gold chips. Powered by `kudos` table with `(event_id, giver_id)` unique constraint. Routes: `POST /api/events/:id/kudos`, `GET /api/events/:id/kudos/status`, `GET /api/user/kudos`, `GET /api/events/:id/attendees-for-kudo`.
- **Club detail Values/Perks/Leaders tabs**: Three new tabs added to club detail: "Values" (2×2 grid from club.highlights), "Perks" (bulleted list with star icons from club.highlights), "Leaders" (organiser card with 64px avatar, crown badge, optional WhatsApp Talk button).
- **Creator auto-member fix**: When a club is created, the creator is now automatically added as an approved founding member via join_requests. Previously creator wasn't in the members list.
- **Category gradients on club cards**: Club card emoji containers now use category-specific gradients (Trekking=#E8D5B8→#C4A882, Cycling=#B8D4E8→#82A8C4, Photography=#D4B8E8→#A882C4, Fitness=#B8E8C8→#82C498, Books=#E8D8B8→#C4B082, Art=#E8B8B8→#C48282).
- **Organiser dashboard bottom nav**: BottomNav component now rendered in organizer.tsx (was missing).

## External Dependencies

- **PostgreSQL**: Primary database, connected via `DATABASE_URL` env var using `pg` (node-postgres) driver
- **Google Fonts**: Playfair Display, Outfit, Bebas Neue loaded via CDN in index.html
- **Replit Plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev-only)
- **Auth**: Supabase JWT auth — `SUPABASE_URL` + `SUPABASE_ANON_KEY` server-side; `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` frontend
- **Payments**: Razorpay — `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `VITE_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`

## External Deployment (Railway + Supabase DB)

The app is fully portable to any Node.js host. Configuration:

- **Build**: `npm run build` → outputs frontend to `dist/public/`, server to `dist/index.cjs`
- **Start**: `node ./dist/index.cjs`
- **Port**: reads `PORT` env var (Railway/Render set this automatically); falls back to 5000
- **Railway config**: `railway.toml` at repo root configures build/start commands automatically
- **CORS**: production CORS is controlled by `ALLOWED_ORIGINS` env var (comma-separated list, e.g. `https://myapp.railway.app`). Empty = same-origin only (fine since frontend + backend share one origin). Set explicitly if you need cross-origin API access.
- **Database**: Works with any PostgreSQL — set `DATABASE_URL` to Supabase Postgres connection string (use Session mode pooler, port 5432). Run `npm run db:push` once after pointing to new DB to create all tables.
- **Seed**: Runs automatically on first boot; skips if clubs already exist. Safe to deploy repeatedly.

### Required env vars for external hosting
| Variable | Source |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection String (Session mode) |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL (baked into frontend at build time) |
| `VITE_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY (baked into frontend at build time) |
| `RAZORPAY_KEY_ID` | Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | Razorpay dashboard |
| `VITE_RAZORPAY_KEY_ID` | Same as RAZORPAY_KEY_ID (baked into frontend at build time) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Webhooks |
| `ADMIN_USER_ID` | Supabase user UUID for the admin account |
| `NODE_ENV` | Set to `production` |
| `ALLOWED_ORIGINS` | Optional — your deployed domain if you need cross-origin access |

After deploying, update Razorpay webhook URL to `https://your-domain/api/payments/webhook`.
