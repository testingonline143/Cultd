import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./supabase";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const claims = req.user.claims;
      // When a user logs in via Supabase for the first time, they won't exist in the local 
      // users table until we upsert them based on their claims.
      const user = await authStorage.upsertUser({
        id: claims.sub,
        email: claims.email || null,
        firstName: claims.first_name || null,
        lastName: claims.last_name || null,
        profileImageUrl: null,
      });

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
