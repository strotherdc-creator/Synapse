/**
 * Goals page data access. Every function takes the signed-in doctor's userId from the
 * tRPC context. Callers never pass a userId from the client (no IDOR surface).
 */
import { and, eq, sql } from "drizzle-orm";
import { doctorGoals, users } from "../../shared/schema";
import { getCentralDateKey, getDb, getWwldTotalsForRange } from "../db";
import { DEFAULT_WEEKS_WORKED, isValidWorkDays } from "../../shared/goals";

export type GoalsDto = {
  goalYear: number;
  yearlyRevenue: number | null;
  yearlyOfficeVisits: number | null;
  yearlyNewPatients: number | null;
  weeksWorked: number;
  updatedAt: string | null;
};

export type SaveGoalsInput = {
  goalYear: number;
  yearlyRevenue: number | null;
  yearlyOfficeVisits: number | null;
  yearlyNewPatients: number | null;
  weeksWorked: number;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** The doctor's saved goals for a year, or null when nothing is saved yet (page starts empty). */
export async function getGoals(userId: number, goalYear: number): Promise<GoalsDto | null> {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(doctorGoals)
    .where(and(eq(doctorGoals.userId, userId), eq(doctorGoals.goalYear, goalYear)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    goalYear: row.goalYear,
    yearlyRevenue: row.yearlyRevenue,
    yearlyOfficeVisits: row.yearlyOfficeVisits,
    yearlyNewPatients: row.yearlyNewPatients,
    weeksWorked: row.weeksWorked ?? DEFAULT_WEEKS_WORKED,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Insert or update the single (doctor, year) row. Only ever touches this doctor's row. */
export async function saveGoals(userId: number, input: SaveGoalsInput): Promise<GoalsDto> {
  const db = await requireDb();
  const values = {
    yearlyRevenue: input.yearlyRevenue,
    yearlyOfficeVisits: input.yearlyOfficeVisits,
    yearlyNewPatients: input.yearlyNewPatients,
    weeksWorked: input.weeksWorked,
  };
  await db
    .insert(doctorGoals)
    .values({ userId, goalYear: input.goalYear, ...values })
    .onConflictDoUpdate({
      target: [doctorGoals.userId, doctorGoals.goalYear],
      set: { ...values, updatedAt: sql`NOW()` },
    });
  const saved = await getGoals(userId, input.goalYear);
  if (!saved) throw new Error("Goals save did not persist");
  return saved;
}

/**
 * Update only this doctor's clinic schedule (users.work_days, the same field as
 * Profile → Practice Schedule). No other user column is touched.
 */
export async function saveClinicDays(userId: number, workDays: string): Promise<void> {
  if (!isValidWorkDays(workDays)) throw new Error("Invalid clinic schedule");
  const db = await requireDb();
  await db.update(users).set({ workDays, updatedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * "This year so far": office visits and new patients actually logged in Log Stats
 * (wwld_sessions) from Jan 1 through today (Central, same clock as Log Stats) or Dec 31.
 * Includes past-days (backlog) totals, because those are real logged numbers.
 */
export async function getYearProgress(userId: number, goalYear: number) {
  const today = getCentralDateKey();
  const todayYear = Number(today.slice(0, 4));
  if (goalYear > todayYear) {
    return { asOf: today, officeVisits: 0, newPatients: 0, hasData: false };
  }
  const end = goalYear < todayYear ? `${goalYear}-12-31` : today;
  const { totals, dailyBreakdown } = await getWwldTotalsForRange(userId, `${goalYear}-01-01`, end, false);
  return {
    asOf: today,
    officeVisits: totals.officeVisits,
    newPatients: totals.newPatients,
    hasData: dailyBreakdown.length > 0,
  };
}
