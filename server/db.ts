import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.warn("[db] DATABASE_URL is not set — database features will be unavailable.");
}

const isSupabase = dbUrl?.includes("supabase.com") || dbUrl?.includes("supabase.co");

export const pool = new pg.Pool({
  connectionString: dbUrl || "postgresql://localhost/placeholder",
  connectionTimeoutMillis: 5000,
  ...(isSupabase && {
    ssl: { rejectUnauthorized: false },
  }),
});

export const db = drizzle(pool, { schema });
