import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser, users,
  modules, InsertModule,
  lessons, InsertLesson,
  userProgress,
  chatMessages, InsertChatMessage,
  userAnswers, InsertUserAnswer,
  dailyTasks, InsertDailyTask,
  streaks,
  contentHistory, InsertContentHistory,
  coupons, InsertCoupon,
} from "../shared/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      const pool = new Pool({
        connectionString: ENV.databaseUrl,
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────

export async function upsertUser(user: Partial<InsertUser> & { clerkId: string }): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const existing = await db.select().from(users).where(eq(users.clerkId, user.clerkId)).limit(1);

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {};
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.role !== undefined) updateData.role = user.role;
      if (user.bio !== undefined) updateData.bio = user.bio;
      if (user.avatarUrl !== undefined) updateData.avatarUrl = user.avatarUrl;
      updateData.lastSignedIn = user.lastSignedIn ?? new Date();
      updateData.updatedAt = new Date();
      await db.update(users).set(updateData).where(eq(users.clerkId, user.clerkId));
    } else {
      // Check if this user should be admin
      const isAdmin = ENV.adminEmail && user.email && user.email.toLowerCase() === ENV.adminEmail.toLowerCase();
      await db.insert(users).values({
        clerkId: user.clerkId,
        name: user.name ?? null,
        email: user.email ?? null,
        role: isAdmin ? "admin" : (user.role ?? "user"),
        lastSignedIn: user.lastSignedIn ?? new Date(),
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByClerkId(clerkId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; bio?: string; avatarUrl?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
}

// ─── Modules ─────────────────────────────────────────────────────────

export async function listModules(publishedOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const query = publishedOnly
    ? db.select().from(modules).where(eq(modules.status, "published")).orderBy(asc(modules.sortOrder))
    : db.select().from(modules).orderBy(asc(modules.sortOrder));
  return query;
}

export async function getModuleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(modules).where(eq(modules.id, id)).limit(1);
  return result[0];
}

export async function createModule(data: Omit<InsertModule, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(modules).values(data).returning({ id: modules.id });
  return { id: result[0].id };
}

export async function updateModule(id: number, data: Partial<InsertModule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(modules).set({ ...data, updatedAt: new Date() }).where(eq(modules.id, id));
}

export async function deleteModule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(lessons).where(eq(lessons.moduleId, id));
  await db.delete(modules).where(eq(modules.id, id));
}

// ─── Lessons ─────────────────────────────────────────────────────────

export async function listLessons(moduleId: number, publishedOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = publishedOnly
    ? and(eq(lessons.moduleId, moduleId), eq(lessons.status, "published"))
    : eq(lessons.moduleId, moduleId);
  return db.select().from(lessons).where(conditions).orderBy(asc(lessons.sortOrder));
}

export async function getLessonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return result[0];
}

export async function createLesson(data: Omit<InsertLesson, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(lessons).values(data).returning({ id: lessons.id });
  return { id: result[0].id };
}

export async function updateLesson(id: number, data: Partial<InsertLesson>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(lessons).set({ ...data, updatedAt: new Date() }).where(eq(lessons.id, id));
}

export async function deleteLesson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(lessons).where(eq(lessons.id, id));
}

// ─── User Progress ───────────────────────────────────────────────────

export async function getUserProgress(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userProgress).where(eq(userProgress.userId, userId));
}

export async function getUserModuleProgress(userId: number, moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userProgress).where(
    and(eq(userProgress.userId, userId), eq(userProgress.moduleId, moduleId))
  );
}

