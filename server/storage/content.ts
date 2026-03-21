import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  clubs, clubMoments, momentComments, momentLikes, clubAnnouncements, clubPolls, pollVotes,
  type ClubMoment, type MomentComment, type ClubAnnouncement, type InsertClubAnnouncement,
  type ClubPoll, type InsertClubPoll,
} from "@shared/schema";

export const contentStorage = {
  async getClubMoments(clubId: string): Promise<(ClubMoment & { commentCount: number })[]> {
    const rows = await db.select().from(clubMoments).where(eq(clubMoments.clubId, clubId)).orderBy(desc(clubMoments.createdAt));
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const counts = await db
      .select({ momentId: momentComments.momentId, count: sql<number>`count(*)::int` })
      .from(momentComments)
      .where(sql`${momentComments.momentId} = ANY(${sql.raw(`ARRAY[${ids.map(id => `'${id}'`).join(",")}]`)})`)
      .groupBy(momentComments.momentId);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.momentId] = c.count;
    return rows.map(r => ({ ...r, commentCount: countMap[r.id] ?? 0 }));
  },

  async createMoment(clubId: string, caption: string, emoji?: string, imageUrl?: string, authorUserId?: string, authorName?: string): Promise<ClubMoment> {
    const [created] = await db.insert(clubMoments).values({ clubId, caption, emoji: emoji || null, imageUrl: imageUrl || null, authorUserId: authorUserId || null, authorName: authorName || null }).returning();
    return created;
  },

  async updateMoment(id: string, data: { caption?: string; emoji?: string }): Promise<ClubMoment | undefined> {
    const [updated] = await db.update(clubMoments).set(data).where(eq(clubMoments.id, id)).returning();
    return updated;
  },

  async deleteMoment(id: string): Promise<void> {
    await db.delete(momentComments).where(eq(momentComments.momentId, id));
    await db.delete(clubMoments).where(eq(clubMoments.id, id));
  },

  async getMomentById(momentId: string): Promise<ClubMoment | undefined> {
    const [row] = await db.select().from(clubMoments).where(eq(clubMoments.id, momentId));
    return row;
  },

  async getCommentsByMoment(momentId: string): Promise<MomentComment[]> {
    return db.select().from(momentComments)
      .where(eq(momentComments.momentId, momentId))
      .orderBy(momentComments.createdAt);
  },

  async createComment(data: { momentId: string; userId: string; userName: string; userImageUrl?: string | null; content: string }): Promise<MomentComment> {
    const [created] = await db.insert(momentComments).values({
      momentId: data.momentId,
      userId: data.userId,
      userName: data.userName,
      userImageUrl: data.userImageUrl ?? null,
      content: data.content,
    }).returning();
    return created;
  },

  async deleteComment(commentId: string, userId: string, isOrganiser = false): Promise<void> {
    if (isOrganiser) {
      await db.delete(momentComments).where(eq(momentComments.id, commentId));
    } else {
      await db.delete(momentComments).where(and(eq(momentComments.id, commentId), eq(momentComments.userId, userId)));
    }
  },

  async likeMoment(momentId: string, userId: string): Promise<void> {
    try {
      await db.insert(momentLikes).values({ momentId, userId });
      await db.update(clubMoments).set({ likesCount: sql`${clubMoments.likesCount} + 1` }).where(eq(clubMoments.id, momentId));
    } catch { }
  },

  async unlikeMoment(momentId: string, userId: string): Promise<void> {
    const deleted = await db.delete(momentLikes).where(and(eq(momentLikes.momentId, momentId), eq(momentLikes.userId, userId))).returning();
    if (deleted.length > 0) {
      await db.update(clubMoments).set({ likesCount: sql`GREATEST(${clubMoments.likesCount} - 1, 0)` }).where(eq(clubMoments.id, momentId));
    }
  },

  async getMomentLikeStatus(momentId: string, userId: string): Promise<boolean> {
    const [row] = await db.select().from(momentLikes).where(and(eq(momentLikes.momentId, momentId), eq(momentLikes.userId, userId)));
    return !!row;
  },

  async getFeedMomentsCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(clubMoments);
    return result?.count ?? 0;
  },

  async getFeedMoments(limit = 10, userId?: string, offset = 0) {
    const rows = await db.select({
      id: clubMoments.id,
      clubId: clubMoments.clubId,
      caption: clubMoments.caption,
      imageUrl: clubMoments.imageUrl,
      emoji: clubMoments.emoji,
      likesCount: clubMoments.likesCount,
      createdAt: clubMoments.createdAt,
      authorUserId: clubMoments.authorUserId,
      authorName: clubMoments.authorName,
      clubName: clubs.name,
      clubEmoji: clubs.emoji,
      clubLocation: clubs.location,
    })
      .from(clubMoments)
      .innerJoin(clubs, eq(clubMoments.clubId, clubs.id))
      .orderBy(desc(clubMoments.createdAt))
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const counts = await db
      .select({ momentId: momentComments.momentId, count: sql<number>`count(*)::int` })
      .from(momentComments)
      .where(sql`${momentComments.momentId} = ANY(${sql.raw(`ARRAY[${ids.map(id => `'${id}'`).join(",")}]`)})`)
      .groupBy(momentComments.momentId);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.momentId] = c.count;
    let likedSet = new Set<string>();
    if (userId) {
      const likedRows = await db
        .select({ momentId: momentLikes.momentId })
        .from(momentLikes)
        .where(and(eq(momentLikes.userId, userId), sql`${momentLikes.momentId} = ANY(${sql.raw(`ARRAY[${ids.map(id => `'${id}'`).join(",")}]`)})`));
      for (const row of likedRows) likedSet.add(row.momentId);
    }
    return rows.map(r => ({ ...r, commentCount: countMap[r.id] ?? 0, userHasLiked: likedSet.has(r.id) }));
  },

  async getClubAnnouncements(clubId: string): Promise<ClubAnnouncement[]> {
    return db.select().from(clubAnnouncements)
      .where(eq(clubAnnouncements.clubId, clubId))
      .orderBy(desc(clubAnnouncements.createdAt));
  },

  async createAnnouncement(data: InsertClubAnnouncement): Promise<ClubAnnouncement> {
    const [created] = await db.insert(clubAnnouncements).values(data).returning();
    return created;
  },

  async deleteAnnouncement(id: string, clubId: string): Promise<void> {
    await db.delete(clubAnnouncements).where(
      and(eq(clubAnnouncements.id, id), eq(clubAnnouncements.clubId, clubId))
    );
  },

  async getPollById(pollId: string): Promise<ClubPoll | null> {
    const [poll] = await db.select().from(clubPolls).where(eq(clubPolls.id, pollId));
    return poll ?? null;
  },

  async getClubPolls(clubId: string, viewerUserId?: string): Promise<(ClubPoll & { voteCounts: number[]; userVote: number | null })[]> {
    const polls = await db.select().from(clubPolls)
      .where(eq(clubPolls.clubId, clubId))
      .orderBy(desc(clubPolls.createdAt));
    if (polls.length === 0) return [];
    const pollIds = polls.map(p => p.id);
    const [aggregates, userVotes] = await Promise.all([
      db.select({
        pollId: pollVotes.pollId,
        optionIndex: pollVotes.optionIndex,
        count: sql<number>`count(*)::int`,
      })
        .from(pollVotes)
        .where(inArray(pollVotes.pollId, pollIds))
        .groupBy(pollVotes.pollId, pollVotes.optionIndex),
      viewerUserId
        ? db.select({ pollId: pollVotes.pollId, optionIndex: pollVotes.optionIndex })
            .from(pollVotes)
            .where(and(inArray(pollVotes.pollId, pollIds), eq(pollVotes.userId, viewerUserId)))
        : Promise.resolve([]),
    ]);
    const countMap = new Map<string, Map<number, number>>();
    for (const row of aggregates) {
      const byOption = countMap.get(row.pollId) ?? new Map<number, number>();
      byOption.set(row.optionIndex, row.count);
      countMap.set(row.pollId, byOption);
    }
    const userVoteMap = new Map<string, number>();
    for (const row of userVotes) {
      userVoteMap.set(row.pollId, row.optionIndex);
    }
    return polls.map(poll => {
      const byOption = countMap.get(poll.id) ?? new Map<number, number>();
      const voteCounts = (poll.options ?? []).map((_: string, idx: number) => byOption.get(idx) ?? 0);
      return { ...poll, voteCounts, userVote: userVoteMap.get(poll.id) ?? null };
    });
  },

  async createPoll(data: InsertClubPoll): Promise<ClubPoll> {
    const [created] = await db.insert(clubPolls).values(data).returning();
    return created;
  },

  async deletePoll(id: string, clubId: string): Promise<void> {
    await db.delete(clubPolls).where(and(eq(clubPolls.id, id), eq(clubPolls.clubId, clubId)));
  },

  async closePoll(id: string, clubId: string): Promise<void> {
    await db.update(clubPolls).set({ isOpen: false })
      .where(and(eq(clubPolls.id, id), eq(clubPolls.clubId, clubId)));
  },

  async castVote(pollId: string, userId: string, optionIndex: number): Promise<void> {
    const existing = await db.select().from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    if (existing.length > 0) {
      await db.update(pollVotes).set({ optionIndex })
        .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    } else {
      await db.insert(pollVotes).values({ pollId, userId, optionIndex });
    }
  },
};
