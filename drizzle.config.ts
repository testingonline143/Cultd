import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isSupabase =
  process.env.DATABASE_URL.includes("supabase.com") ||
  process.env.DATABASE_URL.includes("supabase.co");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ...(isSupabase && { ssl: "prefer" }),
  },
});