export async function toggleLessonComplete(userId: number, lessonId: number, moduleId: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(userProgress).where(
    and(eq(userProgress.userId, userId), eq(userProgress.lessonId, lessonId))
  ).limit(1);

  if (existing.length > 0) {
    await db.update(userProgress).set({
      completed,
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(userProgress.id, existing[0].id));
  } else {
    await db.insert(userProgress).values({
      userId,
      lessonId,
      moduleId,
      completed,
      completedAt: completed ? new Date() : null,
    });
  }
}

// ─── User Answers ───────────────────────────────────────────────────

export async function getUserAnswers(userId: number, moduleId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = moduleId
    ? and(eq(userAnswers.userId, userId), eq(userAnswers.moduleId, moduleId))
    : eq(userAnswers.userId, userId);
  return db.select().from(userAnswers).where(conditions);
}

export async function saveUserAnswer(data: Omit<InsertUserAnswer, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(userAnswers).where(
    and(
      eq(userAnswers.userId, data.userId),
      eq(userAnswers.lessonId, data.lessonId),
      eq(userAnswers.questionKey, data.questionKey)
    )
  ).limit(1);

  if (existing.length > 0) {
    await db.update(userAnswers).set({
      answer: data.answer,
      updatedAt: new Date(),
    }).where(eq(userAnswers.id, existing[0].id));
  } else {
    await db.insert(userAnswers).values(data);
  }
}

// ─── Chat Messages ───────────────────────────────────────────────────

export async function getChatHistory(userId: number, lessonId: number | null, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = lessonId
    ? and(eq(chatMessages.userId, userId), eq(chatMessages.lessonId, lessonId))
    : and(eq(chatMessages.userId, userId), sql`${chatMessages.lessonId} IS NULL`);
  return db.select().from(chatMessages).where(conditions).orderBy(asc(chatMessages.createdAt)).limit(limit);
}

export async function saveChatMessage(data: Omit<InsertChatMessage, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
}

export async function clearChatHistory(userId: number, lessonId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = lessonId
    ? and(eq(chatMessages.userId, userId), eq(chatMessages.lessonId, lessonId))
    : and(eq(chatMessages.userId, userId), sql`${chatMessages.lessonId} IS NULL`);
  await db.delete(chatMessages).where(conditions);
}

// ─── Daily Tasks & Streaks ──────────────────────────────────────────

export async function getDailyTasks(userId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dailyTasks).where(
    and(eq(dailyTasks.userId, userId), eq(dailyTasks.date, date))
  );
}

export async function toggleDailyTask(userId: number, date: string, taskKey: string, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(dailyTasks).where(
    and(eq(dailyTasks.userId, userId), eq(dailyTasks.date, date), eq(dailyTasks.taskKey, taskKey))
  ).limit(1);

  if (existing.length > 0) {
    await db.update(dailyTasks).set({ completed }).where(eq(dailyTasks.id, existing[0].id));
  } else {
    await db.insert(dailyTasks).values({ userId, date, taskKey, completed });
  }
}

export async function getUserStreak(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function updateStreak(userId: number, date: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);

  if (existing.length > 0) {
    const streak = existing[0];
    const lastDate = streak.lastCompletedDate;
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newCurrent = 1;
    if (lastDate === yesterdayStr) {
      newCurrent = streak.currentStreak + 1;
    } else if (lastDate === date) {
      newCurrent = streak.currentStreak; // same day, no change
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);

    await db.update(streaks).set({
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastCompletedDate: date,
      updatedAt: new Date(),
    }).where(eq(streaks.userId, userId));
  } else {
    await db.insert(streaks).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastCompletedDate: date,
    });
  }
}

// ─── Content History ────────────────────────────────────────────────

export async function getContentHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentHistory)
    .where(eq(contentHistory.userId, userId))
    .orderBy(sql`${contentHistory.createdAt} DESC`)
    .limit(limit);
}

export async function saveContentHistory(data: Omit<InsertContentHistory, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(contentHistory).values(data);
}

// ─── Coupons ────────────────────────────────────────────────────────

export async function getCouponByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(coupons).where(eq(coupons.code, code.toUpperCase())).limit(1);
  return result[0];
}

export async function listCoupons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(coupons).orderBy(sql`${coupons.createdAt} DESC`);
}

export async function createCoupon(data: Omit<InsertCoupon, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning({ id: coupons.id });
  return { id: result[0].id };
}

export async function updateCoupon(id: number, data: Partial<InsertCoupon>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(coupons).set(data).where(eq(coupons.id, id));
}

export async function incrementCouponUse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(coupons).set({
    currentUses: sql`${coupons.currentUses} + 1`,
  }).where(eq(coupons.id, id));
}
