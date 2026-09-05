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
  wwldSessions,
} from "../../shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

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
  // Use Central Time (America/Chicago) so the day resets at midnight CT
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
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
interface UserProfile {
  name?: string | null;
  practiceName?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
}

function buildHashtags(topic: ReturnType<typeof getTopicById>, profile: UserProfile): string {
  const tags: string[] = [];
  // Condition tags
  if (topic) {
    tags.push(`#${topic.shortLabel.replace(/\s+/g, "")}`);
    tags.push("#CorrectiveCare", "#SpineHealth", "#Chiropractic");
    if (topic.id !== "general_corrective") {
      tags.push(`#${topic.topProblems[0].replace(/\s+/g, "")}`);
    }
  }
  // Location tags
  if (profile.city) {
    const cityTag = profile.city.replace(/\s+/g, "");
    tags.push(`#${cityTag}Chiropractor`, `#${cityTag}Health`);
  }
  if (profile.state) {
    tags.push(`#${profile.state.replace(/\s+/g, "")}Chiropractic`);
  }
  // General growth tags
  tags.push("#GetFixed", "#StructuralCorrection", "#ChiropracticCare");
  return tags.slice(0, 12).join(" ");
}

function getActionContent(categoryKey: string, topic: ReturnType<typeof getTopicById>, dayOfYear: number, profile: UserProfile = {}) {
  if (!topic) return { title: categoryKey, script: null, visualGuidance: null };

  const drName = profile.name || "Dr. [You]";
  const practice = profile.practiceName || "[Your Practice]";
  const location = profile.city && profile.state ? `${profile.city}, ${profile.state}` : "[Your City]";
  const hashtags = buildHashtags(topic, profile);
  const linkCta = profile.website ? `🔗 ${profile.website}` : "📍 Link in bio to book.";

  switch (categoryKey) {
    case "social_post": {
      const postIdx = dayOfYear % topic.socialPostTemplates.length;
      const photoIdx = dayOfYear % topic.photoSuggestions.length;
      const imgIdx = dayOfYear % topic.imagePromptTemplates.length;
      const postText = `${topic.socialPostTemplates[postIdx]}\n\n— ${drName}, ${practice} | ${location}\n\n${linkCta}\n\n${hashtags}`;
      return {
        title: `Post about ${topic.shortLabel}`,
        script: JSON.stringify({
          sections: [
            { label: "Your Post", content: postText, copyable: true },
            { label: "Photo Idea", content: topic.photoSuggestions[photoIdx], copyable: false },
            { label: "AI Image Prompt (paste into Gemini)", content: topic.imagePromptTemplates[imgIdx], copyable: true },
          ]
        }),
        visualGuidance: null,
      };
    }
    case "video": {
      const vidIdx = dayOfYear % topic.videoTopics.length;
      const pillarIdx = dayOfYear % topic.pillarPhrases.length;
      const captionPost = `${topic.pillarPhrases[pillarIdx]} ${topic.oneSentenceDifference}\n\nIf you're dealing with ${topic.topProblems[0].toLowerCase()}, it may be worth finding out what's actually going on before deciding what comes next.\n\n— ${drName}, ${practice} | ${location}\n${linkCta}\n\n${hashtags}`;
      const videoScript = `HOOK (first 3 seconds):\n"If you're dealing with ${topic.topProblems[0].toLowerCase()}... I need to tell you something most people don't hear."\n\nTEACHING (15-30 seconds):\n"${topic.pillarPhrases[pillarIdx]}"\n\n"Here's what a lot of people don't realize: ${topic.topProblems[0].toLowerCase()} may not be the real problem. It could be the SIGNAL. Something structural might be off — and until someone actually evaluates it, you could be managing symptoms instead of addressing the cause."\n\n"${topic.desiredOutcome} — that's what patients tell us can happen when the real issue is identified and addressed."\n\nCLOSE (5-10 seconds):\n"${topic.oneSentenceDifference}"\n\n"If this sounds like you or someone you know — link in bio. Let's find out what's actually going on."`;
      return {
        title: `Record a video: ${topic.videoTopics[vidIdx]}`,
        script: JSON.stringify({
          sections: [
            { label: "Video Script (30-60 sec)", content: videoScript, copyable: true },
            { label: "Post Caption (paste with your video)", content: captionPost, copyable: true },
            { label: "Tips", content: "• First 3 seconds decide if they watch or scroll — start with the problem\n• Talk TO one person, not AT an audience\n• Confidence > perfection. One take is fine.\n• End with a clear next step (link in bio, DM me, call us)", copyable: false },
          ]
        }),
        visualGuidance: null,
      };
    }
    case "referral_ask": {
      const referralVariants = [
        `🤝 REFERRAL: THE PATTERN INTERRUPT\n\nDon't ask "Do you know anyone?" — that's easy to say no to.\n\nInstead, after a great visit, try this:\n\nPause. Make eye contact. Then say:\n"Can I ask you something personal?"\n\n(They'll say yes — this is a pattern interrupt. You now have their full attention.)\n\nThen:\n"${topic.referralTriggerLine}"\n\nWhy this works: You broke the autopilot. They're actually thinking now — not just nodding.\n\nIf they mention someone:\n"${topic.easyIntroLine}"\n\n─────────────────────\n\n💡 PSYCHOLOGY: You're creating a moment of genuine connection before the ask. The pause + eye contact signals this matters.`,
        `🤝 REFERRAL: THE LABELING TECHNIQUE\n\nBefore you ask for the referral, LABEL what they're feeling:\n\n"It seems like you're really relieved that we figured out what was going on with your [${topic.topProblems[0].toLowerCase()}]."\n\n(Wait. Let them confirm. They'll usually elaborate.)\n\nThen:\n"You know what — if you know someone else who's been dealing with something similar and nobody can figure it out... ${topic.referralTriggerLine.toLowerCase()}"\n\nWhy this works: When you label their emotion first, they feel SEEN. The referral ask becomes natural — they WANT to share that feeling with someone they care about.\n\n─────────────────────\n\n💡 PSYCHOLOGY: Labeling + reciprocity principle. When someone feels genuinely helped, they naturally want to pass it forward. You're not asking for a favor — you're giving them permission to help someone they love.`,
        `🤝 REFERRAL: THE STORY BRIDGE\n\nDon't ask for a referral. Tell a story instead:\n\n"You know, I had a patient just like you — they'd been dealing with [${topic.topProblems[0].toLowerCase()}] for years. Nobody could figure it out. They almost gave up. But we found [the structural issue] and now they're [${topic.desiredOutcome.toLowerCase()}]."\n\nPause. Then:\n"If you ever hear someone telling a story like yours used to be — send them my way. ${topic.referralTriggerLine.toLowerCase()}"\n\nWhy this works: Stories bypass resistance. They're not being "sold" — they're being trusted with information. The story also reminds them of their own transformation, which makes them want to share it.\n\n─────────────────────\n\n💡 PSYCHOLOGY: Narrative transport (people drop their guard during stories) + identity reinforcement (they now see themselves as someone who was FIXED, not just treated).`
      ];
      const refIdx = dayOfYear % referralVariants.length;
      return {
        title: "Ask for a referral today",
        script: referralVariants[refIdx],
        visualGuidance: null,
      };
    }
    case "patient_outreach": {
      const outreachVariants = [
        `📞 OUTREACH: THE SPECIFIC MEMORY\n\nBefore you call, take 10 seconds to think:\n• What was their specific problem?\n• What did THEY say mattered to them? (Their kid's game? Their job? Sleep?)\n• What was the last thing you noticed about their progress?\n\nThen call:\n\n"Hey [Name], it's Dr. [You]. I was thinking about you today — specifically about how you told me [specific thing they said]. I wanted to check in. How's that going?"\n\nWait. Listen. Don't pitch.\n\nIf they've lapsed:\n"Look, I noticed you were making real progress with [their ${topic.topProblems[0].toLowerCase()}]. I don't want you to lose that ground. What's getting in the way of coming back in?"\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• The specific memory proves you actually care (not a mass call)\n• Asking "what's getting in the way" is an open-ended calibrated question — it puts them in problem-solving mode instead of defensive mode\n• You're not guilting them. You're showing them you noticed their progress and you don't want them to backslide.`,
        `📞 OUTREACH: THE DISRUPTION CALL\n\nMost recall calls sound like: "Hi, just checking in, wanted to see how you're doing!"\n\nThat's easy to ignore. Try this instead:\n\n"Hey [Name], it's Dr. [You]. I need to be honest with you about something."\n\n(Pause. This is a pattern interrupt — they're paying attention now.)\n\n"When I look at where you were when you started and where you got to... I think we left something unfinished. And I don't want you to be one of those people who was 80% better and then slowly slides back to where they started. That's not okay with me."\n\nThen ask:\n"What would need to be true for you to come back in this week?"\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• "I need to be honest with you" — creates instant attention and trust\n• You're framing it as YOUR concern, not their failure\n• "What would need to be true" (calibrated question) — removes barriers instead of creating pressure\n• You're positioning yourself as someone who genuinely won't let them fail.`,
        `📞 OUTREACH: THE PROGRESS ANCHOR\n\nPull up their file before you call. Find ONE specific measurable improvement they made.\n\nThen:\n\n"Hey [Name], it's Dr. [You]. I was reviewing some patient files today and yours caught my eye. Do you remember when you first came in you couldn't [specific limitation]? And by your last visit you were [specific improvement]?"\n\n(Let them respond. They'll usually say something positive.)\n\n"That's exactly why I'm calling. That kind of progress doesn't happen by accident — it happened because something structural was changing. I want to make sure we don't lose that. When can we get you back in for a progress check?"\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• Anchoring to their real progress makes the call about THEM, not about your schedule\n• "Your file caught my eye" — they feel individually noticed, not mass-contacted\n• "Progress doesn't happen by accident" — reinforces that correction is working, not just temporary relief\n• You're asking WHEN, not IF (assumptive close, but earned through genuine care).`
      ];
      const outIdx = dayOfYear % outreachVariants.length;
      return {
        title: "Reach out to a patient",
        script: outreachVariants[outIdx],
        visualGuidance: null,
      };
    }
    case "community_connection": {
      const communityVariants = [
        `🏘️ COMMUNITY CONNECTION: THE VALUE-FIRST APPROACH\n\nYour community lane: ${topic.communityLane}\n\n❌ DON'T DO THIS:\n"Hi, I'm the chiropractor down the street. Can I leave some cards?"\n(This positions you as needy. Nobody refers to someone who walks in begging.)\n\n✅ DO THIS INSTEAD:\n\nStep 1 — Lead with value, not a pitch:\n"Hey, I'm Dr. [You]. I work with a lot of people who [specific problem from your lane]. I put together a quick guide on [topic — e.g., 'desk posture for people who sit 8+ hours']. Would it be useful if I dropped off a few copies for your [clients/members]?"\n\nStep 2 — Create a reason to come back:\n"I'll check back in a week to see if anyone had questions. And if any of your people ever mention [${topic.topProblems[0].toLowerCase()}], I'm happy to do a free 10-minute consult for them."\n\nStep 3 — Follow up (this is where 90% of doctors fail):\nReturn in 5-7 days. Bring coffee or a small gift. Ask: "Did anyone mention anything? I'm here if they need me."\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• You gave value FIRST — you're not asking for anything on the first visit\n• The free guide positions you as the expert (authority principle)\n• The follow-up creates familiarity — people refer to people they've seen multiple times\n• "Free 10-minute consult" removes risk for the referrer — they're not sending someone into the unknown`,
        `🏘️ COMMUNITY CONNECTION: THE PROBLEM-SPOTTER\n\nYour community lane: ${topic.communityLane}\n\nInstead of introducing yourself as a chiropractor, introduce yourself as a PROBLEM-SPOTTER.\n\nWalk in and say:\n"Hey, I'm Dr. [You]. I specialize in helping people with ${topic.topProblems[0].toLowerCase()} — the kind that won't go away no matter what they try. I'm not here to sell anything. I just wanted to ask: do your [clients/members] ever complain about that kind of thing?"\n\n(Listen. Let them talk. They WILL have stories.)\n\nThen:\n"That's exactly what I fix. Here's what I'd suggest — if anyone mentions it, just tell them: 'I know a doctor who actually figures out what's causing that.' That's it. No pressure. If they want help, they'll reach out."\n\nLeave your card. Don't ask for anything else.\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• You asked a question instead of pitching — this creates dialogue, not resistance\n• "Do your clients ever complain about..." makes THEM the expert on their own people\n• You gave them an easy sentence to say — not a brochure to hand out\n• No pressure = they'll actually do it. Pressure = your card goes in the trash.`,
        `🏘️ COMMUNITY CONNECTION: THE RECIPROCITY PLAY\n\nYour community lane: ${topic.communityLane}\n\nThe most powerful referral relationships start with YOU referring to THEM first.\n\nStep 1 — Send them a patient this week:\nThink of a patient who could use their service. Text that patient: "Hey, I know a great [gym/trainer/massage therapist/etc.] near the office. Want me to connect you?"\n\nStep 2 — Tell the business owner:\n"Hey, I sent [Name] your way. They're one of my patients — great person. I figured you'd take good care of them."\n\nStep 3 — Now you've earned the right to say:\n"By the way — if any of your people ever mention ${topic.topProblems[0].toLowerCase()} or anything structural, send them my way. I specialize in finding the actual cause and fixing it. Here's my card."\n\n─────────────────────\n\n💡 WHY THIS WORKS:\n• You gave first. Now they feel obligated to reciprocate (reciprocity is the strongest influence principle)\n• You proved you're a real person who actually cares about their business\n• The referral ask comes AFTER value — not before\n• This creates a long-term relationship, not a one-time card drop`
      ];
      const commIdx = dayOfYear % communityVariants.length;
      return {
        title: "Make a community connection",
        script: communityVariants[commIdx],
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
        script: `💬 OPEN THE AI COACH\n\nTap the link below to open a conversation with the AI Coach.\n\nThe coach uses Lyle's growth philosophy to help you with:\n• How to handle a specific patient conversation\n• What to say when someone objects to care\n• How to position yourself in a specific situation\n• Strategy for growing new patients this week\n• How to ask for referrals without feeling awkward\n\nAsk anything about practice growth, communication, or patient management.\n\n👉 Go to: AI Coach (in the sidebar)`,
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

      // Check for existing plan for today
      const [existingPlan] = await dbInstance
        .select()
        .from(dailyGrowthPlans)
        .where(and(eq(dailyGrowthPlans.userId, userId), eq(dailyGrowthPlans.planDate, date)))
        .limit(1);

      let planId: number;

      if (existingPlan) {
        // Reuse existing plan — only delete PENDING actions, keep completed ones
        planId = existingPlan.id;
        await dbInstance
          .delete(growthActions)
          .where(
            and(
              eq(growthActions.userId, userId),
              eq(growthActions.planId, planId),
              eq(growthActions.status, "pending")
            )
          );
      } else {
        // Create new plan
        const [plan] = await dbInstance
          .insert(dailyGrowthPlans)
          .values({ userId, planDate: date, focus: topic.shortLabel, state: "active" })
          .returning({ id: dailyGrowthPlans.id });
        planId = plan.id;
      }

      // Figure out the next sort order (after any existing completed actions)
      const existingActions = await dbInstance
        .select({ sortOrder: growthActions.sortOrder })
        .from(growthActions)
        .where(and(eq(growthActions.userId, userId), eq(growthActions.planId, planId)))
        .orderBy(desc(growthActions.sortOrder))
        .limit(1);
      const nextSortOrder = existingActions.length > 0 ? (existingActions[0].sortOrder ?? 0) + 1 : 0;

      // Create actions with expanded content
      for (let i = 0; i < input.actionKeys.length; i++) {
        const key = input.actionKeys[i];
        const category = ACTION_CATEGORIES.find(c => c.key === key)!;
        const content = getActionContent(key, topic, dayOfYear, ctx.user as UserProfile);

        await dbInstance.insert(growthActions).values({
          userId,
          planId,
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
          sortOrder: nextSortOrder + i,
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
        entityId: planId,
      });

      return { success: true, planId };
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
      const lyleAction = await getLyleRecommendation(userId, date);
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

    const lyleAction = await getLyleRecommendation(userId, date);

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
    const modules = await db.listModules(true); // published only, sortOrder asc

    const modulesWithProgress = await Promise.all(
      modules.map(async (mod) => {
        const steps = await db.getModuleSteps(mod.id);
        const stepProgress = await db.getUserStepProgress(ctx.user.id, mod.id);
        const completedSteps = stepProgress.filter(p => p.completed).length;
        const totalSteps = steps.length;
        // Match modules.list: coaching steps win when present, else lessons
        const lessons = await db.listLessons(mod.id, true);
        const lessonProgress = await db.getUserModuleProgress(ctx.user.id, mod.id);
        const lessonsCompleted = lessonProgress.filter((p) => p.completed).length;
        const curriculumComplete = lessons.length > 0 && lessonsCompleted >= lessons.length;
        const coachingComplete = completedSteps >= totalSteps && totalSteps > 0;
        const moduleComplete = totalSteps > 0 ? coachingComplete : curriculumComplete;
        return {
          id: mod.id,
          title: mod.title,
          sortOrder: mod.sortOrder,
          completedSteps: totalSteps > 0 ? completedSteps : lessonsCompleted,
          totalSteps: totalSteps > 0 ? totalSteps : lessons.length,
          isComplete: moduleComplete,
          percentComplete:
            (totalSteps > 0 ? totalSteps : lessons.length) > 0
              ? Math.round(
                  ((totalSteps > 0 ? completedSteps : lessonsCompleted) /
                    (totalSteps > 0 ? totalSteps : lessons.length)) *
                    100
                )
              : 0,
        };
      })
    );

    // Stable order: sortOrder then id (avoids duplicate sortOrder races)
    const ordered = [...modulesWithProgress].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
    );

    // Sequential unlock: module i unlocked iff all previous are complete
    const withUnlock = ordered.map((mod, index) => {
      const unlocked = index === 0 || ordered.slice(0, index).every((m) => m.isComplete);
      return { ...mod, unlocked };
    });

    const incomplete = withUnlock.filter((m) => !m.isComplete);
    const next = incomplete.find((m) => m.unlocked) ?? incomplete[0] ?? null;
    const allComplete = incomplete.length === 0;

    return {
      allComplete,
      nextModuleId: next?.id ?? null,
      incompleteModules: incomplete,
      totalModules: withUnlock.length,
      completedModules: withUnlock.filter((m) => m.isComplete).length,
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

      // One completed growth action counts as daily activity for the streak.
      const date = todayStr();
      await db.updateStreak(ctx.user.id, date);

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

  // Cancel an action — delete it so the user can pick something else
  cancelAction: protectedProcedure
    .input(z.object({ actionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      guardFeature("actions", ctx.user.clerkId);
      const dbInstance = await db.getDb();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the action to find its planId
      const [action] = await dbInstance
        .select()
        .from(growthActions)
        .where(and(eq(growthActions.id, input.actionId), eq(growthActions.userId, ctx.user.id)))
        .limit(1);

      if (!action) throw new TRPCError({ code: "NOT_FOUND" });

      // Only delete if the action is pending — never delete completed actions
      if (action.status === "completed") {
        return { success: true };
      }

      // Delete the pending action
      await dbInstance
        .delete(growthActions)
        .where(and(eq(growthActions.id, input.actionId), eq(growthActions.userId, ctx.user.id)));

      // Check if any actions remain for this plan (including completed ones)
      const remaining = await dbInstance
        .select({ id: growthActions.id })
        .from(growthActions)
        .where(and(eq(growthActions.planId, action.planId!), eq(growthActions.userId, ctx.user.id)))
        .limit(1);

      // Only delete the plan if truly no actions remain (no completed ones either)
      if (remaining.length === 0 && action.planId) {
        await dbInstance
          .delete(dailyGrowthPlans)
          .where(eq(dailyGrowthPlans.id, action.planId));
      }

      return { success: true };
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
      const content = getActionContent(action.sourceRef ?? action.source, topic, shiftedDay, ctx.user as UserProfile);

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

async function getLyleRecommendation(userId: number, date: string) {
  const contentRow = await db.getOrCreateDailyLyleQuote(userId, date);
  if (!contentRow) return null;

  return {
    actionText: contentRow.actionText,
    pillar: contentRow.pillar,
    trendState: contentRow.trendState,
    metricTrigger: contentRow.metricTrigger.replace(/_/g, " "),
  };
}
