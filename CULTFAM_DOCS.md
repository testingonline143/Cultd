# CultFam — Complete App Documentation

> **Version:** Current (March 2026)  
> **Stack:** React + TypeScript (Vite) · Express.js · Drizzle ORM · Replit PostgreSQL · Supabase JWT Auth  
> **Repository:** `testingonline143/Cultd` (GitHub)

---

## 1. What Is CultFam?

CultFam is a city-based community platform that connects people in Indian cities to hobby clubs, local events, and like-minded members. Users discover clubs (trekking groups, book clubs, chess circles, etc.), send join requests, RSVP to events, and engage with their club communities — all in one mobile-friendly web app.

### Supported Cities (11)
Tirupati · Chennai · Bengaluru · Hyderabad · Kochi · Vizag · Vijayawada · Nellore · Guntur · Warangal · Coimbatore

### Hobby Categories (14)
Trekking 🏔️ · Books 📚 · Cycling 🚴 · Photography 📷 · Fitness 💪 · Art 🎨 · Football ⚽ · Cricket 🏏 · Chess ♟️ · Music 🎵 · Gaming 🎮 · Dance 💃 · Cooking 🍳 · Yoga 🧘

---

## 2. User Roles

| Role | Who | Key Permissions |
|------|-----|-----------------|
| **User** | Any signed-in member | Browse clubs & events, RSVP, join clubs, post/like moments, rate clubs, receive notifications |
| **Club Organizer / Co-organizer** | Club creator or anyone the creator adds as co-organizer | Full organizer dashboard (8 tabs), manage join requests, create & manage events, post announcements, run polls, view insights |
| **Admin** | Single superuser set via `ADMIN_USER_ID` env secret | Platform-wide analytics, manage all clubs/users/events, approve/reject join requests, review club proposals, broadcast to all users |

---

## 3. Authentication & Onboarding

