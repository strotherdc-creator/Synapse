/**
 * Real-Postgres checks for the Goals page. Runs only with TEST_DATABASE_URL pointing at a
 * THROWAWAY database. Never point this at production.
 */
import { beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("Goals against real Postgres", () => {
  let goals: typeof import("./goals/goals");
  let pg: import("pg").Pool;
  const base = 800_000 + Math.floor(Math.random() * 90_000);

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
    ]);
    const db = await import("./db");
    await db.runMigrations([]);
    await db.runMigrations([]); // idempotent
    goals = await import("./goals/goals");
  }, 30_000);

  it("one row per doctor per year; saving again updates it; doctors never see each other's goals", async () => {
    const a = base + 1;
    const b = base + 2;
    expect(await goals.getGoals(a, 2026)).toBeNull();
    await goals.saveGoals(a, { goalYear: 2026, yearlyRevenue: 600_000, yearlyOfficeVisits: 12_000, yearlyNewPatients: 400, weeksWorked: 50 });
    const saved = await goals.saveGoals(a, { goalYear: 2026, yearlyRevenue: 650_000, yearlyOfficeVisits: null, yearlyNewPatients: 400, weeksWorked: 48 });
    expect(saved).toMatchObject({ yearlyRevenue: 650_000, yearlyOfficeVisits: null, weeksWorked: 48 });
    await goals.saveGoals(a, { goalYear: 2027, yearlyRevenue: 1, yearlyOfficeVisits: 1, yearlyNewPatients: 1, weeksWorked: 50 });
    const rows = await pg.query(`SELECT goal_year FROM doctor_goals WHERE user_id=$1 ORDER BY goal_year`, [a]);
    expect(rows.rows.map((r) => r.goal_year)).toEqual([2026, 2027]);
    expect(await goals.getGoals(b, 2026)).toBeNull();
    await expect(
      pg.query(`INSERT INTO doctor_goals (user_id, goal_year) VALUES ($1, 2026)`, [a])
    ).rejects.toThrow(/doctor_goals_user_year_key/);
  });

  it("schedule + goals save in one transaction and change only that doctor's work_days", async () => {
    const one = await pg.query(`INSERT INTO users (clerk_id, name, bio) VALUES ($1, 'One', 'bio1') RETURNING id`, [`g-${base}-1`]);
    const two = await pg.query(`INSERT INTO users (clerk_id, name, bio) VALUES ($1, 'Two', 'bio2') RETURNING id`, [`g-${base}-2`]);
    const id1 = one.rows[0].id;
    const sched = "mon:full,tue:half,wed:off,thu:full,fri:half,sat:off,sun:off";
    await goals.saveGoals(id1, { goalYear: 2026, yearlyRevenue: 1000, yearlyOfficeVisits: 10, yearlyNewPatients: 1, weeksWorked: 50, workDays: sched });
    const after = await pg.query(`SELECT id, name, bio, work_days FROM users WHERE id = ANY($1) ORDER BY id`, [[id1, two.rows[0].id]]);
    expect(after.rows[0]).toMatchObject({ name: "One", bio: "bio1", work_days: sched });
    expect(after.rows[1]).toMatchObject({ name: "Two", bio: "bio2", work_days: "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off" });
    expect((await goals.getGoals(id1, 2026))?.yearlyRevenue).toBe(1000);

    // If the goals write fails, the schedule change rolls back with it (all-or-nothing).
    const other = "mon:off,tue:off,wed:off,thu:off,fri:off,sat:full,sun:full";
    await expect(
      goals.saveGoals(id1, { goalYear: 2026, yearlyRevenue: 2000, yearlyOfficeVisits: 10, yearlyNewPatients: 1, weeksWorked: null as unknown as number, workDays: other })
    ).rejects.toThrow();
    expect((await pg.query(`SELECT work_days FROM users WHERE id=$1`, [id1])).rows[0].work_days).toBe(sched);
    expect((await goals.getGoals(id1, 2026))?.yearlyRevenue).toBe(1000);

    await expect(goals.saveGoals(id1, { goalYear: 2026, yearlyRevenue: 1, yearlyOfficeVisits: 1, yearlyNewPatients: 1, weeksWorked: 50, workDays: "mon:full" })).rejects.toThrow();
  });

  it("weekly backup query includes every doctor's goals", async () => {
    const { fetchDoctorGoalsBackupRows } = await import("./wwld-backup");
    const db = await (await import("./db")).getDb();
    const rows = await fetchDoctorGoalsBackupRows(db!);
    const mine = rows.filter((r) => r.userId === base + 1);
    expect(mine.map((r) => r.goalYear)).toEqual([2026, 2027]);
    expect(mine[0]).toMatchObject({ yearlyRevenue: 650_000, weeksWorked: 48 });
  });

  it("concurrent startup migrations serialize on the advisory lock and release it", async () => {
    const db = await import("./db");
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => db.runMigrations([])));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    // Released: another session can take it. (Another test file may briefly hold it while it
    // migrates in parallel, so wait for it with a bound instead of asserting "nobody holds it now".)
    const client = await pg.connect();
    try {
      await client.query(`SET lock_timeout = '10s'`);
      await client.query(`SELECT pg_advisory_lock($1)`, [db.MIGRATIONS_LOCK_KEY]);
      await client.query(`SELECT pg_advisory_unlock($1)`, [db.MIGRATIONS_LOCK_KEY]);
    } finally {
      client.release();
    }
  });

  it("year progress sums only that doctor's logged visits and new patients for the year", async () => {
    const a = base + 3;
    await pg.query(
      `INSERT INTO wwld_sessions (user_id, session_date, session_type, office_visits, new_patients) VALUES
       ($1,'2025-12-31','end_of_day',99,9), ($1,'2026-01-05','morning',20,1), ($1,'2026-01-05','afternoon',15,2),
       ($2,'2026-01-05','morning',500,50)`,
      [a, a + 1]
    );
    const p = await goals.getYearProgress(a, 2026);
    expect(p).toMatchObject({ officeVisits: 35, newPatients: 3, hasData: true });
    // Today isn't counted until it's over (matches the pace target)
    await pg.query(`INSERT INTO wwld_sessions (user_id, session_date, session_type, office_visits, new_patients) VALUES ($1,$2,'morning',7,7)`, [a, p.asOf]);
    expect(await goals.getYearProgress(a, 2026)).toMatchObject({ officeVisits: 35, newPatients: 3, through: p.through });
    expect((await goals.getYearProgress(a + 7, 2026)).hasData).toBe(false);
  });
});
