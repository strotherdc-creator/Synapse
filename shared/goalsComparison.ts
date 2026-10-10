/**
 * Goals vs Log Stats — pure comparison (Doc, Oct 10 2026).
 *
 * For each goal (office visits, new patients, revenue) and each period (today, this week,
 * this month, this year) we show what was LOGGED, the GOAL, and the difference as a percent
 * and in the goal's own units. That's all: no pace, no projections, no estimates.
 *
 *   Day / week / month goals are the yearly goal split out exactly like the Goals page
 *   (calculateGoals): month = year ÷ 12, week = year ÷ weeks worked, full day = year ÷ clinic
 *   days a year, half day = full day × 0.5. Compared UNROUNDED; displayed at one decimal.
 *   Periods run from their start through today (today counts, "so far") and are compared with
 *   the FULL period's goal — no pro-rating, so early in a period it reads low.
 *   Weekly/monthly "Log Past Stats" totals count toward week, month and year, never a day.
 *
 * Missing data is never filled in: no goal → "No goal set", nothing logged → "No stats logged",
 * a day off → "Day off · no daily goal", a stat unchecked in Log Stats → "Not tracked in Log Stats".
 */
import {
  calculateGoals,
  formatCount,
  formatMoney,
  parseClinicSchedule,
  WEEKDAYS,
  type ClinicDayType,
  type GoalResults,
} from "./goals";
import { dateKeysBetween, dayOfWeek, mondayDateKey, monthStartKey, shiftDateKey, yearStartKey } from "./appTime";
import { trackedBuiltinStats, type BuiltinStatKey } from "./wwldStats";

export const GOAL_METRICS = [
  { key: "revenue", label: "Revenue", unit: "", unitOne: "", stat: "collections" },
  { key: "officeVisits", label: "Office visits", unit: "visits", unitOne: "visit", stat: "officeVisits" },
  { key: "newPatients", label: "New patients", unit: "new patients", unitOne: "new patient", stat: "newPatients" },
] as const satisfies ReadonlyArray<{ key: string; label: string; unit: string; unitOne: string; stat: BuiltinStatKey }>;
export type GoalMetricKey = (typeof GOAL_METRICS)[number]["key"];

export const PERIODS = ["day", "week", "month", "year"] as const;
export type PeriodKey = (typeof PERIODS)[number];

/** The bits of a wwld_sessions row the comparison needs. */
export type ComparisonSessionRow = {
  sessionDate: string;
  notes: string | null;
  trackedStats: string | null;
  officeVisits: number;
  newPatients: number;
  collections: number | null;
};

export type MetricActual = { value: number; logged: boolean };
export type PeriodActuals = Record<GoalMetricKey, MetricActual>;

export function isBacklogTotalNote(notes: string | null | undefined): boolean {
  return notes === "Weekly total (backlog entry)" || notes === "Monthly total (backlog entry)";
}

/** Sum one period. A metric counts as logged only when a session actually tracked it. */
export function sumActuals(rows: ComparisonSessionRow[], opts: { excludeBacklogTotals: boolean }): PeriodActuals {
  const out: PeriodActuals = {
    officeVisits: { value: 0, logged: false },
    newPatients: { value: 0, logged: false },
    revenue: { value: 0, logged: false },
  };
  for (const row of rows) {
    if (opts.excludeBacklogTotals && isBacklogTotalNote(row.notes)) continue;
    const tracked = new Set<string>(trackedBuiltinStats(row.trackedStats));
    if (tracked.has("officeVisits")) {
      out.officeVisits.value += row.officeVisits;
      out.officeVisits.logged = true;
    }
    if (tracked.has("newPatients")) {
      out.newPatients.value += row.newPatients;
      out.newPatients.logged = true;
    }
    // Collections: NULL = not logged (legacy rows and sessions where it wasn't entered).
    if (row.collections !== null && row.collections !== undefined) {
      out.revenue.value += row.collections;
      out.revenue.logged = true;
    }
  }
  return out;
}

export type PeriodRange = { start: string; end: string };

/** Period boundaries in the app's calendar (New York), from today's date key. Weeks are Mon–Sun. */
export function periodRanges(today: string): Record<PeriodKey, PeriodRange> {
  return {
    day: { start: today, end: today },
    week: { start: mondayDateKey(today), end: today },
    month: { start: monthStartKey(today), end: today },
    year: { start: yearStartKey(today), end: today },
  };
}

export function scheduledDayType(dateKey: string, workDays: string | null | undefined): ClinicDayType {
  const schedule = parseClinicSchedule(workDays);
  const dow = dayOfWeek(dateKey); // 0 = Sun
  const key = WEEKDAYS[(dow + 6) % 7].key;
  return schedule[key];
}

export type GoalsInput = {
  yearlyRevenue: number | null;
  yearlyOfficeVisits: number | null;
  yearlyNewPatients: number | null;
  weeksWorked: number;
} | null;

function breakdownFor(results: GoalResults, metric: GoalMetricKey) {
  return metric === "officeVisits" ? results.officeVisits : metric === "newPatients" ? results.newPatients : results.revenue;
}

