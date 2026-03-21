import { eq, desc, asc, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  platformTransactions, events, clubs, eventRsvps, eventTicketTypes, users,
  type PlatformTransaction, type InsertPlatformTransaction,
} from "@shared/schema";

export const paymentsStorage = {
  async createPlatformTransaction(data: InsertPlatformTransaction): Promise<PlatformTransaction> {
    const [created] = await db.insert(platformTransactions).values(data).returning();
    return created;
  },

  async updatePlatformTransaction(id: string, data: Partial<Pick<PlatformTransaction, "status" | "razorpayTransferId">>): Promise<PlatformTransaction | undefined> {
    const [updated] = await db.update(platformTransactions).set(data).where(eq(platformTransactions.id, id)).returning();
    return updated;
  },

  async getPlatformTransactions(params: { clubId?: string; userId?: string; status?: string; page?: number; limit?: number }): Promise<{ transactions: (PlatformTransaction & { eventTitle: string; clubName: string; userName: string | null })[]; total: number }> {
    const conditions = [];
    if (params.clubId) conditions.push(eq(platformTransactions.clubId, params.clubId));
    if (params.userId) conditions.push(eq(platformTransactions.userId, params.userId));
    if (params.status) conditions.push(eq(platformTransactions.status, params.status));

    const limit = params.limit ?? 20;
    const offset = ((params.page ?? 1) - 1) * limit;

    const txs = await db.select({
      id: platformTransactions.id,
      eventId: platformTransactions.eventId,
      rsvpId: platformTransactions.rsvpId,
      clubId: platformTransactions.clubId,
      userId: platformTransactions.userId,
      razorpayOrderId: platformTransactions.razorpayOrderId,
      razorpayPaymentId: platformTransactions.razorpayPaymentId,
      razorpayTransferId: platformTransactions.razorpayTransferId,
      totalAmount: platformTransactions.totalAmount,
      baseAmount: platformTransactions.baseAmount,
      platformFee: platformTransactions.platformFee,
      currency: platformTransactions.currency,
      status: platformTransactions.status,
      createdAt: platformTransactions.createdAt,
      eventTitle: events.title,
      clubName: clubs.name,
      userName: users.firstName,
    })
      .from(platformTransactions)
      .leftJoin(events, eq(platformTransactions.eventId, events.id))
      .leftJoin(clubs, eq(platformTransactions.clubId, clubs.id))
      .leftJoin(users, eq(platformTransactions.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(platformTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(platformTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      transactions: txs.map(r => ({
        ...r,
        eventTitle: r.eventTitle ?? "Unknown Event",
        clubName: r.clubName ?? "Unknown Club",
        userName: r.userName ?? null,
      })),
      total: countRow?.count ?? 0,
    };
  },

  async getPlatformTransactionByRsvpId(rsvpId: string): Promise<PlatformTransaction | undefined> {
    const [tx] = await db.select().from(platformTransactions).where(eq(platformTransactions.rsvpId, rsvpId));
    return tx;
  },

  async getPlatformTransactionById(id: string): Promise<PlatformTransaction | undefined> {
    const [tx] = await db.select().from(platformTransactions).where(eq(platformTransactions.id, id));
    return tx;
  },

  async getPlatformTransactionByPaymentId(razorpayPaymentId: string): Promise<PlatformTransaction | undefined> {
    const [tx] = await db.select().from(platformTransactions).where(eq(platformTransactions.razorpayPaymentId, razorpayPaymentId));
    return tx;
  },

  async getClubEarnings(clubId: string): Promise<{ totalTransferred: number; totalPending: number; totalFailed: number; recentTransactions: (PlatformTransaction & { eventTitle: string })[] }> {
    const [stats] = await db.select({
      totalTransferred: sql<number>`coalesce(sum(case when ${platformTransactions.status} = 'transferred' then ${platformTransactions.baseAmount} else 0 end), 0)::int`,
      totalPending: sql<number>`coalesce(sum(case when ${platformTransactions.status} = 'pending' then ${platformTransactions.baseAmount} else 0 end), 0)::int`,
      totalFailed: sql<number>`coalesce(sum(case when ${platformTransactions.status} = 'failed' then ${platformTransactions.baseAmount} else 0 end), 0)::int`,
    }).from(platformTransactions).where(eq(platformTransactions.clubId, clubId));

    const recent = await db.select({
      id: platformTransactions.id,
      eventId: platformTransactions.eventId,
      rsvpId: platformTransactions.rsvpId,
      clubId: platformTransactions.clubId,
      userId: platformTransactions.userId,
      razorpayOrderId: platformTransactions.razorpayOrderId,
      razorpayPaymentId: platformTransactions.razorpayPaymentId,
      razorpayTransferId: platformTransactions.razorpayTransferId,
      totalAmount: platformTransactions.totalAmount,
      baseAmount: platformTransactions.baseAmount,
      platformFee: platformTransactions.platformFee,
      currency: platformTransactions.currency,
      status: platformTransactions.status,
      createdAt: platformTransactions.createdAt,
      eventTitle: events.title,
    })
      .from(platformTransactions)
      .leftJoin(events, eq(platformTransactions.eventId, events.id))
      .where(eq(platformTransactions.clubId, clubId))
      .orderBy(desc(platformTransactions.createdAt))
      .limit(10);

    return {
      totalTransferred: stats?.totalTransferred ?? 0,
      totalPending: stats?.totalPending ?? 0,
      totalFailed: stats?.totalFailed ?? 0,
      recentTransactions: recent.map(r => ({ ...r, eventTitle: r.eventTitle ?? "Unknown Event" })),
    };
  },

  async getAllClubEarnings(clubId: string, params: { status?: string; page?: number; limit?: number }): Promise<{ transactions: (PlatformTransaction & { eventTitle: string; ticketTypeName: string | null })[]; total: number }> {
    const conditions = [eq(platformTransactions.clubId, clubId)];
    if (params.status) conditions.push(eq(platformTransactions.status, params.status));

    const limit = params.limit ?? 20;
    const offset = ((params.page ?? 1) - 1) * limit;

    const txs = await db.select({
      id: platformTransactions.id,
      eventId: platformTransactions.eventId,
      rsvpId: platformTransactions.rsvpId,
      clubId: platformTransactions.clubId,
      userId: platformTransactions.userId,
      razorpayOrderId: platformTransactions.razorpayOrderId,
      razorpayPaymentId: platformTransactions.razorpayPaymentId,
      razorpayTransferId: platformTransactions.razorpayTransferId,
      totalAmount: platformTransactions.totalAmount,
      baseAmount: platformTransactions.baseAmount,
      platformFee: platformTransactions.platformFee,
      currency: platformTransactions.currency,
      status: platformTransactions.status,
      createdAt: platformTransactions.createdAt,
      eventTitle: events.title,
      ticketTypeName: eventTicketTypes.name,
    })
      .from(platformTransactions)
      .leftJoin(events, eq(platformTransactions.eventId, events.id))
      .leftJoin(eventRsvps, eq(platformTransactions.rsvpId, eventRsvps.id))
      .leftJoin(eventTicketTypes, eq(eventRsvps.ticketTypeId, eventTicketTypes.id))
      .where(and(...conditions))
      .orderBy(desc(platformTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(platformTransactions)
      .where(and(...conditions));

    return {
      transactions: txs.map(r => ({ ...r, eventTitle: r.eventTitle ?? "Unknown Event", ticketTypeName: r.ticketTypeName ?? null })),
      total: countRow?.count ?? 0,
    };
  },

  async getAdminPaymentStats() {
    const [statsRow] = await db.select({
      platformRevenue: sql<number>`coalesce(sum(case when ${platformTransactions.status} = 'transferred' then ${platformTransactions.platformFee} else 0 end), 0)::int`,
      totalVolume: sql<number>`coalesce(sum(${platformTransactions.totalAmount}), 0)::int`,
      pendingCount: sql<number>`count(case when ${platformTransactions.status} = 'pending' then 1 end)::int`,
      failedCount: sql<number>`count(case when ${platformTransactions.status} = 'failed' then 1 end)::int`,
    }).from(platformTransactions);

    const topClubs = await db.select({
      clubId: platformTransactions.clubId,
      clubName: clubs.name,
      city: clubs.city,
      totalVolume: sql<number>`coalesce(sum(${platformTransactions.totalAmount}), 0)::int`,
      organizerReceived: sql<number>`coalesce(sum(${platformTransactions.baseAmount}), 0)::int`,
      platformEarned: sql<number>`coalesce(sum(${platformTransactions.platformFee}), 0)::int`,
    })
      .from(platformTransactions)
      .leftJoin(clubs, eq(platformTransactions.clubId, clubs.id))
      .groupBy(platformTransactions.clubId, clubs.name, clubs.city)
      .orderBy(desc(sql`sum(${platformTransactions.totalAmount})`))
      .limit(10);

    const commissionRates = await db.select({
      clubId: clubs.id,
      clubName: clubs.name,
      city: clubs.city,
      commissionType: clubs.commissionType,
      commissionValue: clubs.commissionValue,
      totalTickets: sql<number>`coalesce(count(${platformTransactions.id}), 0)::int`,
      totalEarned: sql<number>`coalesce(sum(${platformTransactions.platformFee}), 0)::int`,
    })
      .from(clubs)
      .leftJoin(platformTransactions, eq(platformTransactions.clubId, clubs.id))
      .groupBy(clubs.id, clubs.name, clubs.city, clubs.commissionType, clubs.commissionValue)
      .orderBy(asc(clubs.name));

    return {
      platformRevenue: statsRow?.platformRevenue ?? 0,
      totalVolume: statsRow?.totalVolume ?? 0,
      pendingCount: statsRow?.pendingCount ?? 0,
      failedCount: statsRow?.failedCount ?? 0,
      topClubs: topClubs.map(r => ({ clubId: r.clubId, clubName: r.clubName ?? "Unknown", city: r.city ?? "", totalVolume: r.totalVolume, organizerReceived: r.organizerReceived, platformEarned: r.platformEarned })),
      commissionRates: commissionRates.map(r => ({ clubId: r.clubId, clubName: r.clubName, city: r.city, commissionType: r.commissionType, commissionValue: r.commissionValue, totalTickets: r.totalTickets, totalEarned: r.totalEarned })),
    };
  },

  async getUserPaymentHistory(userId: string): Promise<(PlatformTransaction & { eventTitle: string; clubName: string; ticketTypeName: string | null })[]> {
    const results = await db.select({
      id: platformTransactions.id,
      eventId: platformTransactions.eventId,
      rsvpId: platformTransactions.rsvpId,
      clubId: platformTransactions.clubId,
      userId: platformTransactions.userId,
      razorpayOrderId: platformTransactions.razorpayOrderId,
      razorpayPaymentId: platformTransactions.razorpayPaymentId,
      razorpayTransferId: platformTransactions.razorpayTransferId,
      totalAmount: platformTransactions.totalAmount,
      baseAmount: platformTransactions.baseAmount,
      platformFee: platformTransactions.platformFee,
      currency: platformTransactions.currency,
      status: platformTransactions.status,
      createdAt: platformTransactions.createdAt,
      eventTitle: events.title,
      clubName: clubs.name,
      ticketTypeName: eventTicketTypes.name,
    })
      .from(platformTransactions)
      .leftJoin(events, eq(platformTransactions.eventId, events.id))
      .leftJoin(clubs, eq(platformTransactions.clubId, clubs.id))
      .leftJoin(eventRsvps, eq(platformTransactions.rsvpId, eventRsvps.id))
      .leftJoin(eventTicketTypes, eq(eventRsvps.ticketTypeId, eventTicketTypes.id))
      .where(eq(platformTransactions.userId, userId))
      .orderBy(desc(platformTransactions.createdAt));

    return results.map(r => ({ ...r, eventTitle: r.eventTitle ?? "Unknown Event", clubName: r.clubName ?? "Unknown Club", ticketTypeName: r.ticketTypeName ?? null }));
  },
};
