import { users, type User } from "@shared/models/auth";
import { db } from "../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getOrCreateUser(data: { id: string; email: string; name: string }): Promise<User>;
  upsertUser(user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getOrCreateUser(data: { id: string; email: string; name: string }): Promise<User> {
    const existing = await this.getUser(data.id);
    if (existing) return existing;

    const nameParts = data.name.trim().split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || null;

    return this.upsertUser({
      id: data.id,
      email: data.email,
      firstName,
      lastName,
      profileImageUrl: null,
    });
  }

  async upsertUser(user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    const [upserted] = await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }
}

export const authStorage = new AuthStorage();
