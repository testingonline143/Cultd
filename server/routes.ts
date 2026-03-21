import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import multer from "multer";
import QRCode from "qrcode";
import crypto from "crypto";
import { storage } from "./storage";
import { insertJoinRequestSchema, insertQuizAnswersSchema, insertEventSchema, CATEGORY_EMOJI } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { isAuthenticated, registerAuthRoutes, supabase } from "./auth";
import type { RequestHandler } from "express";
import { isCrawler, readHtmlTemplate, buildOgHtml, buildClubSvg, buildEventSvg } from "./og";
import { razorpay, getRazorpayKeyId, isTestMode, fetchRazorpayPayment, fetchRazorpayOrder, createRazorpayOrder, createRouteTransfer, createRazorpayContact, createRazorpayFundAccount, RazorpayOrderEntity } from "./razorpay";
import { calculateCommission, suggestCommissionForCity } from "./commission";

import fs from "fs/promises";
import sharp from "sharp";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const adminEnvId = process.env.ADMIN_USER_ID;
    if (adminEnvId && userId === adminEnvId) {
      return next();
    }
    const user = await storage.getUser(userId);
    if (user?.role === "admin") {
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  } catch (err) {
    console.error("Error checking admin access:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

function requireClubManager(clubIdParam = "clubId"): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const clubId = req.params[clubIdParam];
      const ok = await storage.isClubManager(clubId, userId);
      if (!ok) return res.status(403).json({ message: "Forbidden: not a club manager" });
      next();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

// requireEventManager is the event-scoped equivalent of requireClubManager.
// It resolves the event by URL param, then enforces club-manager ownership via storage.isClubManager.
// It attaches req.resolvedEvent so handlers don't need a second event lookup.
function requireEventManager(eventIdParam = "eventId"): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const eventId = req.params[eventIdParam];
      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      const ok = await storage.isClubManager(event.clubId, userId);
      if (!ok) return res.status(403).json({ message: "Forbidden: not a club manager for this event" });
      (req as any).resolvedEvent = event;
      next();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

function requireRole(...roles: string[]): RequestHandler {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden: insufficient role" });
      }
      next();
    } catch (err) {
      console.error("Error checking role:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);

  app.get("/api/clubs", async (req, res) => {
    try {
      const { category, search, city, vibe } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "20", 10)));
      const offset = (page - 1) * limit;
      if (search || city || vibe || (category && category !== "all")) {
        const [clubs, total] = await Promise.all([
          storage.searchClubs({ search, category, city, vibe, limit, offset }),
          storage.searchClubsCount({ search, category, city, vibe }),
        ]);
        return res.json({ clubs, total, page, limit });
      }
      const [clubs, total] = await Promise.all([
        storage.getClubs({ limit, offset }),
        storage.getClubsCount(),
      ]);
      res.json({ clubs, total, page, limit });
    } catch (err) {
      console.error("Error fetching clubs:", err);
      res.status(500).json({ message: "Failed to fetch clubs" });
    }
  });

  app.get("/api/clubs/:id", async (req, res) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) {
        return res.status(404).json({ message: "Club not found" });
      }
      res.json(club);
    } catch (err) {
      console.error("Error fetching club:", err);
      res.status(500).json({ message: "Failed to fetch club" });
    }
  });

  app.post("/api/join", isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertJoinRequestSchema.parse(req.body);
      if (!validated.name || validated.name.length < 2) {
        return res.status(400).json({ success: false, message: "Name is required (minimum 2 characters)" });
      }
      if (!validated.phone || validated.phone.replace(/\D/g, "").length < 10) {
        return res.status(400).json({ success: false, message: "Phone is required (minimum 10 digits)" });
      }
      const userId = req.user.claims.sub;
      const existing = await storage.hasExistingJoinRequest(validated.clubId, userId);
      if (existing) {
        if (existing.status === "pending") {
          return res.status(400).json({ success: false, message: "You already have a pending request for this club" });
        }
        if (existing.status === "approved") {
          return res.status(400).json({ success: false, message: "You are already a member of this club" });
        }
        if (existing.status === "rejected") {
          await storage.deleteJoinRequest(existing.id);
        }
      }
      const { answer1, answer2 } = req.body;
      const club = await storage.getClub(validated.clubId);
      const isFoundingMember = ((club?.foundingTaken ?? 0) < (club?.foundingTotal ?? 20));
      const request = await storage.createJoinRequest({
        ...validated,
        userId,
        status: "approved",
        isFoundingMember,
        answer1: answer1 || null,
        answer2: answer2 || null,
      });
      await storage.incrementMemberCount(validated.clubId);
      res.json({ success: true, message: "You've joined the club!", data: request, club });
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        return res.status(400).json({ success: false, message: validationError.message });
      }
      console.error("Error creating join request:", err);
      res.status(500).json({ success: false, message: "Failed to save join request" });
    }
  });

  app.post("/api/onboarding/quick-join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const joinedClubs = await storage.autoJoinSampleClubs(userId);
      res.json({ clubs: joinedClubs });
    } catch (err) {
      console.error("Error auto-joining sample clubs:", err);
      res.status(500).json({ message: "Failed to auto-join clubs" });
    }
  });

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

  app.get("/api/admin/events", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const events = await storage.getAllEventsAdmin();
      res.json(events);
    } catch (err) {
      console.error("Error fetching admin events:", err);
      res.status(500).json({ message: "Failed to fetch events" });
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

  app.get("/api/admin/users/:id/detail", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const detail = await storage.getUserAdminDetail(req.params.id as string);
      res.json(detail);
    } catch (err) {
      console.error("Error fetching user detail:", err);
      res.status(500).json({ message: "Failed to fetch user detail" });
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

  app.post("/api/club-proposals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { clubName, category, vibe, shortDesc, city, schedule, motivation } = req.body;
      if (!clubName || clubName.length < 3) return res.status(400).json({ message: "Club name must be at least 3 characters" });
      if (!category) return res.status(400).json({ message: "Category is required" });
      if (!shortDesc) return res.status(400).json({ message: "Description is required" });
      if (!schedule) return res.status(400).json({ message: "Schedule is required" });
      if (!motivation) return res.status(400).json({ message: "Motivation is required" });
      const proposal = await storage.createClubProposal({
        userId,
        clubName,
        category,
        vibe: vibe || "casual",
        shortDesc,
        city: city || "Tirupati",
        schedule,
        motivation,
      });
      res.status(201).json(proposal);
    } catch (err) {
      console.error("Error creating club proposal:", err);
      res.status(500).json({ message: "Failed to submit proposal" });
    }
  });

  app.get("/api/club-proposals/mine", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const proposals = await storage.getClubProposalsByUser(userId);
      res.json(proposals);
    } catch (err) {
      console.error("Error fetching user proposals:", err);
      res.status(500).json({ message: "Failed to fetch proposals" });
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

        // Auto-generate a shareable slug for the club
        await storage.generateSlugForClub(newClub.id);

        // Set commission if provided
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

  // Public club page by slug — no auth required
  app.get("/api/c/:slug", async (req, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug);
      if (!club || !club.isActive) {
        return res.status(404).json({ message: "Club not found" });
      }
      const pageData = await storage.getPublicPageData(club.id);
      res.json(pageData);
    } catch (err) {
      console.error("Error fetching public club page:", err);
      res.status(500).json({ message: "Failed to fetch club page" });
    }
  });

  app.post("/api/clubs/create", isAuthenticated, requireRole("organiser", "admin"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, category, shortDesc, fullDesc, schedule, location, organizerName, whatsappNumber, city } = req.body;

      if (!name || name.length < 3) {
        return res.status(400).json({ success: false, message: "Club name must be at least 3 characters" });
      }
      if (!category) {
        return res.status(400).json({ success: false, message: "Category is required" });
      }
      if (!organizerName || organizerName.length < 2) {
        return res.status(400).json({ success: false, message: "Organizer name must be at least 2 characters" });
      }

      const emoji = CATEGORY_EMOJI[category] || "🎯";
      let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
      if (baseSlug.length < 2) baseSlug = `club-${Date.now().toString(36)}`;
      let finalSlug = baseSlug;
      let slugAttempt = 0;
      while (await storage.getClubBySlug(finalSlug)) {
        slugAttempt++;
        finalSlug = `${baseSlug}-${slugAttempt}`;
      }

      const club = await storage.createClub({
        name,
        category,
        emoji,
        shortDesc: shortDesc || `New ${category.toLowerCase()} club in ${city || "Tirupati"}.`,
        fullDesc: fullDesc || `${name} is a newly formed ${category.toLowerCase()} community in ${city || "Tirupati"}, organized by ${organizerName}. Join us and be a founding member!`,
        organizerName,
        organizerYears: "New organizer",
        organizerAvatar: "🧑",
        organizerResponse: "Responds within 24 hrs",
        memberCount: 1,
        schedule: schedule || "To be announced",
        location: location || city || "Tirupati",
        city: city || "Tirupati",
        vibe: "casual",
        activeSince: new Date().getFullYear().toString(),
        whatsappNumber: whatsappNumber || null,
        healthStatus: "green",
        healthLabel: "Very Active",
        lastActive: "Just started",
        foundingTaken: 1,
        foundingTotal: 20,
        bgColor: "#f0f9f0",
        timeOfDay: "morning",
        isActive: true,
        creatorUserId: userId,
        slug: finalSlug,
      });

      const currentUser = await storage.getUser(userId);
      if (currentUser && currentUser.role === "user") {
        await storage.updateUserRole(userId, "organiser");
      }

      const existingRequest = await storage.hasExistingJoinRequest(club.id, userId);
      if (!existingRequest) {
        const creatorName = currentUser
          ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") || organizerName
          : organizerName;
        const joinReq = await storage.createJoinRequest({
          clubId: club.id,
          clubName: club.name,
          name: creatorName,
          phone: "organiser",
          userId,
          status: "pending",
          isFoundingMember: true,
        });
        await storage.approveJoinRequestWithFoundingCheck(joinReq.id, club.id);
      }

      res.status(201).json({ success: true, message: "Club created and live!", club, isProposal: false });
    } catch (err) {
      console.error("Error creating club:", err);
      res.status(500).json({ success: false, message: "Failed to create club" });
    }
  });

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

  app.get("/api/user/join-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getJoinRequestsByUser(userId);
      res.json(requests);
    } catch (err) {
      console.error("Error fetching user join requests:", err);
      res.status(500).json({ message: "Failed to fetch join requests" });
    }
  });

  app.get("/api/user/clubs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userClubs = await storage.getUserApprovedClubs(userId);
      res.json(userClubs);
    } catch (err) {
      console.error("Error fetching user clubs:", err);
      res.status(500).json({ message: "Failed to fetch user clubs" });
    }
  });

  app.get("/api/feed", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub as string | undefined;
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "10", 10)));
      const offset = (page - 1) * limit;
      const [moments, total] = await Promise.all([
        storage.getFeedMoments(limit, userId, offset),
        storage.getFeedMomentsCount(),
      ]);
      res.json({ moments, total, page, limit });
    } catch (err) {
      console.error("Error fetching feed:", err);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, bio, city, profileImageUrl } = req.body;
      
      const updates: Record<string, any> = {};
      
      if (name !== undefined) {
        if (name.length < 2) {
          return res.status(400).json({ success: false, message: "Name is required (minimum 2 characters)" });
        }
        updates.firstName = name;
      }
      
      if (bio !== undefined) {
        updates.bio = bio.slice(0, 200);
      }
      
      if (city !== undefined && city.trim().length > 0) {
        updates.city = city.trim();
      }

      if (profileImageUrl !== undefined) {
        updates.profileImageUrl = profileImageUrl;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: "No updates provided" });
      }

      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      res.json({ success: true, user });
    } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ success: false, message: "Failed to update profile" });
    }
  });


  app.post("/api/quiz", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertQuizAnswersSchema.parse({ ...req.body, userId });
      const answers = await storage.saveQuizAnswers(validated);
      await storage.updateUser(userId, { quizCompleted: true });
      if (req.body.city) {
        await storage.updateUser(userId, { city: req.body.city });
      }
      res.json({ success: true, answers });
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        return res.status(400).json({ success: false, message: validationError.message });
      }
      console.error("Error saving quiz:", err);
      res.status(500).json({ success: false, message: "Failed to save quiz answers" });
    }
  });

  app.get("/api/quiz/matches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const quizAnswers = await storage.getQuizAnswers(userId);
      if (!quizAnswers) {
        return res.status(404).json({ message: "No quiz answers found" });
      }
      const user = await storage.getUser(userId);
      const allClubs = await storage.getClubs();
      const scored = allClubs.map((club) => {
        let score = 0;
        const interestMatch = quizAnswers.interests.some(
          (i) => i.toLowerCase() === club.category.toLowerCase()
        );
        if (interestMatch) score += 50;
        if (club.vibe === quizAnswers.vibePreference) score += 25;
        if (user?.city && club.city === user.city) score += 15;
        if (club.memberCount > 0) score += Math.min(10, club.memberCount);
        return { ...club, matchScore: Math.min(score, 99) };
      });
      scored.sort((a, b) => b.matchScore - a.matchScore);
      res.json(scored.slice(0, 6));
    } catch (err) {
      console.error("Error fetching matches:", err);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

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

      // Survey form gate — only block if mandatory, questions exist, and no responses provided yet
      if (event.formMandatory) {
        const questions = await storage.getEventFormQuestions(event.id);
        if (questions.length > 0) {
          const formResponses: { questionId: string; answer: string }[] = req.body?.formResponses ?? [];
          if (formResponses.length === 0) {
            return res.json({ success: false, requiresForm: true, questions });
          }
          // Validate all questions answered with non-empty text
          const answeredMap = new Map(formResponses.map((r: any) => [r.questionId, (r.answer ?? "").trim()]));
          const missingAnswer = questions.find(q => !answeredMap.get(q.id));
          if (missingAnswer) {
            return res.json({ success: false, requiresForm: true, questions, message: "Please answer all required questions" });
          }
        }
      }

      // Validate submitted questionIds belong to this event + sanitize answers before saving
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

      // Validate ticketTypeId — required when event has ticket types
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
        // If the selected ticket has a price, the client must use the payment flow
        if (ticket.price > 0) {
          return res.status(402).json({ success: false, requiresPayment: true, message: "This is a paid ticket — please complete payment to RSVP" });
        }
      } else if (rawTicketTypeId !== undefined && rawTicketTypeId !== null) {
        const parsed = parseInt(String(rawTicketTypeId));
        if (!isNaN(parsed)) {
          const ticket = eventTickets.find(t => t.id === parsed);
          if (ticket) { ticketTypeId = ticket.id; ticketTypeName = ticket.name; }
        }
      }

      const rsvpCount = await storage.getRsvpCount(event.id);
      if (rsvpCount >= event.maxCapacity) {
        const rsvp = await storage.createRsvp({ eventId: event.id, userId, status: "waitlisted", ticketTypeId, ticketTypeName });
        const position = await storage.getUserWaitlistPosition(event.id, userId);
        if (allFormResponses.length > 0) {
          await storage.saveEventFormResponses(event.id, userId, allFormResponses);
        }
        return res.json({ success: true, rsvp, waitlisted: true, position });
      }
      const rsvp = await storage.createRsvp({ eventId: event.id, userId, status: "going", ticketTypeId, ticketTypeName });
      if (allFormResponses.length > 0) {
        await storage.saveEventFormResponses(event.id, userId, allFormResponses);
      }
      const eventDate = new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      await storage.createNotification({
        userId,
        type: "rsvp_confirmed",
        title: "You're in!",
        message: `You're registered for ${event.title} on ${eventDate}. See you there!`,
        linkUrl: `/event/${event.id}`,
        isRead: false,
      });
      res.json({ success: true, rsvp });
    } catch (err) {
      console.error("Error creating RSVP:", err);
      res.status(500).json({ success: false, message: "Failed to RSVP" });
    }
  });

  // ── Event Ticket Types routes ─────────────────────────────────────

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

  // ── Event Survey Form routes ──────────────────────────────────────

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
      // Verify the question belongs to this event before deleting (IDOR prevention)
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

  app.delete("/api/clubs/:id/leave", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existing = await storage.hasExistingJoinRequest(req.params.id, userId);
      if (!existing) {
        return res.status(404).json({ message: "You are not a member of this club" });
      }
      if (existing.status === "approved") {
        await storage.decrementMemberCount(req.params.id);
      }
      await storage.deleteJoinRequest(existing.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error leaving club:", err);
      res.status(500).json({ message: "Failed to leave club" });
    }
  });

  app.get("/api/clubs/:id/join-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getUserJoinStatus(req.params.id, userId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to check status" });
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

  let statsCache: { data: any; expiresAt: number } | null = null;

  app.get("/api/stats", async (_req, res) => {
    try {
      if (statsCache && Date.now() < statsCache.expiresAt) {
        return res.json(statsCache.data);
      }
      const stats = await storage.getStats();
      statsCache = { data: stats, expiresAt: Date.now() + 5 * 60 * 1000 };
      res.json(stats);
    } catch (err) {
      console.error("Error fetching stats:", err);
      res.status(500).json({ message: "Failed to fetch stats" });
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

  app.get("/api/events/:id/attendance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const club = await storage.getClub(event.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Only the club organizer can view attendance" });
      }
      const attendees = await storage.getEventAttendees(req.params.id);
      const checkedIn = attendees.filter(a => a.checkedIn).length;
      const totalRsvps = attendees.length;
      res.json({
        totalRsvps,
        checkedIn,
        notYetArrived: totalRsvps - checkedIn,
        attendees: attendees.map(a => ({
          rsvpId: a.id,
          name: a.userName,
          checkedIn: !!a.checkedIn,
          checkedInAt: a.checkedInAt,
        })),
      });
    } catch (err) {
      console.error("Error fetching attendance:", err);
      res.status(500).json({ message: "Failed to fetch attendance" });
    }
  });

  app.get("/api/events/:id/attendees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const club = await storage.getClub(event.clubId);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Only the club organizer can view attendees" });
      }
      const attendees = await storage.getEventAttendees(req.params.id);
      const checkedInCount = await storage.getCheckedInCount(req.params.id);
      res.json({ attendees, checkedInCount, totalRsvps: attendees.length });
    } catch (err) {
      console.error("Error fetching attendees:", err);
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  app.get("/api/user/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rsvps = await storage.getRsvpsByUser(userId);
      res.json(rsvps);
    } catch (err) {
      console.error("Error fetching user events:", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/club/:id", async (req, res, next) => {
    try {
      const ua = req.headers["user-agent"] || "";
      const isBot = /bot|crawl|spider|facebook|whatsapp|telegram|twitter|slack|linkedin|discord/i.test(ua);
      if (!isBot) {
        return next();
      }
      const club = await storage.getClub(req.params.id);
      if (!club) {
        return next();
      }
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeDesc = esc(club.shortDesc);
      const safeName = esc(club.name);
      const html = `<!DOCTYPE html><html><head>
        <title>${club.emoji} ${safeName} - CultFam</title>
        <meta property="og:title" content="${club.emoji} ${safeName} - CultFam" />
        <meta property="og:description" content="${safeDesc}" />
        <meta property="og:type" content="website" />
        <meta name="description" content="${safeDesc}" />
      </head><body><p>${club.emoji} ${safeName} — ${safeDesc}</p></body></html>`;
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      next();
    }
  });

  app.get("/event/:id", async (req, res, next) => {
    try {
      const ua = req.headers["user-agent"] || "";
      const isBot = /bot|crawl|spider|facebook|whatsapp|telegram|twitter|slack|linkedin|discord/i.test(ua);
      if (!isBot) {
        return next();
      }
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return next();
      }
      const club = await storage.getClub(event.clubId);
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeTitle = esc(event.title);
      const clubEmoji = club?.emoji || "📅";
      const clubName = club?.name || "CultFam";
      const safeClubName = esc(clubName);
      const d = new Date(event.startsAt);
      const dateStr = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      const safeLocation = esc(event.locationText);
      const desc = `${dateStr} · ${timeStr} · ${safeLocation}`;
      const html = `<!DOCTYPE html><html><head>
        <title>${clubEmoji} ${safeTitle} — ${safeClubName}</title>
        <meta property="og:title" content="${clubEmoji} ${safeTitle} — ${safeClubName}" />
        <meta property="og:description" content="${desc}" />
        <meta property="og:type" content="website" />
        <meta name="description" content="${desc}" />
      </head><body><p>${clubEmoji} ${safeTitle} — ${desc}</p></body></html>`;
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      next();
    }
  });

  app.get("/api/clubs/:id/activity", async (req, res) => {
    try {
      const activity = await storage.getClubActivity(req.params.id);
      res.json(activity);
    } catch (err) {
      console.error("Error fetching club activity:", err);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.get("/api/activity/feed", async (_req, res) => {
    try {
      const feed = await storage.getRecentActivityFeed(10);
      res.json(feed);
    } catch (err) {
      console.error("Error fetching activity feed:", err);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  app.get("/api/clubs-with-activity", async (req, res) => {
    try {
      const { category, search, city, vibe, timeOfDay, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageStr || "1", 10) || 1);
      const limit = Math.max(1, Math.min(200, parseInt(limitStr || "20", 10) || 20));
      const offset = (page - 1) * limit;
      const isFiltered = !!(search || city || vibe || timeOfDay || (category && category !== "all" && category !== "All"));
      let clubsList: import("@shared/schema").Club[];
      let total: number;
      if (isFiltered) {
        const filterParams = { search, category, city, vibe, timeOfDay };
        [clubsList, total] = await Promise.all([
          storage.searchClubs({ ...filterParams, limit, offset }),
          storage.searchClubsCount(filterParams),
        ]);
      } else {
        [clubsList, total] = await Promise.all([
          storage.getClubs({ limit, offset }),
          storage.getClubsCount(),
        ]);
      }
      const recentJoins = await storage.getClubsWithRecentJoins();
      const clubsWithActivity = clubsList.map(club => ({ ...club, recentJoins: recentJoins[club.id] || 0 }));
      res.json({ clubs: clubsWithActivity, total, page, limit });
    } catch (err) {
      console.error("Error fetching clubs with activity:", err);
      res.status(500).json({ message: "Failed to fetch clubs" });
    }
  });

  app.get("/api/clubs/:id/ratings", async (req: any, res) => {
    try {
      const { average, count } = await storage.getClubAverageRating(req.params.id);
      let userRating = null;
      let hasJoined = false;
      if (req.user?.claims?.sub) {
        userRating = await storage.getUserRating(req.params.id, req.user.claims.sub);
        hasJoined = await storage.hasUserJoinedClub(req.params.id, req.user.claims.sub);
      }
      res.json({ average, count, userRating, hasJoined });
    } catch (err) {
      console.error("Error fetching ratings:", err);
      res.status(500).json({ message: "Failed to fetch ratings" });
    }
  });

  app.post("/api/clubs/:id/ratings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const hasJoined = await storage.hasUserJoinedClub(req.params.id, userId);
      if (!hasJoined) {
        return res.status(403).json({ message: "You must join this club before rating" });
      }
      const { rating, review } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      const result = await storage.upsertRating(req.params.id, userId, rating, review);
      const { average, count } = await storage.getClubAverageRating(req.params.id);
      res.json({ success: true, rating: result, average, count });
    } catch (err) {
      console.error("Error submitting rating:", err);
      res.status(500).json({ message: "Failed to submit rating" });
    }
  });

  app.get("/api/clubs/:id/faqs", async (req, res) => {
    try {
      const faqs = await storage.getClubFaqs(req.params.id);
      res.json(faqs);
    } catch (err) {
      console.error("Error fetching FAQs:", err);
      res.status(500).json({ message: "Failed to fetch FAQs" });
    }
  });

  app.post("/api/clubs/:id/faqs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { question, answer } = req.body;
      if (!question || !answer) {
        return res.status(400).json({ message: "Question and answer are required" });
      }
      const faq = await storage.createFaq(req.params.id, question, answer);
      res.status(201).json(faq);
    } catch (err) {
      console.error("Error creating FAQ:", err);
      res.status(500).json({ message: "Failed to create FAQ" });
    }
  });

  app.patch("/api/clubs/:id/faqs/:faqId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { question, answer } = req.body;
      const existingFaqs = await storage.getClubFaqs(req.params.id);
      if (!existingFaqs.some(f => f.id === req.params.faqId)) {
        return res.status(404).json({ message: "FAQ not found in this club" });
      }
      const faq = await storage.updateFaq(req.params.faqId, question, answer);
      res.json(faq);
    } catch (err) {
      console.error("Error updating FAQ:", err);
      res.status(500).json({ message: "Failed to update FAQ" });
    }
  });

  app.delete("/api/clubs/:id/faqs/:faqId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const existingFaqs = await storage.getClubFaqs(req.params.id);
      if (!existingFaqs.some(f => f.id === req.params.faqId)) {
        return res.status(404).json({ message: "FAQ not found in this club" });
      }
      await storage.deleteFaq(req.params.faqId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting FAQ:", err);
      res.status(500).json({ message: "Failed to delete FAQ" });
    }
  });

  app.get("/api/clubs/:id/schedule", async (req, res) => {
    try {
      const schedule = await storage.getClubSchedule(req.params.id);
      res.json(schedule);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/clubs/:id/schedule", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { dayOfWeek, startTime, endTime, activity, location } = req.body;
      if (!dayOfWeek || !startTime || !activity) {
        return res.status(400).json({ message: "Day, start time, and activity are required" });
      }
      const entry = await storage.createScheduleEntry(req.params.id, { dayOfWeek, startTime, endTime, activity, location });
      res.status(201).json(entry);
    } catch (err) {
      console.error("Error creating schedule entry:", err);
      res.status(500).json({ message: "Failed to create schedule entry" });
    }
  });

  app.patch("/api/clubs/:id/schedule/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const schedule = await storage.getClubSchedule(req.params.id);
      if (!schedule.some(s => s.id === req.params.entryId)) {
        return res.status(404).json({ message: "Schedule entry not found in this club" });
      }
      const { dayOfWeek, startTime, endTime, activity, location } = req.body;
      const entry = await storage.updateScheduleEntry(req.params.entryId, { dayOfWeek, startTime, endTime, activity, location });
      res.json(entry);
    } catch (err) {
      console.error("Error updating schedule entry:", err);
      res.status(500).json({ message: "Failed to update schedule entry" });
    }
  });

  app.delete("/api/clubs/:id/schedule/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club || !(await storage.isClubManager(club.id, userId))) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const schedule = await storage.getClubSchedule(req.params.id);
      if (!schedule.some(s => s.id === req.params.entryId)) {
        return res.status(404).json({ message: "Schedule entry not found in this club" });
      }
      await storage.deleteScheduleEntry(req.params.entryId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting schedule entry:", err);
      res.status(500).json({ message: "Failed to delete schedule entry" });
    }
  });

  app.get("/api/clubs/:id/moments", async (req, res) => {
    try {
      const moments = await storage.getClubMoments(req.params.id);
      res.json(moments);
    } catch (err) {
      console.error("Error fetching moments:", err);
      res.status(500).json({ message: "Failed to fetch moments" });
    }
  });

  app.post("/api/clubs/:id/moments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const isManager = await storage.isClubManager(club.id, userId);
      const joinStatus = !isManager ? await storage.getUserJoinStatus(req.params.id, userId) : null;
      const isApprovedMember = joinStatus?.status === "approved";
      if (!isManager && !isApprovedMember) {
        return res.status(403).json({ message: "Only approved club members can post moments" });
      }
      const { caption, emoji, imageUrl } = req.body;
      if (!caption) {
        return res.status(400).json({ message: "Caption is required" });
      }
      const user = await storage.getUser(userId);
      const authorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Member";
      const moment = await storage.createMoment(req.params.id, caption, emoji, imageUrl, userId, authorName);
      res.status(201).json(moment);
    } catch (err) {
      console.error("Error creating moment:", err);
      res.status(500).json({ message: "Failed to create moment" });
    }
  });

  app.patch("/api/clubs/:id/moments/:momentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const isManager = await storage.isClubManager(club.id, userId);
      const moments = await storage.getClubMoments(req.params.id);
      const moment = moments.find(m => m.id === req.params.momentId);
      if (!moment) return res.status(404).json({ message: "Moment not found in this club" });
      const isMomentAuthor = moment.authorUserId === userId;
      if (!isManager && !isMomentAuthor) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { caption, emoji } = req.body;
      if (!caption || !caption.trim()) {
        return res.status(400).json({ message: "Caption is required" });
      }
      const updated = await storage.updateMoment(req.params.momentId, { caption: caption.trim(), emoji: emoji || null });
      res.json(updated);
    } catch (err) {
      console.error("Error updating moment:", err);
      res.status(500).json({ message: "Failed to update moment" });
    }
  });

  app.delete("/api/clubs/:id/moments/:momentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const isManager = await storage.isClubManager(club.id, userId);
      const moments = await storage.getClubMoments(req.params.id);
      const moment = moments.find(m => m.id === req.params.momentId);
      if (!moment) return res.status(404).json({ message: "Moment not found in this club" });
      const isMomentAuthor = moment.authorUserId === userId;
      if (!isManager && !isMomentAuthor) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteMoment(req.params.momentId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting moment:", err);
      res.status(500).json({ message: "Failed to delete moment" });
    }
  });

  app.get("/api/moments/:momentId/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByMoment(req.params.momentId);
      res.json(comments);
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/moments/:momentId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const content = (req.body.content || "").trim();
      if (!content) return res.status(400).json({ message: "Comment cannot be empty" });
      const moment = await storage.getMomentById(req.params.momentId);
      if (!moment) return res.status(404).json({ message: "Moment not found" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Member";
      const comment = await storage.createComment({
        momentId: req.params.momentId,
        userId,
        userName,
        userImageUrl: user.profileImageUrl ?? null,
        content,
      });
      res.status(201).json(comment);
    } catch (err) {
      console.error("Error creating comment:", err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.delete("/api/moments/:momentId/comments/:commentId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const moment = await storage.getMomentById(req.params.momentId);
      if (!moment) return res.status(404).json({ message: "Moment not found" });
      const club = await storage.getClub(moment.clubId);
      const isOrganiser = club ? await storage.isClubManager(club.id, userId) : false;
      await storage.deleteComment(req.params.commentId, userId, isOrganiser);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting comment:", err);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifs = await storage.getNotificationsByUser(userId);
      res.json(notifs);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (err) {
      console.error("Error fetching unread count:", err);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getNotificationsByUser(userId);
      const notification = notifications.find(n => n.id === req.params.id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      const updated = await storage.markNotificationRead(req.params.id);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error marking notification read:", err);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.patch("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error marking all notifications read:", err);
      res.status(500).json({ message: "Failed to update notifications" });
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

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const userClubs = await storage.getUserApprovedClubs(req.params.id);
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "CultFam Member";
      res.json({
        id: user.id,
        name,
        bio: user.bio ?? null,
        city: user.city ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        role: user.role ?? "member",
        clubs: userClubs.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, category: c.category })),
      });
    } catch (err) {
      console.error("Error fetching public user profile:", err);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.get("/api/clubs/:id/members-preview", async (req, res) => {
    try {
      const members = await storage.getMembersPreview(req.params.id, 10);
      res.json(members);
    } catch (err) {
      console.error("Error fetching members preview:", err);
      res.status(500).json({ message: "Failed to fetch members preview" });
    }
  });

  app.get("/api/clubs/:id/members", async (req, res) => {
    try {
      const members = await storage.getPublicClubMembers(req.params.id);
      res.json(members);
    } catch (err) {
      console.error("Error fetching member directory:", err);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.get("/api/user/attendance-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserAttendanceStats(userId);
      res.json(stats);
    } catch (err) {
      console.error("Error fetching attendance stats:", err);
      res.status(500).json({ message: "Failed to fetch attendance stats" });
    }
  });

  app.get("/api/clubs/:id/join-count", async (req, res) => {
    try {
      const count = await storage.getJoinRequestCountByClub(req.params.id);
      res.json({ count });
    } catch (err) {
      console.error("Error fetching join count:", err);
      res.status(500).json({ message: "Failed to get join count" });
    }
  });

  // ── ANNOUNCEMENTS ────────────────────────────────────────────────────────

  app.get("/api/clubs/:clubId/announcements", async (req, res) => {
    try {
      const announcements = await storage.getClubAnnouncements(req.params.clubId);
      res.json(announcements);
    } catch (err) {
      console.error("Error fetching announcements:", err);
      res.status(500).json({ message: "Failed to fetch announcements" });
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

  // ── POLLS ────────────────────────────────────────────────────────────────

  app.get("/api/clubs/:clubId/polls", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const polls = await storage.getClubPolls(req.params.clubId, userId);
      res.json(polls);
    } catch (err) {
      console.error("Error fetching polls:", err);
      res.status(500).json({ message: "Failed to fetch polls" });
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

  app.post("/api/polls/:pollId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { optionIndex } = req.body;
      if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ message: "optionIndex is required" });
      }
      await storage.castVote(req.params.pollId, userId, Number(optionIndex));
      res.json({ success: true });
    } catch (err) {
      console.error("Error casting vote:", err);
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  // ── CO-ORGANISERS ────────────────────────────────────────────────────────

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

  app.get("/api/og-image/club/:id", async (req, res) => {
    try {
      const club = await storage.getClub(req.params.id as string);
      if (!club) return res.status(404).send("Not found");
      const svg = buildClubSvg({
        emoji: club.emoji,
        name: club.name,
        category: club.category,
        shortDesc: club.shortDesc,
        organizerName: club.organizerName ?? undefined,
      });
      
      const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
        
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
      res.send(pngBuffer);
    } catch (err) {
      console.error("Error generating club OG image:", err);
      res.status(500).send("Error");
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
      
      const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
        
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      });
      res.send(pngBuffer);
    } catch (err) {
      console.error("Error generating event OG image:", err);
      res.status(500).send("Error");
    }
  });

  app.post("/api/moments/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.likeMoment(req.params.id, userId);
      const moment = await storage.getMomentById(req.params.id);
      res.json({ success: true, likesCount: moment?.likesCount ?? 0 });
    } catch (err) {
      console.error("Error liking moment:", err);
      res.status(500).json({ message: "Failed to like moment" });
    }
  });

  app.delete("/api/moments/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.unlikeMoment(req.params.id, userId);
      const moment = await storage.getMomentById(req.params.id);
      res.json({ success: true, likesCount: moment?.likesCount ?? 0 });
    } catch (err) {
      console.error("Error unliking moment:", err);
      res.status(500).json({ message: "Failed to unlike moment" });
    }
  });

  app.get("/api/moments/:id/like-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const liked = await storage.getMomentLikeStatus(req.params.id, userId);
      res.json({ liked });
    } catch (err) {
      res.status(500).json({ message: "Failed to get like status" });
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

  app.get("/api/user/founding-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const foundingClubs = await storage.getUserFoundingClubs(userId);
      res.json({ clubs: foundingClubs });
    } catch (err) {
      console.error("Error fetching founding status:", err);
      res.status(500).json({ message: "Failed to fetch founding status" });
    }
  });

  app.get("/club/:id", async (req, res, next) => {
    try {
      if (!isCrawler(req.headers["user-agent"])) return next();
      const club = await storage.getClub(req.params.id as string);
      if (!club) return next();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const template = await readHtmlTemplate();
      const html = buildOgHtml(template, {
        title: `${club.emoji} ${club.name} | CultFam Tirupati`,
        description: club.shortDesc,
        imageUrl: `${baseUrl}/api/og-image/club/${club.id}`,
        url: `${baseUrl}/club/${club.id}`,
        type: "website",
      });
      res.status(200).set("Content-Type", "text/html").end(html);
    } catch (err) {
      console.error("Error serving club OG page:", err);
      next();
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
      const fallbackDesc = event.description
        ?? `${dateStr} at ${event.locationText}`;
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

      const giver = await storage.getUser(giverId);
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

  app.get("/api/user/kudos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userKudos = await storage.getKudosByReceiver(userId);
      res.json(userKudos);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch kudos" });
    }
  });

  app.get("/c/:slug", async (req, res, next) => {
    try {
      if (!isCrawler(req.headers["user-agent"])) return next();
      const club = await storage.getClubBySlug(req.params.slug as string);
      if (!club) return next();
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const template = await readHtmlTemplate();
      const html = buildOgHtml(template, {
        title: `${club.emoji} ${club.name} | CultFam Tirupati`,
        description: club.shortDesc,
        imageUrl: `${baseUrl}/api/og-image/club/${club.id}`,
        url: `${baseUrl}/c/${club.slug}`,
        type: "website",
      });
      res.status(200).set("Content-Type", "text/html").end(html);
    } catch (err) {
      console.error("Error serving public club OG page:", err);
      next();
    }
  });

  app.get("/api/clubs/by-slug/:slug", async (req, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug as string);
      if (!club) return res.status(404).json({ message: "Club not found" });
      res.json(club);
    } catch (err) {
      console.error("Error fetching club by slug:", err);
      res.status(500).json({ message: "Failed to fetch club" });
    }
  });

  app.get("/api/c/:slug", async (req, res) => {
    try {
      const club = await storage.getClubBySlug(req.params.slug as string);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const data = await storage.getPublicPageData(club.id);
      res.json(data);
    } catch (err) {
      console.error("Error fetching public page:", err);
      res.status(500).json({ message: "Failed to fetch public page" });
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

  // ══════════════════════════════════════════════════════════════════════════
  // PAYMENT ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // Helper: perform Route transfer after payment
  async function attemptRouteTransfer(paymentId: string, baseAmountPaise: number, fundAccountId: string): Promise<string> {
    return createRouteTransfer(paymentId, [{ account: fundAccountId, amount: baseAmountPaise, currency: "INR" }]);
  }

  // POST /api/payments/create-order
  // Creates a Razorpay order for a paid ticket, or returns { free: true } for free tickets
  app.post("/api/payments/create-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId, ticketTypeId } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId required" });

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.isCancelled) return res.status(400).json({ message: "This event has been cancelled and is no longer accepting bookings." });
      const club = await storage.getClub(event.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      // Membership check
      const isManager = await storage.isClubManager(club.id, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(event.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to book tickets" });
      }

      // Check for existing RSVP — prevent duplicate charge
      const existingRsvp = await storage.getUserRsvp(eventId, userId);
      if (existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")) {
        return res.status(409).json({ message: "You are already registered for this event" });
      }

      // Find ticket type
      const tickets = await storage.getEventTicketTypes(event.id);
      if (tickets.length === 0) return res.json({ free: true });

      const ticket = ticketTypeId ? tickets.find(t => t.id === parseInt(String(ticketTypeId)) && t.isActive) : tickets.filter(t => t.isActive)[0];
      if (!ticket) return res.status(404).json({ message: "Ticket type not found" });

      if (ticket.price === 0) return res.json({ free: true, ticketTypeId: ticket.id, ticketTypeName: ticket.name });

      // Razorpay required from here
      if (!razorpay) {
        return res.status(503).json({ error: "Payments not configured", message: "Online payments coming soon — contact the organiser directly" });
      }

      const baseAmountPaise = ticket.price * 100;
      const breakdown = calculateCommission(baseAmountPaise, club);

      const order = await createRazorpayOrder({
        amount: breakdown.totalAmount,
        currency: "INR",
        notes: { eventId, ticketTypeId: String(ticket.id), userId, clubId: club.id },
      });

      res.json({
        orderId: order.id,
        amount: breakdown.totalAmount,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        currency: "INR",
        keyId: getRazorpayKeyId(),
        isTestMode,
        ticketTypeId: ticket.id,
        ticketTypeName: ticket.name,
        eventTitle: event.title,
        clubName: club.name,
      });
    } catch (err) {
      console.error("Error creating Razorpay order:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  // POST /api/payments/verify
  // Verifies Razorpay signature, fetches order/payment from Razorpay to enforce amount+capture,
  // creates RSVP, records transaction, triggers Route transfer
  app.post("/api/payments/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, eventId: reqEventId, ticketTypeId: reqTicketTypeId, formResponses } = req.body;

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: "Missing required payment fields" });
      }

      // 1. HMAC signature verification
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) return res.status(503).json({ message: "Payments not configured" });

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ message: "Payment verification failed — invalid signature" });
      }

      // 2. Idempotency — if we already processed this payment, return existing
      const existingTxByPayment = await storage.getPlatformTransactionByPaymentId(razorpayPaymentId);
      if (existingTxByPayment) {
        const existingRsvp = await storage.getRsvpById(existingTxByPayment.rsvpId ?? "");
        return res.json({ success: true, rsvp: existingRsvp, alreadyRsvpd: true, transaction: existingTxByPayment });
      }

      // 3. Fetch payment from Razorpay server-side to verify capture status and order binding
      if (!razorpay) return res.status(503).json({ message: "Payments not configured" });

      let rzpPayment;
      try {
        rzpPayment = await fetchRazorpayPayment(razorpayPaymentId);
      } catch {
        return res.status(400).json({ message: "Could not verify payment with Razorpay" });
      }

      if (!rzpPayment || rzpPayment.status !== "captured") {
        return res.status(400).json({ message: "Payment not captured" });
      }
      if (rzpPayment.order_id !== razorpayOrderId) {
        return res.status(400).json({ message: "Payment/order mismatch" });
      }

      // 4. Fetch order from Razorpay to read authoritative notes (eventId, userId, ticketTypeId)
      let rzpOrder: RazorpayOrderEntity;
      try {
        rzpOrder = await fetchRazorpayOrder(razorpayOrderId);
      } catch {
        return res.status(400).json({ message: "Could not fetch order from Razorpay" });
      }

      const notes = rzpOrder.notes ?? {};
      const orderEventId = notes.eventId ?? reqEventId;
      const orderUserId = notes.userId;
      const orderTicketTypeId = notes.ticketTypeId ? parseInt(notes.ticketTypeId) : null;

      // Verify this order belongs to the authenticated user
      if (orderUserId && orderUserId !== userId) {
        return res.status(403).json({ message: "Payment was made by a different user" });
      }

      if (!orderEventId) return res.status(400).json({ message: "Event not found in order" });

      const event = await storage.getEvent(orderEventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.isCancelled) return res.status(400).json({ message: "This event has been cancelled. Payment cannot be processed." });
      const club = await storage.getClub(event.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const tickets = await storage.getEventTicketTypes(event.id);
      const ticket = orderTicketTypeId ? tickets.find(t => t.id === orderTicketTypeId) : null;

      const baseAmountPaise = ticket ? ticket.price * 100 : 0;
      const breakdown = calculateCommission(baseAmountPaise, club);

      // 5. Verify payment amount matches what we expect (prevents underpayment)
      if (rzpOrder.amount !== breakdown.totalAmount) {
        console.error(`[verify] Amount mismatch: order=${rzpOrder.amount} expected=${breakdown.totalAmount}`);
        return res.status(400).json({ message: "Payment amount does not match expected ticket price" });
      }

      // 6. Check for existing RSVP (user already registered for this event)
      const existingRsvp = await storage.getUserRsvp(event.id, userId);
      if (existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")) {
        const existingTx = await storage.getPlatformTransactionByRsvpId(existingRsvp.id);
        return res.json({ success: true, rsvp: existingRsvp, alreadyRsvpd: true, transaction: existingTx });
      }

      // 7. Create RSVP
      const rsvpCount = await storage.getRsvpCount(event.id);
      const rsvpStatus = rsvpCount >= event.maxCapacity ? "waitlisted" : "going";
      const rsvp = await storage.createRsvp({
        eventId: event.id,
        userId,
        status: rsvpStatus,
        ticketTypeId: ticket?.id,
        ticketTypeName: ticket?.name,
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "paid",
      });

      // 8. Save form responses if provided
      const rawFormResponses: { questionId: string; answer: string }[] = formResponses ?? [];
      if (rawFormResponses.length > 0) {
        const validQuestions = await storage.getEventFormQuestions(event.id);
        const validIds = new Set(validQuestions.map(q => q.id));
        const cleaned = rawFormResponses
          .filter(r => validIds.has(r.questionId))
          .map(r => ({ questionId: r.questionId, answer: String(r.answer ?? "").trim().slice(0, 1000) }));
        if (cleaned.length > 0) await storage.saveEventFormResponses(event.id, userId, cleaned);
      }

      // 9. Create transaction record
      const tx = await storage.createPlatformTransaction({
        eventId: event.id,
        rsvpId: rsvp.id,
        clubId: club.id,
        userId,
        razorpayOrderId,
        razorpayPaymentId,
        totalAmount: breakdown.totalAmount,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        currency: "INR",
        status: "pending",
      });

      // 10. Attempt Route transfer
      let transferStatus = "pending";
      let transferId: string | undefined;
      if (club.razorpayFundAccountId && club.payoutsEnabled) {
        try {
          transferId = await attemptRouteTransfer(razorpayPaymentId, breakdown.baseAmount, club.razorpayFundAccountId);
          transferStatus = "transferred";
        } catch (transferErr) {
          console.error("Route transfer failed:", transferErr);
          transferStatus = "failed";
        }
      }

      await storage.updatePlatformTransaction(tx.id, {
        status: transferStatus as "pending" | "transferred" | "failed",
        razorpayTransferId: transferId,
      });

      // 11. Notification to user
      const eventDate = new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      await storage.createNotification({
        userId,
        type: "rsvp_confirmed",
        title: "Payment Successful — You're in!",
        message: `Payment confirmed for ${event.title} on ${eventDate}. Your ticket is ready!`,
        linkUrl: `/event/${event.id}`,
        isRead: false,
      });

      // 12. Notify organiser of transfer result
      if (club.creatorUserId && club.payoutsEnabled) {
        const notifType = transferStatus === "transferred" ? "payout_transferred" : transferStatus === "failed" ? "payout_failed" : "payout_pending";
        const notifMsg = transferStatus === "transferred"
          ? `₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} has been transferred to your account.`
          : transferStatus === "failed"
          ? `Transfer of ₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} failed. Please check the admin dashboard.`
          : `Payment received for ${event.title}. Transfer will be processed shortly.`;
        await storage.createNotification({
          userId: club.creatorUserId,
          type: notifType,
          title: transferStatus === "transferred" ? "Payout Transferred!" : transferStatus === "failed" ? "Transfer Failed" : "Payment Received",
          message: notifMsg,
          linkUrl: `/organizer/earnings?club=${club.id}`,
          isRead: false,
        });
      }

      res.json({ success: true, rsvp, transaction: { ...tx, status: transferStatus, razorpayTransferId: transferId } });
    } catch (err) {
      console.error("Error verifying payment:", err);
      res.status(500).json({ message: "Payment verification failed" });
    }
  });

  // POST /api/payments/webhook
  // Razorpay webhook — reliability fallback for payment.captured
  // Creates RSVP+transaction idempotently if client verify was never called
  // Also retries pending/failed Route transfers on transfer.processed events
  app.post("/api/payments/webhook", async (req: any, res) => {
    try {
      // Signature verification is mandatory — fail closed if secret not configured
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting unsigned request");
        return res.status(400).json({ message: "Webhook secret not configured" });
      }

      const receivedSignature = req.headers["x-razorpay-signature"] as string;
      if (!receivedSignature) {
        return res.status(400).json({ message: "Missing webhook signature" });
      }
      const body = req.rawBody ? String(req.rawBody) : JSON.stringify(req.body);
      const expectedSig = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
      if (receivedSignature !== expectedSig) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const webhookEvent = req.body?.event as string | undefined;
      const payload = req.body?.payload as Record<string, unknown> | undefined;

      // --- payment.captured: create RSVP + transaction if not already done ---
      if (webhookEvent === "payment.captured") {
        const paymentEntity = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
        const orderId = paymentEntity?.order_id as string | undefined;
        const paymentId = paymentEntity?.id as string | undefined;
        const amountPaise: number = (paymentEntity?.amount as number | undefined) ?? 0;

        if (!orderId || !paymentId) {
          console.warn("[webhook] payment.captured missing orderId/paymentId");
          return res.json({ status: "ok" });
        }

        // Idempotency: skip if transaction already recorded
        const existingTx = await storage.getPlatformTransactionByPaymentId(paymentId);
        if (existingTx) {
          // If transfer is pending/failed, attempt retry and notify organiser
          if ((existingTx.status === "pending" || existingTx.status === "failed") && razorpay) {
            const club = await storage.getClub(existingTx.clubId);
            if (club?.razorpayFundAccountId && club.payoutsEnabled) {
              try {
                const transferId = await attemptRouteTransfer(paymentId, existingTx.baseAmount, club.razorpayFundAccountId);
                await storage.updatePlatformTransaction(existingTx.id, { status: "transferred", razorpayTransferId: transferId });
                console.log(`[webhook] Retried transfer for existing tx ${existingTx.id}: ${transferId}`);
                if (club.creatorUserId) {
                  const retryEvent = await storage.getEvent(existingTx.eventId);
                  await storage.createNotification({
                    userId: club.creatorUserId,
                    type: "payout_transferred",
                    title: "Payout Transferred!",
                    message: `₹${(existingTx.baseAmount / 100).toFixed(2)} from ${retryEvent?.title ?? "an event"} has been transferred to your account.`,
                    linkUrl: `/organizer/earnings?club=${club.id}`,
                    isRead: false,
                  });
                }
              } catch (err) {
                console.error("[webhook] Transfer retry failed:", err);
                if (club.creatorUserId) {
                  const retryEvent = await storage.getEvent(existingTx.eventId);
                  await storage.createNotification({
                    userId: club.creatorUserId,
                    type: "payout_failed",
                    title: "Transfer Failed",
                    message: `Transfer of ₹${(existingTx.baseAmount / 100).toFixed(2)} from ${retryEvent?.title ?? "an event"} failed. Please check the admin dashboard.`,
                    linkUrl: `/organizer/earnings?club=${club.id}`,
                    isRead: false,
                  });
                }
              }
            }
          }
          return res.json({ status: "ok" });
        }

        // Fetch Razorpay order to get notes (eventId, userId, ticketTypeId)
        if (!razorpay) return res.json({ status: "ok" });
        let rzpOrder: RazorpayOrderEntity;
        try {
          rzpOrder = await fetchRazorpayOrder(orderId);
        } catch (err) {
          console.error("[webhook] Could not fetch order:", err);
          return res.json({ status: "ok" });
        }

        const notes = rzpOrder.notes ?? {};
        const eventId = notes.eventId;
        const userId = notes.userId;
        const ticketTypeIdRaw = notes.ticketTypeId;

        if (!eventId || !userId) {
          console.warn("[webhook] Order missing eventId/userId notes, skipping RSVP creation");
          return res.json({ status: "ok" });
        }

        const event = await storage.getEvent(eventId);
        const club = event ? await storage.getClub(event.clubId) : null;
        if (!event || !club) {
          console.warn(`[webhook] Event or club not found for eventId=${eventId}`);
          return res.json({ status: "ok" });
        }

        const tickets = await storage.getEventTicketTypes(event.id);
        const ticketTypeId = ticketTypeIdRaw ? parseInt(ticketTypeIdRaw) : null;
        const ticket = ticketTypeId ? tickets.find(t => t.id === ticketTypeId) : null;

        const baseAmountPaise = ticket ? ticket.price * 100 : 0;
        const breakdown = calculateCommission(baseAmountPaise, club);

        // Verify amount integrity
        if (amountPaise > 0 && amountPaise !== breakdown.totalAmount) {
          console.error(`[webhook] Amount mismatch: payment=${amountPaise} expected=${breakdown.totalAmount} for event=${eventId}`);
          return res.json({ status: "ok" });
        }

        // Check for existing RSVP
        const existingRsvp = await storage.getUserRsvp(event.id, userId);
        let rsvp = existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")
          ? existingRsvp
          : null;

        if (!rsvp) {
          const rsvpCount = await storage.getRsvpCount(event.id);
          const rsvpStatus = rsvpCount >= event.maxCapacity ? "waitlisted" : "going";
          rsvp = await storage.createRsvp({
            eventId: event.id,
            userId,
            status: rsvpStatus,
            ticketTypeId: ticket?.id,
            ticketTypeName: ticket?.name,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            paymentStatus: "paid",
          });
          console.log(`[webhook] Created RSVP ${rsvp.id} for user=${userId} event=${eventId}`);
        }

        const tx = await storage.createPlatformTransaction({
          eventId: event.id,
          rsvpId: rsvp.id,
          clubId: club.id,
          userId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          totalAmount: breakdown.totalAmount,
          baseAmount: breakdown.baseAmount,
          platformFee: breakdown.platformFee,
          currency: "INR",
          status: "pending",
        });

        // Attempt Route transfer
        let transferStatus = "pending";
        let transferId: string | undefined;
        if (club.razorpayFundAccountId && club.payoutsEnabled) {
          try {
            transferId = await attemptRouteTransfer(paymentId, breakdown.baseAmount, club.razorpayFundAccountId);
            transferStatus = "transferred";
          } catch (err) {
            console.error("[webhook] Route transfer failed:", err);
            transferStatus = "failed";
          }
        }

        await storage.updatePlatformTransaction(tx.id, {
          status: transferStatus as "pending" | "transferred" | "failed",
          razorpayTransferId: transferId,
        });

        // Notify user
        const eventDate = new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
        await storage.createNotification({
          userId,
          type: "rsvp_confirmed",
          title: "Payment Confirmed — You're in!",
          message: `Your payment for ${event.title} on ${eventDate} has been confirmed.`,
          linkUrl: `/event/${event.id}`,
          isRead: false,
        });

        // Notify organiser of transfer result
        if (club.creatorUserId && club.payoutsEnabled) {
          const notifType = transferStatus === "transferred" ? "payout_transferred" : transferStatus === "failed" ? "payout_failed" : "payout_pending";
          const notifMsg = transferStatus === "transferred"
            ? `₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} has been transferred to your account.`
            : transferStatus === "failed"
            ? `Transfer of ₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} failed. Please check the admin dashboard.`
            : `Payment received for ${event.title}. Transfer will be processed shortly.`;
          await storage.createNotification({
            userId: club.creatorUserId,
            type: notifType,
            title: transferStatus === "transferred" ? "Payout Transferred!" : transferStatus === "failed" ? "Transfer Failed" : "Payment Received",
            message: notifMsg,
            linkUrl: `/organizer/earnings?club=${club.id}`,
            isRead: false,
          });
        }

        console.log(`[webhook] payment.captured processed: tx=${tx.id} transfer=${transferStatus}`);
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // GET /api/user/payments — User's payment history
  app.get("/api/user/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getUserPaymentHistory(userId);
      res.json(history);
    } catch (err) {
      console.error("Error fetching user payment history:", err);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // GET /api/organizer/clubs/:id/payout-setup
  app.get("/api/organizer/clubs/:id/payout-setup", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const maskedAccount = club.bankAccountNumber
        ? `••••${club.bankAccountNumber.slice(-4)}`
        : null;

      const maskedUpi = club.upiId
        ? (() => {
            const atIndex = club.upiId.lastIndexOf("@");
            if (atIndex > 1) {
              return `${club.upiId.slice(0, 2)}••••${club.upiId.slice(atIndex)}`;
            }
            return `••••${club.upiId.slice(-6)}`;
          })()
        : null;

      res.json({
        payoutsEnabled: club.payoutsEnabled ?? false,
        payoutMethod: club.payoutMethod ?? "bank",
        bankAccountName: club.bankAccountName,
        maskedAccountNumber: maskedAccount,
        maskedIfsc: club.bankIfsc ? `${club.bankIfsc.slice(0, 4)}••••••` : null,
        maskedUpiId: maskedUpi,
        payoutConfigured: Boolean(club.razorpayFundAccountId),
      });
    } catch (err) {
      console.error("Error fetching payout setup:", err);
      res.status(500).json({ message: "Failed to fetch payout setup" });
    }
  });

  // POST /api/organizer/clubs/:id/payout-setup
  app.post("/api/organizer/clubs/:id/payout-setup", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const clubId = req.params.id;
      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const { payoutMethod, bankAccountName, bankAccountNumber, bankIfsc, upiId } = req.body;
      if (!payoutMethod || !["bank", "upi"].includes(payoutMethod)) {
        return res.status(400).json({ message: "payoutMethod must be 'bank' or 'upi'" });
      }

      if (payoutMethod === "bank") {
        if (!bankAccountName?.trim()) return res.status(400).json({ message: "Account holder name is required" });
        if (!bankAccountNumber?.trim() || bankAccountNumber.replace(/\D/g, "").length < 9) return res.status(400).json({ message: "Valid bank account number is required" });
        if (!bankIfsc?.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.trim().toUpperCase())) return res.status(400).json({ message: "Valid IFSC code is required (e.g. HDFC0001234)" });
      } else {
        if (!upiId?.trim() || !upiId.includes("@")) return res.status(400).json({ message: "Valid UPI ID is required (e.g. name@upi)" });
      }

      let contactId = club.razorpayContactId;
      let fundAccountId = club.razorpayFundAccountId;
      let payoutsEnabled = false;

      if (razorpay) {
        try {
          const organiserUser = await storage.getUser(club.creatorUserId ?? "");
          const contactName = club.organizerName || organiserUser?.firstName || club.name;
          const contactEmail = organiserUser?.email ?? undefined;

          if (!contactId) {
            const contact = await createRazorpayContact({
              name: contactName,
              email: contactEmail,
              type: "vendor",
              reference_id: clubId,
            });
            contactId = contact.id;
          }

          const fundAccountPayload: Record<string, unknown> = {
            contact_id: contactId,
            account_type: payoutMethod === "upi" ? "vpa" : "bank_account",
          };
          if (payoutMethod === "upi") {
            fundAccountPayload.vpa = { address: upiId.trim() };
          } else {
            fundAccountPayload.bank_account = {
              name: bankAccountName.trim(),
              ifsc: bankIfsc.trim().toUpperCase(),
              account_number: bankAccountNumber.trim(),
            };
          }
          const fundAccount = await createRazorpayFundAccount(fundAccountPayload);
          fundAccountId = fundAccount.id;
          payoutsEnabled = true;
        } catch (rzpErr: any) {
          console.error("Razorpay contact/fund account creation error:", rzpErr);
          // Store details locally even if Razorpay API fails (Route pending approval scenario)
          payoutsEnabled = false;
        }
      }

      const updated = await storage.updateClubPayoutSetup(clubId, {
        razorpayContactId: contactId ?? undefined,
        razorpayFundAccountId: fundAccountId ?? undefined,
        bankAccountName: payoutMethod === "bank" ? bankAccountName?.trim() : undefined,
        bankAccountNumber: payoutMethod === "bank" ? bankAccountNumber?.trim() : undefined,
        bankIfsc: payoutMethod === "bank" ? bankIfsc?.trim().toUpperCase() : undefined,
        upiId: payoutMethod === "upi" ? upiId?.trim() : undefined,
        payoutMethod,
        payoutsEnabled: razorpay ? payoutsEnabled : false,
      });

      const maskedAccount = updated?.bankAccountNumber ? `••••${updated.bankAccountNumber.slice(-4)}` : null;
      res.json({
        success: true,
        payoutsEnabled: updated?.payoutsEnabled ?? false,
        payoutMethod: updated?.payoutMethod ?? payoutMethod,
        bankAccountName: updated?.bankAccountName,
        maskedAccountNumber: maskedAccount,
        bankIfsc: updated?.bankIfsc,
        upiId: updated?.upiId,
      });
    } catch (err) {
      console.error("Error saving payout setup:", err);
      res.status(500).json({ message: "Failed to save payout details" });
    }
  });

  // GET /api/organizer/clubs/:id/earnings — Earnings summary
  app.get("/api/organizer/clubs/:id/earnings", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const earnings = await storage.getClubEarnings(req.params.id);
      res.json(earnings);
    } catch (err) {
      console.error("Error fetching earnings:", err);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  // GET /api/organizer/clubs/:id/earnings/all — Full paginated earnings
  app.get("/api/organizer/clubs/:id/earnings/all", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const { status, page, limit } = req.query as Record<string, string | undefined>;
      const result = await storage.getAllClubEarnings(req.params.id, {
        status: status || "all",
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      res.json(result);
    } catch (err) {
      console.error("Error fetching all earnings:", err);
      res.status(500).json({ message: "Failed to fetch earnings history" });
    }
  });

  // GET /api/admin/payments — Admin payment analytics with pagination
  // Query params: ?page=1&limit=20&status=all|pending|transferred|failed&clubId=xxx
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

  // POST /api/admin/payments/retry/:id — Retry a failed Route transfer
  app.post("/api/admin/payments/retry/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const tx = await storage.getPlatformTransactionById(String(req.params.id));
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      if (tx.status === "transferred") return res.status(400).json({ message: "Transfer already completed" });

      const club = await storage.getClub(tx.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (!club.razorpayFundAccountId || !club.payoutsEnabled) {
        return res.status(400).json({ message: "Club payout not set up — organiser must configure payout details first" });
      }
      if (!razorpay) {
        return res.status(503).json({ message: "Payments not configured" });
      }

      let transferId: string;
      try {
        transferId = await attemptRouteTransfer(tx.razorpayPaymentId, tx.baseAmount, club.razorpayFundAccountId);
      } catch (transferErr: any) {
        console.error("Retry transfer failed:", transferErr);
        return res.status(500).json({ message: "Transfer retry failed — " + (transferErr.message ?? "unknown error") });
      }

      const updated = await storage.updatePlatformTransaction(tx.id, { status: "transferred", razorpayTransferId: transferId });

      if (club.creatorUserId) {
        await storage.createNotification({
          userId: club.creatorUserId,
          type: "payout_transferred",
          title: "Payout Transferred!",
          message: `₹${(tx.baseAmount / 100).toFixed(2)} has been transferred to your account.`,
          linkUrl: `/organizer/earnings?club=${club.id}`,
          isRead: false,
        });
      }

      res.json({ success: true, transaction: updated });
    } catch (err) {
      console.error("Error retrying transfer:", err);
      res.status(500).json({ message: "Failed to retry transfer" });
    }
  });

  // PATCH /api/admin/clubs/:id/commission — Update commission rate
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

  // GET /api/admin/commission/suggest — Returns suggested commission for a city
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

  return httpServer;
}
