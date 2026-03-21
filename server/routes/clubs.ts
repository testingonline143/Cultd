import type { Express, RequestHandler } from "express";
import { storage } from "../storage/index";
import { isAuthenticated } from "../auth";
import { insertJoinRequestSchema, CATEGORY_EMOJI } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { isCrawler, readHtmlTemplate, buildOgHtml, buildClubSvg } from "../og";
import sharp from "sharp";

export function registerClubRoutes(
  app: Express,
  isAdmin: RequestHandler,
  requireRole: (...roles: string[]) => RequestHandler,
  requireClubManager: (param?: string) => RequestHandler,
): void {
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

  app.get("/api/clubs/:id/join-count", async (req, res) => {
    try {
      const count = await storage.getJoinRequestCountByClub(req.params.id);
      res.json({ count });
    } catch (err) {
      console.error("Error fetching join count:", err);
      res.status(500).json({ message: "Failed to get join count" });
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

  app.get("/api/clubs/:clubId/announcements", async (req, res) => {
    try {
      const announcements = await storage.getClubAnnouncements(req.params.clubId);
      res.json(announcements);
    } catch (err) {
      console.error("Error fetching announcements:", err);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  app.get("/api/clubs/:id/activity", async (req, res) => {
    try {
      const activity = await storage.getClubActivity(req.params.id);
      res.json(activity);
    } catch (err) {
      console.error("Error fetching activity:", err);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

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
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
      res.send(pngBuffer);
    } catch (err) {
      console.error("Error generating club OG image:", err);
      res.status(500).send("Error");
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

  // Crawler OG pages
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
}
