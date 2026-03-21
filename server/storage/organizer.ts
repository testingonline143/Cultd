import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { clubs, type Club } from "@shared/schema";

export const organizerStorage = {
  async addCoOrganiser(clubId: string, userId: string): Promise<void> {
    await db.update(clubs).set({
      coOrganiserUserIds: sql`array_append(coalesce(${clubs.coOrganiserUserIds}, ARRAY[]::text[]), ${userId})`
    }).where(eq(clubs.id, clubId));
  },

  async removeCoOrganiser(clubId: string, userId: string): Promise<void> {
    await db.update(clubs).set({
      coOrganiserUserIds: sql`array_remove(coalesce(${clubs.coOrganiserUserIds}, ARRAY[]::text[]), ${userId})`
    }).where(eq(clubs.id, clubId));
  },

  async getClubsForOrganiser(userId: string): Promise<Club[]> {
    const created = await db.select().from(clubs).where(eq(clubs.creatorUserId, userId));
    const coManaged = await db.select().from(clubs).where(
      sql`${clubs.coOrganiserUserIds} @> ARRAY[${userId}]::text[]`
    );
    const seen = new Set<string>();
    const result: Club[] = [];
    for (const c of [...created, ...coManaged]) {
      if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
    }
    return result;
  },

  async isClubManager(clubId: string, userId: string): Promise<boolean> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));
    if (!club) return false;
    if (club.creatorUserId === userId) return true;
    return (club.coOrganiserUserIds ?? []).includes(userId);
  },
};
