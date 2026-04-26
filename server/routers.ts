import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM, type ChatMessage } from "./_core/llm";

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
        return {
          ...mod,
          lessonCount: moduleLessons.length,
          completedCount,
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
          content: `You are a healthcare marketing content specialist. Generate on-brand content for a healthcare practitioner based on their unique positioning and practice philosophy.${practiceContext}`,
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
      await db.toggleDailyTask(
        ctx.user.id,
        input.date,
        input.taskKey,
        input.completed
      );

      // Check if all tasks for the day are complete to update streak
      const tasks = await db.getDailyTasks(ctx.user.id, input.date);
      const allComplete = tasks.length > 0 && tasks.every((t) => t.completed);
      if (allComplete) {
        await db.updateStreak(ctx.user.id, input.date);
      }

      return { success: true };
    }),

  getStreak: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserStreak(ctx.user.id);
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
});

export type AppRouter = typeof appRouter;
