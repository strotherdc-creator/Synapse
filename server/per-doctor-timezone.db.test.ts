/**
 * Real-Postgres checks for the per-doctor time zone. Runs only with TEST_DATABASE_URL pointing
 * at a THROWAWAY database. Never point this at production.
 */
import { beforeAll, describe, expect, it } from "vitest";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("per-doctor time zone against real Postgres", () => {
  let pg: import("pg").Pool;
  let db: typeof import("./db");
  const base = 800_000 + Math.floor(Math.random() * 90_000);

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
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
    const tz = ENGAGEMENT_MIGRATIONS.filter((m) => m.includes("users ADD COLUMN IF NOT EXISTS timezone"));
    expect(tz).toHaveLength(1);
    await db.runMigrations(tz);
    await db.runMigrations(tz); // idempotent
  }, 30_000);

  it("users.timezone is nullable with no default (no backfill of existing rows)", async () => {
    const col = await pg.query(
      `SELECT is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_name='users' AND column_name='timezone'`,
    );
    expect(col.rows).toEqual([{ is_nullable: "YES", column_default: null, character_maximum_length: 64 }]);
  });

  it("auto-detect fills an unset zone once and never overwrites a hand-picked one", async () => {
    const id = base + 1;
    await pg.query(`INSERT INTO users (id, clerk_id, name) VALUES ($1, $2, 'Dr Test')`, [id, `tz_${id}`]);
    expect(await db.setUserTimeZone(id, "Europe/London", true)).toBe(true);
    expect(await db.setUserTimeZone(id, "America/Los_Angeles", true)).toBe(false); // already set
    let r = await pg.query(`SELECT timezone FROM users WHERE id=$1`, [id]);
    expect(r.rows[0].timezone).toBe("Europe/London");
    expect(await db.setUserTimeZone(id, "Australia/Sydney", false)).toBe(true); // manual wins
    r = await pg.query(`SELECT timezone FROM users WHERE id=$1`, [id]);
    expect(r.rows[0].timezone).toBe("Australia/Sydney");
    await expect(db.setUserTimeZone(id, "Mars/Olympus", false)).rejects.toThrow(/Invalid time zone/);
  });

  it("the Lyle quote date SQL (zone bound as a parameter) matches the JS calendar per zone", async () => {
    const servedAt = "2026-10-15 06:30:00"; // stored UTC
    for (const [zone, expected] of [["America/Los_Angeles", "2026-10-14"], ["Europe/London", "2026-10-15"], ["Australia/Sydney", "2026-10-15"]] as const) {
      const r = await pg.query(`SELECT to_char(((($1::timestamp) AT TIME ZONE 'UTC') AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS d`, [servedAt, zone]);
      expect(r.rows[0].d).toBe(expected);
      expect(db.getAppDateKey(new Date("2026-10-15T06:30:00Z"), zone)).toBe(expected);
    }
  });
});
