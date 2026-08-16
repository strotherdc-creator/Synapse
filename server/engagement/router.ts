import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { isEngagementEnabled } from "./flags";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getTopicById, getTopicLabels } from "./quick-start-topics";
import {
  dailyGrowthPlans,
  growthActions,
  growthActionOutcomes,
  userEngagementPreferences,
  engagementEvents,
  lyleContent,
  lyleServedLog,
  wwldSessions,
} from "../../shared/schema";
import { eq, and, desc, asc, sql, isNull } from "drizzle-orm";

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function guardFeature(feature: Parameters<typeof isEngagementEnabled>[0], clerkId?: string) {
  if (!isEngagementEnabled(feature, clerkId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Feature not enabled" });
  }
}

// ─── Daily Plan Engine ──────────────────────────────────────────────

interface PlanAction {
  source: string;
  sourceRef: string | null;
  title: string;
  whyNow: string | null;
  script: string | null;
  estimateMinutes: number;
  pillar: string | null;
  required: boolean;
}

/**
 * Deterministic daily plan selection.
 * Priority:
 *   1. Lyle daily action (if available and not already completed today)
 *   2. Coaching asset activation (newest unactivated saved answer)
 *   3. Content Studio activation (newest unused generated content)
 *   4. Daily Routine task (first incomplete)
 * Max: 1 required + 2 optional = 3 actions
 */
async function buildDailyActions(userId: number, date: string): Promise<PlanAction[]> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  const actions: PlanAction[] = [];

  // Get user's selected topic for fallback content
  const [userPrefs] = await dbInstance
    .select()
    .from(userEngagementPreferences)
    .where(eq(userEngagementPreferences.userId, userId))
    .limit(1);
  const selectedTopicId = userPrefs?.selectedTopicId ?? null;
  const topic = selectedTopicId ? getTopicById(selectedTopicId) : null;

  // ── 1. Lyle daily action ──────────────────────────────────────────
  // Check if there's a Lyle recommendation for today that hasn't been acted on
  const servedToday = await dbInstance
    .select()
    .from(lyleServedLog)
    .where(and(
      eq(lyleServedLog.userId, userId),
      sql`${lyleServedLog.servedAt}::date = ${date}::date`
    ))
    .limit(1);

  if (servedToday.length > 0) {
    const contentRow = await dbInstance
      .select()
      .from(lyleContent)
      .where(eq(lyleContent.contentId, servedToday[0].contentId))
      .limit(1);

    if (contentRow.length > 0) {
      actions.push({
        source: "lyle",
        sourceRef: contentRow[0].contentId,
        title: contentRow[0].actionText,
        whyNow: `Your ${contentRow[0].metricTrigger.replace(/_/g, " ")} trend is "${contentRow[0].trendState}" — this action targets your ${contentRow[0].pillar} pillar.`,
        script: null,
        estimateMinutes: 5,
        pillar: contentRow[0].pillar,
        required: true,
      });
    }
  }

  // ── 2. Coaching asset activation ──────────────────────────────────
  // Find the most recent coaching answer that hasn't been turned into an action yet
  const recentAnswers = await dbInstance
    .select()
    .from(db.getUserAnswersTable())
    .where(eq(db.getUserAnswersTable().userId, userId))
    .orderBy(desc(db.getUserAnswersTable().updatedAt))
    .limit(5);

  // Only use coaching answers if they have meaningful content (not fragments)
  const usableAnswers = recentAnswers.filter(a => a.answer && a.answer.length > 20);

  if (usableAnswers.length > 0 && actions.length < 3) {
    // Check if any of these answers have already been activated today
    const existingActions = await dbInstance
      .select()
      .from(growthActions)
      .where(and(
        eq(growthActions.userId, userId),
        eq(growthActions.actionDate, date),
        eq(growthActions.source, "coaching")
      ));

    const activatedRefs = new Set(existingActions.map(a => a.sourceRef));
    const unactivated = usableAnswers.find(a => !activatedRefs.has(`answer-${a.id}`));

    if (unactivated) {
      const answerPreview = unactivated.answer.length > 80
        ? unactivated.answer.slice(0, 80) + "..."
        : unactivated.answer;
      actions.push({
        source: "coaching",
        sourceRef: `answer-${unactivated.id}`,
        title: `Use your answer today: "${answerPreview}"`,
        whyNow: "You refined this in coaching — try using it in a real conversation today.",
        script: unactivated.answer,
        estimateMinutes: 3,
        pillar: "Communication & Listening",
        required: false,
      });
    }
  } else if (topic && actions.length < 3) {
    // No usable coaching answers — use the quick-start topic instead
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const liner = topic.tableTalkOneLiners[dayOfYear % topic.tableTalkOneLiners.length];
    actions.push({
      source: "coaching",
      sourceRef: `topic-${topic.id}-liner-${dayOfYear % topic.tableTalkOneLiners.length}`,
      title: `Say this today: "${liner}"`,
      whyNow: `This is how patients describe you when you're positioned for ${topic.shortLabel}. Use it at the table or in conversation.`,
      script: `One-liner to use:\n"${liner}"\n\nReferral trigger:\n"${topic.referralTriggerLine}"\n\nWant a fully customized version? Complete your coaching modules.`,
      estimateMinutes: 2,
      pillar: "Communication & Listening",
      required: false,
    });
  }

  // ── 3. Content Studio activation ──────────────────────────────────
  // Find the most recent generated content not yet activated
  const recentContent = await dbInstance
    .select()
    .from(db.getContentHistoryTable())
    .where(eq(db.getContentHistoryTable().userId, userId))
    .orderBy(desc(db.getContentHistoryTable().createdAt))
    .limit(3);

  if (recentContent.length > 0 && actions.length < 3) {
    const existingContentActions = await dbInstance
      .select()
      .from(growthActions)
      .where(and(
        eq(growthActions.userId, userId),
        eq(growthActions.actionDate, date),
        eq(growthActions.source, "content")
      ));

    const activatedContentRefs = new Set(existingContentActions.map(a => a.sourceRef));
    const unactivatedContent = recentContent.find(c => !activatedContentRefs.has(`content-${c.id}`));

    if (unactivatedContent) {
      const typeLabel = unactivatedContent.contentType.replace(/_/g, " ");
      actions.push({
        source: "content",
        sourceRef: `content-${unactivatedContent.id}`,
        title: `Copy & post your ${typeLabel}`,
        whyNow: "You created this content — copy it, post it, and build your visibility today.",
        script: unactivatedContent.generatedContent.slice(0, 500),
        estimateMinutes: 2,
        pillar: "Referral & Visibility",
        required: false,
      });
    }
  } else if (topic && actions.length < 3) {
    // No content studio items — generate a topic-based social post with visual guidance
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const postIndex = dayOfYear % topic.socialPostTemplates.length;
    const videoIndex = dayOfYear % topic.videoTopics.length;
    const photoIndex = dayOfYear % topic.photoSuggestions.length;
    const post = topic.socialPostTemplates[postIndex];
    const videoTopic = topic.videoTopics[videoIndex];
    const photoSuggestion = topic.photoSuggestions[photoIndex];

    actions.push({
      source: "content",
      sourceRef: `topic-${topic.id}-post-${postIndex}`,
      title: `Post about ${topic.shortLabel} today`,
      whyNow: `Consistent visibility on ${topic.label} builds your reputation as the go-to doctor for this.`,
      script: `📋 COPY THIS POST:\n\n${post}\n\n📸 VISUAL OPTIONS:\n\n• Photo idea: ${photoSuggestion}\n• Video idea (30-60 sec): ${videoTopic}\n• AI image prompt (paste into Gemini/ChatGPT):\n  "${topic.imagePromptTemplates[postIndex % topic.imagePromptTemplates.length]}"`,
      estimateMinutes: 5,
      pillar: "Referral & Visibility",
      required: false,
    });
  }

  // ── 4. WWLD stat entry reminder ───────────────────────────────────
  if (actions.length < 3) {
    const todaySession = await dbInstance
      .select()
      .from(wwldSessions)
      .where(and(
        eq(wwldSessions.userId, userId),
        eq(wwldSessions.sessionDate, date)
      ))
      .limit(1);

    if (todaySession.length === 0) {
      actions.push({
        source: "routine",
        sourceRef: "wwld-stats",
        title: "Log today's practice numbers in WWLD",
        whyNow: "Tracking daily stats is how Lyle knows what to recommend next.",
        script: null,
        estimateMinutes: 1,
        pillar: "Personal Growth & Discipline",
        required: false,
      });
    }
  }

  return actions.slice(0, 3); // Hard cap at 3
}

