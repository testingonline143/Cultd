import type { Express, RequestHandler } from "express";
import { createClient } from "@supabase/supabase-js";
import { authStorage } from "./storage";

// We create a server-side Supabase client just to verify tokens and fetch user data if needed
// Note: We use the ANON key here because we just need to verify JWTs matching the project
export const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  // We no longer need express-session or passport because Supabase uses JWTs 
  // passed via the Authorization header.
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("Supabase auth error:", error);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    // Attach user information to the request for downward compatibility
    // Replit auth stored claims on req.user.claims, so we mock it here
    (req as any).user = {
      claims: {
        sub: user.id,
        email: user.email,
        first_name: user?.user_metadata?.full_name?.split(' ')[0],
        last_name: user?.user_metadata?.full_name?.split(' ').slice(1).join(' '),
      }
    };
    
    return next();
  } catch (err) {
    console.error("JWT Verification failed:", err);
    return res.status(401).json({ message: "Unauthorized - Verification failed" });
  }
};
