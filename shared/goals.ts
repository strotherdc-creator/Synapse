/**
 * Goals page math — pure functions shared by the client page and the server tests.
 *
 * Formulas (all from the doctor's yearly goals):
 *   PVA (patient visit average)  = yearly office visits / yearly new patients
 *   OVA (office visit average)   = yearly revenue / yearly office visits
 *   Monthly                      = yearly / 12
 *   Weekly                       = yearly / weeks worked per year
 *   Clinic days per year         = (full days per week + 0.5 × half days per week) × weeks worked
 *   Full-day goal                = yearly / clinic days per year
 *   Half-day goal                = full-day goal × 0.5
 *
 * Anything that would divide by zero (or is missing an input) comes back as null so the
 * page can show "—" instead of Infinity / NaN.
 */

export type ClinicDayType = "full" | "half" | "off";

export const WEEKDAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];
export type ClinicSchedule = Record<WeekdayKey, ClinicDayType>;

/** Same default as users.work_days (Profile → Practice Schedule). */
export const DEFAULT_WORK_DAYS = "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off";
export const HALF_DAY_WEIGHT = 0.5;
export const DEFAULT_WEEKS_WORKED = 50;
export const MIN_WEEKS_WORKED = 1;
export const MAX_WEEKS_WORKED = 52;
export const MAX_GOAL_REVENUE = 1_000_000_000;
export const MAX_GOAL_VISITS = 10_000_000;
export const MAX_GOAL_NEW_PATIENTS = 1_000_000;
export const MIN_GOAL_YEAR = 2000;
export const MAX_GOAL_YEAR = 2100;

/** Strict format accepted when saving a schedule: every weekday exactly once. */
export const WORK_DAYS_PATTERN =
  /^(?:(?:mon|tue|wed|thu|fri|sat|sun):(?:full|half|off))(?:,(?:mon|tue|wed|thu|fri|sat|sun):(?:full|half|off)){6}$/;

/**
 * Parse users.work_days ("mon:full,tue:half,..."). Mirrors server/db.ts parseWorkSchedule:
 * days not listed are closed; an unknown status counts as a full day.
 */
export function parseClinicSchedule(raw: string | null | undefined): ClinicSchedule {
  const schedule: ClinicSchedule = { mon: "off", tue: "off", wed: "off", thu: "off", fri: "off", sat: "off", sun: "off" };
  const source = raw && raw.trim() ? raw : DEFAULT_WORK_DAYS;
  for (const entry of source.split(",")) {
    const [day, status] = entry.trim().split(":");
    if (!day || !(day in schedule)) continue;
    schedule[day as WeekdayKey] = status === "half" || status === "off" ? status : "full";
  }
  return schedule;
}

export function serializeClinicSchedule(schedule: ClinicSchedule): string {
  return WEEKDAYS.map(({ key }) => `${key}:${schedule[key]}`).join(",");
}

export function isValidWorkDays(raw: string): boolean {
  if (!WORK_DAYS_PATTERN.test(raw)) return false;
  const days = raw.split(",").map((e) => e.split(":")[0]);
  return new Set(days).size === 7;
}

export function scheduleCounts(schedule: ClinicSchedule) {
  let fullDays = 0;
  let halfDays = 0;
  for (const { key } of WEEKDAYS) {
    if (schedule[key] === "full") fullDays++;
    else if (schedule[key] === "half") halfDays++;
  }
  return { fullDays, halfDays, dayEquivalents: fullDays + HALF_DAY_WEIGHT * halfDays };
}

/** a / b, or null when either side is missing, b is 0, or the result isn't a finite number. */
export function safeDivide(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const result = a / b;
  return Number.isFinite(result) ? result : null;
}

export type GoalInputs = {
  yearlyRevenue: number | null;
  yearlyOfficeVisits: number | null;
  yearlyNewPatients: number | null;
  weeksWorked: number | null;
  schedule: ClinicSchedule;
};

export type GoalBreakdown = {
  yearly: number | null;
  monthly: number | null;
  weekly: number | null;
  fullDay: number | null;
  halfDay: number | null;
};

export type GoalResults = {
  pva: number | null;
  ova: number | null;
  fullDaysPerWeek: number;
  halfDaysPerWeek: number;
  dayEquivalentsPerWeek: number;
  weeksWorked: number | null;
  clinicDaysPerYear: number | null;
  revenue: GoalBreakdown;
  officeVisits: GoalBreakdown;
  newPatients: GoalBreakdown;
};

