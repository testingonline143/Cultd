import type { RequestHandler } from "express";
import { storage } from "./storage";

export const isAdmin: RequestHandler = async (req: any, res, next) => {
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

export function requireClubManager(clubIdParam = "clubId"): RequestHandler {
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

export function requireEventManager(eventIdParam = "eventId"): RequestHandler {
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

export function requireRole(...roles: string[]): RequestHandler {
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
      if (!roles.includes(user.role as string)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  };
}
