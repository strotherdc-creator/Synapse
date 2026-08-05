import { boolean, integer, pgEnum, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const statusEnum = pgEnum("status", ["draft", "published"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);

// ─── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: roleEnum("role").default("user").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Modules ────────────────────────────────────────────────────────

export const modules = pgTable("modules", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  status: statusEnum("status").default("draft").notNull(),
  iconEmoji: varchar("icon_emoji", { length: 16 }).default("📘"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Module = typeof modules.$inferSelect;
export type InsertModule = typeof modules.$inferInsert;

// ─── Module Steps ──────────────────────────────────────────────────
// Each module has structured coaching steps that the AI guides the user through

export const moduleSteps = pgTable("module_steps", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull(),
  stepNumber: integer("step_number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"), // Brief description shown to user
  aiPrompt: text("ai_prompt").notNull(), // The AI system prompt for this step
  answerKey: varchar("answer_key", { length: 255 }).notNull(), // Key to store the final answer under
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ModuleStep = typeof moduleSteps.$inferSelect;
export type InsertModuleStep = typeof moduleSteps.$inferInsert;

// ─── User Step Progress ────────────────────────────────────────────
// Tracks which steps a user has completed and their final refined answer

export const userStepProgress = pgTable("user_step_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  moduleId: integer("module_id").notNull(),
  stepId: integer("step_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  finalAnswer: text("final_answer"), // The refined, confirmed answer for this step
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserStepProgress = typeof userStepProgress.$inferSelect;
export type InsertUserStepProgress = typeof userStepProgress.$inferInsert;

// ─── Step Chat Messages ────────────────────────────────────────────
// Chat history for each step's coaching conversation

export const stepChatMessages = pgTable("step_chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  stepId: integer("step_id").notNull(),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StepChatMessage = typeof stepChatMessages.$inferSelect;
export type InsertStepChatMessage = typeof stepChatMessages.$inferInsert;

// ─── Lessons ────────────────────────────────────────────────────────

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  moduleId: integer("module_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  summary: text("summary"),
  sortOrder: integer("sort_order").default(0).notNull(),
  status: statusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

// ─── User Progress ──────────────────────────────────────────────────

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  moduleId: integer("module_id").notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

// ─── User Answers ───────────────────────────────────────────────────

export const userAnswers = pgTable("user_answers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  moduleId: integer("module_id").notNull(),
  questionKey: varchar("question_key", { length: 255 }).notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserAnswer = typeof userAnswers.$inferSelect;
export type InsertUserAnswer = typeof userAnswers.$inferInsert;

// ─── Chat Messages ──────────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id"),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ─── Daily Tasks ────────────────────────────────────────────────────

export const dailyTasks = pgTable("daily_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  taskKey: varchar("task_key", { length: 100 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DailyTask = typeof dailyTasks.$inferSelect;
export type InsertDailyTask = typeof dailyTasks.$inferInsert;

// ─── Streaks ────────────────────────────────────────────────────────

export const streaks = pgTable("streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastCompletedDate: varchar("last_completed_date", { length: 10 }), // YYYY-MM-DD
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Streak = typeof streaks.$inferSelect;
export type InsertStreak = typeof streaks.$inferInsert;

// ─── Content History ────────────────────────────────────────────────

export const contentHistory = pgTable("content_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  prompt: text("prompt").notNull(),
  generatedContent: text("generated_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContentHistoryItem = typeof contentHistory.$inferSelect;
export type InsertContentHistory = typeof contentHistory.$inferInsert;

// ─── Coupons ────────────────────────────────────────────────────────

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountPercent: integer("discount_percent").notNull(), // 100 = free trial
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// ─── WWLD Sessions ─────────────────────────────────────────────────
// What Would Lyle Do? — daily practice stats tracker

export const wwldSessions = pgTable(
  "wwld_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    sessionDate: varchar("session_date", { length: 10 }).notNull(), // YYYY-MM-DD
    sessionType: varchar("session_type", { length: 20 }).notNull(), // 'morning' | 'afternoon' | 'end_of_day'
    officeVisits: integer("office_visits").notNull().default(0),
    newPatients: integer("new_patients").notNull().default(0),
    recall: integer("recall").notNull().default(0),
    testResults: integer("test_results").notNull().default(0),
    progressExams: integer("progress_exams").notNull().default(0),
    performanceReviews: integer("performance_reviews").notNull().default(0),
    carePlansSigned: integer("care_plans_signed").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ([
    unique().on(table.userId, table.sessionDate, table.sessionType),
  ])
);

export type WwldSession = typeof wwldSessions.$inferSelect;
export type InsertWwldSession = typeof wwldSessions.$inferInsert;

// ─── Lyle Content Bank ─────────────────────────────────────────────
// Pre-seeded action lines from the Lyle Algorithm content bank CSV
// 114 rows: 52 weekly themes + 62 daily action lines
export const lyleContent = pgTable("lyle_content", {
  id: serial("id").primaryKey(),
  contentId: varchar("content_id", { length: 10 }).notNull().unique(), // e.g. W01, D01
  cadence: varchar("cadence", { length: 10 }).notNull(),               // 'weekly' | 'daily'
  pillar: varchar("pillar", { length: 100 }).notNull(),
  metricTrigger: varchar("metric_trigger", { length: 100 }).notNull(),
  trendState: varchar("trend_state", { length: 30 }).notNull(),        // breaking|slipping|stuck|plateaued|climbing|momentum
  tone: varchar("tone", { length: 30 }).notNull(),
  actionText: text("action_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LyleContent = typeof lyleContent.$inferSelect;
export type InsertLyleContent = typeof lyleContent.$inferInsert;

// ─── Lyle Served Log ───────────────────────────────────────────────
// Tracks which content items have been served to each user (deduplication)
export const lyleServedLog = pgTable("lyle_served_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentId: varchar("content_id", { length: 10 }).notNull(),
  servedAt: timestamp("served_at").defaultNow().notNull(),
});
export type LyleServedLog = typeof lyleServedLog.$inferSelect;
export type InsertLyleServedLog = typeof lyleServedLog.$inferInsert;
