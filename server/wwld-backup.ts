/**
 * WWLD Weekly Data Backup
 *
 * Runs every Sunday at 11:00 PM server time.
 * Exports all wwld_sessions data and all doctor_goals (Goals page) as CSVs and emails them to BACKUP_EMAIL.
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
import { doctorGoals, wwldSessions } from "../shared/schema";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./_core/env";

/** Plain numbers (e.g. -5, 12.5) are data, not formulas, so they stay as numbers in the spreadsheet. */
const PURE_NUMBER = /^-?\d+(\.\d+)?$/;
/** Leading characters Excel / Sheets / LibreOffice treat as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Neutralize spreadsheet formula injection (CSV injection): a cell that starts with
 * =, +, -, @, tab or CR gets a leading apostrophe so the spreadsheet shows it as text
 * instead of running it. Doctor-entered text (names, notes, custom stat names) ends up in
 * these backups, so this matters.
 *
 * Choice: pure numeric values such as -5 or -12.5 (a JS number, or a string that is only an
 * optional minus sign and digits) are left unprefixed. A bare number can't run anything, and
 * prefixing would turn real negative numbers into text. Anything else starting with "-",
 * like "-5+1" or "-cmd", is prefixed.
 */
export function neutralizeFormula(value: unknown): string {
  const s = String(value ?? "");
  if (typeof value === "number" || typeof value === "bigint") return s;
  if (PURE_NUMBER.test(s)) return s;
  return FORMULA_START.test(s) ? `'${s}` : s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "No data";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = neutralizeFormula(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

type BackupDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Every doctor's saved yearly goals, with name/email for readability (Goals page backup). */
export async function fetchDoctorGoalsBackupRows(db: BackupDb) {
  return db
    .select({
      id: doctorGoals.id,
      userId: doctorGoals.userId,
      userName: users.name,
      userEmail: users.email,
      goalYear: doctorGoals.goalYear,
      yearlyRevenue: doctorGoals.yearlyRevenue,
      yearlyOfficeVisits: doctorGoals.yearlyOfficeVisits,
      yearlyNewPatients: doctorGoals.yearlyNewPatients,
      weeksWorked: doctorGoals.weeksWorked,
      clinicDays: users.workDays,
      createdAt: doctorGoals.createdAt,
      updatedAt: doctorGoals.updatedAt,
    })
    .from(doctorGoals)
    .leftJoin(users, eq(doctorGoals.userId, users.id))
    .orderBy(doctorGoals.userId, doctorGoals.goalYear);
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
        // Blank cell = Collections not logged (NULL), never $0.
        collections: wwldSessions.collections,
        notes: wwldSessions.notes,
        createdAt: wwldSessions.createdAt,
      })
      .from(wwldSessions)
      .leftJoin(users, eq(wwldSessions.userId, users.id))
      .orderBy(wwldSessions.sessionDate, wwldSessions.userId);

    const csv = toCSV(rows as Record<string, unknown>[]);
    const goalRows = await fetchDoctorGoalsBackupRows(db);
    const goalsCsv = toCSV(goalRows as Record<string, unknown>[]);
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `wwld-backup-${dateStr}.csv`;
    const goalsFilename = `doctor-goals-backup-${dateStr}.csv`;

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
        `Doctor goals (Goals page): ${goalRows.length} row(s), in ${goalsFilename}`,
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
        {
          filename: goalsFilename,
          content: goalsCsv,
          contentType: "text/csv",
        },
      ],
    });

    console.log(
      `[WWLD Backup] ✓ Backup sent to ${ENV.backupEmail} — ${rows.length} records, ${goalRows.length} goal rows, files: ${filename}, ${goalsFilename}`
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
