/**
 * WWLD Weekly Data Backup
 *
 * Runs every Sunday at 11:00 PM server time.
 * Exports all wwld_sessions data as a CSV and emails it to BACKUP_EMAIL.
 *
 * Setup required (Railway env vars):
 *   SMTP_USER   — Gmail address to send from (e.g., synapse.backup@gmail.com)
 *   SMTP_PASS   — Gmail App Password (Settings > Security > App Passwords)
 *   BACKUP_EMAIL — Where to send the backup (defaults to ADMIN_EMAIL)
 *
 * If SMTP_USER or SMTP_PASS are not set, the job logs a warning and skips.
 */

import cron from "node-cron";
import nodemailer from "nodemailer";
import { getDb } from "./db";
import { wwldSessions } from "../shared/schema";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "No data";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

async function runBackup() {
  console.log("[WWLD Backup] Starting weekly backup...");

  if (!ENV.smtpUser || !ENV.smtpPass) {
    console.warn(
      "[WWLD Backup] SMTP_USER or SMTP_PASS not set — skipping email backup. " +
        "Set these in Railway env vars to enable weekly backups."
    );
    return;
  }

  if (!ENV.backupEmail) {
    console.warn("[WWLD Backup] No BACKUP_EMAIL or ADMIN_EMAIL set — skipping.");
    return;
  }

  const db = await getDb();
  if (!db) {
    console.error("[WWLD Backup] Database not available — skipping backup.");
    return;
  }

  try {
    // Join wwld_sessions with users to include email/name for readability
    const rows = await db
      .select({
        id: wwldSessions.id,
        userName: users.name,
        userEmail: users.email,
        sessionDate: wwldSessions.sessionDate,
        sessionType: wwldSessions.sessionType,
        officeVisits: wwldSessions.officeVisits,
        newPatients: wwldSessions.newPatients,
        recall: wwldSessions.recall,
        testResults: wwldSessions.testResults,
        progressExams: wwldSessions.progressExams,
        performanceReviews: wwldSessions.performanceReviews,
        carePlansSigned: wwldSessions.carePlansSigned,
        notes: wwldSessions.notes,
        createdAt: wwldSessions.createdAt,
      })
      .from(wwldSessions)
      .leftJoin(users, eq(wwldSessions.userId, users.id))
      .orderBy(wwldSessions.sessionDate, wwldSessions.userId);

    const csv = toCSV(rows as Record<string, unknown>[]);
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `wwld-backup-${dateStr}.csv`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: ENV.smtpUser,
        pass: ENV.smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"Synapse Backup" <${ENV.smtpUser}>`,
      to: ENV.backupEmail,
      subject: `[Synapse] WWLD Weekly Backup — ${dateStr}`,
      text: [
        `Weekly WWLD stats backup — ${dateStr}`,
        ``,
        `Total records: ${rows.length}`,
        ``,
        `This is an automated backup of all WWLD session data from the Synapse app.`,
        `The CSV attachment contains all historical stats for all users.`,
        ``,
        `Keep this email for your records.`,
      ].join("\n"),
      attachments: [
        {
          filename,
          content: csv,
          contentType: "text/csv",
        },
      ],
    });

    console.log(
      `[WWLD Backup] ✓ Backup sent to ${ENV.backupEmail} — ${rows.length} records, file: ${filename}`
    );
  } catch (err) {
    console.error("[WWLD Backup] Failed:", err);
  }
}

/**
 * Schedule the backup job.
 * Call this once from server startup (index.ts).
 *
 * Schedule: every Sunday at 11:00 PM server time
 * Cron: "0 23 * * 0"
 */
export function scheduleWwldBackup() {
  if (!ENV.isProduction) {
    console.log("[WWLD Backup] Skipping cron schedule in development mode.");
    return;
  }

  cron.schedule("0 23 * * 0", () => {
    runBackup().catch((err) =>
      console.error("[WWLD Backup] Unhandled error in backup job:", err)
    );
  });

  console.log("[WWLD Backup] Weekly backup scheduled — every Sunday at 11:00 PM");
}

// Allow manual trigger via: node -e "require('./wwld-backup').runBackup()"
export { runBackup };
