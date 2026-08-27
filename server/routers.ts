import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM, type ChatMessage } from "./_core/llm";
import { engagementRouter } from "./engagement/router";
import { buildComplianceFromProfile } from "./compliance/healthcare-content-rules";

// ─── Auth Router ─────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
});

// ─── Profile Router ──────────────────────────────────────────────────

const profileRouter = router({
  get: protectedProcedure.query(({ ctx }) => ctx.user),
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),
  updatePractice: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        practiceName: z.string().min(1).max(200),
        city: z.string().min(1).max(100),
        state: z.string().min(1).max(50),
        phone: z.string().max(30).optional(),
        website: z.string().max(500).optional(),
        facebookUrl: z.string().max(500).optional(),
        instagramHandle: z.string().max(100).optional(),
        tiktokHandle: z.string().max(100).optional(),
        workDays: z.string().max(100).optional(), // format: "mon:full,tue:full,wed:half,thu:full,fri:off,sat:off,sun:off"
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { users } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      await dbInstance.update(users).set({
        name: input.name,
        practiceName: input.practiceName,
        city: input.city,
        state: input.state,
        phone: input.phone || null,
        website: input.website || null,
        facebookUrl: input.facebookUrl || null,
        instagramHandle: input.instagramHandle || null,
        tiktokHandle: input.tiktokHandle || null,
        workDays: input.workDays || "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off",
        profileComplete: true,
        updatedAt: new Date(),
      }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});

// ─── Modules Router ──────────────────────────────────────────────────

const modulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = ctx.user.role === "admin";
    const allModules = await db.listModules(!isAdmin);
    const progress = await db.getUserProgress(ctx.user.id);

    const modulesWithProgress = await Promise.all(
      allModules.map(async (mod) => {
        const moduleLessons = await db.listLessons(mod.id, !isAdmin);
        const moduleProgress = progress.filter((p) => p.moduleId === mod.id);
        const completedCount = moduleProgress.filter((p) => p.completed).length;
        const curriculumComplete = moduleLessons.length > 0 && completedCount >= moduleLessons.length;
        // Check coaching completion for this module
        const steps = await db.getModuleSteps(mod.id);
        const stepProgress = await db.getUserStepProgress(ctx.user.id, mod.id);
        const coachingCompletedSteps = stepProgress.filter((p) => p.completed).length;
        const coachingComplete = coachingCompletedSteps >= steps.length && steps.length > 0;
        const moduleComplete = steps.length > 0 ? coachingComplete : curriculumComplete;
        return {
          ...mod,
          lessonCount: moduleLessons.length,
          completedCount,
          curriculumComplete,
          coachingComplete,
          moduleComplete,
          stepCount: steps.length,
          completedStepCount: coachingCompletedSteps,
        };
      })
    );
    return modulesWithProgress;
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getModuleById(input.id);
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        status: z.enum(["draft", "published"]).optional(),
        iconEmoji: z.string().max(16).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createModule(input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        status: z.enum(["draft", "published"]).optional(),
        iconEmoji: z.string().max(16).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateModule(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteModule(input.id);
      return { success: true };
    }),
});

// ─── Lessons Router ──────────────────────────────────────────────────

const lessonsRouter = router({
  list: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.user.role === "admin";
      const allLessons = await db.listLessons(input.moduleId, !isAdmin);
      const progress = await db.getUserModuleProgress(ctx.user.id, input.moduleId);
      return allLessons.map((lesson) => ({
        ...lesson,
        completed: progress.some((p) => p.lessonId === lesson.id && p.completed),
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getLessonById(input.id);
    }),

  create: adminProcedure
    .input(
      z.object({
        moduleId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().optional(),
        summary: z.string().optional(),
        sortOrder: z.number().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createLesson(input);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
        summary: z.string().optional(),
        sortOrder: z.number().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateLesson(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteLesson(input.id);
      return { success: true };
    }),
});

// ─── Progress Router ─────────────────────────────────────────────────

const progressRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserProgress(ctx.user.id);
  }),

  getByModule: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getUserModuleProgress(ctx.user.id, input.moduleId);
    }),

  toggle: protectedProcedure
    .input(
      z.object({
        lessonId: z.number(),
        moduleId: z.number(),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.toggleLessonComplete(
        ctx.user.id,
        input.lessonId,
        input.moduleId,
        input.completed
      );
      return { success: true };
    }),
});

// ─── User Answers Router ────────────────────────────────────────────

