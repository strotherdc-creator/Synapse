/**
 * Real-Postgres integration tests for Log Stats settings (concurrency, rollback, migrations).
 * Runs only when TEST_DATABASE_URL points at a THROWAWAY database, e.g.
 *   TEST_DATABASE_URL="postgres://postgres@127.0.0.1:55433/postgres?sslmode=disable" pnpm test
 * Never point this at production.
 */
import { beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("Log Stats settings against real Postgres", () => {
  let db: typeof import("./db");
  let ss: typeof import("./wwld/statSettings");
  let pg: import("pg").Pool;
  const base = 900_000 + Math.floor(Math.random() * 90_000);
  let n = 0;
  const newUser = () => base + ++n;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    const { Pool } = await import("pg");
    pg = new Pool({ connectionString: TEST_DB });
    // Minimal pre-feature wwld_sessions table (as on main before this PR) if missing.
    await pg.query(`CREATE TABLE IF NOT EXISTS wwld_sessions (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, session_date VARCHAR(10) NOT NULL,
      session_type VARCHAR(20) NOT NULL, office_visits INTEGER NOT NULL DEFAULT 0,
      new_patients INTEGER NOT NULL DEFAULT 0, test_results INTEGER NOT NULL DEFAULT 0,
      progress_exams INTEGER NOT NULL DEFAULT 0, performance_reviews INTEGER NOT NULL DEFAULT 0,
      care_plans_signed INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, session_date, session_type))`);
    db = await import("./db");
    ss = await import("./wwld/statSettings");
    await db.runMigrations([]);
  }, 30_000);

  const activeCount = async (userId: number) =>
    Number((await pg.query(`SELECT count(*) FROM wwld_custom_stats WHERE user_id=$1 AND archived_at IS NULL`, [userId])).rows[0].count);

  it("10 concurrent saves never leave more than 3 active custom stats", async () => {
    const user = newUser();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        ss.saveStatSettings(user, {
          enabledBuiltinStats: ["officeVisits"],
          customStats: [{ name: `a${i}` }, { name: `b${i}` }, { name: `c${i}` }],
        }),
      ),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await activeCount(user)).toBe(3);
  }, 30_000);

  it("concurrent saves that reference each other's stats stay within the cap and roll back cleanly", async () => {
    const user = newUser();
    const first = await ss.saveStatSettings(user, {
      enabledBuiltinStats: ["officeVisits"],
      customStats: [{ name: "Keep" }],
    });
    const keepId = first.customStats[0].id;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        ss.saveStatSettings(user, {
          enabledBuiltinStats: i % 2 ? ["officeVisits"] : ["newPatients"],
          // even: keep the existing one + 2 new; odd: replace with 3 new (archives "Keep")
          customStats: i % 2
            ? [{ name: `x${i}` }, { name: `y${i}` }, { name: `z${i}` }]
            : [{ id: keepId, name: "Keep" }, { name: `p${i}` }, { name: `q${i}` }],
        }),
      ),
    );
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(ss.StatSettingsError);
    }
    expect(await activeCount(user)).toBeLessThanOrEqual(3);
  }, 30_000);

  it("a rejected save changes nothing (built-in checks included)", async () => {
    const user = newUser();
    await expect(
      ss.saveStatSettings(user, { enabledBuiltinStats: ["officeVisits"], customStats: [{ id: 2_000_000_000, name: "Nope" }] }),
    ).rejects.toBeInstanceOf(ss.StatSettingsError);
    const after = await ss.getStatSettings(user);
    expect(after.hasSavedSettings).toBe(false);
    expect(after.enabledBuiltinStats).toHaveLength(7);
    expect(after.customStats).toHaveLength(0);
  });

  it("a log with an inactive custom stat writes nothing at all", async () => {
    const user = newUser();
    const saved = await ss.saveStatSettings(user, { enabledBuiltinStats: ["officeVisits"], customStats: [{ name: "Old" }] });
    const oldId = saved.customStats[0].id;
    await ss.saveStatSettings(user, { enabledBuiltinStats: ["officeVisits"], customStats: [] });
    await expect(
      ss.logSessionWithCustomStats(
        { userId: user, sessionDate: "2026-10-01", sessionType: "end_of_day", officeVisits: 9 },
        [{ customStatId: oldId, value: 5 }],
      ),
    ).rejects.toBeInstanceOf(ss.StatSettingsError);
    const rows = await pg.query(`SELECT count(*) FROM wwld_sessions WHERE user_id=$1`, [user]);
    expect(Number(rows.rows[0].count)).toBe(0);
  });

  it("untouched custom stats are not stored (no invented zeros)", async () => {
    const user = newUser();
    const saved = await ss.saveStatSettings(user, { enabledBuiltinStats: ["officeVisits"], customStats: [{ name: "A" }, { name: "B" }] });
    await ss.logSessionWithCustomStats(
      { userId: user, sessionDate: "2026-10-01", sessionType: "end_of_day", officeVisits: 3 },
      [{ customStatId: saved.customStats[0].id, value: 4 }],
    );
    const vals = await ss.getCustomStatValuesForDate(user, "2026-10-01");
    expect(vals).toEqual([{ customStatId: saved.customStats[0].id, sessionType: "end_of_day", value: 4 }]);
  });

  it("runMigrations is idempotent and rejects (instead of swallowing) a failing statement", async () => {
    await expect(db.runMigrations([])).resolves.toBeUndefined();
    await expect(db.runMigrations(["SELECT * FROM table_that_does_not_exist_for_test"])).rejects.toThrow(/1 of \d+ migration\(s\) failed/);
  });
});
