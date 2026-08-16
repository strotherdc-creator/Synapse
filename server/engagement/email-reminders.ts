/**
 * Engagement Email Reminders
 *
 * Sends a daily morning email with today's growth plan actions
 * and a Friday weekly review summary.
 *
 * Uses the same SMTP configuration as the WWLD backup system.
 * Only sends to users who have:
 *   1. email_enabled = true in their engagement preferences
 *   2. A valid email address
 *   3. Are in the pilot allowlist (if one is defined)
 *   4. Today is not one of their quiet days
 */

import cron from "node-cron";
import nodemailer from "nodemailer";
import { getDb } from "../db";
import { userEngagementPreferences, dailyGrowthPlans, growthActions, users } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { ENV } from "../_core/env";
import { isEngagementEnabled } from "./flags";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDayOfWeek(): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

async function sendDailyReminders() {
  if (!isEngagementEnabled("email")) {
    console.log("[Engagement Email] Feature flag disabled — skipping.");
    return;
  }

  if (!ENV.smtpUser || !ENV.smtpPass) {
    console.warn("[Engagement Email] SMTP not configured — skipping.");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[Engagement Email] Database not available — skipping.");
    return;
  }

  try {
    const today = todayStr();
    const dayOfWeek = getDayOfWeek();

    // Get all users with email enabled
    const prefs = await db
      .select({
        userId: userEngagementPreferences.userId,
        emailAddress: userEngagementPreferences.emailAddress,
        quietDays: userEngagementPreferences.quietDays,
      })
      .from(userEngagementPreferences)
      .where(eq(userEngagementPreferences.emailEnabled, true));

    let sentCount = 0;

    for (const pref of prefs) {
      // Skip quiet days
      if (pref.quietDays && pref.quietDays.split(",").includes(dayOfWeek)) continue;

      // Skip if no email address
      if (!pref.emailAddress) continue;

      // Check pilot allowlist
      const user = await db.select().from(users).where(eq(users.id, pref.userId)).limit(1);
      if (user.length === 0) continue;

      if (ENV.engagementPilotClerkIds.length > 0 && !ENV.engagementPilotClerkIds.includes(user[0].clerkId)) {
        continue;
      }

      // Get today's plan actions
      const plan = await db
        .select()
        .from(dailyGrowthPlans)
        .where(and(eq(dailyGrowthPlans.userId, pref.userId), eq(dailyGrowthPlans.planDate, today)))
        .limit(1);

      let actionsText = "Open Synapse to see your personalized growth plan for today.";

      if (plan.length > 0) {
        const actions = await db
          .select()
          .from(growthActions)
          .where(and(eq(growthActions.planId, plan[0].id), eq(growthActions.status, "pending")));

        if (actions.length > 0) {
          actionsText = actions.map((a, i) => {
            const prefix = a.required ? "⭐" : `${i + 1}.`;
            const time = a.estimateMinutes ? ` (~${a.estimateMinutes} min)` : "";
            return `${prefix} ${a.title}${time}`;
          }).join("\n");
        }
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
      });

      await transporter.sendMail({
        from: `"Synapse Growth" <${ENV.smtpUser}>`,
        to: pref.emailAddress,
        subject: `Your Growth Plan for Today — ${today}`,
        text: [
          `Good morning, ${user[0].name || "Doctor"}!`,
          ``,
          `Here's your growth plan for today:`,
          ``,
          actionsText,
          ``,
          `Focus: New Patients & Referrals`,
          ``,
          `Open Synapse to view details, scripts, and mark actions complete:`,
          `https://synapse-production-daae.up.railway.app/today`,
          ``,
          `— Synapse`,
          ``,
          `To stop these emails, update your preferences in Synapse > Profile.`,
        ].join("\n"),
      });

      sentCount++;
    }

    console.log(`[Engagement Email] Daily reminders sent to ${sentCount} user(s).`);
  } catch (err) {
    console.error("[Engagement Email] Failed:", err);
  }
}