### Sign-In
- Powered by **Supabase JWT** (via Replit's Log In with Replit integration and Supabase secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- Session stored in Replit's KV-based sessions table.
- Admin identity verified server-side by comparing `req.user.claims.sub` against the `ADMIN_USER_ID` environment secret.

### Onboarding Quiz (`/onboarding`)
New users complete a 5-step quiz before seeing the home feed. City is taken from the user's existing profile (set during sign-up), not collected here.

| Step | Field | Options |
|------|-------|---------|
| 1 | **Interests** | Select 1–3 hobbies from the 14 hobby categories |
| 2 | **Availability** | Early Morning / Evening / Weekends (multi-select) |
| 3 | **Vibe preference** | Chill / Moderate / Intense |
| 4 | **Experience level** | Beginner / Intermediate / Passionate |
| 5 | **User type** | Student / Working Professional / Other |

Quiz answers are saved to `user_quiz_answers` and drive personalised club recommendations on the home feed. On completion the user is taken to `/matched-clubs`.

---

## 4. App Pages & Features

### 4.1 Home Feed (`/home`)
The primary discovery screen after sign-in.

- **Personalized "For You" section** — clubs matched to the user's quiz-selected categories and city, sorted by health status
- **Upcoming Events strip** — horizontally scrollable cards showing events from clubs the user has joined
- **All Clubs grid** — filterable by category with search
- **Announcements feed** — recent club announcements from joined clubs
- **Notification bell** — unread count badge linking to the notifications page

### 4.2 Explore (`/explore`)
Full club discovery page with:
- **Search bar** — filters clubs by name or description in real time
- **City filter** — dropdown to switch between all 11 cities
- **Category pills** — horizontal scroll of category filters
- **Club cards** — emoji, name, member count, health status badge, short description

### 4.3 Club Detail (`/clubs/:id` or `/c/:slug`)
A rich profile page for each club:

| Section | What it shows |
|---------|---------------|
| **Header** | Cover image, emoji, name, city, category, vibe, active since |
| **Health badge** | green/amber/red status with label (e.g. "Very Active") |
| **About** | Full description, schedule summary, location |
| **Organizer card** | Organizer name, years, avatar, typical response time |
| **Highlights** | Bullet list of club highlights |
| **Join / Status** | Join button → opens join form (name, phone, optional custom questions) → instantly auto-approved; user immediately becomes a member |
| **Founding Members** | Progress bar showing founding seats taken vs total (default 20) |
| **Custom page sections** | Organizer-created content blocks with title, description, emoji |
| **Upcoming Events** | Club's next events with RSVP button |
| **Moments (Photo wall)** | Member-posted photos with likes & comments |
| **FAQs** | Accordion of organizer-authored questions and answers |
| **Weekly Schedule** | Day/time/activity grid from organizer |
| **Ratings & Reviews** | Star ratings with text reviews; user can submit their own |
| **Members preview** | Avatars/names of approved members |
| **Polls** | Active club polls; members can vote once per poll |

### 4.4 Event Detail (`/events/:id`)
Full event page:

| Section | Details |
|---------|---------|
| **Event header** | Cover image, title, club name + emoji |
| **Date / Time / Location** | Formatted date range, location text + optional map link |
| **Capacity bar** | Filled seats / max capacity with percentage |
| **Ticket types** | If organizer created ticket tiers, user picks one before RSVPing |
| **RSVP button** | Going / Waitlisted / Cancel RSVP; waitlisted users get promoted automatically when spots open |
| **Event form** | If organizer set mandatory pre-RSVP form questions, user answers them |
| **QR ticket** | After RSVPing, user sees a scannable QR code for check-in |
| **Comment thread** | Open discussion; any user can comment |
| **Kudos** | After attending, users can give one kudo to another attendee (emoji-based recognition) |
| **Moments** | Post-event photo moments linked to the event |

### 4.5 Notifications (`/notifications`)
- List of all notifications for the logged-in user
- Notification types: `join_approved`, `join_rejected`, `new_event`, `club_update`, `rsvp_confirmed`, `waitlist_promoted`
- Each notification has a title, message, timestamp, and optional deep-link URL
- **Mark as read** (single tap) and **Mark All Read** button
- Unread dot indicator and count badge

---

## 5. Organizer Dashboard (`/organizer`)

Accessible to any user who is a **club creator or co-organizer**. If a user manages multiple clubs, a **Switch Club** pill bar appears at the top.

### Tab 1 — Overview
- Key stats: member count, pending requests, events created, founding member progress
- Quick-action shortcuts to other tabs (e.g. "Review Requests", "Post Announcement")
- Recent activity feed (recent joins, RSVPs)

### Tab 2 — Requests (with badge count)
- List of all join requests for the club with name, phone, submission time, quiz answers
- Since join is **auto-approved**, most requests arrive here already approved; the pending count badge reflects any edge cases (e.g. previously rejected users re-applying before auto-approval completes)
- **Approve** / **Reject** / **Mark Done** actions available for manual overrides
- Sends a notification to the user on manual approval or rejection

### Tab 3 — Members
- Full list of approved members with name, join date
- **Remove member** action (moves them back to pending / removes membership)
- Search/filter by name

### Tab 4 — Insights
Key metrics and charts:

| Metric | Description |
|--------|-------------|
| Total Members | Current approved member count |
| Pending Requests | Open join requests |
| Events Created | Lifetime events for this club |
| Avg Attendance | Average check-in rate across all events |
| Engagement Rate | % of members who RSVPd to at least one event |
| No-Show Rate | Average % of RSVPs that didn't check in |
| Member Growth Chart | Bar chart — new members per week (last 8 weeks) |
| Per-Event Breakdown | Table of each event with RSVP count, attended count, % rate |
| Most Active Members | Leaderboard of members by RSVP count |
| Post-Event Survey Summary | Response counts per event |

### Tab 5 — Events
- List of all events for the club (upcoming + past)
- **Create event** form: title, description, date/time, location, capacity, cover image, ticket types, optional pre-RSVP form questions
- **Edit / Cancel** existing events
- **Scan attendees** button → opens QR scanner page for that event

### Tab 6 — Content
Three sub-sections managed by organizer:

- **FAQs** — Add, edit, reorder, delete FAQ pairs
- **Schedule** — Add recurring weekly schedule entries (day, time, activity, location)
- **Moments** — Post photo moments on behalf of the club; manage existing moments

### Tab 7 — Broadcast (Announcements)
- **Create announcement**: title, body, optional pin toggle
- **Pin toggle** — pinned announcements appear at the top of the member feed
- **Polls** — Create multiple-choice polls; close open polls; view live vote tallies

### Tab 8 — Edit Club _(creator only)_
- Edit all club profile fields: name, short description, full description, schedule, location, vibe, time of day, cover image URL, WhatsApp number, organizer bio
- Add / remove **co-organizers** — search approved members by name and promote to co-organizer; remove any time

---

## 6. Page Builder (`/organizer/page-builder?club=<id>`)

A dedicated page for club **creators** (not co-organizers) to build and manage their club's public web page.

### Public URL
- Set a custom URL slug for the club's shareable page (e.g. `/c/tirupati-chess-club`)
- Auto-generates a sensible slug from the club name on first visit
- One-click copy and open buttons

### Club Profile (inline editing)
- Edit Club Name, Tagline, Schedule, Location — each field auto-saves on blur

### Custom Page Sections
Sections appear on the public club detail page (`/c/:slug`) in the order the organizer sets:

| Action | Details |
|--------|---------|
| **Add section** | Title + optional description + emoji (12 choices) + layout |
| **Layouts** | Full Width, Compact List, Horizontal Scroll (carousel) |
| **Reorder** | Up / Down arrow buttons |
| **Toggle visibility** | Show or hide without deleting |
| **Pin events** | Attach specific club events to display inside a section |
| **Edit** | Inline edit title, description, layout |
| **Delete** | Remove section and its pinned events |

---

## 7. QR Check-In System (`/scan/:eventId`)

A dedicated scanner page for organizers at live events.

- **Camera QR scanner** — uses `html5-qrcode`; reads the attendee's personal QR code (contains a signed `checkinToken` stored in `event_rsvps`)
- **Torch toggle** — for low-light venues (hidden if device doesn't support it)
- **Real-time attendance panel** — updates every 10 seconds: total RSVPs, checked-in count, fill rate progress bar
- **Pending list** — searchable list of attendees not yet arrived; tap to manually check in
- **Arrived list** — attendees already checked in with their time
- **Scan feedback** — success / already-checked-in / error states with haptic vibration on mobile

---

## 8. Admin Dashboard (`/admin`)

Access is restricted server-side. If `ADMIN_USER_ID` is not configured, a setup screen guides the admin through copying their user ID and setting the secret.

### Tab 1 — Analytics
Platform-wide stats:

| Metric | |
|--------|-|
| Total Users | All registered accounts |
| Total Clubs | All clubs (active + inactive) |
| Active Clubs | `is_active = true` clubs |
| Total Events | All events created |
| Total RSVPs | Sum of all RSVP records |
| Total Check-ins | Confirmed attendances |
| Total Moments | Photo posts across all clubs |
| Total Comments | Comments on moments + events |
| New This Week | Users / Events / Joins added in last 7 days |
| City Distribution | Breakdown of clubs per city |
| Weekly Growth Chart | Area chart — Users / Events / Moments per week |
| Activity Feed | Recent joins, new clubs, upcoming events |
| **Send Broadcast** button | Opens modal to send a notification to all users |

### Tab 2 — Clubs
- Table of all clubs with: name, city, category, member count, health status, active/inactive toggle
- **Activate / Deactivate** club
- **Delete** club (permanent)
- **CSV Export** of all clubs

### Tab 3 — Users
- Table of all users with: name, email, city, role, clubs joined, join date
- **User detail drawer** (right panel): shows all clubs, events attended, moments posted, join request history for that user
- **CSV Export** of all users

### Tab 4 — Events
- Table of all events: title, club, date, RSVP count, check-in count, capacity, cancelled status
- **Cancel event** action
- **CSV Export** of all events

### Tab 5 — Requests (with badge count)
- All pending join requests across all clubs
- **Approve / Reject** actions (same as organizer but platform-wide)
- **Mark Done** to archive completed requests
- Badge shows open pending count

### Tab 6 — Proposals (with badge count)
- User-submitted club proposals awaiting admin review
- Each proposal shows: club name, category, city, vibe, description, schedule, motivation, submitter
- **Approve** (auto-creates the club) or **Reject with review note**
- Badge shows pending proposal count

---

## 9. Club Proposal Flow (`/create`)

Any logged-in user can propose a new club:

1. Fill in: club name, category, city, vibe, short description, schedule, motivation
2. Proposal saved to `club_proposals` with status `pending`
3. Admin reviews in the Proposals tab → Approve creates a real `clubs` row; Reject stores a review note
4. User is notified of the decision

---

## 10. Data Model

All tables live in a single Replit PostgreSQL database. Primary keys are UUID `varchar` (except `event_ticket_types` which uses `integer` with `generatedAlwaysAsIdentity`).

| Table | Purpose |
|-------|---------|
| `users` | Auth profile: id, email, firstName, city, role, profileImageUrl |
| `sessions` | Supabase session storage |
| `clubs` | Club profiles with all metadata |
| `club_page_sections` | Organizer-created rich content blocks on club pages |
| `section_events` | Events pinned into custom page sections |
| `join_requests` | Member join applications (pending / approved / rejected) |
| `user_quiz_answers` | Onboarding quiz responses for personalization |
| `events` | Events created by clubs |
| `event_ticket_types` | Named ticket tiers per event (free or paid) |
| `event_rsvps` | RSVPs with status (going / waitlisted), check-in token, check-in time |
| `event_form_questions` | Organizer-defined pre-RSVP form questions |
| `event_form_responses` | User answers to pre-RSVP form questions |
| `event_comments` | Comment threads on events |
| `club_moments` | Photo/emoji posts on club walls |
| `moment_likes` | Unique likes per user per moment |
| `moment_comments` | Comment threads on moments |
| `club_ratings` | Star ratings + text reviews for clubs |
| `club_faqs` | FAQ pairs for club pages |
| `club_schedule_entries` | Weekly recurring schedule entries |
| `club_announcements` | Club broadcast posts; supports pinning |
| `club_polls` | Multiple-choice polls within clubs |
| `poll_votes` | One vote per user per poll |
| `kudos` | Post-event peer recognition (one kudo per event per giver) |
| `notifications` | Per-user notification inbox |
| `club_proposals` | User-submitted proposals for new clubs |

---

## 11. Key API Endpoints

### Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | GET | Initiate Supabase login |
| `/api/logout` | GET | Clear session |
| `/api/auth/user` | GET | Get current user |

### Clubs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clubs` | GET | List all clubs (with city/category/search/vibe filters) |
| `/api/clubs/:id` | GET | Club detail |
| `/api/c/:slug` | GET | Club by custom slug (public) |
| `/api/clubs/:id/moments` | GET/POST | Club moments |
| `/api/clubs/:id/faqs` | GET | Club FAQs |
| `/api/clubs/:id/schedule` | GET | Schedule entries |
| `/api/clubs/:id/ratings` | GET/POST | Ratings |
| `/api/clubs/:id/polls` | GET | Polls |
| `/api/clubs/:id/announcements` | GET | Announcements |

### Events
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | List events |
| `/api/events/:id` | GET | Event detail |
| `/api/events/:id/rsvp` | POST | RSVP to event |
| `/api/events/:id/cancel-rsvp` | POST | Cancel RSVP |
| `/api/events/:id/attendance` | GET | Attendance data (organizer) |
| `/api/events/:id/comments` | GET/POST | Event comments |
| `/api/checkin` | POST | QR token check-in |
| `/api/checkin/manual` | POST | Manual check-in by rsvpId |

### Join Requests
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/join` | POST | Submit join request (auto-approves on success) |
| `/api/user/join-requests` | GET | Current user's join request history |
| `/api/clubs/:id/join-status` | GET | Join status for current user in a club |

### Organizer
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizer/my-clubs` | GET | Clubs managed by current user |
| `/api/organizer/join-requests/:clubId` | GET | Join requests for a club |
| `/api/organizer/join-requests/:id/approve` | POST | Approve request |
| `/api/organizer/join-requests/:id/reject` | POST | Reject request |
| `/api/organizer/clubs/:clubId/insights` | GET | Insights metrics |
| `/api/organizer/clubs/:clubId/analytics` | GET | Detailed analytics |
| `/api/organizer/clubs/:clubId/events` | GET/POST | Manage events |
| `/api/organizer/clubs/:clubId/announcements` | GET/POST | Manage announcements |
| `/api/organizer/clubs/:clubId/polls` | GET/POST | Manage polls |
| `/api/organizer/clubs/:clubId/members` | GET | Members list |
| `/api/organizer/clubs/:clubId/co-organisers` | GET/POST/DELETE | Manage co-organizers |
| `/api/organizer/clubs/:clubId/page-sections` | GET/POST | List / create page sections |
| `/api/organizer/clubs/:clubId/page-sections/:id` | PATCH/DELETE | Edit / delete a section |
| `/api/organizer/clubs/:clubId/page-sections/reorder` | PATCH | Reorder sections |
| `/api/organizer/clubs/:clubId/page-sections/:id/events` | POST/DELETE | Pin / remove events in section |
| `/api/organizer/clubs/:clubId/slug` | PATCH | Update custom slug |
| `/api/organizer/clubs/:clubId/generate-slug` | POST | Auto-generate slug |

### Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | User notifications |
| `/api/notifications/unread-count` | GET | Unread count |
| `/api/notifications/:id/read` | PATCH | Mark one read |
| `/api/notifications/read-all` | PATCH | Mark all read |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/status` | GET | Check admin config + auth |
| `/api/admin/analytics` | GET | Platform analytics |
| `/api/admin/clubs` | GET | All clubs |
| `/api/admin/users` | GET | All users |
| `/api/admin/users/:id/detail` | GET | User detail |
| `/api/admin/events` | GET | All events |
| `/api/admin/join-requests` | GET | All join requests |
| `/api/admin/join-requests/:id/approve` | POST | Approve (platform-wide) |
| `/api/admin/join-requests/:id/reject` | POST | Reject (platform-wide) |
| `/api/admin/club-proposals` | GET | All proposals |
| `/api/admin/club-proposals/pending-count` | GET | Count of pending proposals |
| `/api/admin/club-proposals/:id` | PATCH | Approve or reject proposal (`{status, reviewNote}`) |
| `/api/admin/broadcast` | POST | Broadcast to all users |
| `/api/admin/clubs/:id/activate` | POST | Activate club |
| `/api/admin/clubs/:id/deactivate` | POST | Deactivate club |

---

## 12. Tech Stack & Architecture

```
client/                      React + Vite (TypeScript)
  src/
    pages/                   One file per route
      organizer/             8 lazy-loaded tab components
    components/ui/           shadcn/ui component library
    hooks/                   use-auth, use-toast, etc.
    lib/                     queryClient (TanStack Query v5)

server/
  index.ts                   Express entry point
  routes.ts                  All API route handlers (~1,500 lines)
  storage.ts                 IStorage interface + PostgreSQL impl
  vite.ts                    Vite dev server integration

shared/
  schema.ts                  Drizzle ORM table definitions + Zod schemas
  models/auth.ts             users + sessions tables
```

**Key dependencies:**
- `@tanstack/react-query` v5 — data fetching / caching
- `drizzle-orm` + `drizzle-zod` — database + schema validation
- `wouter` — client-side routing
- `shadcn/ui` + `tailwindcss` — UI components and styling
- `html5-qrcode` — QR code scanning (lazy-loaded)
- `recharts` — admin analytics charts
- `date-fns` — date formatting

---

## 13. Environment Variables & Secrets

| Secret/Variable | Purpose |
|-----------------|---------|
| `SUPABASE_URL` | Supabase project URL (server-side) |
| `SUPABASE_ANON_KEY` | Supabase anon key (server-side) |
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| `DATABASE_URL` | Replit PostgreSQL connection string (auto-set) |
| `ADMIN_USER_ID` | Supabase user ID of the platform admin |

---

## 14. Club Health Status

Each club displays a health badge. Set manually by the organizer or admin:

| Status | Label | Meaning |
|--------|-------|---------|
| `green` | Very Active | Regular meetups happening |
| `amber` | Fairly Active | Occasional activity |
| `red` | Inactive | No recent activity |

---

## 15. Waitlist System

When an event reaches `maxCapacity`:
- New RSVPs are saved with `status = "waitlisted"`
- When a "going" RSVP is cancelled, the first waitlisted user is automatically promoted to "going" via server-side logic in `routes.ts`
- Promoted users receive a `waitlist_promoted` notification

---

## 16. Founding Members

Each club has a founding member quota (default: 20 slots). Shown as a progress bar on the club detail page. When a join request is auto-approved, the server checks whether `foundingTaken < foundingTotal`; if so, the join record is flagged `isFoundingMember = true`. Founding status is a recognition feature — founding members can be displayed distinctively; no hard cap prevents joining once slots fill, the flag simply stops being set.

---

## 17. Post-Event Kudos

After attending an event, a user can give one kudo to another attendee. Kudos are emoji-based (e.g. 🌟 Great Energy, 🤝 Team Player). Each user can give at most one kudo per event (`kudos_giver_event_unique` constraint). Kudos appear on the event detail page and can feed into future leaderboards.

---

## 18. Running the App (Development)

```bash
# Install dependencies
npm install

# Push schema to database
npm run db:push

# Start dev server (Express + Vite HMR on same port)
npm run dev
```

The workflow named **"Start application"** runs `npm run dev` automatically. The same port serves both the API and the frontend.

---

## 19. Optimization Opportunities

The following areas are good candidates for improvement based on reviewing the current implementation:

### Join Flow — Explicit Approval Option
**Current:** All join requests are instantly auto-approved server-side (`/api/join` creates the request then immediately calls `approveJoinRequestWithFoundingCheck`). Organizer's Requests tab is effectively a join log rather than a review queue.  
**Opportunity:** Add a per-club setting (e.g. `requireApproval: boolean`) so organizers can switch to a manual-review flow. This would unlock the existing approve/reject UI in a meaningful way and give organizers control over membership quality.

### Health Status — Automated Derivation
**Current:** `healthStatus` and `healthLabel` on the `clubs` table are set manually by the organizer or admin. They can go stale if the club becomes inactive.  
**Opportunity:** Auto-calculate health based on objective signals: recency of last event, average RSVP fill rate, new members in last 30 days. Run as a scheduled job or recompute on each club-detail fetch.

### Member Count — Consistency Risk
**Current:** `clubs.memberCount` is incremented/decremented manually in storage (`incrementMemberCount` / `decrementMemberCount`). Long-running apps risk drift between this counter and the actual count of `status = 'approved'` join requests.  
**Opportunity:** Replace with a derived count (`SELECT count(*) FROM join_requests WHERE club_id = ? AND status = 'approved'`) or run a periodic reconciliation job.

### Founding Member Cap — No Hard Gate
**Current:** The founding member flag (`isFoundingMember`) stops being set once `foundingTaken >= foundingTotal`, but joining itself is never blocked. The progress bar can show "20/20" while new members still join.  
**Opportunity:** If founding membership is meant to be exclusive, gate it: add a `foundingClosed` flag and show a different CTA once founding slots are filled.

### Event Capacity — Static at Creation
**Current:** `maxCapacity` must be manually edited after event creation. There is no UI for adding capacity mid-event.  
**Opportunity:** Allow organizers to expand capacity inline from the Events tab, with an automatic promotion trigger for waitlisted users.

### Waitlist Promotion — First-In-First-Out Only
**Current:** The first waitlisted RSVP is promoted when a spot opens. No UI to see or reorder the waitlist.  
**Opportunity:** Expose the waitlist order to organizers so they can manage it (e.g., prioritise members with higher attendance rates).

### Notifications — In-App Only
**Current:** Notifications are only shown in the app's `/notifications` page with a bell badge.  
**Opportunity:** Add WhatsApp or email delivery for high-priority notifications (join approval, event reminder, waitlist promotion) leveraging the existing `whatsappNumber` field on clubs.

### Club Page Sections — Text/Events Only
**Current:** Custom page sections support text + description + pinned events. No image blocks.  
**Opportunity:** Add an `imageUrl` field to `club_page_sections` to allow rich image banners in sections, which is especially valuable for photography and art clubs.

### Moments — No Native Upload
**Current:** `club_moments.imageUrl` is a plain text field; organizers must supply an external image URL. No upload flow exists in the app.  
**Opportunity:** Integrate a file upload (e.g. Supabase Storage or Cloudinary) and expose an upload button in the Moments section of the organizer Content tab.

### Admin Analytics — Limited City Breakdown
**Current:** Admin analytics show a `cityCounts` array (clubs per city) but organizer insights have no city breakdown; the per-event analytics are club-wide only.  
**Opportunity:** Add city-level and category-level growth charts to the admin dashboard, and give organizers a benchmark comparison against other clubs in their city.

### Polls — No Scheduled Close
**Current:** Polls stay open until an organizer manually closes them from the Broadcast tab.  
**Opportunity:** Add an optional `closesAt` timestamp to `club_polls` and auto-close polls server-side when that time passes.

### Cities & Categories — Hardcoded
**Current:** Both `CITIES` and `CATEGORIES` are `as const` arrays in `shared/schema.ts`; adding a new city or category requires a code deploy.  
**Opportunity:** Move to a database-driven config table (`platform_config`) with an admin UI for adding/removing cities and categories without redeployment.

---

*For the latest schema and API implementation details, refer to `shared/schema.ts` and `server/routes.ts` in the codebase.*