/** The (unrounded) goal for one metric and period, or null when there isn't one. */
export function goalFor(
  goals: GoalsInput,
  workDays: string | null | undefined,
  metric: GoalMetricKey,
  period: PeriodKey,
  dayType: ClinicDayType,
): number | null {
  if (!goals) return null;
  const results = calculateGoals({
    yearlyRevenue: goals.yearlyRevenue,
    yearlyOfficeVisits: goals.yearlyOfficeVisits,
    yearlyNewPatients: goals.yearlyNewPatients,
    weeksWorked: goals.weeksWorked,
    schedule: parseClinicSchedule(workDays),
  });
  const b = breakdownFor(results, metric);
  const value =
    period === "year" ? b.yearly
    : period === "month" ? b.monthly
    : period === "week" ? b.weekly
    : dayType === "full" ? b.fullDay
    : dayType === "half" ? b.halfDay
    : null;
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

export type ComparisonResult =
  | { status: "compared"; actual: number; goal: number; diff: number; pct: number }
  | { status: "no_goal" }
  | { status: "no_stats" }
  | { status: "day_off" }
  | { status: "not_tracked" };

/** Straight comparison of logged vs goal. No pace, no estimate. */
export function compare(actual: MetricActual, goal: number | null): ComparisonResult {
  if (goal === null || !Number.isFinite(goal) || goal <= 0) return { status: "no_goal" };
  if (!actual.logged) return { status: "no_stats" };
  const diff = actual.value - goal;
  return { status: "compared", actual: actual.value, goal, diff, pct: (diff / goal) * 100 };
}

export type MetricComparison = { metric: GoalMetricKey; result: ComparisonResult };
export type PeriodComparison = {
  period: PeriodKey;
  range: PeriodRange;
  /** Full calendar period the goal covers (e.g. Mon–Sun), for "compared with the full week's goal". */
  fullRange: PeriodRange;
  /** Today's clinic day type (only meaningful for "day"). */
  dayType: ClinicDayType;
  /** True when the period hasn't finished yet (always true for the current year's periods). */
  soFar: boolean;
  metrics: MetricComparison[];
};

export type WeekDayRow = {
  date: string;
  dayType: ClinicDayType;
  future: boolean;
  officeVisits: MetricActual;
  newPatients: MetricActual;
  revenue: MetricActual;
};

export type GoalsComparison = {
  asOf: string;
  goalYear: number;
  /** "current": day/week/month/year so far. "past": whole year only. "future": nothing logged yet. */
  yearMode: "current" | "past" | "future";
  hasGoals: boolean;
  periods: PeriodComparison[];
  week: WeekDayRow[];
  /** This week's totals (includes weekly/monthly Log Past Stats totals), for the week list's total row. */
  weekTotal: PeriodActuals | null;
};

function fullRangeFor(period: PeriodKey, today: string): PeriodRange {
  if (period === "day") return { start: today, end: today };
  if (period === "week") {
    const start = mondayDateKey(today);
    return { start, end: shiftDateKey(start, 6) };
  }
  if (period === "month") {
    const [y, m] = today.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: monthStartKey(today), end: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
  }
  return { start: yearStartKey(today), end: `${today.slice(0, 4)}-12-31` };
}

/**
 * Build the whole comparison. `rows` must cover at least [min(Mon of this week, Jan 1), today]
 * for the current year, or the whole goal year otherwise. `enabledStats` = built-in stats the
 * doctor currently has checked in Log Stats settings.
 */
export function buildGoalsComparison(args: {
  today: string;
  goalYear: number;
  goals: GoalsInput;
  workDays: string | null | undefined;
  enabledStats: readonly string[];
  rows: ComparisonSessionRow[];
}): GoalsComparison {
  const { today, goalYear, goals, workDays, rows } = args;
  const enabled = new Set(args.enabledStats);
  const todayYear = Number(today.slice(0, 4));
  const yearMode = goalYear === todayYear ? "current" : goalYear < todayYear ? "past" : "future";
  const hasGoals = !!goals && [goals.yearlyRevenue, goals.yearlyOfficeVisits, goals.yearlyNewPatients].some((v) => v !== null && v > 0);

  const inRange = (r: PeriodRange) => rows.filter((row) => row.sessionDate >= r.start && row.sessionDate <= r.end);
  const metricsFor = (period: PeriodKey, actuals: PeriodActuals, dayType: ClinicDayType): MetricComparison[] =>
    GOAL_METRICS.map((m) => {
      if (!enabled.has(m.stat)) return { metric: m.key, result: { status: "not_tracked" } as const };
      if (period === "day" && dayType === "off") return { metric: m.key, result: { status: "day_off" } as const };
      return { metric: m.key, result: compare(actuals[m.key], goalFor(goals, workDays, m.key, period, dayType)) };
    });

  const periods: PeriodComparison[] = [];
  const week: WeekDayRow[] = [];
  let weekTotal: PeriodActuals | null = null;
  if (yearMode === "current") {
    const ranges = periodRanges(today);
    const todayType = scheduledDayType(today, workDays);
    for (const period of PERIODS) {
      const range = ranges[period];
      const actuals = sumActuals(inRange(range), { excludeBacklogTotals: period === "day" });
      periods.push({ period, range, fullRange: fullRangeFor(period, today), dayType: todayType, soFar: true, metrics: metricsFor(period, actuals, todayType) });
    }
    const monday = mondayDateKey(today);
    for (const date of dateKeysBetween(monday, shiftDateKey(monday, 6))) {
      const a = sumActuals(inRange({ start: date, end: date }), { excludeBacklogTotals: true });
      week.push({ date, dayType: scheduledDayType(date, workDays), future: date > today, ...a });
    }
    weekTotal = sumActuals(inRange(ranges.week), { excludeBacklogTotals: false });
  } else {
    const range = { start: `${goalYear}-01-01`, end: `${goalYear}-12-31` };
    const actuals = sumActuals(yearMode === "past" ? inRange(range) : [], { excludeBacklogTotals: false });
    periods.push({ period: "year", range, fullRange: range, dayType: "full", soFar: false, metrics: metricsFor("year", actuals, "full") });
  }
  return { asOf: today, goalYear, yearMode, hasGoals, periods, week, weekTotal };
}

// ─── Display (plain English) ─────────────────────────────────────────

export function metricDef(metric: GoalMetricKey) {
  return GOAL_METRICS.find((m) => m.key === metric)!;
}

export function formatMetricValue(metric: GoalMetricKey, value: number): string {
  return metric === "revenue" ? formatMoney(value) : formatCount(value);
}

export type DeltaText = { direction: "above" | "below" | "even"; pctText: string; unitsText: string; word: string };

/** "+12%" / "−8%" / "0%" and "+3 new patients" / "−$1,200". Sign and word, never color alone. */
export function describeDelta(metric: GoalMetricKey, diff: number, pct: number): DeltaText {
  if (diff === 0) return { direction: "even", pctText: "0%", unitsText: "", word: "right on goal" };
  const up = diff > 0;
  const sign = up ? "+" : "−";
  const roundedPct = Math.round(Math.abs(pct));
  const pctText = roundedPct === 0 ? `${sign}<1%` : `${sign}${roundedPct}%`;
  const m = metricDef(metric);
  const abs = Math.abs(diff);
  const unitsText =
    metric === "revenue"
      ? abs < 0.5 ? `${sign}<$1` : `${sign}${formatMoney(abs)}`
      : abs < 0.05 ? `${sign}<0.1 ${m.unit}` : `${sign}${formatCount(abs)} ${formatCount(abs) === "1" ? m.unitOne : m.unit}`;
  return { direction: up ? "above" : "below", pctText, unitsText, word: up ? "above goal" : "below goal" };
}

export const STATUS_TEXT: Record<Exclude<ComparisonResult["status"], "compared">, string> = {
  no_goal: "No goal set",
  no_stats: "No stats logged",
  day_off: "Day off · no daily goal",
  not_tracked: "Not tracked in Log Stats",
};

export const PERIOD_TITLES: Record<PeriodKey, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
};

