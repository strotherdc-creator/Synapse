/**
 * Goals page data access. Every function takes the signed-in doctor's userId from the
 * tRPC context. Callers never pass a userId from the client (no IDOR surface).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { doctorGoals, users, wwldSessions } from "../../shared/schema";
import { getAppDateKey, getDb, getWwldTotalsForRange } from "../db";
import { DEFAULT_WEEKS_WORKED, isValidWorkDays, progressThroughDate } from "../../shared/goals";
import { mondayDateKey } from "../../shared/appTime";
import { buildGoalsComparison, type GoalsComparison } from "../../shared/goalsComparison";
import { getStatSettings } from "../wwld/statSettings";

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
  /** Optional clinic schedule (users.work_days). Saved in the same transaction as the goals. */
  workDays?: string;
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

/**
 * Insert or update the single (doctor, year) row and, when given, the doctor's clinic schedule,
 * in ONE transaction: either both are saved or neither is. Only ever touches this doctor's rows.
 * The schedule is users.work_days (same field as Profile → Practice Schedule); no other user
 * column changes.
 */
export async function saveGoals(userId: number, input: SaveGoalsInput): Promise<GoalsDto> {
  if (input.workDays !== undefined && !isValidWorkDays(input.workDays)) {
    throw new Error("Invalid clinic schedule");
  }
  const db = await requireDb();
  const values = {
    yearlyRevenue: input.yearlyRevenue,
    yearlyOfficeVisits: input.yearlyOfficeVisits,
    yearlyNewPatients: input.yearlyNewPatients,
    weeksWorked: input.weeksWorked,
  };
  await db.transaction(async (tx) => {
    if (input.workDays !== undefined) {
      await tx.update(users).set({ workDays: input.workDays, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    await tx
      .insert(doctorGoals)
      .values({ userId, goalYear: input.goalYear, ...values })
      .onConflictDoUpdate({
        target: [doctorGoals.userId, doctorGoals.goalYear],
        set: { ...values, updatedAt: sql`NOW()` },
      });
  });
  const saved = await getGoals(userId, input.goalYear);
  if (!saved) throw new Error("Goals save did not persist");
  return saved;
}

/**
 * "This year so far": office visits and new patients actually logged in Log Stats
 * (wwld_sessions) from Jan 1 through yesterday (New York, same clock as Log Stats) or Dec 31.
 * Includes past-days (backlog) totals, because those are real logged numbers.
 */
export async function getYearProgress(userId: number, goalYear: number) {
  const today = getAppDateKey();
  // Count completed days only (through yesterday), matching the pace target.
  const through = progressThroughDate(goalYear, today);
  if (!through) {
    return { asOf: today, through: null, officeVisits: 0, newPatients: 0, hasData: false };
  }
  const { totals, dailyBreakdown } = await getWwldTotalsForRange(userId, `${goalYear}-01-01`, through, false);
  return {
    asOf: today,
    through,
    officeVisits: totals.officeVisits,
    newPatients: totals.newPatients,
    hasData: dailyBreakdown.length > 0,
  };
}

/**
 * Goals vs Log Stats: logged numbers compared with the goals for today, this week, this month
 * and this year (New York calendar). Read-only. Straight comparison only (no pace / projection);
 * see shared/goalsComparison.ts for the rules.
 */
export async function getGoalsComparison(
  userId: number,
  workDays: string | null | undefined,
  goalYear?: number,
): Promise<GoalsComparison> {
  const today = getAppDateKey();
  const year = goalYear ?? Number(today.slice(0, 4));
  const db = await requireDb();
  const [saved, settings] = await Promise.all([getGoals(userId, year), getStatSettings(userId)]);

  // Current year: from the earlier of Jan 1 and this week's Monday (a week can start in December)
  // through today. Other years: that whole year (a future year simply has no rows).
  const yearStart = `${year}-01-01`;
  const isCurrent = year === Number(today.slice(0, 4));
  const start = isCurrent ? [yearStart, mondayDateKey(today)].sort()[0] : yearStart;
  const end = isCurrent ? today : `${year}-12-31`;
  const rows = await db
    .select({
      sessionDate: wwldSessions.sessionDate,
      notes: wwldSessions.notes,
      trackedStats: wwldSessions.trackedStats,
      officeVisits: wwldSessions.officeVisits,
      newPatients: wwldSessions.newPatients,
      collections: wwldSessions.collections,
    })
    .from(wwldSessions)
    .where(and(eq(wwldSessions.userId, userId), gte(wwldSessions.sessionDate, start), lte(wwldSessions.sessionDate, end)));

  return buildGoalsComparison({
    today,
    goalYear: year,
    goals: saved,
    workDays,
    enabledStats: settings.enabledBuiltinStats,
    rows,
  });
}
