/**
 * Real-Postgres checks for Goals vs Log Stats + the Collections column. Runs only with
 * TEST_DATABASE_URL pointing at a THROWAWAY database. Never point this at production.
 */
import { beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("Goals vs Log Stats against real Postgres", () => {
  let pg: import("pg").Pool;
  let db: typeof import("./db");
  let goals: typeof import("./goals/goals");
  let statSettings: typeof import("./wwld/statSettings");
  const base = 700_000 + Math.floor(Math.random() * 90_000);
  const legacyUser = base + 1;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { Pool } = await import("pg");
    pg = new Pool({ connectionString: TEST_DB });
    const { withMigrationLock } = await import("./test-utils/pgFixture");
    await withMigrationLock(pg, [
      `CREATE TABLE IF NOT EXISTS wwld_sessions (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, session_date VARCHAR(10) NOT NULL,
      session_type VARCHAR(20) NOT NULL, office_visits INTEGER NOT NULL DEFAULT 0,
      new_patients INTEGER NOT NULL DEFAULT 0, test_results INTEGER NOT NULL DEFAULT 0,
      progress_exams INTEGER NOT NULL DEFAULT 0, performance_reviews INTEGER NOT NULL DEFAULT 0,
      care_plans_signed INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, session_date, session_type))`,
      `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, clerk_id VARCHAR(255) NOT NULL UNIQUE, name TEXT, email VARCHAR(320), bio TEXT,
      work_days VARCHAR(100) DEFAULT 'mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off',
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL)`,
      // A row saved before the Collections column existed (only the original columns).
      `INSERT INTO wwld_sessions (user_id, session_date, session_type, office_visits, new_patients)
       VALUES (${legacyUser}, '2026-02-02', 'end_of_day', 31, 2) ON CONFLICT DO NOTHING`,
    ]);
    db = await import("./db");
    await db.runMigrations([]);
    await db.runMigrations([]); // twice: idempotent
    goals = await import("./goals/goals");
    statSettings = await import("./wwld/statSettings");
  }, 30_000);

  it("adds a nullable collections column with no default; old rows read NULL (not logged)", async () => {
    const col = await pg.query(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='wwld_sessions' AND column_name='collections'`,
    );
    expect(col.rows).toEqual([{ data_type: "integer", is_nullable: "YES", column_default: null }]);
    const legacy = await pg.query(`SELECT collections FROM wwld_sessions WHERE user_id=$1`, [legacyUser]);
    expect(legacy.rows[0].collections).toBeNull();
    const again = await pg.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='wwld_sessions' AND column_name='collections'`);
    expect(again.rows[0].n).toBe(1);
  });

  it("logs Collections, leaves it NULL when omitted, and compares it as revenue", async () => {
    const user = base + 2;
    const today = db.getAppDateKey();
    await statSettings.logSessionWithCustomStats({ userId: user, sessionDate: today, sessionType: "morning", officeVisits: 20, newPatients: 1, collections: 3_000 });
    await statSettings.logSessionWithCustomStats({ userId: user, sessionDate: today, sessionType: "afternoon", officeVisits: 15 });
    const rows = await pg.query(`SELECT session_type, collections, tracked_stats FROM wwld_sessions WHERE user_id=$1 ORDER BY session_type`, [user]);
    expect(rows.rows).toEqual([
      { session_type: "afternoon", collections: null, tracked_stats: "officeVisits" },
      { session_type: "morning", collections: 3000, tracked_stats: "officeVisits,newPatients,collections" },
    ]);

    // No goals yet → "No goal set", never a guess.
    let c = await goals.getGoalsComparison(user, "mon:full,tue:full,wed:full,thu:full,fri:full,sat:full,sun:full");
    expect(c.hasGoals).toBe(false);
    expect(c.periods[0].metrics.every((m) => m.result.status === "no_goal")).toBe(true);

    const year = Number(today.slice(0, 4));
    await goals.saveGoals(user, { goalYear: year, yearlyRevenue: 1_400_000, yearlyOfficeVisits: 14_000, yearlyNewPatients: 700, weeksWorked: 50 });
    c = await goals.getGoalsComparison(user, "mon:full,tue:full,wed:full,thu:full,fri:full,sat:full,sun:full");
    const day = c.periods.find((p) => p.period === "day")!;
    // 14,000 ÷ (7 × 50 = 350 days) = 40 visits a day; revenue 4,000 a day.
    expect(day.metrics.find((m) => m.metric === "officeVisits")!.result).toMatchObject({ status: "compared", actual: 35, goal: 40, diff: -5 });
    expect(day.metrics.find((m) => m.metric === "revenue")!.result).toMatchObject({ status: "compared", actual: 3_000, goal: 4_000, diff: -1_000 });

    // Uncheck Collections → "Not tracked in Log Stats", not −100%.
    await pg.query(
      `INSERT INTO wwld_stat_settings (user_id, hidden_builtin_stats) VALUES ($1, 'collections')
       ON CONFLICT (user_id) DO UPDATE SET hidden_builtin_stats = 'collections'`,
      [user],
    );
    c = await goals.getGoalsComparison(user, "mon:full,tue:full,wed:full,thu:full,fri:full,sat:full,sun:full");
    expect(c.periods.every((p) => p.metrics.find((m) => m.metric === "revenue")!.result.status === "not_tracked")).toBe(true);
  });

  it("history never shows a made-up $0 for Collections", async () => {
    const h = await statSettings.getStatsHistoryForYear(legacyUser, 2026);
    const s = h.days.find((d) => d.date === "2026-02-02")!.sessions[0];
    expect(s.builtin.officeVisits).toBe(31);
    expect("collections" in s.builtin).toBe(false);
  });

  it("totals for a range keep Collections null when nothing was entered", async () => {
    const t = await db.getWwldTotalsForRange(legacyUser, "2026-01-01", "2026-12-31");
    expect(t.totals.collections).toBeNull();
    expect(t.totals.officeVisits).toBe(31);
  });

  it("Collections can be cleared back to 'not logged': save $500 → clear → reload shows Not logged", async () => {
    const user = base + 5;
    const today = db.getAppDateKey();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: { id: user, clerkId: `clerk_${user}`, email: null, name: "Doc", role: "user", workDays: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as never,
      res: {} as never,
    } as never);
    await caller.wwld.logSession({ sessionDate: today, sessionType: "morning", officeVisits: 10, collections: 500 });
    expect((await pg.query(`SELECT collections FROM wwld_sessions WHERE user_id=$1`, [user])).rows[0].collections).toBe(500);

    // The form sends null for an emptied box; the server writes NULL (other stats untouched).
    await caller.wwld.logSession({ sessionDate: today, sessionType: "morning", officeVisits: 10, collections: null });
    const row = (await pg.query(`SELECT collections, office_visits FROM wwld_sessions WHERE user_id=$1`, [user])).rows[0];
    expect(row).toEqual({ collections: null, office_visits: 10 });

    // Reload: history, totals and the goals comparison all read "not logged", never $500 or $0.
    const year = Number(today.slice(0, 4));
    const h = await statSettings.getStatsHistoryForYear(user, year);
    expect("collections" in h.days.find((d) => d.date === today)!.sessions[0].builtin).toBe(false);
    expect((await caller.wwld.getToday({ date: today })).totals.collections).toBeNull();
    await goals.saveGoals(user, { goalYear: year, yearlyRevenue: 500_000, yearlyOfficeVisits: 5_000, yearlyNewPatients: 100, weeksWorked: 50 });
    const c = await goals.getGoalsComparison(user, "mon:full,tue:full,wed:full,thu:full,fri:full,sat:full,sun:full");
    expect(c.periods.find((p) => p.period === "day")!.metrics.find((m) => m.metric === "revenue")!.result.status).toBe("no_stats");

    // Omitting collections leaves a saved value alone (only an explicit null clears).
    await caller.wwld.logSession({ sessionDate: today, sessionType: "morning", officeVisits: 11, collections: 700 });
    await caller.wwld.logSession({ sessionDate: today, sessionType: "morning", officeVisits: 12 });
    expect((await pg.query(`SELECT collections FROM wwld_sessions WHERE user_id=$1`, [user])).rows[0].collections).toBe(700);
  });
});
