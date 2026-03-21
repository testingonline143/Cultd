import { eq, desc, and, sql, gte } from "drizzle-orm";
import { db } from "../db";
import {
  users, userQuizAnswers, notifications,
  type User, type InsertQuizAnswers, type QuizAnswers,
  type Notification, type InsertNotification,
} from "@shared/schema";

export const usersStorage = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  },

  async saveQuizAnswers(answers: InsertQuizAnswers): Promise<QuizAnswers> {
    const existing = await usersStorage.getQuizAnswers(answers.userId);
    if (existing) {
      const [updated] = await db.update(userQuizAnswers)
        .set(answers)
        .where(eq(userQuizAnswers.userId, answers.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userQuizAnswers).values(answers).returning();
    return created;
  },

  async getQuizAnswers(userId: string): Promise<QuizAnswers | undefined> {
    const [answers] = await db.select().from(userQuizAnswers).where(eq(userQuizAnswers.userId, userId));
    return answers;
  },

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  },

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  },

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  },

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  },

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.count ?? 0;
  },

  async getAllUsers() {
    const results = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      city: users.city,
      role: users.role,
      createdAt: users.createdAt,
      clubCount: sql<number>`(select count(*)::int from join_requests where join_requests.user_id = ${users.id} and join_requests.status = 'approved')`,
    }).from(users).orderBy(desc(users.createdAt));
    return results;
  },

  async broadcastNotification(title: string, message: string, linkUrl?: string): Promise<number> {
    const allUsers = await db.select({ id: users.id }).from(users);
    await Promise.all(allUsers.map(u =>
      db.insert(notifications).values({
        userId: u.id,
        type: "broadcast",
        title,
        message,
        linkUrl: linkUrl || null,
        isRead: false,
      })
    ));
    return allUsers.length;
  },
};
