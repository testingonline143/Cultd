import type { Express, RequestHandler } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorage } from "./storage";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[auth] SUPABASE_URL or SUPABASE_ANON_KEY not set — authentication will be unavailable.");
}

export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient("https://placeholder.supabase.co", "placeholder-key-that-wont-be-used");

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ message: "Authentication not configured — set SUPABASE_URL and SUPABASE_ANON_KEY" });
  }

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
