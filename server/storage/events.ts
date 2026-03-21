import { eq, desc, asc, and, sql, gte, ne, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  events, eventRsvps, users, clubs, eventComments, kudos,
  eventFormQuestions, eventFormResponses, eventTicketTypes, joinRequests,
  type Event, type InsertEvent, type EventRsvp, type InsertEventRsvp,
  type EventComment, type Kudo,
} from "@shared/schema";

export const eventsStorage = {
  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  },

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  },

  async getEventsByClub(clubId: string): Promise<Event[]> {
    return db.select().from(events)
      .where(eq(events.clubId, clubId))
      .orderBy(events.startsAt);
  },

  async updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(data).where(eq(events.id, id)).returning();
    return updated;
  },

  async cancelEvent(id: string): Promise<Event | undefined> {
    const [updated] = await db.update(events)
      .set({ isCancelled: true })
      .where(eq(events.id, id))
      .returning();
    return updated;
  },

  async getUpcomingEvents(city?: string, limit = 10): Promise<(Event & { clubName: string; clubEmoji: string; rsvpCount: number })[]> {
    const now = new Date();
    const baseQuery = db.select({
      id: events.id,
      clubId: events.clubId,
      title: events.title,
      description: events.description,
      locationText: events.locationText,
      locationUrl: events.locationUrl,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      maxCapacity: events.maxCapacity,
      coverImageUrl: events.coverImageUrl,
      isPublic: events.isPublic,
      isCancelled: events.isCancelled,
      recurrenceRule: events.recurrenceRule,
      createdAt: events.createdAt,
      formMandatory: events.formMandatory,
      clubName: clubs.name,
      clubEmoji: clubs.emoji,
      rsvpCount: sql<number>`(select count(*)::int from ${eventRsvps} where ${eventRsvps.eventId} = ${events.id} and ${eventRsvps.status} = 'going')`,
    })
      .from(events)
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .where(
        city && city !== "All Cities"
          ? and(gte(events.startsAt, now), eq(events.isCancelled, false), eq(clubs.city, city))
          : and(gte(events.startsAt, now), eq(events.isCancelled, false))
      )
      .orderBy(events.startsAt)
      .limit(limit);
    return baseQuery as any;
  },

  async extendEventSeries(clubId: string, title: string, recurrenceRule: string): Promise<Event[]> {
    const seriesEvents = await db.select().from(events)
      .where(and(eq(events.clubId, clubId), eq(events.title, title), eq(events.recurrenceRule, recurrenceRule)))
      .orderBy(desc(events.startsAt));
    if (seriesEvents.length === 0) return [];
    const latest = seriesEvents[0];
    const baseStartsAt = new Date(latest.startsAt);
    const created: Event[] = [];
    for (let i = 1; i <= 4; i++) {
      const nextStartsAt = new Date(baseStartsAt);
      if (recurrenceRule === "weekly") nextStartsAt.setDate(nextStartsAt.getDate() + 7 * i);
      else if (recurrenceRule === "biweekly") nextStartsAt.setDate(nextStartsAt.getDate() + 14 * i);
      else if (recurrenceRule === "monthly") nextStartsAt.setMonth(nextStartsAt.getMonth() + i);
      const [newEvent] = await db.insert(events).values({
        clubId,
        title: latest.title,
        description: latest.description,
        locationText: latest.locationText,
        locationUrl: latest.locationUrl,
        startsAt: nextStartsAt,
        maxCapacity: latest.maxCapacity,
        coverImageUrl: latest.coverImageUrl,
        recurrenceRule,
      }).returning();
      created.push(newEvent);
    }
    return created;
  },

  async createRsvp(rsvp: InsertEventRsvp, checkinTokenHash?: string): Promise<EventRsvp> {
    const existing = await eventsStorage.getUserRsvp(rsvp.eventId, rsvp.userId);
    if (existing) {
      const [updated] = await db.update(eventRsvps)
        .set({
          status: "going",
          ...(rsvp.ticketTypeId !== undefined ? { ticketTypeId: rsvp.ticketTypeId, ticketTypeName: rsvp.ticketTypeName } : {}),
          ...(checkinTokenHash ? { checkinToken: checkinTokenHash } : {}),
        })
        .where(eq(eventRsvps.id, existing.id))
        .returning();
      return updated;
    }
    const values = checkinTokenHash ? { ...rsvp, checkinToken: checkinTokenHash } : rsvp;
    const [created] = await db.insert(eventRsvps).values(values as typeof rsvp).returning();
    return created;
  },

  async cancelRsvp(eventId: string, userId: string): Promise<void> {
    await db.update(eventRsvps)
      .set({ status: "cancelled" })
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
  },

  async getRsvpsByEvent(eventId: string): Promise<(EventRsvp & { userName: string | null })[]> {
    const results = await db.select({
      id: eventRsvps.id,
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      checkinToken: eventRsvps.checkinToken,
      checkedIn: eventRsvps.checkedIn,
      checkedInAt: eventRsvps.checkedInAt,
      ticketTypeId: eventRsvps.ticketTypeId,
      ticketTypeName: eventRsvps.ticketTypeName,
      createdAt: eventRsvps.createdAt,
      razorpayOrderId: eventRsvps.razorpayOrderId,
      razorpayPaymentId: eventRsvps.razorpayPaymentId,
      paymentStatus: eventRsvps.paymentStatus,
      userName: users.firstName,
    })
      .from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "going")));
    return results;
  },

  async getUserRsvp(eventId: string, userId: string): Promise<EventRsvp | undefined> {
    const [rsvp] = await db.select().from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
    return rsvp;
  },

  async getRsvpCount(eventId: string): Promise<number> {
    const event = await eventsStorage.getEvent(eventId);
    if (event?.isCancelled) return 0;
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "going")));
    return result?.count ?? 0;
  },

  async getRsvpsByUser(userId: string) {
    return db.select({
      id: eventRsvps.id,
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      checkinToken: eventRsvps.checkinToken,
      checkedIn: eventRsvps.checkedIn,
      checkedInAt: eventRsvps.checkedInAt,
      createdAt: eventRsvps.createdAt,
      ticketTypeId: eventRsvps.ticketTypeId,
      ticketTypeName: eventRsvps.ticketTypeName,
      razorpayOrderId: eventRsvps.razorpayOrderId,
      razorpayPaymentId: eventRsvps.razorpayPaymentId,
      paymentStatus: eventRsvps.paymentStatus,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventLocation: events.locationText,
      clubName: clubs.name,
      clubEmoji: clubs.emoji,
    })
      .from(eventRsvps)
      .innerJoin(events, eq(eventRsvps.eventId, events.id))
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .where(and(eq(eventRsvps.userId, userId), eq(eventRsvps.status, "going")))
      .orderBy(events.startsAt);
  },

  async getCheckedInCount(eventId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.checkedIn, true)));
    return result?.count ?? 0;
  },

  async getEventAttendees(eventId: string): Promise<(EventRsvp & { userName: string | null; checkedIn: boolean | null; checkedInAt: Date | null })[]> {
    return db.select({
      id: eventRsvps.id,
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      checkinToken: eventRsvps.checkinToken,
      checkedIn: eventRsvps.checkedIn,
      checkedInAt: eventRsvps.checkedInAt,
      createdAt: eventRsvps.createdAt,
      ticketTypeId: eventRsvps.ticketTypeId,
      ticketTypeName: eventRsvps.ticketTypeName,
      razorpayOrderId: eventRsvps.razorpayOrderId,
      razorpayPaymentId: eventRsvps.razorpayPaymentId,
      paymentStatus: eventRsvps.paymentStatus,
      userName: users.firstName,
    })
      .from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "going")));
  },

  async getWaitlistCount(eventId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "waitlisted")));
    return result?.count ?? 0;
  },

  async getUserWaitlistPosition(eventId: string, userId: string): Promise<number> {
    const userRsvp = await eventsStorage.getUserRsvp(eventId, userId);
    if (!userRsvp || userRsvp.status !== "waitlisted") return 0;
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.status, "waitlisted"),
        sql`${eventRsvps.createdAt} <= ${userRsvp.createdAt}`
      ));
    return result?.count ?? 1;
  },

  async promoteFirstFromWaitlist(eventId: string): Promise<EventRsvp | undefined> {
    const [first] = await db.select()
      .from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "waitlisted")))
      .orderBy(eventRsvps.createdAt)
      .limit(1);
    if (!first) return undefined;
    const [promoted] = await db.update(eventRsvps)
      .set({ status: "going" })
      .where(eq(eventRsvps.id, first.id))
      .returning();
    return promoted;
  },

  async getRsvpById(rsvpId: string): Promise<EventRsvp | undefined> {
    const [rsvp] = await db.select().from(eventRsvps).where(eq(eventRsvps.id, rsvpId));
    return rsvp;
  },

  async getRsvpByToken(token: string): Promise<(EventRsvp & { userName: string | null }) | undefined> {
    const [result] = await db.select({
      id: eventRsvps.id,
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      checkinToken: eventRsvps.checkinToken,
      checkedIn: eventRsvps.checkedIn,
      checkedInAt: eventRsvps.checkedInAt,
      createdAt: eventRsvps.createdAt,
      ticketTypeId: eventRsvps.ticketTypeId,
      ticketTypeName: eventRsvps.ticketTypeName,
      razorpayOrderId: eventRsvps.razorpayOrderId,
      razorpayPaymentId: eventRsvps.razorpayPaymentId,
      paymentStatus: eventRsvps.paymentStatus,
      userName: users.firstName,
    })
      .from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .where(and(eq(eventRsvps.checkinToken, token), eq(eventRsvps.status, "going")));
    return result;
  },

  async checkInRsvpByToken(token: string): Promise<EventRsvp | undefined> {
    const [updated] = await db.update(eventRsvps)
      .set({ checkedIn: true, checkedInAt: new Date() })
      .where(and(eq(eventRsvps.checkinToken, token), eq(eventRsvps.status, "going"), eq(eventRsvps.checkedIn, false)))
      .returning();
    return updated;
  },

  async checkInRsvpById(rsvpId: string): Promise<EventRsvp | undefined> {
    const [updated] = await db.update(eventRsvps)
      .set({ checkedIn: true, checkedInAt: new Date() })
      .where(and(eq(eventRsvps.id, rsvpId), eq(eventRsvps.status, "going"), eq(eventRsvps.checkedIn, false)))
      .returning();
    return updated;
  },

  async getAllRsvpsWithTokens(): Promise<{ id: string; checkinToken: string | null }[]> {
    return db.select({ id: eventRsvps.id, checkinToken: eventRsvps.checkinToken }).from(eventRsvps);
  },

  async updateRsvpCheckinToken(rsvpId: string, hashedToken: string): Promise<void> {
    await db.update(eventRsvps).set({ checkinToken: hashedToken }).where(eq(eventRsvps.id, rsvpId));
  },

  async cancelFutureRsvpsForClub(clubId: string): Promise<{ userId: string | null; eventTitle: string; eventId: string }[]> {
    const now = new Date();
    const futureEvents = await db.select({ id: events.id, title: events.title })
      .from(events)
      .where(and(eq(events.clubId, clubId), gte(events.startsAt, now)));
    if (futureEvents.length === 0) return [];
    const futureEventIds = futureEvents.map(e => e.id);
    const eventTitleMap = new Map(futureEvents.map(e => [e.id, e.title]));
    const cancelled = await db.update(eventRsvps)
      .set({ status: "cancelled" })
      .where(and(inArray(eventRsvps.eventId, futureEventIds), eq(eventRsvps.status, "going")))
      .returning({ userId: eventRsvps.userId, eventId: eventRsvps.eventId });
    return cancelled.map(r => ({
      userId: r.userId,
      eventId: r.eventId,
      eventTitle: eventTitleMap.get(r.eventId) ?? "an upcoming event",
    }));
  },

  async getUserAttendanceStats(userId: string): Promise<{ clubId: string; clubName: string; clubEmoji: string; totalRsvps: number; attended: number }[]> {
    return db.select({
      clubId: clubs.id,
      clubName: clubs.name,
      clubEmoji: clubs.emoji,
      totalRsvps: sql<number>`count(*)::int`,
      attended: sql<number>`sum(case when ${eventRsvps.checkedIn} = true then 1 else 0 end)::int`,
    })
      .from(eventRsvps)
      .innerJoin(events, eq(eventRsvps.eventId, events.id))
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .where(and(eq(eventRsvps.userId, userId), eq(eventRsvps.status, "going")))
      .groupBy(clubs.id, clubs.name, clubs.emoji);
  },

  async getEventComments(eventId: string): Promise<EventComment[]> {
    return db.select().from(eventComments).where(eq(eventComments.eventId, eventId)).orderBy(eventComments.createdAt);
  },

  async createEventComment(eventId: string, userId: string, userName: string, userImageUrl: string | null, text: string): Promise<EventComment> {
    const [created] = await db.insert(eventComments).values({ eventId, userId, userName, userImageUrl, text }).returning();
    return created;
  },

  async createKudo(data: { eventId: string; giverId: string; receiverId: string; kudoType: string }): Promise<Kudo> {
    const [kudo] = await db.insert(kudos).values(data).returning();
    return kudo;
  },

  async hasGivenKudo(eventId: string, giverId: string): Promise<boolean> {
    const [row] = await db.select({ id: kudos.id }).from(kudos)
      .where(and(eq(kudos.eventId, eventId), eq(kudos.giverId, giverId)));
    return !!row;
  },

  async getKudosByReceiver(userId: string): Promise<(Kudo & { eventTitle: string; eventStartsAt: Date })[]> {
    const rows = await db.select({
      id: kudos.id, eventId: kudos.eventId, giverId: kudos.giverId,
      receiverId: kudos.receiverId, kudoType: kudos.kudoType, createdAt: kudos.createdAt,
      eventTitle: events.title, eventStartsAt: events.startsAt,
    }).from(kudos)
      .innerJoin(events, eq(kudos.eventId, events.id))
      .where(eq(kudos.receiverId, userId))
      .orderBy(desc(kudos.createdAt));
    return rows as any;
  },

  async getEventAttendeesForKudo(eventId: string, excludeUserId: string): Promise<{ userId: string; userName: string | null }[]> {
    const rows = await db.select({
      userId: eventRsvps.userId,
      userName: users.firstName,
    }).from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .where(and(
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.checkedIn, true),
        ne(eventRsvps.userId, excludeUserId),
      ));
    return rows.map(r => ({ userId: r.userId, userName: r.userName }));
  },

  async getEventAttendanceReport(eventId: string, clubId: string): Promise<{ userId: string; userName: string | null; status: string; checkedIn: boolean | null; checkedInAt: Date | null; phone: string | null }[]> {
    return db.select({
      userId: eventRsvps.userId,
      userName: users.firstName,
      status: eventRsvps.status,
      checkedIn: eventRsvps.checkedIn,
      checkedInAt: eventRsvps.checkedInAt,
      phone: joinRequests.phone,
    })
      .from(eventRsvps)
      .leftJoin(users, eq(eventRsvps.userId, users.id))
      .leftJoin(joinRequests, and(
        eq(eventRsvps.userId, joinRequests.userId),
        eq(joinRequests.clubId, clubId),
        eq(joinRequests.status, "approved"),
      ))
      .where(eq(eventRsvps.eventId, eventId))
      .orderBy(asc(eventRsvps.status), asc(users.firstName));
  },

  async getEventFormQuestions(eventId: string) {
    return db.select().from(eventFormQuestions)
      .where(eq(eventFormQuestions.eventId, eventId))
      .orderBy(asc(eventFormQuestions.sortOrder), asc(eventFormQuestions.createdAt));
  },

  async addEventFormQuestion(eventId: string, question: string, sortOrder: number) {
    const [created] = await db.insert(eventFormQuestions).values({ eventId, question, sortOrder }).returning();
    return created;
  },

  async deleteEventFormQuestion(id: string): Promise<void> {
    await db.delete(eventFormQuestions).where(eq(eventFormQuestions.id, id));
  },

  async setEventFormMandatory(eventId: string, mandatory: boolean) {
    const [updated] = await db.update(events).set({ formMandatory: mandatory }).where(eq(events.id, eventId)).returning();
    return updated;
  },

  async saveEventFormResponses(eventId: string, userId: string, responses: { questionId: string; answer: string }[]): Promise<void> {
    if (responses.length === 0) return;
    await db.delete(eventFormResponses).where(
      and(eq(eventFormResponses.eventId, eventId), eq(eventFormResponses.userId, userId))
    );
    await db.insert(eventFormResponses).values(
      responses.map(r => ({ eventId, userId, questionId: r.questionId, answer: r.answer }))
    );
  },

  async getEventFormResponses(eventId: string): Promise<{ userId: string; userName: string | null; answers: { question: string; answer: string }[] }[]> {
    const rows = await db.select({
      userId: eventFormResponses.userId,
      userName: users.firstName,
      question: eventFormQuestions.question,
      answer: eventFormResponses.answer,
    })
      .from(eventFormResponses)
      .innerJoin(eventFormQuestions, eq(eventFormResponses.questionId, eventFormQuestions.id))
      .leftJoin(users, eq(eventFormResponses.userId, users.id))
      .where(eq(eventFormResponses.eventId, eventId))
      .orderBy(asc(eventFormResponses.userId), asc(eventFormQuestions.sortOrder));

    const grouped = new Map<string, { userId: string; userName: string | null; answers: { question: string; answer: string }[] }>();
    for (const row of rows) {
      if (!grouped.has(row.userId)) {
        grouped.set(row.userId, { userId: row.userId, userName: row.userName, answers: [] });
      }
      grouped.get(row.userId)!.answers.push({ question: row.question, answer: row.answer });
    }
    return Array.from(grouped.values());
  },

  async hasUserSubmittedFormResponses(eventId: string, userId: string): Promise<boolean> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(eventFormResponses)
      .where(and(eq(eventFormResponses.eventId, eventId), eq(eventFormResponses.userId, userId)));
    return (result?.count ?? 0) > 0;
  },

  async getEventTicketTypes(eventId: string) {
    return db.select().from(eventTicketTypes).where(eq(eventTicketTypes.eventId, eventId)).orderBy(asc(eventTicketTypes.sortOrder));
  },

  async createEventTicketType(eventId: string, data: { name: string; price: number; description?: string; sortOrder?: number }) {
    const [created] = await db.insert(eventTicketTypes).values({ eventId, ...data }).returning();
    return created;
  },

  async updateEventTicketType(id: number, data: { name?: string; price?: number; description?: string | null; sortOrder?: number; isActive?: boolean }) {
    const [updated] = await db.update(eventTicketTypes).set(data).where(eq(eventTicketTypes.id, id)).returning();
    return updated;
  },

  async deleteEventTicketType(id: number): Promise<void> {
    await db.delete(eventTicketTypes).where(eq(eventTicketTypes.id, id));
  },

  async getAllEventsAdmin() {
    return db.select({
      id: events.id,
      title: events.title,
      clubId: events.clubId,
      clubName: clubs.name,
      clubEmoji: clubs.emoji,
      startsAt: events.startsAt,
      isCancelled: events.isCancelled,
      maxCapacity: events.maxCapacity,
      rsvpCount: sql<number>`(select count(*)::int from ${eventRsvps} where ${eventRsvps.eventId} = ${events.id})`,
      checkedInCount: sql<number>`(select count(*)::int from ${eventRsvps} where ${eventRsvps.eventId} = ${events.id} and ${eventRsvps.checkedIn} = true)`,
    })
      .from(events)
      .innerJoin(clubs, eq(events.clubId, clubs.id))
      .orderBy(desc(events.startsAt));
  },
};