async function sendWeeklyReview() {
  if (!isEngagementEnabled("weeklyReview")) {
    console.log("[Engagement Email] Weekly review flag disabled — skipping.");
    return;
  }

  if (!ENV.smtpUser || !ENV.smtpPass) {
    console.warn("[Engagement Email] SMTP not configured — skipping weekly review.");
    return;
  }

  const db = await getDb();
  if (!db) return;

  try {
    // Get all users with email enabled
    const prefs = await db
      .select({
        userId: userEngagementPreferences.userId,
        emailAddress: userEngagementPreferences.emailAddress,
      })
      .from(userEngagementPreferences)
      .where(eq(userEngagementPreferences.emailEnabled, true));

    let sentCount = 0;

    for (const pref of prefs) {
      if (!pref.emailAddress) continue;

      const user = await db.select().from(users).where(eq(users.id, pref.userId)).limit(1);
      if (user.length === 0) continue;

      if (ENV.engagementPilotClerkIds.length > 0 && !ENV.engagementPilotClerkIds.includes(user[0].clerkId)) {
        continue;
      }

      // Count this week's completed actions
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const completedThisWeek = await db
        .select({ count: sql<number>`count(*)` })
        .from(growthActions)
        .where(and(
          eq(growthActions.userId, pref.userId),
          eq(growthActions.status, "completed"),
          sql`${growthActions.actionDate} >= ${weekStartStr}`
        ));

      const totalThisWeek = await db
        .select({ count: sql<number>`count(*)` })
        .from(growthActions)
        .where(and(
          eq(growthActions.userId, pref.userId),
          sql`${growthActions.actionDate} >= ${weekStartStr}`
        ));

      const completed = Number(completedThisWeek[0]?.count ?? 0);
      const total = Number(totalThisWeek[0]?.count ?? 0);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
      });

      await transporter.sendMail({
        from: `"Synapse Growth" <${ENV.smtpUser}>`,
        to: pref.emailAddress,
        subject: `Your Weekly Growth Review — Week of ${weekStartStr}`,
        text: [
          `Hi ${user[0].name || "Doctor"},`,
          ``,
          `Here's your weekly growth summary:`,
          ``,
          `Actions completed: ${completed} of ${total}`,
          `Completion rate: ${total > 0 ? Math.round((completed / total) * 100) : 0}%`,
          ``,
          completed >= total && total > 0
            ? `Outstanding week! You completed every growth action. Keep this momentum going.`
            : completed > 0
            ? `Good progress this week. Every action you take builds your practice.`
            : `This week was quiet. Even one small action next week moves the needle.`,
          ``,
          `Open Synapse for next week's plan:`,
          `https://synapse-production-daae.up.railway.app/today`,
          ``,
          `— Synapse`,
        ].join("\n"),
      });

      sentCount++;
    }

    console.log(`[Engagement Email] Weekly reviews sent to ${sentCount} user(s).`);
  } catch (err) {
    console.error("[Engagement Email] Weekly review failed:", err);
  }
}

/**
 * Schedule engagement email jobs.
 * Call once from server startup.
 *
 * Daily reminder: every weekday at 7:30 AM server time
 * Weekly review: every Friday at 5:00 PM server time
 */
export function scheduleEngagementEmails() {
  if (!ENV.isProduction) {
    console.log("[Engagement Email] Skipping cron schedule in development mode.");
    return;
  }

  // Daily reminder — weekdays at 7:30 AM
  cron.schedule("30 7 * * 1-5", () => {
    sendDailyReminders().catch((err) =>
      console.error("[Engagement Email] Unhandled error in daily reminder:", err)
    );
  });

  // Weekly review — Friday at 5:00 PM
  cron.schedule("0 17 * * 5", () => {
    sendWeeklyReview().catch((err) =>
      console.error("[Engagement Email] Unhandled error in weekly review:", err)
    );
  });

  console.log("[Engagement Email] Scheduled — daily 7:30 AM weekdays, weekly review Friday 5:00 PM");
}

export { sendDailyReminders, sendWeeklyReview };
