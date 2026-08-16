import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { isEngagementEnabled } from "./flags";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getTopicById, getTopicLabels, QUICK_START_TOPICS } from "./quick-start-topics";
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
import { eq, and, desc, asc, sql } from "drizzle-orm";

// ─── Constants ─────────────────────────────────────────────────────

/** Action categories the doctor can pick from each day */
export const ACTION_CATEGORIES = [
  {
    key: "social_post",
    label: "Post to social media",
    icon: "📱",
    description: "Copy your topic-based post and share it on Facebook, Instagram, or LinkedIn",
  },
  {
    key: "video",
    label: "Make a short video",
    icon: "🎬",
    description: "Record a 30-60 second video using today's script and bullet points",
  },
  {
    key: "referral_ask",
    label: "Ask for a referral",
    icon: "🤝",
    description: "Use your referral trigger line with a patient or in public today",
  },
  {
    key: "patient_outreach",
    label: "Reach out to a patient",
    icon: "📞",
    description: "Call, text, or message an existing patient to check in or recall them",
  },
  {
    key: "community_connection",
    label: "Community connection",
    icon: "🏘️",
    description: "Connect with a local business owner, gym, or potential referral source",
  },
  {
    key: "curriculum_lesson",
    label: "Complete a curriculum lesson",
    icon: "📚",
    description: "Work through your next lesson to unlock customized content",
  },
  {
    key: "ai_coach",
    label: "Ask the AI Coach a question",
    icon: "💬",
    description: "Get Lyle-based coaching on a specific challenge you're facing",
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function guardFeature(feature: Parameters<typeof isEngagementEnabled>[0], clerkId?: string) {
  if (!isEngagementEnabled(feature, clerkId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Feature not enabled" });
  }
}

/** Get or auto-assign the user's topic (defaults to general_corrective) */
async function ensureUserTopic(dbInstance: any, userId: number, email: string) {
  const [prefs] = await dbInstance
    .select()
    .from(userEngagementPreferences)
    .where(eq(userEngagementPreferences.userId, userId))
    .limit(1);

  if (prefs?.selectedTopicId) {
    return getTopicById(prefs.selectedTopicId) ?? QUICK_START_TOPICS[7]; // fallback to general
  }

  // Auto-assign general_corrective
  const defaultTopic = QUICK_START_TOPICS[7]; // "general_corrective"
  if (prefs) {
    await dbInstance
      .update(userEngagementPreferences)
      .set({ selectedTopicId: defaultTopic.id, updatedAt: new Date() })
      .where(eq(userEngagementPreferences.userId, userId));
  } else {
    await dbInstance
      .insert(userEngagementPreferences)
      .values({ userId, emailAddress: email, selectedTopicId: defaultTopic.id });
  }
  return defaultTopic;
}

/** Generate expanded content for an action category based on the user's topic */
function getActionContent(categoryKey: string, topic: ReturnType<typeof getTopicById>, dayOfYear: number) {
  if (!topic) return { title: categoryKey, script: null, visualGuidance: null };

  switch (categoryKey) {
    case "social_post": {
      const postIdx = dayOfYear % topic.socialPostTemplates.length;
      const photoIdx = dayOfYear % topic.photoSuggestions.length;
      const imgIdx = dayOfYear % topic.imagePromptTemplates.length;
      return {
        title: `Post about ${topic.shortLabel}`,
        script: `📋 YOUR POST (copy this):\n\n${topic.socialPostTemplates[postIdx]}\n\n─────────────────────\n\n📸 PHOTO OPTION:\n${topic.photoSuggestions[photoIdx]}\n\n🤖 AI IMAGE OPTION (paste this into Gemini or ChatGPT to generate an image):\n"${topic.imagePromptTemplates[imgIdx]}"`,
        visualGuidance: null,
      };
    }
    case "video": {
      const vidIdx = dayOfYear % topic.videoTopics.length;
      const pillarIdx = dayOfYear % topic.pillarPhrases.length;
      const captionPost = `${topic.pillarPhrases[pillarIdx]} ${topic.oneSentenceDifference}\n\nIf you're dealing with ${topic.topProblems[0].toLowerCase()}, you don't have to keep living with it. We find the real problem and fix it.\n\n📍 Link in bio to book.\n\n#chiropractic #${topic.shortLabel.toLowerCase().replace(/\s+/g, "")} #correction #getfixed`;
      return {
        title: `Record a video: ${topic.videoTopics[vidIdx]}`,
        script: `🎬 VIDEO SCRIPT (30-60 seconds)\n\nTopic: ${topic.videoTopics[vidIdx]}\n\nOpening (look at camera, say this):\n"${topic.pillarPhrases[pillarIdx]}"\n\nKey points to hit:\n• "${topic.topProblems[0]}"\n• "${topic.desiredOutcome}"\n• "If this sounds like you, come see us."\n\nClose with:\n"${topic.oneSentenceDifference}"\n\n🎥 Film at your desk, adjustment room, or outside your office.\nLook directly at camera. Keep it under 60 seconds.\n\n─────────────────────\n\n📋 POST CAPTION (copy this to post with your video):\n\n${captionPost}`,
        visualGuidance: null,
      };
    }
    case "referral_ask": {
      return {
        title: "Ask for a referral today",
        script: `🤝 REFERRAL SCRIPT\n\nAt the end of an appointment, say:\n"${topic.referralTriggerLine}"\n\nIf they mention someone:\n"${topic.easyIntroLine}"\n\nIn public or with friends:\n"${topic.knownForSentence}"`,
        visualGuidance: null,
      };
    }
    case "patient_outreach": {
      return {
        title: "Reach out to a patient",
        script: `📞 OUTREACH TEMPLATE\n\nFor a recall patient:\n"Hey [Name], it's Dr. [You]. I was thinking about you — it's been a while since we checked on [their issue]. How are you doing? I'd love to get you back in and make sure everything is holding."\n\nFor a current patient who missed:\n"Hey [Name], just checking in — we missed you this week. Everything okay? Let's get you back on track."`,
        visualGuidance: null,
      };
    }
    case "community_connection": {
      return {
        title: "Make a community connection",
        script: `🏘️ COMMUNITY OUTREACH\n\nYour community lane: ${topic.communityLane}\n\nApproach:\n"Hi, I'm Dr. [You] — I'm the chiropractor down the street. I work with a lot of people dealing with ${topic.topProblems[0].toLowerCase()}. If any of your [clients/members/customers] ever mention back or neck issues, I'd love to be your go-to referral. Can I leave some cards?"\n\nFollow up within 1 week with a thank-you or a small gift (coffee, etc.)`,
        visualGuidance: null,
      };
    }
    case "curriculum_lesson": {
      return {
        title: "Complete your next curriculum lesson",
        script: null,
        visualGuidance: null,
      };
    }
    case "ai_coach": {
      return {
        title: "Ask the AI Coach a question",
        script: null,
        visualGuidance: null,
      };
    }
    default:
      return { title: categoryKey, script: null, visualGuidance: null };
  }
}

// ─── Engagement Router ──────────────────────────────────────────────

export const engagementRouter = router({
  // Get available quick-start topics
  getTopics: protectedProcedure.query(async () => {
    return { topics: getTopicLabels() };
  }),

  // Get action categories for the picker
  getActionCategories: protectedProcedure.query(async () => {
    return { categories: ACTION_CATEGORIES };
  }),

  // Set the user's selected quick-start topic
  selectTopic: protectedProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

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

  // Pick 3 daily actions — creates the plan for today
  pickDailyActions: protectedProcedure
    .input(z.object({ actionKeys: z.array(z.string()).min(1).max(7) }))
    .mutation(async ({ ctx, input }) => {
      guardFeature("dailyPlan", ctx.user.clerkId);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const date = todayStr();
      const userId = ctx.user.id;

      // Validate all keys
      const validKeys = ACTION_CATEGORIES.map(c => c.key);
      for (const key of input.actionKeys) {
        if (!validKeys.includes(key as any)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid action: ${key}` });
        }
      }

      // Get or auto-assign topic
      const topic = await ensureUserTopic(dbInstance, userId, ctx.user.email ?? "");
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);

      // Delete any existing plan for today (allows re-picking)
      const existingPlan = await dbInstance
        .select()
        .from(dailyGrowthPlans)
        .where(and(eq(dailyGrowthPlans.userId, userId), eq(dailyGrowthPlans.planDate, date)))
        .limit(1);

      if (existingPlan.length > 0) {
        await dbInstance.delete(growthActions).where(and(eq(growthActions.userId, userId), eq(growthActions.actionDate, date)));
        await dbInstance.delete(dailyGrowthPlans).where(eq(dailyGrowthPlans.id, existingPlan[0].id));
      }

      // Create new plan
      const [plan] = await dbInstance
        .insert(dailyGrowthPlans)
        .values({ userId, planDate: date, focus: topic.shortLabel, state: "active" })
        .returning({ id: dailyGrowthPlans.id });

      // Create actions with expanded content
      for (let i = 0; i < input.actionKeys.length; i++) {
        const key = input.actionKeys[i];
        const category = ACTION_CATEGORIES.find(c => c.key === key)!;
        const content = getActionContent(key, topic, dayOfYear);

        await dbInstance.insert(growthActions).values({
          userId,
          planId: plan.id,
          source: "picked",
          sourceRef: key,
          title: content.title,
          whyNow: category.description,
          script: content.script,
          estimateMinutes: key === "video" ? 5 : key === "social_post" ? 3 : 2,
          pillar: key === "referral_ask" || key === "community_connection" ? "Referral & Visibility" :
                  key === "patient_outreach" ? "Retention & Case Management" :
                  key === "curriculum_lesson" ? "Personal Growth & Discipline" :
                  key === "social_post" || key === "video" ? "Referral & Visibility" :
                  "Communication & Listening",
          sortOrder: i,
          required: i === 0,
          status: "pending",
          actionDate: date,
        });
      }

      // Log event
      await dbInstance.insert(engagementEvents).values({
        userId,
        eventName: "actions_picked",
        entityType: "plan",
        entityId: plan.id,
      });

      return { success: true, planId: plan.id };
    }),

  // Get today's plan (returns picked actions or empty if not picked yet)
  getDailyPlan: protectedProcedure.query(async ({ ctx }) => {
    guardFeature("dailyPlan", ctx.user.clerkId);
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const date = todayStr();
    const userId = ctx.user.id;

    // Get user's topic (auto-assign if needed)
    const topic = await ensureUserTopic(dbInstance, userId, ctx.user.email ?? "");

    // Check for existing plan
    const [existing] = await dbInstance
      .select()
      .from(dailyGrowthPlans)
      .where(and(eq(dailyGrowthPlans.userId, userId), eq(dailyGrowthPlans.planDate, date)))
      .limit(1);

    if (!existing) {
      // No plan yet — doctor needs to pick actions
      // Also get the Lyle recommendation for display
      const lyleAction = await getLyleRecommendation(dbInstance, userId, date);
      return {
        status: "needs_pick" as const,
        topic: { id: topic.id, label: topic.label, shortLabel: topic.shortLabel },
        lyleRecommendation: lyleAction,
        actions: [],
      };
    }

    // Plan exists — fetch actions
    const actions = await dbInstance
      .select()
      .from(growthActions)
      .where(and(eq(growthActions.planId, existing.id), eq(growthActions.userId, userId)))
      .orderBy(asc(growthActions.sortOrder));

    const lyleAction = await getLyleRecommendation(dbInstance, userId, date);

    const completedCount = actions.filter(a => a.status === "completed").length;

    return {
      status: "active" as const,
      topic: { id: topic.id, label: topic.label, shortLabel: topic.shortLabel },
      lyleRecommendation: lyleAction,
      plan: {
        id: existing.id,
        date: existing.planDate,
        focus: existing.focus,
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
      })),
      completedCount,
      totalCount: actions.length,
    };
  }),

  // Get curriculum progress for the reminder section
  getCurriculumReminder: protectedProcedure.query(async ({ ctx }) => {
    const modules = await db.listModules(true); // published only
    const progress = await db.getUserProgress(ctx.user.id);

    const modulesWithProgress = await Promise.all(
      modules.map(async (mod) => {
        const steps = await db.getModuleSteps(mod.id);
        const stepProgress = await db.getUserStepProgress(ctx.user.id, mod.id);
        const completedSteps = stepProgress.filter(p => p.completed).length;
        const totalSteps = steps.length;
        const isComplete = completedSteps >= totalSteps && totalSteps > 0;
        return {
          id: mod.id,
          title: mod.title,
          completedSteps,
          totalSteps,
          isComplete,
          percentComplete: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
        };
      })
    );

    const incomplete = modulesWithProgress.filter(m => !m.isComplete);
    const allComplete = incomplete.length === 0;

    return {
      allComplete,
      incompleteModules: incomplete,
      totalModules: modulesWithProgress.length,
      completedModules: modulesWithProgress.filter(m => m.isComplete).length,
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

      // Update streak via routine system
      const date = todayStr();
      const allActions = await dbInstance
        .select()
        .from(growthActions)
        .where(and(eq(growthActions.userId, ctx.user.id), eq(growthActions.actionDate, date)));
      const allComplete = allActions.every(a => a.id === input.actionId || a.status === "completed");
      if (allComplete) {
        await db.updateStreak(ctx.user.id, date);
      }

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

  // Refresh an action — regenerate with a different script variant (same category)
  refreshAction: protectedProcedure
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

      // Get topic and use a shifted day index for different content
      const topic = await ensureUserTopic(dbInstance, ctx.user.id, ctx.user.email ?? "");
      const baseDayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const shiftedDay = baseDayOfYear + Math.floor(Math.random() * 5) + 1;
      const content = getActionContent(action.sourceRef ?? action.source, topic, shiftedDay);

      await dbInstance
        .update(growthActions)
        .set({ title: content.title, script: content.script, updatedAt: new Date() })
        .where(eq(growthActions.id, input.actionId));

      return { success: true };
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

// ─── Lyle Recommendation Helper ────────────────────────────────────

async function getLyleRecommendation(dbInstance: any, userId: number, date: string) {
  const servedToday = await dbInstance
    .select()
    .from(lyleServedLog)
    .where(and(
      eq(lyleServedLog.userId, userId),
      sql`${lyleServedLog.servedAt}::date = ${date}::date`
    ))
    .limit(1);

  if (servedToday.length === 0) return null;

  const [contentRow] = await dbInstance
    .select()
    .from(lyleContent)
    .where(eq(lyleContent.contentId, servedToday[0].contentId))
    .limit(1);

  if (!contentRow) return null;

  return {
    actionText: contentRow.actionText,
    pillar: contentRow.pillar,
    trendState: contentRow.trendState,
    metricTrigger: contentRow.metricTrigger.replace(/_/g, " "),
  };
}
