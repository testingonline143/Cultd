import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { CATEGORY_EMOJI } from "@shared/schema";
import { suggestCommissionForCity } from "../commission";

export function registerAdminRoutes(
  app: Express,
  isAdmin: RequestHandler,
): void {
  app.get("/api/admin/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const adminEnvId = process.env.ADMIN_USER_ID;
    const isEnvAdmin = !!(adminEnvId && userId === adminEnvId);
    let isDbAdmin = false;
    if (!isEnvAdmin && userId) {
      const user = await storage.getUser(userId);
      isDbAdmin = user?.role === "admin";
    }
    const isCurrentUserAdmin = isEnvAdmin || isDbAdmin;
    res.json({ configured: isCurrentUserAdmin, isCurrentUserAdmin });
  });

  app.get("/api/admin/join-requests", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const requests = await storage.getJoinRequests();
      res.json(requests);
    } catch (err) {
      console.error("Error fetching join requests:", err);
      res.status(500).json({ message: "Failed to fetch join requests" });
    }
  });

  app.patch("/api/admin/join-requests/:id/done", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updated = await storage.markJoinRequestDone(req.params.id as string);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error marking join request done:", err);
      res.status(500).json({ message: "Failed to update" });
    }
  });

  app.post("/api/admin/join-requests/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { clubId } = req.body;
      if (!clubId) return res.status(400).json({ message: "clubId required" });
      const updated = await storage.approveJoinRequestWithFoundingCheck(req.params.id, clubId);
      if (!updated) return res.status(404).json({ message: "Request not found" });
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
      res.json(updated);
    } catch (err) {
      console.error("Error admin approving join request:", err);
      res.status(500).json({ message: "Failed to approve request" });
    }
  });

  app.post("/api/admin/join-requests/:id/reject", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updated = await storage.rejectJoinRequest(req.params.id as string);
      if (!updated) return res.status(404).json({ message: "Request not found" });
      if (updated.userId) {
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
      console.error("Error admin rejecting join request:", err);
      res.status(500).json({ message: "Failed to reject request" });
    }
  });

  app.get("/api/admin/clubs", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const clubs = await storage.getClubs();
      res.json(clubs);
    } catch (err) {
      console.error("Error fetching admin clubs:", err);
      res.status(500).json({ message: "Failed to fetch clubs" });
    }
  });

  app.patch("/api/admin/clubs/:id/deactivate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updated = await storage.updateClub(req.params.id as string, { isActive: false });
      if (!updated) return res.status(404).json({ message: "Club not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error deactivating club:", err);
      res.status(500).json({ message: "Failed to deactivate club" });
    }
  });

  app.patch("/api/admin/clubs/:id/activate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updated = await storage.updateClub(req.params.id as string, { isActive: true });
      if (!updated) return res.status(404).json({ message: "Club not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error activating club:", err);
      res.status(500).json({ message: "Failed to activate club" });
    }
  });

  app.get("/api/admin/analytics", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (err) {
      console.error("Error fetching admin analytics:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err) {
      console.error("Error fetching admin users:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/role", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      if (!role || !["user", "organiser", "admin"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      const updated = await storage.updateUserRole(req.params.id as string, role);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating user role:", err);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.get("/api/admin/users/:id/detail", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const detail = await storage.getUserAdminDetail(req.params.id as string);
      res.json(detail);
    } catch (err) {
      console.error("Error fetching user detail:", err);
      res.status(500).json({ message: "Failed to fetch user detail" });
    }
  });

  app.get("/api/admin/events", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const events = await storage.getAllEventsAdmin();
      res.json(events);
    } catch (err) {
      console.error("Error fetching admin events:", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.delete("/api/admin/events/:eventId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.isCancelled) {
        return res.status(400).json({ message: "Event is already cancelled" });
      }
      await storage.cancelEvent(req.params.eventId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error admin cancelling event:", err);
      res.status(500).json({ message: "Failed to cancel event" });
    }
  });

  app.patch("/api/admin/events/:eventId/restore", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const updated = await storage.updateEvent(req.params.eventId, { isCancelled: false });
      res.json(updated);
    } catch (err) {
      console.error("Error restoring event:", err);
      res.status(500).json({ message: "Failed to restore event" });
    }
  });

  app.get("/api/admin/activity-feed", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const feed = await storage.getAdminActivityFeed();
      res.json(feed);
    } catch (err) {
      console.error("Error fetching admin activity feed:", err);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  app.get("/api/admin/polls", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const polls = await storage.getAllPollsAdmin();
      res.json(polls);
    } catch (err) {
      console.error("Error fetching admin polls:", err);
      res.status(500).json({ message: "Failed to fetch polls" });
    }
  });

  app.patch("/api/admin/polls/:id/close", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.closePollAdmin(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error closing poll:", err);
      res.status(500).json({ message: "Failed to close poll" });
    }
  });

  app.post("/api/admin/broadcast", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { title, message, linkUrl } = req.body;
      if (!title || typeof title !== "string" || title.trim().length < 2) {
        return res.status(400).json({ message: "Title is required (min 2 chars)" });
      }
      if (!message || typeof message !== "string" || message.trim().length < 5) {
        return res.status(400).json({ message: "Message is required (min 5 chars)" });
      }
      const sent = await storage.broadcastNotification(title.trim(), message.trim(), linkUrl || undefined);
      res.json({ sent });
    } catch (err) {
      console.error("Error broadcasting notification:", err);
      res.status(500).json({ message: "Failed to send broadcast" });
    }
  });

  app.get("/api/admin/growth", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const growth = await storage.getWeeklyGrowth();
      res.json(growth);
    } catch (err) {
      console.error("Error fetching growth data:", err);
      res.status(500).json({ message: "Failed to fetch growth data" });
    }
  });

  app.patch("/api/admin/clubs/:id/health", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { status, label } = req.body;
      if (!status || !label) return res.status(400).json({ message: "status and label required" });
      await storage.updateClubHealth(req.params.id as string, status, label);
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating club health:", err);
      res.status(500).json({ message: "Failed to update club health" });
    }
  });

  app.get("/api/admin/club-proposals", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const proposals = await storage.getAllClubProposals();
      res.json(proposals);
    } catch (err) {
      console.error("Error fetching admin proposals:", err);
      res.status(500).json({ message: "Failed to fetch proposals" });
    }
  });

  app.get("/api/admin/club-proposals/pending-count", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const count = await storage.getPendingProposalCount();
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch count" });
    }
  });

  app.patch("/api/admin/club-proposals/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, reviewNote, commissionType, commissionValue, commissionNote } = req.body;
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }
      const proposal = await storage.getClubProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      if (proposal.status !== "pending") return res.status(400).json({ message: "Proposal already reviewed" });

      if (status === "approved") {
        const emoji = CATEGORY_EMOJI[proposal.category] || "🎯";
        const newClub = await storage.createClub({
          name: proposal.clubName,
          category: proposal.category,
          emoji,
          shortDesc: proposal.shortDesc,
          fullDesc: proposal.shortDesc,
          organizerName: "",
          schedule: proposal.schedule,
          location: proposal.city,
          city: proposal.city,
          vibe: proposal.vibe,
          creatorUserId: proposal.userId,
          memberCount: 0,
          healthStatus: "green",
          healthLabel: "New Club",
          timeOfDay: "morning",
        });

        await storage.generateSlugForClub(newClub.id);

        if (commissionType && commissionValue !== undefined) {
          await storage.updateClubCommission(newClub.id, {
            commissionType,
            commissionValue: Number(commissionValue),
            commissionSetByAdmin: true,
            commissionNote: commissionNote || undefined,
          });
        }

        const proposalUser = await storage.getUser(proposal.userId);
        if (proposalUser) {
          if (proposalUser.role === "user") {
            await storage.updateUserRole(proposal.userId, "organiser");
          }
          if (proposalUser.firstName) {
            await storage.updateClub(newClub.id, { organizerName: proposalUser.firstName });
          }
        }

        await storage.createNotification({
          userId: proposal.userId,
          type: "proposal_approved",
          title: "Club Proposal Approved!",
          message: `Your club "${proposal.clubName}" has been approved! You can now manage it from your organizer dashboard.`,
          linkUrl: "/organizer",
        });
      } else {
        await storage.createNotification({
          userId: proposal.userId,
          type: "proposal_rejected",
          title: "Club Proposal Update",
          message: reviewNote
            ? `Your proposal for "${proposal.clubName}" was not approved. Note: ${reviewNote}`
            : `Your proposal for "${proposal.clubName}" was not approved at this time.`,
          linkUrl: "/profile",
        });
      }

      const updated = await storage.updateClubProposalStatus(req.params.id, status, reviewNote);
      res.json(updated);
    } catch (err) {
      console.error("Error updating proposal:", err);
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });

  app.patch("/api/admin/clubs/:id/commission", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { commissionType, commissionValue, commissionNote } = req.body;
      if (!commissionType || !["percentage", "fixed"].includes(commissionType)) {
        return res.status(400).json({ message: "commissionType must be 'percentage' or 'fixed'" });
      }
      const value = parseInt(String(commissionValue));
      if (isNaN(value) || value < 0) {
        return res.status(400).json({ message: "commissionValue must be a non-negative number" });
      }
      const updated = await storage.updateClubCommission(String(req.params.id), {
        commissionType,
        commissionValue: value,
        commissionSetByAdmin: true,
        commissionNote: commissionNote?.trim() || undefined,
      });
      if (!updated) return res.status(404).json({ message: "Club not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating commission:", err);
      res.status(500).json({ message: "Failed to update commission" });
    }
  });

  app.get("/api/admin/commission/suggest", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const city = req.query.city as string;
      if (!city) return res.status(400).json({ message: "city query param required" });
      const suggestion = suggestCommissionForCity(city);
      res.json(suggestion);
    } catch (err) {
      res.status(500).json({ message: "Failed to get suggestion" });
    }
  });

  app.get("/api/admin/payments", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
      const status = req.query.status ? String(req.query.status) : undefined;
      const clubId = req.query.clubId ? String(req.query.clubId) : undefined;

      const [stats, txResult] = await Promise.all([
        storage.getAdminPaymentStats(),
        storage.getPlatformTransactions({ status, clubId, page, limit }),
      ]);

      res.json({
        ...stats,
        transactions: txResult.transactions,
        total: txResult.total,
        page,
        limit,
      });
    } catch (err) {
      console.error("Error fetching admin payment stats:", err);
      res.status(500).json({ message: "Failed to fetch payment stats" });
    }
  });
}