function cleanCount(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function breakdown(yearly: number | null, weeksWorked: number | null, clinicDaysPerYear: number | null): GoalBreakdown {
  const fullDay = safeDivide(yearly, clinicDaysPerYear);
  return {
    yearly,
    monthly: safeDivide(yearly, 12),
    weekly: safeDivide(yearly, weeksWorked),
    fullDay,
    halfDay: fullDay === null ? null : fullDay * HALF_DAY_WEIGHT,
  };
}

export function calculateGoals(inputs: GoalInputs): GoalResults {
  const revenue = cleanCount(inputs.yearlyRevenue);
  const visits = cleanCount(inputs.yearlyOfficeVisits);
  const newPatients = cleanCount(inputs.yearlyNewPatients);
  const weeks = cleanCount(inputs.weeksWorked);
  const weeksWorked = weeks && weeks > 0 ? weeks : null;
  const { fullDays, halfDays, dayEquivalents } = scheduleCounts(inputs.schedule);
  const clinicDaysPerYear = weeksWorked !== null && dayEquivalents > 0 ? dayEquivalents * weeksWorked : null;

  return {
    pva: safeDivide(visits, newPatients),
    ova: safeDivide(revenue, visits),
    fullDaysPerWeek: fullDays,
    halfDaysPerWeek: halfDays,
    dayEquivalentsPerWeek: dayEquivalents,
    weeksWorked,
    clinicDaysPerYear,
    revenue: breakdown(revenue, weeksWorked, clinicDaysPerYear),
    officeVisits: breakdown(visits, weeksWorked, clinicDaysPerYear),
    newPatients: breakdown(newPatients, weeksWorked, clinicDaysPerYear),
  };
}

// ─── Display helpers ────────────────────────────────────────────────

const DASH = "—";

/** Money to whole dollars: 1234.5 → "$1,235". */
export function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** OVA is an average per visit, so cents matter: 62.5 → "$62.50". */
export function formatMoneyCents(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Counts to at most 1 decimal, dropping a trailing ".0": 12.04 → "12", 7.25 → "7.3". */
export function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Whole number needed to actually hit a target (you can't see 0.3 of a patient): 7.2 → 8. */
export function wholeNeeded(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  // Guard against float noise like 12.000000000001 rounding up to 13.
  return Math.ceil(Math.round(value * 1000) / 1000);
}

/** Keep the year picker inside the range the server accepts. */
export function clampGoalYear(year: number): number {
  if (!Number.isFinite(year)) return MIN_GOAL_YEAR;
  return Math.min(MAX_GOAL_YEAR, Math.max(MIN_GOAL_YEAR, Math.trunc(year)));
}

/**
 * Whole numbers to aim for on one full day. Visits and new patients use the same rule
 * (round UP: you can't see 0.3 of a patient, and rounding down would miss the goal).
 */
export function fullDayAim(results: Pick<GoalResults, "officeVisits" | "newPatients">) {
  return {
    officeVisits: wholeNeeded(results.officeVisits.fullDay),
    newPatients: wholeNeeded(results.newPatients.fullDay),
  };
}

/** Parse a form field ("12,500" / "$12,500" / "") into a non-negative whole number or null. */
export function parseGoalInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned));
  return Number.isFinite(value) ? value : null;
}

// ─── "This year so far" pace ────────────────────────────────────────

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Share of the goal year fully completed before `todayKey` (YYYY-MM-DD). Today is NOT counted,
 * because today's numbers usually aren't all logged yet; the pace runs through yesterday.
 * 0 for a future year (and on Jan 1), 1 for a past year.
 */
export function yearElapsedFraction(year: number, todayKey: string): number {
  const todayYear = Number(todayKey.slice(0, 4));
  if (year > todayYear) return 0;
  if (year < todayYear) return 1;
  const start = Date.UTC(year, 0, 1);
  const today = Date.UTC(year, Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)));
  const completedDays = Math.floor((today - start) / 86_400_000);
  return Math.min(1, Math.max(0, completedDays / (isLeap(year) ? 366 : 365)));
}

/**
 * Last day counted in "this year so far" (YYYY-MM-DD): Dec 31 for a past year, yesterday for the
 * current year, null when no full day has passed yet (future year or Jan 1).
 */
export function progressThroughDate(year: number, todayKey: string): string | null {
  const todayYear = Number(todayKey.slice(0, 4));
  if (year > todayYear) return null;
  if (year < todayYear) return `${year}-12-31`;
  const d = new Date(Date.UTC(year, Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() - 1);
  if (d.getUTCFullYear() !== year) return null;
  return d.toISOString().slice(0, 10);
}

/** Where an even pace through the year says you should be by now. */
export function paceTarget(yearly: number | null, fraction: number): number | null {
  if (yearly === null || !Number.isFinite(yearly)) return null;
  return yearly * fraction;
}
