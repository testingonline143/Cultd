import { eq, desc, asc, and, sql, gte, ne } from "drizzle-orm";
import { db } from "../db";
import {
  users, clubs, events, eventRsvps, joinRequests, clubMoments, momentComments,
  clubPolls, pollVotes, notifications,
} from "@shared/schema";

export const adminStorage = {
  async getStats(): Promise<{ totalMembers: number; totalClubs: number; upcomingEvents: number }> {
    const [membersResult] = await db.select({
      count: sql<number>`(SELECT COUNT(DISTINCT phone) FROM join_requests WHERE status = 'approved')::int`,
    }).from(joinRequests);

    const [clubsResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(clubs).where(eq(clubs.isActive, true));

    const now = new Date();
    const [eventsResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(events).where(gte(events.startsAt, now));

    return {
      totalMembers: membersResult?.count ?? 0,
      totalClubs: clubsResult?.count ?? 0,
      upcomingEvents: eventsResult?.count ?? 0,
    };
  },

  async getClubActivity(clubId: string): Promise<{ recentJoins: number; recentJoinNames: string[]; totalEvents: number; lastEventDate: Date | null }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [joinCountResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(joinRequests).where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved"), gte(joinRequests.createdAt, sevenDaysAgo)));

    const recentNames = await db.select({ name: joinRequests.name })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved"), gte(joinRequests.createdAt, sevenDaysAgo)))
      .orderBy(desc(joinRequests.createdAt))
      .limit(3);

    const [eventCountResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(events).where(eq(events.clubId, clubId));

    const [lastEvent] = await db.select({ startsAt: events.startsAt })
      .from(events)
      .where(eq(events.clubId, clubId))
      .orderBy(desc(events.startsAt))
      .limit(1);

    return {
      recentJoins: joinCountResult?.count ?? 0,
      recentJoinNames: recentNames.map(r => r.name.split(" ")[0]),
      totalEvents: eventCountResult?.count ?? 0,
      lastEventDate: lastEvent?.startsAt ?? null,
    };
  },

  async getRecentActivityFeed(limit = 10): Promise<{ name: string; clubName: string; clubEmoji: string; createdAt: Date | null }[]> {
    const results = await db.select({
      name: joinRequests.name,
      clubName: joinRequests.clubName,
      clubId: joinRequests.clubId,
      createdAt: joinRequests.createdAt,
    })
      .from(joinRequests)
      .where(eq(joinRequests.status, "approved"))
      .orderBy(desc(joinRequests.createdAt))
      .limit(limit);

    const clubIds = Array.from(new Set(results.map(r => r.clubId)));
    const clubsData = clubIds.length > 0
      ? await db.select({ id: clubs.id, emoji: clubs.emoji }).from(clubs).where(
          sql`${clubs.id} IN (${sql.join(clubIds.map(id => sql`${id}`), sql`, `)})`
        )
      : [];
    const emojiMap = Object.fromEntries(clubsData.map(c => [c.id, c.emoji]));

    return results.map(r => ({
      name: r.name.split(" ")[0],
      clubName: r.clubName,
      clubEmoji: emojiMap[r.clubId] || "🎯",
      createdAt: r.createdAt,
    }));
  },

  async getClubsWithRecentJoins(): Promise<Record<string, number>> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const results = await db.select({
      clubId: joinRequests.clubId,
      count: sql<number>`count(*)::int`,
    })
      .from(joinRequests)
      .where(and(eq(joinRequests.status, "approved"), gte(joinRequests.createdAt, sevenDaysAgo)))
      .groupBy(joinRequests.clubId);

    return Object.fromEntries(results.map(r => [r.clubId, r.count]));
  },

  async getAdminAnalytics() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [clubCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clubs);
    const [activeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clubs).where(ne(clubs.isActive, false));
    const [eventCount] = await db.select({ count: sql<number>`count(*)::int` }).from(events);
    const [rsvpCount] = await db.select({ count: sql<number>`count(*)::int` }).from(eventRsvps);
    const [checkinCount] = await db.select({ count: sql<number>`count(*)::int` }).from(eventRsvps).where(eq(eventRsvps.checkedIn, true));
    const [momentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clubMoments);
    const [commentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(momentComments);
    const [newUsersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, sevenDaysAgo));
    const [newEventsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(events).where(gte(events.createdAt, sevenDaysAgo));
    const [newJoinsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(joinRequests).where(and(eq(joinRequests.status, "approved"), gte(joinRequests.createdAt, sevenDaysAgo)));

    const cityRows = await db.select({
      city: clubs.city,
      count: sql<number>`count(*)::int`,
    }).from(clubs).groupBy(clubs.city).orderBy(sql`count(*) desc`);

    return {
      totalUsers: userCount.count,
      totalClubs: clubCount.count,
      activeClubs: activeCount.count,
      totalEvents: eventCount.count,
      totalRsvps: rsvpCount.count,
      totalCheckins: checkinCount.count,
      totalMoments: momentCount.count,
      totalComments: commentCount.count,
      newUsersThisWeek: newUsersRow.count,
      newEventsThisWeek: newEventsRow.count,
      newJoinsThisWeek: newJoinsRow.count,
      cityCounts: cityRows.map(r => ({ city: r.city, count: r.count })),
    };
  },

  async getAdminActivityFeed() {
    const recentJoinsRows = await db
      .select({ name: joinRequests.name, clubName: clubs.name, createdAt: joinRequests.createdAt })
      .from(joinRequests)
      .innerJoin(clubs, eq(joinRequests.clubId, clubs.id))
      .where(eq(joinRequests.status, "approved"))
      .orderBy(desc(joinRequests.createdAt))
      .limit(5);
    const recentClubsRows = await db
      .select({ name: clubs.name, emoji: clubs.emoji, city: clubs.city, createdAt: clubs.createdAt })
      .from(clubs)
      .orderBy(desc(clubs.createdAt))
      .limit(3);
    const recentEventsRows = await db
      .select({ title: events.title, clubName: clubs.name, startsAt: events.startsAt })
      .from(events)
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .orderBy(desc(events.createdAt))
      .limit(3);
    return { recentJoins: recentJoinsRows, recentClubs: recentClubsRows, recentEvents: recentEventsRows };
  },

  async getUserAdminDetail(userId: string) {
    const userClubs = await db
      .select({ clubId: joinRequests.clubId, clubName: clubs.name, clubEmoji: clubs.emoji, joinedAt: joinRequests.createdAt })
      .from(joinRequests)
      .innerJoin(clubs, eq(joinRequests.clubId, clubs.id))
      .where(and(eq(joinRequests.userId, userId), eq(joinRequests.status, "approved")))
      .orderBy(desc(joinRequests.createdAt));

    const userEvents = await db
      .select({ id: events.id, title: events.title, startsAt: events.startsAt, clubName: clubs.name })
      .from(eventRsvps)
      .innerJoin(events, eq(eventRsvps.eventId, events.id))
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .where(eq(eventRsvps.userId, userId))
      .orderBy(desc(events.startsAt))
      .limit(10);

    const userClubIds = userClubs.map(c => c.clubId);
    const userMoments = userClubIds.length > 0
      ? await db
          .select({ id: clubMoments.id, caption: clubMoments.caption, createdAt: clubMoments.createdAt })
          .from(clubMoments)
          .where(sql`${clubMoments.clubId} = ANY(${userClubIds})`)
          .orderBy(desc(clubMoments.createdAt))
          .limit(5)
      : [];

    const userJoinRequests = await db
      .select({ clubName: clubs.name, status: joinRequests.status, createdAt: joinRequests.createdAt })
      .from(joinRequests)
      .innerJoin(clubs, eq(joinRequests.clubId, clubs.id))
      .where(eq(joinRequests.userId, userId))
      .orderBy(desc(joinRequests.createdAt));

    return {
      clubs: userClubs,
      events: userEvents,
      moments: userMoments,
      joinRequests: userJoinRequests,
    };
  },

  async getAllPollsAdmin() {
    const allPolls = await db
      .select({
        id: clubPolls.id,
        clubId: clubPolls.clubId,
        clubName: clubs.name,
        clubEmoji: clubs.emoji,
        question: clubPolls.question,
        options: clubPolls.options,
        isOpen: clubPolls.isOpen,
        createdAt: clubPolls.createdAt,
      })
      .from(clubPolls)
      .innerJoin(clubs, eq(clubPolls.clubId, clubs.id))
      .orderBy(desc(clubPolls.createdAt));

    return Promise.all(allPolls.map(async (poll) => {
      const allVotes = await db.select().from(pollVotes).where(eq(pollVotes.pollId, poll.id));
      const votes = poll.options.map((_, i) => allVotes.filter(v => v.optionIndex === i).length);
      return { ...poll, votes, totalVotes: allVotes.length };
    }));
  },

  async closePollAdmin(pollId: string): Promise<void> {
    await db.update(clubPolls).set({ isOpen: false }).where(eq(clubPolls.id, pollId));
  },

  async getWeeklyGrowth(): Promise<{ week: string; users: number; events: number; moments: number }[]> {
    const weeks: { week: string; users: number; events: number; moments: number }[] = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const [uRow] = await db.select({ count: sql<number>`count(*)::int` })
        .from(users).where(and(gte(users.createdAt, weekStart), sql`${users.createdAt} < ${weekEnd}`));
      const [eRow] = await db.select({ count: sql<number>`count(*)::int` })
        .from(events).where(and(gte(events.createdAt, weekStart), sql`${events.createdAt} < ${weekEnd}`));
      const [mRow] = await db.select({ count: sql<number>`count(*)::int` })
        .from(clubMoments).where(and(gte(clubMoments.createdAt, weekStart), sql`${clubMoments.createdAt} < ${weekEnd}`));

      const label = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      weeks.push({ week: label, users: uRow.count, events: eRow.count, moments: mRow.count });
    }

    return weeks;
  },

  async getOrganizerInsights(clubId: string) {
    const [memberResult] = await db.select({ count: sql<number>`count(*)::int` }).from(joinRequests).where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")));
    const [pendingResult] = await db.select({ count: sql<number>`count(*)::int` }).from(joinRequests).where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "pending")));
    const clubEvents = await db.select({ id: events.id, title: events.title }).from(events).where(eq(events.clubId, clubId));

    let avgAttendanceRate = 0;
    let topEvent: { title: string; attended: number; total: number } | null = null;

    if (clubEvents.length > 0) {
      const eventIds = clubEvents.map(e => e.id);
      const attendanceStats = await db.select({
        eventId: eventRsvps.eventId,
        rsvpCount: sql<number>`count(*)::int`,
        checkinCount: sql<number>`sum(case when ${eventRsvps.checkedIn} then 1 else 0 end)::int`,
      })
        .from(eventRsvps)
        .where(sql`${eventRsvps.eventId} in ${eventIds}`)
        .groupBy(eventRsvps.eventId);

      let totalRate = 0;
      let ratedEvents = 0;
      let bestAttendance = -1;

      for (const stat of attendanceStats) {
        if (stat.rsvpCount > 0) {
          const rate = (stat.checkinCount || 0) / stat.rsvpCount;
          totalRate += rate;
          ratedEvents++;
          if ((stat.checkinCount || 0) > bestAttendance) {
            bestAttendance = stat.checkinCount || 0;
            const ev = clubEvents.find(e => e.id === stat.eventId);
            topEvent = { title: ev?.title || "Unknown", attended: stat.checkinCount || 0, total: stat.rsvpCount };
          }
        }
      }
      avgAttendanceRate = ratedEvents > 0 ? Math.round((totalRate / ratedEvents) * 100) : 0;
    }

    const recentJoins = await db.select({
      name: joinRequests.name,
      date: joinRequests.createdAt,
    })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")))
      .orderBy(desc(joinRequests.createdAt))
      .limit(5);

    const recentRsvps = await db.select({
      userName: users.firstName,
      eventTitle: events.title,
      date: eventRsvps.createdAt,
    })
      .from(eventRsvps)
      .innerJoin(events, eq(eventRsvps.eventId, events.id))
      .innerJoin(users, eq(eventRsvps.userId, users.id))
      .where(eq(events.clubId, clubId))
      .orderBy(desc(eventRsvps.createdAt))
      .limit(5);

    return {
      totalMembers: memberResult.count,
      pendingRequests: pendingResult.count,
      totalEvents: clubEvents.length,
      avgAttendanceRate,
      topEvent,
      recentJoins: recentJoins.map(r => ({ name: r.name, date: r.date })),
      recentRsvps: recentRsvps.map(r => ({ userName: r.userName || "Unknown", eventTitle: r.eventTitle, date: r.date })),
    };
  },

  async getClubAnalytics(clubId: string) {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const recentJoins = await db
      .select({ createdAt: joinRequests.createdAt })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved"), gte(joinRequests.createdAt, eightWeeksAgo)));

    const now = new Date();
    const memberGrowth: { week: string; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - w * 7 - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const count = recentJoins.filter(j =>
        j.createdAt && new Date(j.createdAt) >= weekStart && new Date(j.createdAt) < weekEnd
      ).length;
      const label = weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      memberGrowth.push({ week: label, count });
    }

    const clubEventsRows = await db
      .select({ id: events.id, title: events.title, startsAt: events.startsAt, isCancelled: events.isCancelled })
      .from(events)
      .where(eq(events.clubId, clubId))
      .orderBy(desc(events.startsAt));

    const perEventStats: { id: string; title: string; date: string; rsvps: number; attended: number; rate: number; isCancelled: boolean | null }[] = [];
    for (const evt of clubEventsRows.slice(0, 10)) {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          attended: sql<number>`coalesce(sum(case when ${eventRsvps.checkedIn} then 1 else 0 end), 0)::int`,
        })
        .from(eventRsvps)
        .where(eq(eventRsvps.eventId, evt.id));
      const rsvps = row?.total ?? 0;
      const attended = row?.attended ?? 0;
      const rate = rsvps > 0 ? Math.round((attended / rsvps) * 100) : 0;
      perEventStats.push({ id: evt.id, title: evt.title, date: evt.startsAt ? new Date(evt.startsAt).toISOString() : "", rsvps, attended, rate, isCancelled: evt.isCancelled });
    }

    const topRsvpers = await db
      .select({ userId: eventRsvps.userId, rsvpCount: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(eq(events.clubId, clubId))
      .groupBy(eventRsvps.userId)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(5);

    const mostActiveMembers: { name: string; rsvpCount: number }[] = [];
    for (const row of topRsvpers) {
      const [u] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, row.userId));
      mostActiveMembers.push({ name: u?.firstName ?? "Member", rsvpCount: row.rsvpCount });
    }

    const [engRow] = await db
      .select({ engaged: sql<number>`count(distinct ${eventRsvps.userId})::int` })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(eq(events.clubId, clubId));

    const [membRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(joinRequests)
      .where(and(eq(joinRequests.clubId, clubId), eq(joinRequests.status, "approved")));

    const totalMembers = membRow?.count ?? 0;
    const engagementRate = totalMembers > 0 ? Math.round(((engRow?.engaged ?? 0) / totalMembers) * 100) : 0;

    const pastWithRsvps = perEventStats.filter(e => !e.isCancelled && e.rsvps > 0);
    let noShowRate = 0;
    if (pastWithRsvps.length > 0) {
      const totalRate = pastWithRsvps.reduce((sum, e) => sum + (e.rsvps - e.attended) / e.rsvps, 0);
      noShowRate = Math.round((totalRate / pastWithRsvps.length) * 100);
    }

    return { memberGrowth, perEventStats, mostActiveMembers, engagementRate, noShowRate };
  },

  async getClubSurveySummary(clubId: string) {
    const { eventFormResponses } = await import("@shared/schema");
    return db.select({
      eventId: events.id,
      eventTitle: events.title,
      eventDate: events.startsAt,
      responseCount: sql<number>`count(distinct ${eventFormResponses.userId})::int`,
    })
      .from(events)
      .innerJoin(eventFormResponses, eq(eventFormResponses.eventId, events.id))
      .where(eq(events.clubId, clubId))
      .groupBy(events.id, events.title, events.startsAt)
      .orderBy(desc(events.startsAt));
  },
};
