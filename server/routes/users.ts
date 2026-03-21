import type { Express } from "express";
import { storage } from "../storage/index";
import { isAuthenticated } from "../auth";
import { writeRateLimiter } from "../middleware";
import { insertQuizAnswersSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export function registerUserRoutes(
  app: Express,
): void {
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

  app.get("/api/user/kudos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userKudos = await storage.getKudosByReceiver(userId);
      res.json(userKudos);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch kudos" });
    }
  });

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

  app.get("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "CultFam Member";
      res.json({
        id: user.id,
        name,
        bio: user.bio ?? null,
        city: user.city ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        role: user.role ?? "member",
      });
    } catch (err) {
      console.error("Error fetching public user profile:", err);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.get("/api/users/:id/clubs", isAuthenticated, async (req: any, res) => {
    try {
      const userClubs = await storage.getUserApprovedClubs(req.params.id);
      res.json(userClubs.map(c => ({ id: c.id, name: c.name, emoji: c.emoji, category: c.category })));
    } catch (err) {
      console.error("Error fetching user clubs:", err);
      res.status(500).json({ message: "Failed to fetch user clubs" });
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

  app.get("/api/moments/:momentId/comments", async (req, res) => {
    try {
      const comments = await storage.getCommentsByMoment(req.params.momentId);
      res.json(comments);
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/moments/:momentId/comments", isAuthenticated, writeRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const content = (req.body.content || "").trim();
      if (!content) return res.status(400).json({ message: "Comment cannot be empty" });
      if (content.length > 500) return res.status(400).json({ message: "Comment too long (max 500 chars)" });
      const moment = await storage.getMomentById(req.params.momentId);
      if (!moment) return res.status(404).json({ message: "Moment not found" });
      const isManager = await storage.isClubManager(moment.clubId, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(moment.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to comment" });
      }
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

  app.post("/api/moments/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const moment = await storage.getMomentById(req.params.id);
      if (!moment) return res.status(404).json({ message: "Moment not found" });
      const isManager = await storage.isClubManager(moment.clubId, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(moment.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to like posts" });
      }
      await storage.likeMoment(req.params.id, userId);
      const updated = await storage.getMomentById(req.params.id);
      res.json({ success: true, likesCount: updated?.likesCount ?? 0 });
    } catch (err) {
      console.error("Error liking moment:", err);
      res.status(500).json({ message: "Failed to like moment" });
    }
  });

  app.delete("/api/moments/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const moment = await storage.getMomentById(req.params.id);
      if (!moment) return res.status(404).json({ message: "Moment not found" });
      const isManager = await storage.isClubManager(moment.clubId, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(moment.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to unlike posts" });
      }
      await storage.unlikeMoment(req.params.id, userId);
      const updated = await storage.getMomentById(req.params.id);
      res.json({ success: true, likesCount: updated?.likesCount ?? 0 });
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

  app.post("/api/polls/:pollId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { optionIndex } = req.body;
      if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ message: "optionIndex is required" });
      }
      const poll = await storage.getPollById(req.params.pollId);
      if (!poll) return res.status(404).json({ message: "Poll not found" });
      const isManager = await storage.isClubManager(poll.clubId, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(poll.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to vote" });
      }
      await storage.castVote(req.params.pollId, userId, Number(optionIndex));
      res.json({ success: true });
    } catch (err) {
      console.error("Error casting vote:", err);
      res.status(500).json({ message: "Failed to cast vote" });
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

  app.get("/api/activity/feed", async (_req, res) => {
    try {
      const feed = await storage.getRecentActivityFeed(10);
      res.json(feed);
    } catch (err) {
      console.error("Error fetching activity feed:", err);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });
}
