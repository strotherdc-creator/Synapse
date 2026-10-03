/**
 * Test-only: run fixture DDL under the same advisory lock as startup migrations, so DB test
 * files running in parallel against one throwaway Postgres don't race on CREATE TABLE.
 * Release before calling runMigrations (it takes the lock itself on another connection).
 */
import type { Pool } from "pg";
import { MIGRATIONS_LOCK_KEY } from "../db";

export async function withMigrationLock(pool: Pool, statements: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [MIGRATIONS_LOCK_KEY]);
    try {
      for (const sql of statements) await client.query(sql);
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [MIGRATIONS_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
