/**
 * Engagement Email Reminders
 *
 * Sends a daily morning email with today's growth plan actions
 * and a Friday weekly stat report (this week vs the doctor's goals).
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
import { getGoalsComparison } from "../goals/goals";
import { buildWeeklyStatEmail } from "./weekly-stat-email";
import { resolveTimeZone, weekdayShort, zonedClock } from "../../shared/appTime";

/** How often the reminder job wakes up. Every zone offset in use is a multiple of 15 minutes. */
export const REMINDER_TICK_MINUTES = 15;
export const DAILY_REMINDER = { minutes: 7 * 60 + 30, weekdays: [1, 2, 3, 4, 5] } as const; // 7:30 AM Mon–Fri
export const WEEKLY_REVIEW = { minutes: 17 * 60, weekdays: [5] } as const; // 5:00 PM Friday

/**
 * True when `now` falls in the [target, target + tick) window of the doctor's own local
 * clock on one of the given weekdays (0 = Sunday). Each doctor matches exactly one tick per
 * day, so an every-15-minutes job sends each email once at that doctor's local time.
 */
export function isLocalSendWindow(
  now: Date,
  zone: string | null | undefined,
  rule: { minutes: number; weekdays: readonly number[] },
  tickMinutes = REMINDER_TICK_MINUTES,
): boolean {
  const clock = zonedClock(now, resolveTimeZone(zone));
  if (!rule.weekdays.includes(clock.weekday)) return false;
  return clock.minutes >= rule.minutes && clock.minutes < rule.minutes + tickMinutes;
}

export type ReminderKind = "daily" | "weekly";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Claim one reminder send in reminder_send_log BEFORE sending. Returns true only for the one
 * process whose insert succeeded; any duplicate (overlapping deploy, restart, second replica)
 * gets false and must not send.
 */
export async function claimReminderSend(db: Db, userId: number, kind: ReminderKind, localDate: string): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO reminder_send_log (user_id, kind, local_date)
    VALUES (${userId}, ${kind}, ${localDate})
    ON CONFLICT (user_id, kind, local_date) DO NOTHING
    RETURNING id`);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? (Array.isArray(result) ? result : []);
  return rows.length > 0;
}

/** Email-enabled doctors with their user row, in ONE query (no per-doctor lookups). */
async function loadReminderRecipients(db: Db) {
  return db
    .select({
      userId: userEngagementPreferences.userId,
      emailAddress: userEngagementPreferences.emailAddress,
      quietDays: userEngagementPreferences.quietDays,
      name: users.name,
      clerkId: users.clerkId,
      workDays: users.workDays,
      timezone: users.timezone,
    })
    .from(userEngagementPreferences)
    .innerJoin(users, eq(users.id, userEngagementPreferences.userId))
    .where(eq(userEngagementPreferences.emailEnabled, true));
}

type Recipient = Awaited<ReturnType<typeof loadReminderRecipients>>[number];

function inPilot(r: Recipient): boolean {
  return ENV.engagementPilotClerkIds.length === 0 || ENV.engagementPilotClerkIds.includes(r.clerkId);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
  });
  return transporter;
}

/**
 * Shared per-tick loop: picks recipients whose local time matches `rule`, claims the send in
 * the log, then sends. Each recipient has its own try/catch so one bad address can't stop the rest.
 */
async function runReminderTick(
  kind: ReminderKind,
  rule: { minutes: number; weekdays: readonly number[] },
  now: Date,
  buildMail: (db: Db, r: Recipient, localDate: string) => Promise<{ subject: string; text: string; html?: string } | null>,
) {
  if (!ENV.smtpUser || !ENV.smtpPass) {
    console.warn(`[Engagement Email] SMTP not configured — skipping ${kind}.`);
    return;
  }
  const db = await getDb();
  if (!db) {
    console.error(`[Engagement Email] Database not available — skipping ${kind}.`);
    return;
  }

  let recipients: Recipient[];
  try {
    recipients = await loadReminderRecipients(db);
  } catch (err) {
    console.error(`[Engagement Email] Could not load ${kind} recipients:`, err);
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      if (!r.emailAddress || !inPilot(r)) continue;
      const zone = resolveTimeZone(r.timezone);
      if (!isLocalSendWindow(now, zone, rule)) continue;
      const localDate = zonedClock(now, zone).dateKey;
      if (kind === "daily" && r.quietDays && r.quietDays.split(",").includes(weekdayShort(localDate))) continue;

      const mail = await buildMail(db, r, localDate);
      if (!mail) continue;
      // Claim first; only the process that inserted the row sends.
      if (!(await claimReminderSend(db, r.userId, kind, localDate))) continue;

      await getTransporter().sendMail({ from: `"Synapse Growth" <${ENV.smtpUser}>`, to: r.emailAddress, ...mail });
      sent++;
    } catch (err) {
      failed++;
      console.error(`[Engagement Email] ${kind} send failed for user ${r.userId}:`, err instanceof Error ? err.message : err);
    }
  }
  if (sent > 0 || failed > 0) console.log(`[Engagement Email] ${kind}: sent ${sent}, failed ${failed}.`);
}

async function sendDailyReminders(now: Date = new Date()) {
  if (!isEngagementEnabled("email")) return; // flag off (checked every tick; stay quiet)
  await runReminderTick("daily", DAILY_REMINDER, now, async (db, r, today) => {
    const plan = await db
      .select()
      .from(dailyGrowthPlans)
      .where(and(eq(dailyGrowthPlans.userId, r.userId), eq(dailyGrowthPlans.planDate, today)))
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

    return {
      subject: `Your Growth Plan for Today — ${today}`,
      text: [
        `Good morning, ${r.name || "Doctor"}!`,
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
    };
  });
}

async function sendWeeklyReview(now: Date = new Date()) {
  if (!isEngagementEnabled("weeklyReview")) return; // flag off (checked every tick; stay quiet)
  await runReminderTick("weekly", WEEKLY_REVIEW, now, async (_db, r) => {
    // Same numbers as the Goals page: this week (Mon–Sun, doctor's own calendar) vs the week's goal.
    const comparison = await getGoalsComparison(r.userId, r.workDays, undefined, r.timezone);
    return buildWeeklyStatEmail({ name: r.name, comparison });
  });
}

/**
 * Schedule engagement email jobs.
 * Call once from server startup.
 *
 * One job every 15 minutes (UTC). Each run picks the doctors whose OWN local time is
 * 7:30 AM on a weekday (daily reminder) or 5:00 PM Friday (weekly review).
 */
export function scheduleEngagementEmails() {
  if (!ENV.isProduction) {
    console.log("[Engagement Email] Skipping cron schedule in development mode.");
    return;
  }

  cron.schedule(`*/${REMINDER_TICK_MINUTES} * * * *`, () => {
    const now = new Date();
    sendDailyReminders(now).catch((err) =>
      console.error("[Engagement Email] Unhandled error in daily reminder:", err)
    );
    sendWeeklyReview(now).catch((err) =>
      console.error("[Engagement Email] Unhandled error in weekly review:", err)
    );
  }, { timezone: "UTC" });

  console.log("[Engagement Email] Scheduled — every 15 min; daily 7:30 AM weekdays and weekly review Friday 5:00 PM in each doctor's own time zone");
}

export { sendDailyReminders, sendWeeklyReview };