// ─── Engagement Router ──────────────────────────────────────────────

export const engagementRouter = router({
  // Get available quick-start topics
  getTopics: protectedProcedure.query(async () => {
    return { topics: getTopicLabels() };
  }),

  // Set the user's selected quick-start topic
  selectTopic: protectedProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Validate topic exists
      const topic = getTopicById(input.topicId);
      if (!topic) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid topic ID" });

      const [existing] = await dbInstance
        .select()
        .from(userEngagementPreferences)
        .where(eq(userEngagementPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await dbInstance
          .update(userEngagementPreferences)
          .set({ selectedTopicId: input.topicId, updatedAt: new Date() })
          .where(eq(userEngagementPreferences.userId, ctx.user.id));
      } else {
        await dbInstance
          .insert(userEngagementPreferences)
          .values({ userId: ctx.user.id, emailAddress: ctx.user.email, selectedTopicId: input.topicId });
      }

      // Delete today's plan so it regenerates with the new topic
      const date = todayStr();
      await dbInstance.delete(growthActions).where(and(eq(growthActions.userId, ctx.user.id), eq(growthActions.actionDate, date)));
      await dbInstance.delete(dailyGrowthPlans).where(and(eq(dailyGrowthPlans.userId, ctx.user.id), eq(dailyGrowthPlans.planDate, date)));

      return { success: true, topicId: input.topicId, topicLabel: topic.label };
    }),

  // Get or create today's growth plan
  getDailyPlan: protectedProcedure.query(async ({ ctx }) => {
    guardFeature("dailyPlan", ctx.user.clerkId);
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const date = todayStr();
    const userId = ctx.user.id;

    // Check for existing plan
    const existing = await dbInstance
      .select()
      .from(dailyGrowthPlans)
      .where(and(eq(dailyGrowthPlans.userId, userId), eq(dailyGrowthPlans.planDate, date)))
      .limit(1);

    let planId: number;
    if (existing.length > 0) {
      planId = existing[0].id;
    } else {
      // Create today's plan
      const [newPlan] = await dbInstance
        .insert(dailyGrowthPlans)
        .values({ userId, planDate: date, focus: "New Patients & Referrals" })
        .returning({ id: dailyGrowthPlans.id });
      planId = newPlan.id;

      // Generate actions
      const planActions = await buildDailyActions(userId, date);
      for (let i = 0; i < planActions.length; i++) {
        await dbInstance.insert(growthActions).values({
          userId,
          planId,
          source: planActions[i].source,
          sourceRef: planActions[i].sourceRef,
          title: planActions[i].title,
          whyNow: planActions[i].whyNow,
          script: planActions[i].script,
          estimateMinutes: planActions[i].estimateMinutes,
          pillar: planActions[i].pillar,
          sortOrder: i,
          required: planActions[i].required,
          status: "pending",
          actionDate: date,
        });
      }

      // Log event
      await dbInstance.insert(engagementEvents).values({
        userId,
        eventName: "plan_created",
        entityType: "plan",
        entityId: planId,
      });
    }

    // Fetch actions for this plan
    const actions = await dbInstance
      .select()
      .from(growthActions)
      .where(and(eq(growthActions.planId, planId), eq(growthActions.userId, userId)))
      .orderBy(asc(growthActions.sortOrder));

    const plan = existing.length > 0 ? existing[0] : (await dbInstance
      .select().from(dailyGrowthPlans).where(eq(dailyGrowthPlans.id, planId)).limit(1))[0];

    return {
      plan: {
        id: plan.id,
        date: plan.planDate,
        focus: plan.focus,
        state: plan.state,
      },
      actions: actions.map(a => ({
        id: a.id,
        source: a.source,
        sourceRef: a.sourceRef,
        title: a.title,
        whyNow: a.whyNow,
        script: a.script,
        estimateMinutes: a.estimateMinutes,
        pillar: a.pillar,
        required: a.required,
        status: a.status,
        completedAt: a.completedAt,
        deferredTo: a.deferredTo,
      })),
    };
  }),

  // Complete an action
  completeAction: protectedProcedure
    .input(z.object({ actionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      guardFeature("actions", ctx.user.clerkId);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [action] = await dbInstance
        .select()
        .from(growthActions)
        .where(and(eq(growthActions.id, input.actionId), eq(growthActions.userId, ctx.user.id)))
        .limit(1);

      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action not found" });

      await dbInstance
        .update(growthActions)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(growthActions.id, input.actionId));

      await dbInstance.insert(engagementEvents).values({
        userId: ctx.user.id,
        eventName: "action_completed",
        entityType: "action",
        entityId: input.actionId,
      });

      return { success: true };
    }),

  // Defer an action to tomorrow
  deferAction: protectedProcedure
    .input(z.object({ actionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      guardFeature("actions", ctx.user.clerkId);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [action] = await dbInstance
        .select()
        .from(growthActions)
        .where(and(eq(growthActions.id, input.actionId), eq(growthActions.userId, ctx.user.id)))
        .limit(1);

      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action not found" });

      // Defer to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      await dbInstance
        .update(growthActions)
        .set({ status: "deferred", deferredTo: tomorrowStr, updatedAt: new Date() })
        .where(eq(growthActions.id, input.actionId));

      await dbInstance.insert(engagementEvents).values({
        userId: ctx.user.id,
        eventName: "action_deferred",
        entityType: "action",
        entityId: input.actionId,
      });

      return { success: true, deferredTo: tomorrowStr };
    }),

  // Record an outcome after completing an action
  recordOutcome: protectedProcedure
    .input(z.object({
      actionId: z.number(),
      outcomeType: z.enum(["spoke", "posted", "sent", "scheduled", "other"]),
      confidence: z.number().min(1).max(5).optional(),
      note: z.string().max(500).optional(),
      completionSeconds: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      guardFeature("actions", ctx.user.clerkId);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [action] = await dbInstance
        .select()
        .from(growthActions)
        .where(and(eq(growthActions.id, input.actionId), eq(growthActions.userId, ctx.user.id)))
        .limit(1);

      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Action not found" });

      const [outcome] = await dbInstance
        .insert(growthActionOutcomes)
        .values({
          actionId: input.actionId,
          userId: ctx.user.id,
          outcomeType: input.outcomeType,
          confidence: input.confidence,
          note: input.note,
          completionSeconds: input.completionSeconds,
        })
        .returning({ id: growthActionOutcomes.id });

      await dbInstance.insert(engagementEvents).values({
        userId: ctx.user.id,
        eventName: "outcome_recorded",
        entityType: "outcome",
        entityId: outcome.id,
      });

      return { success: true, outcomeId: outcome.id };
    }),

  // Get or create user engagement preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [prefs] = await dbInstance
      .select()
      .from(userEngagementPreferences)
      .where(eq(userEngagementPreferences.userId, ctx.user.id))
      .limit(1);

    if (prefs) return prefs;

    // Create defaults
    const [newPrefs] = await dbInstance
      .insert(userEngagementPreferences)
      .values({ userId: ctx.user.id, emailAddress: ctx.user.email })
      .returning();

    return newPrefs;
  }),

  // Update engagement preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      timezone: z.string().optional(),
      morningAnchor: z.string().optional(),
      endOfDayAnchor: z.string().optional(),
      emailEnabled: z.boolean().optional(),
      emailAddress: z.string().email().optional(),
      quietDays: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [existing] = await dbInstance
        .select()
        .from(userEngagementPreferences)
        .where(eq(userEngagementPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await dbInstance
          .update(userEngagementPreferences)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(userEngagementPreferences.userId, ctx.user.id));
      } else {
        await dbInstance
          .insert(userEngagementPreferences)
          .values({ userId: ctx.user.id, emailAddress: ctx.user.email, ...input });
      }

      return { success: true };
    }),
});