export const PERIOD_GOAL_NOUN: Record<PeriodKey, string> = {
  day: "full day's",
  week: "full week's",
  month: "full month's",
  year: "full year's",
};

// ─── v2 display (Doc, Oct 10 4:05pm): whole numbers, "% of goal", one status line ───

/** Goal shown in whole units: visits/patients rounded UP to a whole, money to the nearest dollar. */
export function displayGoal(metric: GoalMetricKey, goal: number): number {
  return metric === "revenue" ? Math.round(goal) : Math.ceil(goal - 1e-9);
}

export function formatWhole(metric: GoalMetricKey, value: number): string {
  const n = Math.round(value);
  return metric === "revenue" ? `$${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
}

export type ProgressText = {
  state: "ahead" | "short" | "even";
  /** "6 short · 98% of goal", "$450 short · 64% of goal", "4 ahead · 144% of goal", "Right on goal". */
  text: string;
  /** logged ÷ goal (unrounded goal), whole percent. */
  pctOfGoal: number;
  /** Bar fill, capped at 100. */
  barPct: number;
};

/** One plain status line. Math uses the UNROUNDED goal; only the display is rounded. */
export function describeProgress(metric: GoalMetricKey, actual: number, goal: number): ProgressText {
  const diff = actual - goal;
  const roundedDiff = Math.round(Math.abs(diff));
  const pctOfGoal = Math.round((actual / goal) * 100);
  const barPct = Math.max(0, Math.min(100, (actual / goal) * 100));
  if (roundedDiff === 0) return { state: "even", text: "Right on goal", pctOfGoal, barPct };
  const state = diff > 0 ? "ahead" : "short";
  return { state, text: `${formatWhole(metric, roundedDiff)} ${state} · ${pctOfGoal}% of goal`, pctOfGoal, barPct };
}

export const STATUS_TEXT_V2: Record<"no_goal" | "no_stats" | "not_tracked", string> = {
  no_goal: "No goal set",
  no_stats: "Nothing logged yet",
  not_tracked: "Not tracked",
};

export const PERIOD_TABS: Record<PeriodKey, string> = { day: "Today", week: "Week", month: "Month", year: "Year" };