const answersRouter = router({
  getByModule: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getUserAnswers(ctx.user.id, input.moduleId);
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserAnswers(ctx.user.id);
  }),

  save: protectedProcedure
    .input(
      z.object({
        lessonId: z.number(),
        moduleId: z.number(),
        questionKey: z.string().min(1),
        answer: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.saveUserAnswer({
        userId: ctx.user.id,
        ...input,
      });
      return { success: true };
    }),
});

// ─── AI Chat Router ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Synapse, an AI coaching assistant embedded in a personalized curriculum platform for healthcare practitioners (chiropractors, wellness professionals). Your role is to help learners understand and apply the Bridge the Gap curriculum material.

Core principles:
- Be encouraging, clear, and professional
- Give concise, actionable answers — respect the learner's time
- When explaining concepts, use plain language first, then add technical detail if needed
- If the learner seems stuck, ask a guiding question rather than giving the full answer
- Always relate your answers back to the curriculum context when possible
- Never fabricate information — if you are unsure, say so honestly
- Keep responses focused and on-topic to the curriculum
- Help learners build their unique positioning, messaging, and practice differentiation
- When a learner shares their answers from previous modules, use that context to make your coaching more personalized

You are NOT a general-purpose chatbot. Stay focused on helping the learner with their current module and lesson material, and help them build actionable tools they can use in their practice.`;

const aiRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(4000),
        lessonId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get lesson context if available
      let lessonContext = "";
      if (input.lessonId) {
        const lesson = await db.getLessonById(input.lessonId);
        if (lesson) {
          lessonContext = `\n\nCurrent lesson: "${lesson.title}"\nLesson summary: ${lesson.summary || "No summary available."}\nLesson content excerpt: ${(lesson.content || "").slice(0, 1500)}`;
        }
      }

      // Get user's previous answers for context carry-forward
      const allAnswers = await db.getUserAnswers(ctx.user.id);
      let answersContext = "";
      if (allAnswers.length > 0) {
        answersContext =
          "\n\nLearner's previous curriculum answers:\n" +
          allAnswers
            .map((a) => `- ${a.questionKey}: ${a.answer}`)
            .join("\n");
      }

      // Get recent chat history
      const history = await db.getChatHistory(ctx.user.id, input.lessonId, 20);

      // Build messages array
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: SYSTEM_PROMPT + lessonContext + answersContext,
        },
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: input.message },
      ];

      // Save user message
      await db.saveChatMessage({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        role: "user",
        content: input.message,
      });

      // Call LLM with automatic failover
      const response = await invokeLLM(messages);

      // Save assistant message
      await db.saveChatMessage({
        userId: ctx.user.id,
        lessonId: input.lessonId,
        role: "assistant",
        content: response.content,
      });

      return { content: response.content, provider: response.provider };
    }),

  history: protectedProcedure
    .input(z.object({ lessonId: z.number().nullable() }))
    .query(async ({ ctx, input }) => {
      return db.getChatHistory(ctx.user.id, input.lessonId);
    }),

  clear: protectedProcedure
    .input(z.object({ lessonId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await db.clearChatHistory(ctx.user.id, input.lessonId);
      return { success: true };
    }),
});

// ─── Content Studio Router ──────────────────────────────────────────

const contentRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        contentType: z.enum([
          "social_post",
          "video_script",
          "patient_story",
          "email",
          "text_message",
          "referral_request",
        ]),
        topic: z.string().min(1).max(500),
        additionalContext: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's curriculum answers for personalization
      const allAnswers = await db.getUserAnswers(ctx.user.id);
      let practiceContext = "";
      if (allAnswers.length > 0) {
        practiceContext =
          "\n\nPractitioner's profile from curriculum:\n" +
          allAnswers
            .map((a) => `- ${a.questionKey}: ${a.answer}`)
            .join("\n");
      }

      const contentTypePrompts: Record<string, string> = {
        social_post:
          "Create an engaging social media post (suitable for Facebook, Instagram, or LinkedIn). Include relevant hashtags. Keep it authentic and educational, not salesy.",
        video_script:
          "Write a short video script (60-90 seconds) for a social media video. Include an attention-grabbing hook, key points, and a call to action.",
        patient_story:
          "Write a compelling patient success story (anonymized) that demonstrates the value of the practitioner's approach. Make it relatable and outcome-focused.",
        email:
          "Write a professional email to patients/prospects. Include a subject line, body, and call to action. Keep it warm and informative.",
        text_message:
          "Write a brief, professional text message for patient communication. Keep it under 160 characters if possible, or provide a short version and extended version.",
        referral_request:
          "Write a referral request message that can be sent to existing patients. Make it personal, appreciative, and easy to act on.",
      };

      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `You are a healthcare marketing content specialist. Generate on-brand content for a healthcare practitioner based on their unique positioning and practice philosophy.\n\n${buildComplianceFromProfile(ctx.user)}${practiceContext}`,
        },
        {
          role: "user",
          content: `${contentTypePrompts[input.contentType]}\n\nTopic: ${input.topic}${input.additionalContext ? `\n\nAdditional context: ${input.additionalContext}` : ""}`,
        },
      ];

      const response = await invokeLLM(messages);

      // Save to history
      await db.saveContentHistory({
        userId: ctx.user.id,
        contentType: input.contentType,
        prompt: input.topic,
        generatedContent: response.content,
      });

      return { content: response.content, provider: response.provider };
    }),

  history: protectedProcedure.query(async ({ ctx }) => {
    return db.getContentHistory(ctx.user.id);
  }),
});

// ─── Daily Routine & Streaks Router ─────────────────────────────────

const routineRouter = router({
  // Opening the authenticated app counts as one daily check-in. This is
  // intentionally separate from the number of actions completed that day.
  recordDailyCheckIn: protectedProcedure.mutation(async ({ ctx }) => {
    const serverDate = db.getCentralDateKey();
    await db.updateStreak(ctx.user.id, serverDate);
    return { success: true, date: serverDate };
  }),

  getTasks: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return db.getDailyTasks(ctx.user.id, input.date);
    }),

  toggleTask: protectedProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        taskKey: z.string().min(1),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const serverDate = db.getCentralDateKey();
      if (input.date !== serverDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Daily tasks can only be completed for today.",
        });
      }

      await db.toggleDailyTask(
        ctx.user.id,
        serverDate,
        input.taskKey,
        input.completed
      );

      // Synapse's promise is one meaningful action per day, not an all-checklist requirement.
      if (input.completed) {
        await db.updateStreak(ctx.user.id, serverDate);
      }

      return { success: true };
    }),

  getStreak: protectedProcedure.query(async ({ ctx }) => {
    const streak = await db.getUserStreak(ctx.user.id);
    // Compute average tasks completed per day (last 30 days)
    const dbInstance = await db.getDb();
    let avgTasksPerDay = 0;
    if (dbInstance) {
      const { growthActions } = await import("../shared/schema");
      const { eq, and, sql } = await import("drizzle-orm");
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
      const result = await dbInstance
        .select({
          totalCompleted: sql<number>`count(*)`,
          distinctDays: sql<number>`count(distinct ${growthActions.actionDate})`,
        })
        .from(growthActions)
        .where(and(
          eq(growthActions.userId, ctx.user.id),
          eq(growthActions.status, "completed"),
          sql`${growthActions.actionDate} >= ${thirtyDaysAgoStr}`
        ));
      const total = Number(result[0]?.totalCompleted ?? 0);
      const days = Number(result[0]?.distinctDays ?? 1);
      avgTasksPerDay = days > 0 ? Math.round((total / days) * 10) / 10 : 0;
    }
    return { ...streak, avgTasksPerDay };
  }),
});

// ─── Coupons Router ─────────────────────────────────────────────────

const couponsRouter = router({
  validate: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const coupon = await db.getCouponByCode(input.code);
      if (!coupon) return { valid: false, message: "Coupon not found" };
      if (!coupon.active) return { valid: false, message: "Coupon is inactive" };
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
        return { valid: false, message: "Coupon has expired" };
      if (coupon.maxUses && coupon.currentUses >= coupon.maxUses)
        return { valid: false, message: "Coupon usage limit reached" };
      return {
        valid: true,
        discountPercent: coupon.discountPercent,
        message: coupon.discountPercent === 100 ? "Free access!" : `${coupon.discountPercent}% off`,
      };
    }),

  // Admin
  list: adminProcedure.query(async () => {
    return db.listCoupons();
  }),

  create: adminProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50),
        discountPercent: z.number().min(1).max(100),
        maxUses: z.number().min(1).optional(),
        expiresAt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createCoupon({
        code: input.code,
        discountPercent: input.discountPercent,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        active: z.boolean().optional(),
        maxUses: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateCoupon(id, data);
      return { success: true };
    }),
});

// ─── Coaching Router ────────────────────────────────────────────────

const coachingRouter = router({
  // Get all steps for a module
  getSteps: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const steps = await db.getModuleSteps(input.moduleId);
      const progress = await db.getUserStepProgress(ctx.user.id, input.moduleId);
      return steps.map((step) => {
        const stepProgress = progress.find((p) => p.stepId === step.id);
        return {
          ...step,
          completed: stepProgress?.completed ?? false,
          finalAnswer: stepProgress?.finalAnswer ?? null,
        };
      });
    }),

  // Get chat history for a specific step
  getStepChat: protectedProcedure
    .input(z.object({ stepId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getStepChatHistory(ctx.user.id, input.stepId);
    }),

  // Send a message in a step coaching conversation
  chat: protectedProcedure
    .input(
      z.object({
        stepId: z.number(),
        message: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the step details
      const step = await db.getStepById(input.stepId);
      if (!step) throw new Error("Step not found");

      // Get all previous answers across all modules for context carry-forward
      const allStepProgress = await db.getAllUserStepProgress(ctx.user.id);
      let previousAnswersContext = "";
      if (allStepProgress.length > 0) {
        // Get step details for each completed answer to build context
        const completedSteps = allStepProgress.filter((p) => p.completed && p.finalAnswer);
        if (completedSteps.length > 0) {
          const stepDetails = await Promise.all(
            completedSteps.map(async (p) => {
              const s = await db.getStepById(p.stepId);
              return { step: s, answer: p.finalAnswer };
            })
          );
          previousAnswersContext =
            "\n\n=== LEARNER'S PREVIOUS ANSWERS (use these to personalize coaching) ===\n" +
            stepDetails
              .filter((d) => d.step)
              .map((d) => `- ${d.step!.title} (${d.step!.answerKey}): ${d.answer}`)
              .join("\n") +
            "\n=== END PREVIOUS ANSWERS ===";
        }
      }

      // Build the system prompt from the step's AI prompt + previous answers
      const systemPrompt = step.aiPrompt + previousAnswersContext;

      // Get chat history for this step
      const history = await db.getStepChatHistory(ctx.user.id, input.stepId, 30);

      // Build messages array
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: input.message },
      ];

      // Save user message
      await db.saveStepChatMessage({
        userId: ctx.user.id,
        stepId: input.stepId,
        role: "user",
        content: input.message,
      });

      // Call LLM
      const response = await invokeLLM(messages);

      // Save assistant message
      await db.saveStepChatMessage({
        userId: ctx.user.id,
        stepId: input.stepId,
        role: "assistant",
        content: response.content,
      });

      return { content: response.content, provider: response.provider };
    }),

  // Complete a step with a final answer
  completeStep: protectedProcedure
    .input(
      z.object({
        stepId: z.number(),
        moduleId: z.number(),
        finalAnswer: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.completeStep(
        ctx.user.id,
        input.moduleId,
        input.stepId,
        input.finalAnswer
      );

      // Also save to the legacy user_answers table for backward compatibility
      const step = await db.getStepById(input.stepId);
      if (step) {
        await db.saveUserAnswer({
          userId: ctx.user.id,
          lessonId: 0, // No lesson association in coaching mode
          moduleId: input.moduleId,
          questionKey: step.answerKey,
          answer: input.finalAnswer,
        });
      }

      return { success: true };
    }),

  // Clear chat history for a step (restart the conversation)
  clearStepChat: protectedProcedure
    .input(z.object({ stepId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.clearStepChatHistory(ctx.user.id, input.stepId);
      return { success: true };
    }),

  // Get module coaching progress summary
  getModuleProgress: protectedProcedure
    .input(z.object({ moduleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const steps = await db.getModuleSteps(input.moduleId);
      const progress = await db.getUserStepProgress(ctx.user.id, input.moduleId);
      const completedSteps = progress.filter((p) => p.completed).length;
      return {
        totalSteps: steps.length,
        completedSteps,
        isComplete: completedSteps >= steps.length && steps.length > 0,
      };
    }),
});

// ─── Admin Stats Router ──────────────────────────────────────────────

const adminStatsRouter = router({
  getStats: adminProcedure.query(async () => {
    const stats = await db.getAdminStats();
    return stats;
  }),
});

// ─── WWLD Router ────────────────────────────────────────────────────

const wwldRouter = router({
  logSession: protectedProcedure
    .input(
      z.object({
        sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sessionType: z.enum(["morning", "afternoon", "end_of_day"]),
        officeVisits: z.number().int().min(0).max(9999),
        newPatients: z.number().int().min(0).max(9999),
        recall: z.number().int().min(0).max(9999),
        testResults: z.number().int().min(0).max(9999),
        progressExams: z.number().int().min(0).max(9999),
        performanceReviews: z.number().int().min(0).max(9999),
        carePlansSigned: z.number().int().min(0).max(9999),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await db.upsertWwldSession({
        userId: ctx.user.id,
        ...input,
      });
      return { success: true, session };
    }),

  getToday: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const sessions = await db.getWwldSessionsForDate(ctx.user.id, input.date);
      const totals = {
        officeVisits: sessions.reduce((s, r) => s + r.officeVisits, 0),
        newPatients: sessions.reduce((s, r) => s + r.newPatients, 0),
        recall: sessions.reduce((s, r) => s + (r.recall ?? 0), 0),
        testResults: sessions.reduce((s, r) => s + r.testResults, 0),
        progressExams: sessions.reduce((s, r) => s + r.progressExams, 0),
        performanceReviews: sessions.reduce((s, r) => s + r.performanceReviews, 0),
        carePlansSigned: sessions.reduce((s, r) => s + r.carePlansSigned, 0),
      };
      return { sessions, totals };
    }),

  getStats: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      return db.getWwldTotalsForRange(ctx.user.id, input.startDate, input.endDate);
    }),

  getTodayStatus: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      return db.getWwldTodayStatus(ctx.user.id, input.date);
    }),
  getAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getWwldAnalytics(ctx.user.id);
    }),

  getDailyAction: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      // ── 1. Fetch last 4 weeks of sessions ──────────────────────────
      const endStr = db.getCentralDateKey();
      const startStr = db.shiftDateKey(endStr, -28);
      const { dailyBreakdown } = await db.getWwldTotalsForRange(userId, startStr, endStr, true);

      // ── 1b. Filter out non-work days ──────────────────────────────
      const DAY_MAP: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
      const workDaysRaw = (ctx.user as any).workDays || "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off";
      // Parse schedule: { mon: "full", tue: "half", fri: "off", ... }
      const schedule: Record<string, string> = {};
      workDaysRaw.split(",").forEach((entry: string) => {
        const [day, status] = entry.split(":");
        if (day) schedule[day] = status || "full";
      });
      // Filter: exclude "off" days, keep "full" and "half"
      const workDayBreakdown = dailyBreakdown.filter((d: any) => {
        const date = new Date(d.date + "T12:00:00"); // noon to avoid timezone shift
        const dayName = DAY_MAP[date.getDay()];
        return schedule[dayName] !== "off";
      }).map((d: any) => {
        // Weight half days 2x so they compare fairly to full days
        const date = new Date(d.date + "T12:00:00");
        const dayName = DAY_MAP[date.getDay()];
        const multiplier = schedule[dayName] === "half" ? 2 : 1;
        return {
          ...d,
          officeVisits: d.officeVisits * multiplier,
          newPatients: d.newPatients * multiplier,
          carePlansSigned: d.carePlansSigned * multiplier,
        };
      });

      // ── 2. Determine this week's Monday ───────────────────────────
      const todayDay = new Date(`${endStr}T00:00:00Z`).getUTCDay();
      const thisMondayStr = db.mondayDateKey(endStr);
      const isMonday = todayDay === 1;
      const currentWeekDaily = dailyBreakdown.filter((day: any) => day.date >= thisMondayStr && day.date <= endStr);

      // ── 3. Diagnostic engine ──────────────────────────────────────
      // With < 7 days of data → default to 'breaking' state
      const uniqueDays = workDayBreakdown.length;
      const hasEnoughData = uniqueDays >= 7;

      type TrendState = "breaking" | "slipping" | "stuck" | "plateaued" | "climbing" | "momentum";

      function computeTrend(
        values: number[],
        fallback: TrendState = "breaking"
      ): TrendState {
        if (values.length < 7) return fallback;
        const recent = values.slice(-7);
        const prior = values.slice(-14, -7);
        if (prior.length < 7) return fallback;
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
        if (priorAvg === 0) return recentAvg > 0 ? "climbing" : fallback;
        const pct = (recentAvg - priorAvg) / priorAvg;
        if (pct <= -0.15) return "breaking";
        if (pct <= -0.05) return "slipping";
        if (Math.abs(pct) < 0.05) {
          // flat — check how long it's been flat
          const allFlat = values.slice(-21);
          const allFlatAvg = allFlat.reduce((a, b) => a + b, 0) / allFlat.length;
          const variance = allFlat.reduce((s, v) => s + Math.abs(v - allFlatAvg), 0) / allFlat.length;
          return variance / (allFlatAvg || 1) < 0.1 ? "stuck" : "plateaued";
        }
        if (pct >= 0.15) return "momentum";
        return "climbing";
      }

      const ovVals = workDayBreakdown.map((d: any) => d.officeVisits);
      const npVals = workDayBreakdown.map((d: any) => d.newPatients);
      const cpVals = workDayBreakdown.map((d: any) => d.carePlansSigned);

      const ovTrend = computeTrend(ovVals);
      const npTrend = computeTrend(npVals);
      const cpTrend = computeTrend(cpVals);

      // Priority: breaking > slipping > stuck > plateaued > climbing > momentum
      const PRIORITY: TrendState[] = ["breaking", "slipping", "stuck", "plateaued", "climbing", "momentum"];

      type MetricDiag = { metric: string; pillar: string; metricTrigger: string; trendState: TrendState; value: number };

      const diagnostics: MetricDiag[] = [
        { metric: "office_visits", pillar: "Personal Growth & Discipline", metricTrigger: "plateaued_stats", trendState: ovTrend, value: currentWeekDaily.reduce((sum: number, day: any) => sum + day.officeVisits, 0) },
        { metric: "new_patients",  pillar: "Referral & Visibility",         metricTrigger: "low_new_patients", trendState: npTrend, value: currentWeekDaily.reduce((sum: number, day: any) => sum + day.newPatients, 0) },
        { metric: "care_plans",    pillar: "Closing & Sales Skill",          metricTrigger: "low_conversion",   trendState: cpTrend, value: currentWeekDaily.reduce((sum: number, day: any) => sum + day.carePlansSigned, 0) },
      ];

      diagnostics.sort((a, b) => PRIORITY.indexOf(a.trendState) - PRIORITY.indexOf(b.trendState));
      const topDiag = diagnostics[0];

      // ── 4. Deduplication ──────────────────────────────────────────
      const servedIds = await db.getServedContentIds(userId);

      // ── 5. Pick weekly theme (Monday cadence, persists Mon–Sun) ───
      let weeklyContent: Awaited<ReturnType<typeof db.getLyleContentByPillarAndState>>[0] | null = null;
      {
        let pool = await db.getLyleContentByPillarAndState(topDiag.pillar, "weekly", topDiag.trendState, servedIds);
        if (pool.length === 0) pool = await db.getLyleContentByPillar(topDiag.pillar, "weekly", servedIds);
        if (pool.length === 0) pool = await db.getLyleContent(topDiag.trendState, "weekly", servedIds);
        if (pool.length === 0) {
          // All served — reset for this cadence and pick from full pool
          const allWeekly = await db.getLyleContent(topDiag.trendState, "weekly", []);
          pool = allWeekly;
        }
        if (pool.length > 0) {
          // Deterministic within the week: pick by (userId + weekStart) mod pool.length
          const seed = (userId * 31 + parseInt(thisMondayStr.replace(/-/g, ""), 10)) % pool.length;
          weeklyContent = pool[Math.abs(seed) % pool.length];
          if (isMonday) {
            await db.markContentServed(userId, weeklyContent.contentId);
          }
        }
      }

      // ── 6. One shared, stable daily quote ─────────────────────────
      // Today’s Plan and the WWLD card use the same Central Time daily record.
      // This prevents query refreshes from changing the quote mid-day.
      const dailyContent = await db.getOrCreateDailyLyleQuote(userId, endStr);

      return {
        hasEnoughData,
        trendState: topDiag.trendState,
        triggerMetric: topDiag.metric,
        triggerValue: topDiag.value,
        pillar: topDiag.pillar,
        weeklyTheme: weeklyContent?.actionText ?? null,
        weeklyContentId: weeklyContent?.contentId ?? null,
        dailyAction: dailyContent?.actionText ?? null,
        dailyContentId: dailyContent?.contentId ?? null,
        dailyTone: dailyContent?.tone ?? null,
      };
    }),
});

// ─── App Router ──────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  profile: profileRouter,
  modules: modulesRouter,
  lessons: lessonsRouter,
  progress: progressRouter,
  answers: answersRouter,
  ai: aiRouter,
  content: contentRouter,
  routine: routineRouter,
  coupons: couponsRouter,
  coaching: coachingRouter,
  adminStats: adminStatsRouter,
  wwld: wwldRouter,
  engagement: engagementRouter,
});

export type AppRouter = typeof appRouter;
