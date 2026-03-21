import type { Express, RequestHandler } from "express";
import QRCode from "qrcode";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { isCrawler, readHtmlTemplate, buildOgHtml, buildEventSvg } from "../og";
import sharp from "sharp";

export function registerEventRoutes(
  app: Express,
  requireRole: (...roles: string[]) => RequestHandler,
  requireEventManager: (param?: string) => RequestHandler,
): void {
  app.get("/api/events", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const rawLimit = parseInt(req.query.limit as string);
      const limit = (!isNaN(rawLimit) && rawLimit > 0) ? Math.min(rawLimit, 50) : 10;
      const events = await storage.getUpcomingEvents(city, limit);
      res.json(events);
    } catch (err) {
      console.error("Error fetching events:", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const allRsvps = await storage.getRsvpsByEvent(event.id);
      const rsvps = event.isCancelled ? [] : allRsvps;
      const club = await storage.getClub(event.clubId);
      const waitlistCount = event.isCancelled ? 0 : await storage.getWaitlistCount(event.id);
      let myRsvp = null;
      if (req.user?.claims?.sub) {
        myRsvp = await storage.getUserRsvp(event.id, req.user.claims.sub);
      }
      res.json({ ...event, rsvps, club, waitlistCount, myRsvp });
    } catch (err) {
      console.error("Error fetching event:", err);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.get("/api/clubs/:id/events", async (req, res) => {
    try {
      const clubEvents = await storage.getEventsByClub(req.params.id);
      const eventsWithRsvps = await Promise.all(
        clubEvents.map(async (event) => {
          const rsvpCount = await storage.getRsvpCount(event.id);
          return { ...event, rsvpCount };
        })
      );
      res.json(eventsWithRsvps);
    } catch (err) {
      console.error("Error fetching club events:", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/clubs/:id/events", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club) {
        return res.status(404).json({ success: false, message: "Club not found" });
      }
      const isManager = await storage.isClubManager(club.id, userId);
      if (!isManager) {
        return res.status(403).json({ success: false, message: "Not authorized for this club" });
      }
      const recurrenceRule = req.body.recurrenceRule && req.body.recurrenceRule !== "none" ? req.body.recurrenceRule : null;
      const baseStartsAt = new Date(req.body.startsAt);
      const baseEndsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
      const eventData = {
        title: req.body.title,
        description: req.body.description || "",
        clubId: req.params.id,
        startsAt: baseStartsAt,
        endsAt: baseEndsAt,
        locationText: req.body.locationText,
        maxCapacity: parseInt(req.body.maxCapacity) || 20,
        coverImageUrl: req.body.coverImageUrl || null,
        recurrenceRule,
      };
      const event = await storage.createEvent(eventData);
      if (recurrenceRule) {
        for (let i = 1; i <= 4; i++) {
          const nextStartsAt = new Date(baseStartsAt);
          if (recurrenceRule === "weekly") nextStartsAt.setDate(nextStartsAt.getDate() + 7 * i);
          else if (recurrenceRule === "biweekly") nextStartsAt.setDate(nextStartsAt.getDate() + 14 * i);
          else if (recurrenceRule === "monthly") nextStartsAt.setMonth(nextStartsAt.getMonth() + i);
          let nextEndsAt = null;
          if (baseEndsAt) {
            const duration = baseEndsAt.getTime() - baseStartsAt.getTime();
            nextEndsAt = new Date(nextStartsAt.getTime() + duration);
          }
          await storage.createEvent({ ...eventData, startsAt: nextStartsAt, endsAt: nextEndsAt });
        }
      }
      const approvedMembers = await storage.getApprovedMembersByClub(req.params.id);
      for (const member of approvedMembers) {
        if (member.userId && member.userId !== userId) {
          await storage.createNotification({
            userId: member.userId,
            type: "new_event",
            title: "New Event!",
            message: `${club.name} just posted a new event: ${event.title}`,
            linkUrl: `/event/${event.id}`,
            isRead: false,
          });
        }
      }
      res.status(201).json({ success: true, event });
    } catch (err) {
      console.error("Error creating event:", err);
      res.status(500).json({ success: false, message: "Failed to create event" });
    }
  });

  app.patch("/api/clubs/:clubId/events/:eventId", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const event = await storage.getEvent(req.params.eventId);
      if (!event || event.clubId !== req.params.clubId) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.isCancelled) {
        return res.status(400).json({ message: "Cannot edit a cancelled event" });
      }
      const updateData: any = {};
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.locationText) updateData.locationText = req.body.locationText;
      if (req.body.locationUrl !== undefined) updateData.locationUrl = req.body.locationUrl;
      if (req.body.startsAt) updateData.startsAt = new Date(req.body.startsAt);
      if (req.body.endsAt !== undefined) updateData.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
      if (req.body.maxCapacity) {
        const parsed = parseInt(req.body.maxCapacity);
        if (!isNaN(parsed) && parsed >= 2) updateData.maxCapacity = parsed;
      }
      if (req.body.coverImageUrl !== undefined) updateData.coverImageUrl = req.body.coverImageUrl;
      const updated = await storage.updateEvent(req.params.eventId, updateData);
      res.json({ success: true, event: updated });
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/clubs/:clubId/events/:eventId", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const event = await storage.getEvent(req.params.eventId);
      if (!event || event.clubId !== req.params.clubId) {
        return res.status(404).json({ message: "Event not found" });
      }
      await storage.cancelEvent(req.params.eventId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error cancelling event:", err);
      res.status(500).json({ message: "Failed to cancel event" });
    }
  });

  app.post("/api/clubs/:clubId/events/:eventId/extend-series", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const seedEvent = await storage.getEvent(req.params.eventId);
      if (!seedEvent || seedEvent.clubId !== req.params.clubId) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (!seedEvent.recurrenceRule) {
        return res.status(400).json({ message: "Event is not part of a recurring series" });
      }
      const newEvents = await storage.extendEventSeries(req.params.clubId, seedEvent.title, seedEvent.recurrenceRule);
      res.json({ success: true, count: newEvents.length, events: newEvents });
    } catch (err) {
      console.error("Error extending event series:", err);
      res.status(500).json({ message: "Failed to extend series" });
    }
  });

  app.post("/api/events/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ success: false, message: "Event not found" });
      }
      if (event.isCancelled) {
        return res.status(400).json({ success: false, message: "This event has been cancelled and is no longer accepting RSVPs." });
      }
      const club = await storage.getClub(event.clubId);
      const isManager = club && await storage.isClubManager(club.id, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(event.clubId, userId);
        if (!isMember) {
          return res.status(403).json({ success: false, message: "You must be an approved member of this club to RSVP. Join the club first!" });
        }
      }
      const existingRsvp = await storage.getUserRsvp(event.id, userId);
      if (existingRsvp && existingRsvp.status === "going") {
        return res.json({ success: true, rsvp: existingRsvp, alreadyRsvpd: true });
      }
      if (existingRsvp && existingRsvp.status === "waitlisted") {
        const position = await storage.getUserWaitlistPosition(event.id, userId);
        return res.json({ success: true, rsvp: existingRsvp, waitlisted: true, position });
      }

      if (event.formMandatory) {
        const questions = await storage.getEventFormQuestions(event.id);
        if (questions.length > 0) {
          const formResponses: { questionId: string; answer: string }[] = req.body?.formResponses ?? [];
          if (formResponses.length === 0) {
            return res.json({ success: false, requiresForm: true, questions });
          }
          const answeredMap = new Map(formResponses.map((r: any) => [r.questionId, (r.answer ?? "").trim()]));
          const missingAnswer = questions.find(q => !answeredMap.get(q.id));
          if (missingAnswer) {
            return res.json({ success: false, requiresForm: true, questions, message: "Please answer all required questions" });
          }
        }
      }

      const rawFormResponses: { questionId: string; answer: string }[] = req.body?.formResponses ?? [];
      const allFormResponses = rawFormResponses.map((r: any) => ({
        questionId: String(r.questionId ?? ""),
        answer: String(r.answer ?? "").trim().slice(0, 1000),
      }));
      if (allFormResponses.length > 0) {
        const validQuestions = await storage.getEventFormQuestions(event.id);
        const validIds = new Set(validQuestions.map(q => q.id));
        const invalid = allFormResponses.find(r => !validIds.has(r.questionId));
        if (invalid) {
          return res.status(400).json({ success: false, message: "Invalid question ID in form responses" });
        }
      }

      const rawTicketTypeId = req.body?.ticketTypeId;
      let ticketTypeId: number | undefined;
      let ticketTypeName: string | undefined;
      const eventTickets = await storage.getEventTicketTypes(event.id);
      if (eventTickets.length > 0) {
        if (rawTicketTypeId === undefined || rawTicketTypeId === null) {
          return res.status(400).json({ success: false, message: "Please select a ticket type to RSVP" });
        }
        const parsed = parseInt(String(rawTicketTypeId));
        if (isNaN(parsed)) {
          return res.status(400).json({ success: false, message: "Invalid ticket type" });
        }
        const ticket = eventTickets.find(t => t.id === parsed);
        if (!ticket) {
          return res.status(400).json({ success: false, message: "Invalid ticket type" });
        }
        ticketTypeId = ticket.id;
        ticketTypeName = ticket.name;
        if (ticket.price > 0) {
          return res.status(402).json({ success: false, requiresPayment: true, message: "This is a paid ticket — please complete payment to RSVP" });
        }
      }

      const rsvpCount = await storage.getRsvpCount(event.id);
      const status = rsvpCount >= event.maxCapacity ? "waitlisted" : "going";
      const rsvp = await storage.createRsvp({
        eventId: event.id,
        userId,
        status,
        ticketTypeId,
        ticketTypeName,
      });

      if (allFormResponses.length > 0) {
        await storage.saveEventFormResponses(event.id, userId, allFormResponses);
      }

      if (status === "waitlisted") {
        const position = await storage.getUserWaitlistPosition(event.id, userId);
        return res.json({ success: true, rsvp, waitlisted: true, position });
      }

      res.json({ success: true, rsvp });
    } catch (err) {
      console.error("Error creating RSVP:", err);
      res.status(500).json({ success: false, message: "Failed to RSVP" });
    }
  });

  app.delete("/api/events/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existingRsvp = await storage.getUserRsvp(req.params.id, userId);
      await storage.cancelRsvp(req.params.id, userId);
      if (existingRsvp?.status === "going") {
        const promoted = await storage.promoteFirstFromWaitlist(req.params.id);
        if (promoted) {
          const event = await storage.getEvent(req.params.id);
          const eventDate = event ? new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";
          await storage.createNotification({
            userId: promoted.userId,
            type: "waitlist_promoted",
            title: "You're off the waitlist!",
            message: `A spot opened up for ${event?.title || "the event"}${eventDate ? ` on ${eventDate}` : ""}. You're now confirmed!`,
            linkUrl: `/event/${req.params.id}`,
            isRead: false,
          });
        }
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error cancelling RSVP:", err);
      res.status(500).json({ success: false, message: "Failed to cancel RSVP" });
    }
  });

  app.get("/api/user/rsvps", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rsvps = await storage.getRsvpsByUser(userId);
      res.json(rsvps);
    } catch (err) {
      console.error("Error fetching RSVPs:", err);
      res.status(500).json({ message: "Failed to fetch RSVPs" });
    }
  });

  app.get("/api/rsvps/:rsvpId/qr", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rsvp = await storage.getRsvpById(req.params.rsvpId);
      if (!rsvp) {
        return res.status(404).json({ message: "RSVP not found" });
      }
      if (rsvp.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const payload = JSON.stringify({
        token: rsvp.checkinToken,
        eventId: rsvp.eventId,
        userId: rsvp.userId,
      });
      const qrBuffer = await QRCode.toBuffer(payload, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      res.set("Content-Type", "image/png");
      res.send(qrBuffer);
    } catch (err) {
      console.error("Error generating QR:", err);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.post("/api/checkin", isAuthenticated, async (req: any, res) => {
    try {
      const organizerUserId = req.user.claims.sub;
      const { token, eventId } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: "Token is required" });
      }
      if (!eventId) {
        return res.status(400).json({ success: false, message: "Event ID is required" });
      }
      const rsvp = await storage.getRsvpByToken(token);
      if (!rsvp) {
        return res.status(404).json({ success: false, message: "Invalid ticket — RSVP not found" });
      }
      if (rsvp.eventId !== eventId) {
        return res.status(400).json({ success: false, message: "This ticket is for a different event" });
      }
      const event = await storage.getEvent(rsvp.eventId);
      if (!event) {
        return res.status(404).json({ success: false, message: "Event not found" });
      }
      const club = await storage.getClub(event.clubId);
      if (!club || !(await storage.isClubManager(club.id, organizerUserId))) {
        return res.status(403).json({ success: false, message: "Only the event organizer can scan check-ins" });
      }
      if (rsvp.checkedIn) {
        return res.json({ success: true, alreadyCheckedIn: true, name: rsvp.userName, checkedInAt: rsvp.checkedInAt });
      }
      const updated = await storage.checkInRsvpByToken(token);
      res.json({ success: true, name: rsvp.userName, checkedInAt: updated?.checkedInAt });
    } catch (err) {
      console.error("Error checking in:", err);
      res.status(500).json({ success: false, message: "Failed to check in" });
    }
  });

  app.post("/api/checkin/manual", isAuthenticated, async (req: any, res) => {
    try {
      const organizerUserId = req.user.claims.sub;
      const { rsvpId, eventId } = req.body;
      if (!rsvpId || !eventId) {
        return res.status(400).json({ success: false, message: "rsvpId and eventId are required" });
      }
      const rsvp = await storage.getRsvpById(rsvpId);
      if (!rsvp) {
        return res.status(404).json({ success: false, message: "RSVP not found" });
      }
      if (rsvp.eventId !== eventId) {
        return res.status(400).json({ success: false, message: "RSVP does not match this event" });
      }
      const event = await storage.getEvent(rsvp.eventId);
      if (!event) {
        return res.status(404).json({ success: false, message: "Event not found" });
      }
      const club = await storage.getClub(event.clubId);
      if (!club || !(await storage.isClubManager(club.id, organizerUserId))) {
        return res.status(403).json({ success: false, message: "Only the event organizer can manually check in attendees" });
      }
      if (rsvp.checkedIn) {
        return res.json({ success: true, alreadyCheckedIn: true });
      }
      const updated = await storage.checkInRsvpById(rsvpId);
      res.json({ success: true, checkedInAt: updated?.checkedInAt });
    } catch (err) {
      console.error("Error manual check-in:", err);
      res.status(500).json({ success: false, message: "Failed to check in" });
    }
  });

  app.get("/api/events/:id/tickets", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const tickets = await storage.getEventTicketTypes(event.id);
      res.json(tickets);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch ticket types" });
    }
  });

  app.get("/api/events/:id/form", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const questions = await storage.getEventFormQuestions(event.id);
      res.json({ formMandatory: event.formMandatory, questions });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch form" });
    }
  });

  app.get("/api/events/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getEventComments(req.params.id);
      res.json(comments);
    } catch (err) {
      console.error("Error fetching event comments:", err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/events/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { text } = req.body;
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ message: "Comment text is required" });
      }
      if (text.trim().length > 300) {
        return res.status(400).json({ message: "Comment too long (max 300 chars)" });
      }
      const user = await storage.getUser(userId);
      const userName = user?.firstName || user?.email?.split("@")[0] || "Member";
      const comment = await storage.createEventComment(req.params.id, userId, userName, user?.profileImageUrl ?? null, text.trim());
      res.status(201).json(comment);
    } catch (err) {
      console.error("Error creating event comment:", err);
      res.status(500).json({ message: "Failed to post comment" });
    }
  });

  app.get("/api/events/:id/attendees-for-kudo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const attendees = await storage.getEventAttendeesForKudo(id, userId);
      res.json(attendees);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  app.get("/api/events/:id/kudos/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const hasGiven = await storage.hasGivenKudo(id, userId);
      res.json({ hasGiven });
    } catch (err) {
      res.status(500).json({ message: "Failed to check kudo status" });
    }
  });

  app.post("/api/events/:id/kudos", isAuthenticated, async (req: any, res) => {
    try {
      const giverId = req.user.claims.sub;
      const { id: eventId } = req.params;
      const { receiverId, kudoType } = req.body;

      if (!receiverId || !kudoType) {
        return res.status(400).json({ message: "receiverId and kudoType are required" });
      }
      const validTypes = ["Most Welcoming", "Most Energetic", "Best Conversation", "Always On Time"];
      if (!validTypes.includes(kudoType)) {
        return res.status(400).json({ message: "Invalid kudo type" });
      }

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const alreadyGiven = await storage.hasGivenKudo(eventId, giverId);
      if (alreadyGiven) return res.status(409).json({ message: "You have already given a kudo for this event" });

      const kudo = await storage.createKudo({ eventId, giverId, receiverId, kudoType });

      await storage.createNotification({
        userId: receiverId,
        type: "kudo",
        title: "You received a kudo! 🏅",
        message: `Someone at ${event.title} gave you a "${kudoType}" kudo.`,
        linkUrl: `/profile`,
        isRead: false,
      });

      res.status(201).json(kudo);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ message: "You have already given a kudo for this event" });
      }
      console.error("Error creating kudo:", err);
      res.status(500).json({ message: "Failed to create kudo" });
    }
  });

  app.get("/api/og-image/event/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id as string);
      if (!event) return res.status(404).send("Not found");
      let clubName: string | undefined;
      let clubEmoji: string | undefined;
      if (event.clubId) {
        const club = await storage.getClub(event.clubId);
        clubName = club?.name;
        clubEmoji = club?.emoji;
      }
      const svg = buildEventSvg({
        title: event.title,
        startsAt: new Date(event.startsAt),
        locationText: event.locationText,
        clubName,
        clubEmoji,
      });
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      res.send(pngBuffer);
    } catch (err) {
      console.error("Error generating event OG image:", err);
      res.status(500).send("Error");
    }
  });

  app.get("/event/:id", async (req, res, next) => {
    try {
      if (!isCrawler(req.headers["user-agent"])) return next();
      const event = await storage.getEvent(req.params.id as string);
      if (!event) return next();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const d = new Date(event.startsAt);
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
      const fallbackDesc = event.description ?? `${dateStr} at ${event.locationText}`;
      const template = await readHtmlTemplate();
      const html = buildOgHtml(template, {
        title: `${event.title} | CultFam`,
        description: fallbackDesc.slice(0, 200),
        imageUrl: `${baseUrl}/api/og-image/event/${event.id}`,
        url: `${baseUrl}/event/${event.id}`,
        type: "website",
      });
      res.status(200).set("Content-Type", "text/html").end(html);
    } catch (err) {
      console.error("Error serving event OG page:", err);
      next();
    }
  });
}
