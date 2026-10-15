/**
 * Reminder send-log against a THROWAWAY Postgres (TEST_DATABASE_URL only; never production).
 * One row per (user_id, kind, local_date) is claimed BEFORE sending; only the claimer sends.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;
const sent: string[] = [];
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string }) => {
        await new Promise((r) => setTimeout(r, 5));
        if (m.to.startsWith("bounce")) throw new Error("550 mailbox unavailable");
        sent.push(m.to);
      },
    }),
  },
}));

describe.skipIf(!TEST_DB)("reminder send-log against real Postgres", () => {
  let pg: import("pg").Pool;
  let db: typeof import("./db");
  let reminders: typeof import("./engagement/email-reminders");
  const base = 600_000 + Math.floor(Math.random() * 90_000);
  const id = (n: number) => base + n;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.SMTP_USER = "qc@example.com";
    process.env.SMTP_PASS = "x";
    const { Pool } = await import("pg");
    pg = new Pool({ connectionString: TEST_DB });
    const { withMigrationLock } = await import("./test-utils/pgFixture");
    await withMigrationLock(pg, [
      `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, clerk_id VARCHAR(255) NOT NULL UNIQUE, name TEXT, email VARCHAR(320), bio TEXT,
      work_days VARCHAR(100) DEFAULT 'mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off',
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL)`,
    ]);
    db = await import("./db");
    const { ENGAGEMENT_MIGRATIONS } = await import("./engagement/migrations");
    await db.runMigrations(ENGAGEMENT_MIGRATIONS);
    await db.runMigrations(ENGAGEMENT_MIGRATIONS); // idempotent
    reminders = await import("./engagement/email-reminders");

    const people: [number, string, string | null][] = [
      [1, "la-ok", "America/Los_Angeles"],
      [2, "bounce", "America/Los_Angeles"],
      [3, "la-after-bounce", "America/Los_Angeles"],
      [4, "london", "Europe/London"],
    ];
    for (const [n, who, tz] of people) {
      await pg.query(`INSERT INTO users (id, clerk_id, name, timezone) VALUES ($1, $2, $3, $4)`, [id(n), `c_${id(n)}`, `Dr ${who}`, tz]);
      await pg.query(`INSERT INTO user_engagement_preferences (user_id, email_enabled, email_address) VALUES ($1, TRUE, $2)`, [id(n), `${who}-${base}@example.com`]);
    }
  }, 60_000);

  it("creates reminder_send_log with UNIQUE(user_id, kind, local_date)", async () => {
    const r = await pg.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'reminder_send_log'::regclass AND contype = 'u'`);
    expect(r.rows.map((x) => x.def)).toContain("UNIQUE (user_id, kind, local_date)");
  });

  it("only one of many concurrent claims wins", async () => {
    const database = (await db.getDb())!;
    const results = await Promise.all(Array.from({ length: 8 }, () => reminders.claimReminderSend(database, id(99), "daily", "2026-10-15")));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await reminders.claimReminderSend(database, id(99), "weekly", "2026-10-15")).toBe(true); // other kind
    expect(await reminders.claimReminderSend(database, id(99), "daily", "2026-10-16")).toBe(true); // other day
  });

  it("two overlapping ticks send each doctor once; a bounce doesn't stop the others", async () => {
    const tick = new Date("2026-10-15T14:30:00Z"); // Thu: 7:30 AM in LA, 3:30 PM in London
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await Promise.all([reminders.sendDailyReminders(tick), reminders.sendDailyReminders(tick)]);
    await reminders.sendDailyReminders(tick); // a restart re-running the same tick
    errors.mockRestore();
    const mine = sent.filter((to) => to.endsWith(`-${base}@example.com`));
    expect(mine.sort()).toEqual([`la-after-bounce-${base}@example.com`, `la-ok-${base}@example.com`]);
    const log = await pg.query(`SELECT user_id, kind, local_date FROM reminder_send_log WHERE user_id = ANY($1) ORDER BY user_id`, [[id(1), id(2), id(3), id(4)]]);
    expect(log.rows).toEqual([
      { user_id: id(1), kind: "daily", local_date: "2026-10-15" },
      { user_id: id(2), kind: "daily", local_date: "2026-10-15" }, // claimed, send failed: never retried as a duplicate
      { user_id: id(3), kind: "daily", local_date: "2026-10-15" },
    ]);
  });
});
