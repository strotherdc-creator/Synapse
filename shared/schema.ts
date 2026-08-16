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
  practiceName: text("practice_name"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  phone: varchar("phone", { length: 30 }),
  website: text("website"),
  facebookUrl: text("facebook_url"),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  tiktokHandle: varchar("tiktok_handle", { length: 100 }),
  profileComplete: boolean("profile_complete").default(false).notNull(),
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

// ─── Engagement: Daily Growth Plans ───────────────────────────────
// One plan per user per day — the "Today's Growth Plan"

export const dailyGrowthPlans = pgTable(
  "daily_growth_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    planDate: varchar("plan_date", { length: 10 }).notNull(), // YYYY-MM-DD
    focus: varchar("focus", { length: 100 }).notNull(), // e.g. "New Patients & Referrals"
    state: varchar("state", { length: 20 }).notNull().default("active"), // active | completed | skipped
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ([
    unique().on(table.userId, table.planDate),
  ])
);
export type DailyGrowthPlan = typeof dailyGrowthPlans.$inferSelect;
export type InsertDailyGrowthPlan = typeof dailyGrowthPlans.$inferInsert;

// ─── Engagement: Growth Actions ──────────────────────────────────
// Individual recommended or user-selected real-world actions

export const growthActions = pgTable("growth_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planId: integer("plan_id"), // nullable — can exist without a plan
  source: varchar("source", { length: 50 }).notNull(), // lyle | coaching | content | routine | campaign | manual
  sourceRef: varchar("source_ref", { length: 100 }), // e.g. lyle content ID, step ID, etc.
  title: varchar("title", { length: 500 }).notNull(),
  whyNow: text("why_now"), // brief explanation of relevance
  script: text("script"), // ready-to-use script/copy if applicable
  estimateMinutes: integer("estimate_minutes").default(5),
  pillar: varchar("pillar", { length: 100 }), // growth pillar category
  sortOrder: integer("sort_order").default(0).notNull(),
  required: boolean("required").default(false).notNull(), // max 1 required per plan
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | completed | deferred | skipped
  actionDate: varchar("action_date", { length: 10 }).notNull(), // YYYY-MM-DD
  completedAt: timestamp("completed_at"),
  deferredTo: varchar("deferred_to", { length: 10 }), // YYYY-MM-DD if deferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type GrowthAction = typeof growthActions.$inferSelect;
export type InsertGrowthAction = typeof growthActions.$inferInsert;

// ─── Engagement: Action Outcomes ─────────────────────────────────
// Optional proof/result following action completion (30-second capture)

export const growthActionOutcomes = pgTable("growth_action_outcomes", {
  id: serial("id").primaryKey(),
  actionId: integer("action_id").notNull(),
  userId: integer("user_id").notNull(),
  outcomeType: varchar("outcome_type", { length: 50 }).notNull(), // spoke | posted | sent | scheduled | other
  confidence: integer("confidence"), // 1-5 self-rating
  note: text("note"), // brief free-text (no patient info)
  completionSeconds: integer("completion_seconds"), // how long the real-world action took
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GrowthActionOutcome = typeof growthActionOutcomes.$inferSelect;
export type InsertGrowthActionOutcome = typeof growthActionOutcomes.$inferInsert;

// ─── Engagement: User Preferences ────────────────────────────────
// Work anchors, delivery channels, and quiet-day settings

export const userEngagementPreferences = pgTable("user_engagement_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  timezone: varchar("timezone", { length: 50 }).default("America/Chicago"),
  morningAnchor: varchar("morning_anchor", { length: 5 }).default("07:30"), // HH:MM
  endOfDayAnchor: varchar("end_of_day_anchor", { length: 5 }).default("17:00"),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  emailAddress: varchar("email_address", { length: 320 }),
  quietDays: varchar("quiet_days", { length: 50 }).default(""), // comma-separated: "sat,sun"
  selectedTopicId: varchar("selected_topic_id", { length: 50 }), // quick-start topic ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type UserEngagementPreference = typeof userEngagementPreferences.$inferSelect;
export type InsertUserEngagementPreference = typeof userEngagementPreferences.$inferInsert;

// ─── Engagement: Events ──────────────────────────────────────────
// Append-only product telemetry for engagement analytics

export const engagementEvents = pgTable("engagement_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventName: varchar("event_name", { length: 100 }).notNull(), // plan_viewed | action_completed | action_deferred | review_opened | email_sent
  entityType: varchar("entity_type", { length: 50 }), // plan | action | outcome | review
  entityId: integer("entity_id"),
  metadata: text("metadata"), // JSON string for flexible context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EngagementEvent = typeof engagementEvents.$inferSelect;
export type InsertEngagementEvent = typeof engagementEvents.$inferInsert;
