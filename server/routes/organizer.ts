import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";

export function registerOrganizerRoutes(
  app: Express,
  requireRole: (...roles: string[]) => RequestHandler,
  requireClubManager: (param?: string) => RequestHandler,
  requireEventManager: (param?: string) => RequestHandler,
): void {
  app.get("/api/organizer/my-club", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const clubs = await storage.getClubsForOrganiser(userId);
      if (clubs.length === 0) {
        return res.status(404).json({ message: "No club found" });
      }
      res.json(clubs[0]);
    } catch (err) {
      console.error("Error fetching organizer club:", err);
      res.status(500).json({ message: "Failed to fetch club" });
    }
  });

  app.get("/api/organizer/my-clubs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const clubs = await storage.getClubsForOrganiser(userId);
      res.json(clubs);
    } catch (err) {
      console.error("Error fetching organizer clubs:", err);
      res.status(500).json({ message: "Failed to fetch clubs" });
    }
  });

  app.get("/api/organizer/join-requests/:clubId", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(req.params.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const requests = await storage.getJoinRequestsByClub(req.params.clubId);
      res.json(requests);
    } catch (err) {
      console.error("Error fetching organizer join requests:", err);
      res.status(500).json({ message: "Failed to fetch join requests" });
    }
  });

  app.patch("/api/organizer/join-requests/:id/contacted", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const request = await storage.getJoinRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(request.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.markJoinRequestDone(req.params.id as string);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error marking contacted:", err);
      res.status(500).json({ message: "Failed to update" });
    }
  });

  app.patch("/api/organizer/join-requests/:id/approve", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const request = await storage.getJoinRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.status === "approved") return res.json(request);
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(request.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.approveJoinRequestWithFoundingCheck(req.params.id, request.clubId);
      if (updated) {
        if (updated.userId) {
          const club = await storage.getClub(updated.clubId);
          await storage.createNotification({
            userId: updated.userId,
            type: "join_approved",
            title: "Membership Approved!",
            message: `You've been approved to join ${club?.name || updated.clubName}. Welcome aboard!`,
            linkUrl: `/club/${updated.clubId}`,
            isRead: false,
          });
        }
      }
      res.json(updated);
    } catch (err) {
      console.error("Error approving join request:", err);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  app.patch("/api/organizer/join-requests/:id/reject", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const request = await storage.getJoinRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(request.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.rejectJoinRequest(req.params.id as string);
      if (updated && updated.userId) {
        const club = await storage.getClub(updated.clubId);
        await storage.createNotification({
          userId: updated.userId,
          type: "join_rejected",
          title: "Membership Update",
          message: `Your request to join ${club?.name || updated.clubName} was not approved at this time.`,
          linkUrl: `/club/${updated.clubId}`,
          isRead: false,
        });
      }
      res.json(updated);
    } catch (err) {
      console.error("Error rejecting join request:", err);
      res.status(500).json({ message: "Failed to reject" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/members/:requestId", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(req.params.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const request = await storage.getJoinRequest(req.params.requestId);
      if (!request || request.clubId !== req.params.clubId) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (request.status === "approved") {
        await storage.decrementMemberCount(req.params.clubId);
      }
      await storage.deleteJoinRequest(req.params.requestId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing member:", err);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/members", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isManager = await storage.isClubManager(req.params.clubId, userId);
      if (!isManager) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const members = await storage.getClubMembersEnriched(req.params.clubId);
      res.json(members);
    } catch (err) {
      console.error("Error fetching members:", err);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/pending-count", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!(await storage.isClubManager(req.params.clubId, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const count = await storage.getPendingJoinRequestCount(req.params.clubId);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/insights", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!(await storage.isClubManager(req.params.clubId, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const insights = await storage.getOrganizerInsights(req.params.clubId);
      res.json(insights);
    } catch (err) {
      console.error("Error fetching organizer insights:", err);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/analytics", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!(await storage.isClubManager(req.params.clubId, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const analytics = await storage.getClubAnalytics(req.params.clubId);
      res.json(analytics);
    } catch (err) {
      console.error("Error fetching club analytics:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.patch("/api/organizer/club/:id", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { shortDesc, fullDesc, schedule, location, healthStatus, highlights, organizerName, whatsappNumber, joinQuestion1, joinQuestion2 } = req.body;
      const updateData: Record<string, any> = {};
      if (shortDesc !== undefined) updateData.shortDesc = shortDesc;
      if (fullDesc !== undefined) updateData.fullDesc = fullDesc;
      if (schedule !== undefined) updateData.schedule = schedule;
      if (location !== undefined) updateData.location = location;
      if (healthStatus !== undefined) updateData.healthStatus = healthStatus;
      if (highlights !== undefined) updateData.highlights = highlights;
      if (organizerName !== undefined) updateData.organizerName = organizerName;
      if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
      if (joinQuestion1 !== undefined) updateData.joinQuestion1 = joinQuestion1 || null;
      if (joinQuestion2 !== undefined) updateData.joinQuestion2 = joinQuestion2 || null;
      const updated = await storage.updateClub(req.params.id, updateData);
      if (!updated) return res.status(404).json({ message: "Club not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating club:", err);
      res.status(500).json({ message: "Failed to update club" });
    }
  });

  app.patch("/api/organizer/clubs/:clubId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { name, shortDesc, schedule, location } = req.body;
      const updates: any = {};
      if (typeof name === "string" && name.trim().length > 0) updates.name = name.trim();
      if (typeof shortDesc === "string") updates.shortDesc = shortDesc;
      if (typeof schedule === "string") updates.schedule = schedule;
      if (typeof location === "string") updates.location = location;
      if (Object.keys(updates).length === 0) return res.json(await storage.getClub(req.params.clubId));
      const result = await storage.updateClub(req.params.clubId, updates);
      res.json(result || {});
    } catch (err) {
      console.error("Error updating club profile:", err);
      res.status(500).json({ message: "Failed to update club profile" });
    }
  });

  app.patch("/api/organizer/clubs/:clubId/slug", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { slug } = req.body;
      if (!slug || typeof slug !== "string" || slug.length < 2 || slug.length > 60) {
        return res.status(400).json({ message: "Slug must be 2-60 characters" });
      }
      const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (cleaned.length < 2) return res.status(400).json({ message: "Slug must contain at least 2 valid characters" });
      const existing = await storage.getClubBySlug(cleaned);
      if (existing && existing.id !== req.params.clubId) {
        return res.status(409).json({ message: "This URL is already taken" });
      }
      const updated = await storage.updateClubSlug(req.params.clubId, cleaned);
      res.json(updated);
    } catch (err) {
      console.error("Error updating slug:", err);
      res.status(500).json({ message: "Failed to update slug" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/generate-slug", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const slug = await storage.generateSlugForClub(req.params.clubId);
      if (!slug) return res.status(404).json({ message: "Club not found" });
      res.json({ slug });
    } catch (err) {
      console.error("Error generating slug:", err);
      res.status(500).json({ message: "Failed to generate slug" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/page-sections", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const sections = await storage.getPageSections(req.params.clubId);
      const withEvents = await Promise.all(sections.map(async (s) => {
        const evts = await storage.getSectionEvents(s.id);
        return { ...s, events: evts };
      }));
      res.json(withEvents);
    } catch (err) {
      console.error("Error fetching page sections:", err);
      res.status(500).json({ message: "Failed to fetch page sections" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/page-sections", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { title, description, emoji, layout } = req.body;
      if (!title || typeof title !== "string" || title.length < 1) {
        return res.status(400).json({ message: "Title is required" });
      }
      const existing = await storage.getPageSections(req.params.clubId);
      const section = await storage.createPageSection({
        clubId: req.params.clubId,
        title,
        description: description || null,
        emoji: emoji || "📌",
        layout: layout || "full",
        position: existing.length,
        isVisible: true,
      });
      res.status(201).json(section);
    } catch (err) {
      console.error("Error creating page section:", err);
      res.status(500).json({ message: "Failed to create section" });
    }
  });

  app.patch("/api/organizer/clubs/:clubId/page-sections/:sectionId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const sections = await storage.getPageSections(req.params.clubId);
      const owns = sections.some(s => s.id === req.params.sectionId);
      if (!owns) return res.status(403).json({ message: "Section does not belong to this club" });
      const { title, description, emoji, layout, isVisible } = req.body;
      const updated = await storage.updatePageSection(req.params.sectionId, {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(emoji !== undefined && { emoji }),
        ...(layout !== undefined && { layout }),
        ...(isVisible !== undefined && { isVisible }),
      });
      if (!updated) return res.status(404).json({ message: "Section not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating page section:", err);
      res.status(500).json({ message: "Failed to update section" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/page-sections/:sectionId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const sections = await storage.getPageSections(req.params.clubId);
      const owns = sections.some(s => s.id === req.params.sectionId);
      if (!owns) return res.status(403).json({ message: "Section does not belong to this club" });
      await storage.deletePageSection(req.params.sectionId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting page section:", err);
      res.status(500).json({ message: "Failed to delete section" });
    }
  });

  app.patch("/api/organizer/clubs/:clubId/page-sections/reorder", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { sectionIds } = req.body;
      if (!Array.isArray(sectionIds)) return res.status(400).json({ message: "sectionIds required" });
      await storage.reorderPageSections(req.params.clubId, sectionIds);
      res.json({ success: true });
    } catch (err) {
      console.error("Error reordering sections:", err);
      res.status(500).json({ message: "Failed to reorder sections" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/page-sections/:sectionId/events", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const sections = await storage.getPageSections(req.params.clubId);
      const owns = sections.some(s => s.id === req.params.sectionId);
      if (!owns) return res.status(403).json({ message: "Section does not belong to this club" });
      const { eventId } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId required" });
      const existing = await storage.getSectionEvents(req.params.sectionId);
      const se = await storage.addSectionEvent(req.params.sectionId, eventId, existing.length);
      res.status(201).json(se);
    } catch (err) {
      console.error("Error adding event to section:", err);
      res.status(500).json({ message: "Failed to add event" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/page-sections/:sectionId/events/:seId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const sections = await storage.getPageSections(req.params.clubId);
      const owns = sections.some(s => s.id === req.params.sectionId);
      if (!owns) return res.status(403).json({ message: "Section does not belong to this club" });
      await storage.removeSectionEvent(req.params.seId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing event from section:", err);
      res.status(500).json({ message: "Failed to remove event" });
    }
  });

  app.get("/api/organizer/events/:eventId/attendance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const club = await storage.getClub(event.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Only club managers can view attendance reports" });
      }
      const attendees = await storage.getEventAttendanceReport(event.id, club.id);
      const goingCount = attendees.filter(a => a.status === "going").length;
      const waitlistCount = attendees.filter(a => a.status === "waitlisted").length;
      const checkedInCount = attendees.filter(a => a.checkedIn === true).length;
      res.json({ attendees, goingCount, waitlistCount, checkedInCount });
    } catch (err) {
      console.error("Error fetching event attendance report:", err);
      res.status(500).json({ message: "Failed to fetch attendance report" });
    }
  });

  app.patch("/api/organizer/events/:eventId/cancel", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      if (event.isCancelled) {
        return res.status(400).json({ message: "Event is already cancelled" });
      }
      const updated = await storage.cancelEvent(event.id);
      res.json({ success: true, event: updated });
    } catch (err) {
      console.error("Error cancelling event:", err);
      res.status(500).json({ message: "Failed to cancel event" });
    }
  });

  app.post("/api/organizer/events/:eventId/tickets", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      const { name, price, description } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ message: "Ticket name is required" });
      }
      const parsedPrice = parseInt(String(price ?? 0));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: "Price must be a non-negative number" });
      }
      const existing = await storage.getEventTicketTypes(event.id);
      const ticket = await storage.createEventTicketType(event.id, {
        name: String(name).trim().slice(0, 100),
        price: parsedPrice,
        description: description ? String(description).trim().slice(0, 300) : undefined,
        sortOrder: existing.length,
      });
      res.status(201).json(ticket);
    } catch (err) {
      console.error("Error creating ticket type:", err);
      res.status(500).json({ message: "Failed to create ticket type" });
    }
  });

  app.patch("/api/organizer/events/:eventId/tickets/:ticketId", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      if (isNaN(ticketId)) return res.status(400).json({ message: "Invalid ticket ID" });
      const event = req.resolvedEvent;
      const existing = await storage.getEventTicketTypes(event.id);
      if (!existing.find(t => t.id === ticketId)) {
        return res.status(404).json({ message: "Ticket type not found" });
      }
      const updates: { name?: string; price?: number; description?: string | null } = {};
      if (req.body.name !== undefined) updates.name = String(req.body.name).trim().slice(0, 100);
      if (req.body.price !== undefined) {
        const p = parseInt(String(req.body.price));
        if (!isNaN(p) && p >= 0) updates.price = p;
      }
      if (req.body.description !== undefined) {
        updates.description = req.body.description ? String(req.body.description).trim().slice(0, 300) : null;
      }
      const updated = await storage.updateEventTicketType(ticketId, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update ticket type" });
    }
  });

  app.delete("/api/organizer/events/:eventId/tickets/:ticketId", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      if (isNaN(ticketId)) return res.status(400).json({ message: "Invalid ticket ID" });
      const event = req.resolvedEvent;
      const existing = await storage.getEventTicketTypes(event.id);
      if (!existing.find(t => t.id === ticketId)) {
        return res.status(404).json({ message: "Ticket type not found for this event" });
      }
      await storage.deleteEventTicketType(ticketId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete ticket type" });
    }
  });

  app.post("/api/organizer/events/:eventId/form/questions", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      const { question } = req.body;
      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ message: "Question text is required" });
      }
      const existingQuestions = await storage.getEventFormQuestions(event.id);
      const sortOrder = existingQuestions.length;
      const created = await storage.addEventFormQuestion(event.id, question.trim(), sortOrder);
      res.json(created);
    } catch (err) {
      res.status(500).json({ message: "Failed to add question" });
    }
  });

  app.delete("/api/organizer/events/:eventId/form/questions/:questionId", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      const questions = await storage.getEventFormQuestions(event.id);
      const ownedQuestion = questions.find(q => q.id === req.params.questionId);
      if (!ownedQuestion) return res.status(404).json({ message: "Question not found for this event" });
      await storage.deleteEventFormQuestion(req.params.questionId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  app.patch("/api/organizer/events/:eventId/form/mandatory", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      const { mandatory } = req.body;
      if (typeof mandatory !== "boolean") return res.status(400).json({ message: "mandatory must be a boolean" });
      const updated = await storage.setEventFormMandatory(event.id, mandatory);
      res.json({ success: true, formMandatory: updated?.formMandatory });
    } catch (err) {
      res.status(500).json({ message: "Failed to update form setting" });
    }
  });

  app.get("/api/organizer/events/:eventId/form-responses", isAuthenticated, requireEventManager(), async (req: any, res) => {
    try {
      const event = req.resolvedEvent;
      const responses = await storage.getEventFormResponses(event.id);
      res.json(responses);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch form responses" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/survey-summary", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const summary = await storage.getClubSurveySummary(req.params.clubId);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch survey summary" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/announcements", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { title, body, isPinned, notifyMembers } = req.body;
      if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: "Title and body are required" });
      }
      const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Organiser";
      const announcement = await storage.createAnnouncement({
        clubId: req.params.clubId,
        authorUserId: userId,
        authorName,
        title: title.trim(),
        body: body.trim(),
        isPinned: !!isPinned,
      });
      if (notifyMembers) {
        const memberIds = await storage.getClubMemberUserIds(req.params.clubId);
        const club = await storage.getClub(req.params.clubId);
        await Promise.all(memberIds.map(memberId =>
          storage.createNotification({
            userId: memberId,
            type: "announcement",
            title: `${club?.name ?? "Club"}: ${title.trim()}`,
            message: body.trim().slice(0, 120),
            linkUrl: `/clubs/${req.params.clubId}`,
          })
        ));
      }
      res.json(announcement);
    } catch (err) {
      console.error("Error creating announcement:", err);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/announcements/:id", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id, req.params.clubId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting announcement:", err);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/polls", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { question, options } = req.body;
      if (!question?.trim()) return res.status(400).json({ message: "Question is required" });
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ message: "At least 2 options required" });
      }
      const poll = await storage.createPoll({
        clubId: req.params.clubId,
        question: question.trim(),
        options: options.map((o: string) => o.trim()).filter(Boolean),
      });
      res.json(poll);
    } catch (err) {
      console.error("Error creating poll:", err);
      res.status(500).json({ message: "Failed to create poll" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/polls/:pollId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      await storage.deletePoll(req.params.pollId, req.params.clubId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting poll:", err);
      res.status(500).json({ message: "Failed to delete poll" });
    }
  });

  app.patch("/api/organizer/clubs/:clubId/polls/:pollId/close", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      await storage.closePoll(req.params.pollId, req.params.clubId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error closing poll:", err);
      res.status(500).json({ message: "Failed to close poll" });
    }
  });

  app.get("/api/organizer/clubs/:clubId/co-organisers", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const club = await storage.getClub(req.params.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const ids = (club.coOrganiserUserIds ?? []).filter(id => id !== club.creatorUserId);
      const members = await Promise.all(ids.map(id => storage.getUser(id)));
      res.json(members.filter(Boolean).map(u => ({
        userId: u!.id,
        name: [u!.firstName, u!.lastName].filter(Boolean).join(" ") || "Member",
        profileImageUrl: u!.profileImageUrl,
      })));
    } catch (err) {
      console.error("Error fetching co-organisers:", err);
      res.status(500).json({ message: "Failed to fetch co-organisers" });
    }
  });

  app.post("/api/organizer/clubs/:clubId/co-organisers", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const club = await storage.getClub(req.params.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (userId === club.creatorUserId) {
        return res.status(400).json({ message: "Creator is already the owner" });
      }
      if ((club.coOrganiserUserIds ?? []).includes(userId)) {
        return res.status(400).json({ message: "Already a co-organiser" });
      }
      const isMember = await storage.hasUserJoinedClub(req.params.clubId, userId);
      if (!isMember) {
        return res.status(400).json({ message: "User must be an approved member of the club" });
      }
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await storage.addCoOrganiser(req.params.clubId, userId);
      if (targetUser.role === "user") {
        await storage.updateUserRole(userId, "organiser");
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error adding co-organiser:", err);
      res.status(500).json({ message: "Failed to add co-organiser" });
    }
  });

  app.delete("/api/organizer/clubs/:clubId/co-organisers/:userId", isAuthenticated, requireClubManager(), async (req: any, res) => {
    try {
      const club = await storage.getClub(req.params.clubId);
      if (club && req.params.userId === club.creatorUserId) {
        return res.status(400).json({ message: "Cannot remove the club creator" });
      }
      await storage.removeCoOrganiser(req.params.clubId, req.params.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error removing co-organiser:", err);
      res.status(500).json({ message: "Failed to remove co-organiser" });
    }
  });
}
