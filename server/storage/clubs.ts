import { eq, desc, asc, and, sql, gte, or, ilike, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  clubs, joinRequests, users, events, clubRatings, clubFaqs,
  clubScheduleEntries, clubMoments, momentComments, clubAnnouncements, eventRsvps,
  clubPageSections, sectionEvents, clubProposals,
  type Club, type InsertClub, type JoinRequest, type InsertJoinRequest,
  type ClubRating, type ClubFaq, type ClubScheduleEntry, type ClubMoment,
  type ClubPageSection, type InsertClubPageSection,
  type SectionEvent, type ClubProposal, type InsertClubProposal,
} from "@shared/schema";

export const clubsStorage = {
  async getClubs(params?: { limit?: number; offset?: number }): Promise<Club[]> {
    const q = db.select().from(clubs).orderBy(desc(clubs.memberCount));
    if (params?.limit !== undefined) {
      return q.limit(params.limit).offset(params?.offset ?? 0);
    }
    return q;
  },

  async getClubsCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(clubs);
    return result?.count ?? 0;
  },

  async getClubsByCategory(category: string): Promise<Club[]> {
    return db.select().from(clubs).where(eq(clubs.category, category));
  },

  async getClub(id: string): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, id));
    return club;
  },

  async getClubBySlug(slug: string): Promise<Club | undefined> {
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug));
    return club;
  },

  async updateClubSlug(clubId: string, slug: string): Promise<Club | undefined> {
    const [updated] = await db.update(clubs).set({ slug }).where(eq(clubs.id, clubId)).returning();
    return updated;
  },

  async generateSlugForClub(clubId: string): Promise<string | null> {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));
    if (!club) return null;
    const base = club.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    let slug = base;
    let attempt = 0;
    while (true) {
      const [existing] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.slug, slug));
      if (!existing || existing.id === clubId) break;
      attempt++;
      slug = `${base}-${attempt}`;
    }
    await db.update(clubs).set({ slug }).where(eq(clubs.id, clubId));
    return slug;
  },

  async createClub(club: InsertClub): Promise<Club> {
    const [created] = await db.insert(clubs).values(club).returning();
    return created;
  },

  async updateClub(id: string, data: Partial<InsertClub>): Promise<Club | undefined> {
    const [updated] = await db.update(clubs).set(data).where(eq(clubs.id, id)).returning();
    return updated;
  },

  async incrementMemberCount(clubId: string): Promise<Club | undefined> {
    const [updated] = await db.update(clubs)
      .set({ memberCount: sql`${clubs.memberCount} + 1` })
      .where(eq(clubs.id, clubId))
      .returning();
    return updated;
  },

  async decrementMemberCount(clubId: string): Promise<Club | undefined> {
    const [updated] = await db.update(clubs)
      .set({ memberCount: sql`GREATEST(${clubs.memberCount} - 1, 0)` })
      .where(eq(clubs.id, clubId))
      .returning();
    return updated;
  },

  async reconcileMemberCount(clubId: string): Promise<Club | undefined> {
    const [updated] = await db.update(clubs)
      .set({
        memberCount: sql`(SELECT count(*)::int FROM ${joinRequests} WHERE ${joinRequests.clubId} = ${clubId} AND ${joinRequests.status} = 'approved')`,
      })
      .where(eq(clubs.id, clubId))
      .returning();
    return updated;
  },

  async getClubsByCreator(creatorUserId: string): Promise<Club[]> {
    return db.select().from(clubs).where(eq(clubs.creatorUserId, creatorUserId));
  },

  async searchClubs(params: { search?: string; category?: string; city?: string; vibe?: string; timeOfDay?: string; limit?: number; offset?: number }): Promise<Club[]> {
    const conditions = [];
    if (params.category && params.category !== "All") conditions.push(eq(clubs.category, params.category));
    if (params.city && params.city !== "All Cities") conditions.push(eq(clubs.city, params.city));
    if (params.vibe && params.vibe !== "all") conditions.push(eq(clubs.vibe, params.vibe));
    if (params.timeOfDay && params.timeOfDay !== "all") conditions.push(eq(clubs.timeOfDay, params.timeOfDay));
    if (params.search) {
      conditions.push(or(ilike(clubs.name, `%${params.search}%`), ilike(clubs.shortDesc, `%${params.search}%`), ilike(clubs.category, `%${params.search}%`))!);
    }
    const baseQuery = conditions.length === 0
      ? db.select().from(clubs).orderBy(desc(clubs.memberCount))
      : db.select().from(clubs).where(and(...conditions)).orderBy(desc(clubs.memberCount));
    if (params.limit !== undefined) return baseQuery.limit(params.limit).offset(params.offset ?? 0);
    return baseQuery;
  },

  async searchClubsCount(params: { search?: string; category?: string; city?: string; vibe?: string; timeOfDay?: string }): Promise<number> {
    const conditions = [];
    if (params.category && params.category !== "All") conditions.push(eq(clubs.category, params.category));
    if (params.city && params.city !== "All Cities") conditions.push(eq(clubs.city, params.city));
    if (params.vibe && params.vibe !== "all") conditions.push(eq(clubs.vibe, params.vibe));
    if (params.timeOfDay && params.timeOfDay !== "all") conditions.push(eq(clubs.timeOfDay, params.timeOfDay));
    if (params.search) {
      conditions.push(or(ilike(clubs.name, `%${params.search}%`), ilike(clubs.shortDesc, `%${params.search}%`), ilike(clubs.category, `%${params.search}%`))!);
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(clubs).where(whereClause);
    return result?.count ?? 0;
  },

  async getMemberDirectory(clubId: string): Promise<{ userId: string | null; name: string; profileImageUrl: string | null; joinedAt: Date | null }[]> {
    return db.select({
      userId: joinRequests.userId,
      name: joinRequests.name,
      profileImageUrl: users.profileImageUrl,
      joinedAt: joinRequests.createdAt,
    })
      .from(joinRequests)
      .leftJoin(users, eq(joinRequests.userId, users.id))
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")))
      .orderBy(asc(joinRequests.createdAt));
  },

  async getMembersPreview(clubId: string, limit = 10): Promise<{ userId: string | null; name: string; profileImageUrl: string | null }[]> {
    return db.select({
      userId: joinRequests.userId,
      name: joinRequests.name,
      profileImageUrl: users.profileImageUrl,
    })
      .from(joinRequests)
      .leftJoin(users, eq(joinRequests.userId, users.id))
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")))
      .orderBy(asc(joinRequests.createdAt))
      .limit(limit);
  },

  async getPublicClubMembers(clubId: string): Promise<{ name: string; profileImageUrl: string | null }[]> {
    return db.select({
      name: joinRequests.name,
      profileImageUrl: users.profileImageUrl,
    })
      .from(joinRequests)
      .leftJoin(users, eq(joinRequests.userId, users.id))
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")))
      .orderBy(asc(joinRequests.createdAt));
  },

  async createJoinRequest(request: InsertJoinRequest): Promise<JoinRequest> {
    const [created] = await db.insert(joinRequests).values(request).returning();
    return created;
  },

  async getJoinRequests(): Promise<JoinRequest[]> {
    return db.select().from(joinRequests).orderBy(desc(joinRequests.createdAt));
  },

  async getJoinRequestsByClub(clubId: string): Promise<JoinRequest[]> {
    return db.select().from(joinRequests)
      .where(eq(joinRequests.clubId, clubId))
      .orderBy(desc(joinRequests.createdAt));
  },

  async getJoinRequestsByPhone(phone: string): Promise<JoinRequest[]> {
    return db.select().from(joinRequests)
      .where(eq(joinRequests.phone, phone))
      .orderBy(desc(joinRequests.createdAt));
  },

  async getJoinRequestsByUser(userId: string): Promise<JoinRequest[]> {
    return db.select().from(joinRequests)
      .where(eq(joinRequests.userId, userId))
      .orderBy(desc(joinRequests.createdAt));
  },

  async getJoinRequest(id: string): Promise<JoinRequest | undefined> {
    const [request] = await db.select().from(joinRequests).where(eq(joinRequests.id, id));
    return request;
  },

  async markJoinRequestDone(id: string): Promise<JoinRequest | undefined> {
    const [updated] = await db.update(joinRequests).set({ markedDone: true }).where(eq(joinRequests.id, id)).returning();
    return updated;
  },

  async approveJoinRequest(id: string): Promise<JoinRequest | undefined> {
    const [updated] = await db.update(joinRequests).set({ status: "approved" }).where(eq(joinRequests.id, id)).returning();
    return updated;
  },

  async rejectJoinRequest(id: string): Promise<JoinRequest | undefined> {
    const [updated] = await db.update(joinRequests).set({ status: "rejected" }).where(eq(joinRequests.id, id)).returning();
    return updated;
  },

  async deleteJoinRequest(id: string): Promise<void> {
    await db.delete(joinRequests).where(eq(joinRequests.id, id));
  },

  async getPendingJoinRequestCount(clubId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "pending")));
    return result?.count ?? 0;
  },

  async getApprovedMembersByClub(clubId: string): Promise<JoinRequest[]> {
    return db.select().from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")));
  },

  async hasExistingJoinRequest(clubId: string, userId: string): Promise<JoinRequest | undefined> {
    const [request] = await db.select().from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.userId, userId)));
    return request;
  },

  async getJoinRequestCountByClub(clubId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(joinRequests)
      .where(eq(joinRequests.clubId, clubId));
    return result?.count ?? 0;
  },

  async hasUserJoinedClub(clubId: string, userId: string): Promise<boolean> {
    const [request] = await db.select().from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.userId, userId), eq(joinRequests.status, "approved")));
    return !!request;
  },

  async getUserJoinStatus(clubId: string, userId: string): Promise<{ status: string | null; requestId: string | null }> {
    const [request] = await db.select().from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.userId, userId)));
    if (!request) return { status: null, requestId: null };
    return { status: request.status, requestId: request.id };
  },

  async approveJoinRequestWithFoundingCheck(requestId: string, clubId: string): Promise<JoinRequest | undefined> {
    const club = await clubsStorage.getClub(clubId);
    if (!club) return undefined;
    const isFoundingMember = (club.foundingTaken ?? 0) < (club.foundingTotal ?? 20);
    const [updated] = await db.update(joinRequests)
      .set({ status: "approved", isFoundingMember })
      .where(eq(joinRequests.id, requestId))
      .returning();
    if (updated) {
      await clubsStorage.incrementMemberCount(clubId);
    }
    return updated;
  },

  async autoJoinSampleClubs(userId: string): Promise<Club[]> {
    const sampleClubs = await db.select().from(clubs).orderBy(asc(clubs.createdAt)).limit(3);
    const joined: Club[] = [];
    for (const club of sampleClubs) {
      const existing = await clubsStorage.hasExistingJoinRequest(club.id, userId);
      if (existing?.status === "approved") { joined.push(club); continue; }
      if (existing && existing.status !== "approved") {
        await db.update(joinRequests).set({ status: "approved", isFoundingMember: false }).where(eq(joinRequests.id, existing.id));
        await clubsStorage.incrementMemberCount(club.id);
        joined.push(club);
        continue;
      }
      const [request] = await db.insert(joinRequests).values({
        clubId: club.id,
        clubName: club.name,
        userId,
        name: "Member",
        phone: "0000000000",
        status: "pending",
      }).returning();
      await clubsStorage.approveJoinRequestWithFoundingCheck(request.id, club.id);
      joined.push(club);
    }
    return joined;
  },

  async getUserApprovedClubs(userId: string): Promise<Club[]> {
    const result = await db.select({ club: clubs })
      .from(joinRequests)
      .innerJoin(clubs, eq(joinRequests.clubId, clubs.id))
      .where(and(eq(joinRequests.userId, userId), eq(joinRequests.status, "approved")));
    return result.map(r => r.club);
  },

  async getUserFoundingClubs(userId: string): Promise<{ clubId: string; clubName: string; isFoundingMember: boolean | null }[]> {
    return db.select({
      clubId: joinRequests.clubId,
      clubName: joinRequests.clubName,
      isFoundingMember: joinRequests.isFoundingMember,
    })
      .from(joinRequests)
      .where(and(eq(joinRequests.userId, userId), eq(joinRequests.status, "approved")));
  },

  async getClubMemberUserIds(clubId: string): Promise<string[]> {
    const rows = await db.select({ userId: joinRequests.userId })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")));
    return rows.map(r => r.userId).filter((id): id is string => id !== null);
  },

  async getClubMembersEnriched(clubId: string) {
    const attendanceSubquery = db
      .select({
        userId: eventRsvps.userId,
        count: sql<number>`count(*)::int`.as("count"),
      })
      .from(eventRsvps)
      .innerJoin(events, eq(eventRsvps.eventId, events.id))
      .where(and(eq(events.clubId, clubId), eq(eventRsvps.checkedIn, true)))
      .groupBy(eventRsvps.userId)
      .as("attendance");

    return db.select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      name: joinRequests.name,
      phone: joinRequests.phone,
      profileImageUrl: users.profileImageUrl,
      bio: users.bio,
      city: users.city,
      joinedAt: joinRequests.createdAt,
      isFoundingMember: joinRequests.isFoundingMember,
      eventsAttended: sql<number>`coalesce(${attendanceSubquery.count}, 0)`.as("events_attended"),
    })
      .from(joinRequests)
      .leftJoin(users, eq(joinRequests.userId, users.id))
      .leftJoin(attendanceSubquery, eq(joinRequests.userId, attendanceSubquery.userId))
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")))
      .orderBy(desc(joinRequests.createdAt));
  },

  async getClubRatings(clubId: string): Promise<ClubRating[]> {
    return db.select().from(clubRatings).where(eq(clubRatings.clubId, clubId));
  },

  async getClubAverageRating(clubId: string): Promise<{ average: number; count: number }> {
    const [result] = await db.select({
      average: sql<number>`coalesce(avg(rating), 0)::float`,
      count: sql<number>`count(*)::int`,
    }).from(clubRatings).where(eq(clubRatings.clubId, clubId));
    return { average: result?.average ?? 0, count: result?.count ?? 0 };
  },

  async getUserRating(clubId: string, userId: string): Promise<ClubRating | undefined> {
    const [rating] = await db.select().from(clubRatings)
      .where(and(eq(clubRatings.clubId, clubId), eq(clubRatings.userId, userId)));
    return rating;
  },

  async upsertRating(clubId: string, userId: string, rating: number, review?: string): Promise<ClubRating> {
    const existing = await clubsStorage.getUserRating(clubId, userId);
    if (existing) {
      const [updated] = await db.update(clubRatings)
        .set({ rating, review: review ?? null })
        .where(and(eq(clubRatings.clubId, clubId), eq(clubRatings.userId, userId)))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clubRatings).values({ clubId, userId, rating, review: review ?? null }).returning();
    return created;
  },

  async getClubFaqs(clubId: string): Promise<ClubFaq[]> {
    return db.select().from(clubFaqs).where(eq(clubFaqs.clubId, clubId));
  },

  async createFaq(clubId: string, question: string, answer: string): Promise<ClubFaq> {
    const [created] = await db.insert(clubFaqs).values({ clubId, question, answer }).returning();
    return created;
  },

  async updateFaq(id: string, question: string, answer: string): Promise<ClubFaq | undefined> {
    const [updated] = await db.update(clubFaqs).set({ question, answer }).where(eq(clubFaqs.id, id)).returning();
    return updated;
  },

  async deleteFaq(id: string): Promise<void> {
    await db.delete(clubFaqs).where(eq(clubFaqs.id, id));
  },

  async getClubSchedule(clubId: string): Promise<ClubScheduleEntry[]> {
    return db.select().from(clubScheduleEntries).where(eq(clubScheduleEntries.clubId, clubId));
  },

  async createScheduleEntry(clubId: string, data: { dayOfWeek: string; startTime: string; endTime?: string; activity: string; location?: string }): Promise<ClubScheduleEntry> {
    const [created] = await db.insert(clubScheduleEntries).values({ clubId, ...data }).returning();
    return created;
  },

  async updateScheduleEntry(id: string, data: { dayOfWeek?: string; startTime?: string; endTime?: string; activity?: string; location?: string }): Promise<ClubScheduleEntry | undefined> {
    const [updated] = await db.update(clubScheduleEntries).set(data).where(eq(clubScheduleEntries.id, id)).returning();
    return updated;
  },

  async deleteScheduleEntry(id: string): Promise<void> {
    await db.delete(clubScheduleEntries).where(eq(clubScheduleEntries.id, id));
  },

  async getPageSections(clubId: string): Promise<ClubPageSection[]> {
    return db.select().from(clubPageSections)
      .where(eq(clubPageSections.clubId, clubId))
      .orderBy(asc(clubPageSections.position));
  },

  async createPageSection(data: InsertClubPageSection): Promise<ClubPageSection> {
    const [created] = await db.insert(clubPageSections).values(data).returning();
    return created;
  },

  async updatePageSection(id: string, data: Partial<InsertClubPageSection>): Promise<ClubPageSection | undefined> {
    const [updated] = await db.update(clubPageSections).set(data).where(eq(clubPageSections.id, id)).returning();
    return updated;
  },

  async deletePageSection(id: string): Promise<void> {
    await db.delete(sectionEvents).where(eq(sectionEvents.sectionId, id));
    await db.delete(clubPageSections).where(eq(clubPageSections.id, id));
  },

  async reorderPageSections(clubId: string, sectionIds: string[]): Promise<void> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(clubPageSections)
        .set({ position: i })
        .where(and(eq(clubPageSections.id, sectionIds[i]), eq(clubPageSections.clubId, clubId)));
    }
  },

  async getSectionEvents(sectionId: string) {
    const rows = await db.select({
      id: sectionEvents.id,
      sectionId: sectionEvents.sectionId,
      eventId: sectionEvents.eventId,
      position: sectionEvents.position,
      createdAt: sectionEvents.createdAt,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventLocation: events.locationText,
    })
      .from(sectionEvents)
      .innerJoin(events, eq(sectionEvents.eventId, events.id))
      .where(eq(sectionEvents.sectionId, sectionId))
      .orderBy(asc(sectionEvents.position));
    return rows as any;
  },

  async addSectionEvent(sectionId: string, eventId: string, position: number): Promise<SectionEvent> {
    const [created] = await db.insert(sectionEvents).values({ sectionId, eventId, position }).returning();
    return created;
  },

  async removeSectionEvent(id: string): Promise<void> {
    await db.delete(sectionEvents).where(eq(sectionEvents.id, id));
  },

  async getPublicPageData(clubId: string) {
    const club = await clubsStorage.getClub(clubId);
    if (!club) throw new Error("Club not found");

    const sections = await clubsStorage.getPageSections(clubId);
    const sectionsWithEvents = await Promise.all(
      sections.filter(s => s.isVisible !== false).map(async (s) => {
        const evts = await clubsStorage.getSectionEvents(s.id);
        return {
          ...s,
          events: evts.map((e: any) => ({
            id: e.id,
            eventId: e.eventId,
            title: e.eventTitle,
            startsAt: e.eventStartsAt,
            location: e.eventLocation,
            position: e.position,
          })),
        };
      })
    );

    const announcements = await db.select().from(clubAnnouncements)
      .where(eq(clubAnnouncements.clubId, clubId))
      .orderBy(desc(clubAnnouncements.createdAt));
    const schedule = await clubsStorage.getClubSchedule(clubId);

    const momentRows = await db.select().from(clubMoments).where(eq(clubMoments.clubId, clubId)).orderBy(desc(clubMoments.createdAt)).limit(6);
    const momentIds = momentRows.map(r => r.id);
    let commentCounts: Record<string, number> = {};
    if (momentIds.length > 0) {
      const counts = await db
        .select({ momentId: momentComments.momentId, count: sql<number>`count(*)::int` })
        .from(momentComments)
        .where(inArray(momentComments.momentId, momentIds))
        .groupBy(momentComments.momentId);
      for (const c of counts) commentCounts[c.momentId] = c.count;
    }
    const moments = momentRows.map(r => ({ ...r, commentCount: commentCounts[r.id] ?? 0 }));

    const now = new Date();
    const clubEvents = await db.select().from(events).where(eq(events.clubId, clubId)).orderBy(events.startsAt);
    const activeEvents = clubEvents.filter(e => !e.isCancelled);
    const upcomingEventCount = activeEvents.filter(e => new Date(e.startsAt) > now).length;
    const pastEventCount = activeEvents.filter(e => new Date(e.startsAt) <= now).length;

    const { average, count } = await clubsStorage.getClubAverageRating(clubId);

    return {
      club,
      sections: sectionsWithEvents,
      announcements,
      schedule,
      moments,
      memberCount: club.memberCount,
      upcomingEventCount,
      pastEventCount,
      rating: count > 0 ? average : null,
    };
  },

  async createClubProposal(data: InsertClubProposal): Promise<ClubProposal> {
    const [created] = await db.insert(clubProposals).values(data).returning();
    return created;
  },

  async getClubProposalsByUser(userId: string): Promise<ClubProposal[]> {
    return db.select().from(clubProposals).where(eq(clubProposals.userId, userId)).orderBy(desc(clubProposals.createdAt));
  },

  async getAllClubProposals() {
    return db.select({
      id: clubProposals.id,
      userId: clubProposals.userId,
      clubName: clubProposals.clubName,
      category: clubProposals.category,
      vibe: clubProposals.vibe,
      shortDesc: clubProposals.shortDesc,
      city: clubProposals.city,
      schedule: clubProposals.schedule,
      motivation: clubProposals.motivation,
      status: clubProposals.status,
      reviewNote: clubProposals.reviewNote,
      createdAt: clubProposals.createdAt,
      suggestedCommissionType: clubProposals.suggestedCommissionType,
      suggestedCommissionValue: clubProposals.suggestedCommissionValue,
      commissionNote: clubProposals.commissionNote,
      userName: users.firstName,
      userEmail: users.email,
    })
      .from(clubProposals)
      .leftJoin(users, eq(clubProposals.userId, users.id))
      .orderBy(desc(clubProposals.createdAt));
  },

  async updateClubProposalStatus(id: string, status: string, reviewNote?: string): Promise<ClubProposal | undefined> {
    const updateData: Record<string, any> = { status };
    if (reviewNote !== undefined) updateData.reviewNote = reviewNote;
    const [updated] = await db.update(clubProposals).set(updateData).where(eq(clubProposals.id, id)).returning();
    return updated;
  },

  async getClubProposal(id: string): Promise<ClubProposal | undefined> {
    const [proposal] = await db.select().from(clubProposals).where(eq(clubProposals.id, id));
    return proposal;
  },

  async getPendingProposalCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(clubProposals).where(eq(clubProposals.status, "pending"));
    return result?.count ?? 0;
  },

  async updateClubHealth(clubId: string, status: string, label: string): Promise<void> {
    await db.update(clubs).set({ healthStatus: status, healthLabel: label }).where(eq(clubs.id, clubId));
  },

  async updateClubCommission(clubId: string, data: { commissionType: string; commissionValue: number; commissionSetByAdmin: boolean; commissionNote?: string }): Promise<Club | undefined> {
    const [updated] = await db.update(clubs).set({
      commissionType: data.commissionType,
      commissionValue: data.commissionValue,
      commissionSetByAdmin: data.commissionSetByAdmin,
      commissionNote: data.commissionNote ?? null,
    }).where(eq(clubs.id, clubId)).returning();
    return updated;
  },

  async updateClubPayoutSetup(clubId: string, data: { razorpayContactId?: string; razorpayFundAccountId?: string; bankAccountName?: string; bankAccountNumber?: string; bankIfsc?: string; upiId?: string; payoutMethod?: string; payoutsEnabled?: boolean }): Promise<Club | undefined> {
    const [updated] = await db.update(clubs).set(data).where(eq(clubs.id, clubId)).returning();
    return updated;
  },
};
