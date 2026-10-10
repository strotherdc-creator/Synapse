/**
 * Goals vs Log Stats (Oct 2026): New York calendar, straight comparison math, missing data,
 * unchecked stats and the Collections ($) → revenue mapping. Pure; no database.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APP_TIME_ZONE,
  appDateKey,
  dateKeysBetween,
  mondayDateKey,
  monthStartKey,
  shiftDateKey,
  yearStartKey,
} from "../shared/appTime";
import {
  buildGoalsComparison,
  compare,
  describeDelta,
  goalFor,
  periodRanges,
  sumActuals,
  type ComparisonSessionRow,
} from "../shared/goalsComparison";
import { calculateGoals, parseClinicSchedule } from "../shared/goals";
import {
  BUILTIN_STAT_KEYS,
  builtinStatMax,
  enabledBuiltinStats,
  formatBuiltinStatValue,
  mergeTrackedStats,
  trackedBuiltinStats,
} from "../shared/wwldStats";
import { getAppDateKey } from "./db";
import { toCSV } from "./wwld-backup";
import { WWLD_STATS_MIGRATIONS } from "./wwld/migrations";

const SCHEDULE = "mon:full,tue:full,wed:half,thu:full,fri:full,sat:off,sun:off"; // 4.5 days/week
const GOALS = { yearlyRevenue: 900_000, yearlyOfficeVisits: 9_000, yearlyNewPatients: 450, weeksWorked: 50 };
const ALL = [...BUILTIN_STAT_KEYS];

function row(date: string, p: Partial<ComparisonSessionRow> = {}): ComparisonSessionRow {
  return { sessionDate: date, notes: null, trackedStats: "officeVisits,newPatients,collections", officeVisits: 0, newPatients: 0, collections: null, ...p };
}

describe("New York calendar (server and client share shared/appTime)", () => {
  it("uses America/New_York, not Central", () => {
    expect(APP_TIME_ZONE).toBe("America/New_York");
    // 11:30pm Central on Oct 9 is already Oct 10 in New York.
    expect(appDateKey(new Date("2026-10-10T04:30:00Z"))).toBe("2026-10-10");
    expect(getAppDateKey(new Date("2026-10-10T04:30:00Z"))).toBe("2026-10-10");
  });

  it("rolls the day over at midnight New York time in summer (EDT, UTC−4) and winter (EST, UTC−5)", () => {
    expect(appDateKey(new Date("2026-07-15T03:59:59Z"))).toBe("2026-07-14");
    expect(appDateKey(new Date("2026-07-15T04:00:00Z"))).toBe("2026-07-15");
    expect(appDateKey(new Date("2026-01-15T04:59:59Z"))).toBe("2026-01-14");
    expect(appDateKey(new Date("2026-01-15T05:00:00Z"))).toBe("2026-01-15");
  });

  it("handles the DST switches (Mar 8 and Nov 1, 2026)", () => {
    // Spring forward: 1:59am EST Mar 8 → 06:59Z; 11:59pm Mar 7 EST → 04:59Z Mar 8.
    expect(appDateKey(new Date("2026-03-08T04:59:00Z"))).toBe("2026-03-07");
    expect(appDateKey(new Date("2026-03-08T06:59:00Z"))).toBe("2026-03-08");
    expect(appDateKey(new Date("2026-03-09T03:59:00Z"))).toBe("2026-03-08"); // 11:59pm EDT
    expect(appDateKey(new Date("2026-03-09T04:00:00Z"))).toBe("2026-03-09");
    // Fall back: 11:59pm EDT Oct 31 → 03:59Z Nov 1; the 25-hour day ends 04:59Z Nov 2.
    expect(appDateKey(new Date("2026-11-01T03:59:00Z"))).toBe("2026-10-31");
    expect(appDateKey(new Date("2026-11-02T04:59:00Z"))).toBe("2026-11-01");
    expect(appDateKey(new Date("2026-11-02T05:00:00Z"))).toBe("2026-11-02");
    // Day arithmetic never skips or repeats a date across DST.
    expect(shiftDateKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(shiftDateKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(shiftDateKey("2026-11-01", 1)).toBe("2026-11-02");
    expect(dateKeysBetween("2026-10-26", "2026-11-08")).toHaveLength(14);
  });

  it("weeks run Monday–Sunday, including across DST and the new year", () => {
    expect(mondayDateKey("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayDateKey("2026-10-11")).toBe("2026-10-05"); // Sunday belongs to the week before
    expect(mondayDateKey("2026-11-01")).toBe("2026-10-26"); // DST-end Sunday
    expect(mondayDateKey("2026-03-08")).toBe("2026-03-02"); // DST-start Sunday
    expect(mondayDateKey("2027-01-01")).toBe("2026-12-28");
    expect(monthStartKey("2026-10-08")).toBe("2026-10-01");
    expect(yearStartKey("2026-10-08")).toBe("2026-01-01");
  });

  it("period ranges include today ('so far')", () => {
    expect(periodRanges("2026-10-08")).toEqual({
      day: { start: "2026-10-08", end: "2026-10-08" },
      week: { start: "2026-10-05", end: "2026-10-08" },
      month: { start: "2026-10-01", end: "2026-10-08" },
      year: { start: "2026-01-01", end: "2026-10-08" },
    });
  });

  it("no client or server date code still uses America/Chicago", () => {
    for (const f of [
      "server/db.ts",
      "server/engagement/router.ts",
      "server/engagement/email-reminders.ts",
      "client/src/pages/DailyRoutine.tsx",
      "client/src/pages/WWLD.tsx",
      "client/src/pages/TodaysGrowthPlan.tsx",
      "client/src/App.tsx",
      "client/src/components/wwld/SessionPrompt.tsx",
      "client/src/pages/WwldHistory.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toContain("America/Chicago");
    }
  });
});

describe("comparison math (straight comparison, unrounded goal)", () => {
  it("gives the percent and unit difference against the goal", () => {
    expect(compare({ value: 30, logged: true }, 25)).toEqual({ status: "compared", actual: 30, goal: 25, diff: 5, pct: 20 });
    const below = compare({ value: 46, logged: true }, 50);
    expect(below).toMatchObject({ diff: -4, pct: -8 });
  });

  it("formats with a sign and a word, never color alone", () => {
    expect(describeDelta("newPatients", 3, 12)).toEqual({ direction: "above", pctText: "+12%", unitsText: "+3 new patients", word: "above goal" });
    expect(describeDelta("revenue", -1200, -8.4)).toEqual({ direction: "below", pctText: "−8%", unitsText: "−$1,200", word: "below goal" });
    expect(describeDelta("officeVisits", 1, 4)).toMatchObject({ unitsText: "+1 visit" });
    expect(describeDelta("officeVisits", -5.4, -17.8)).toMatchObject({ pctText: "−18%", unitsText: "−5.4 visits" });
  });

  it("exactly on goal reads '0% · right on goal'", () => {
    expect(describeDelta("officeVisits", 0, 0)).toEqual({ direction: "even", pctText: "0%", unitsText: "", word: "right on goal" });
  });

  it("compares against the UNROUNDED goal", () => {
    // 9,001 visits ÷ (4.5 days × 50 weeks = 225 days) = 40.00444… a full day.
    const goal = goalFor({ ...GOALS, yearlyOfficeVisits: 9_001 }, SCHEDULE, "officeVisits", "day", "full")!;
    expect(goal).toBeCloseTo(40.00444, 4);
    const r = compare({ value: 40, logged: true }, goal);
    expect(r.status === "compared" && r.diff < 0).toBe(true); // 40 is (just) below, not "on goal"
    expect(r.status === "compared" && describeDelta("officeVisits", r.diff, r.pct)).toMatchObject({ pctText: "−<1%", word: "below goal" });
  });

  it("day/week/month goals are the Goals page split of the yearly goal", () => {
    const results = calculateGoals({ ...GOALS, schedule: parseClinicSchedule(SCHEDULE) });
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "year", "full")).toBe(9_000);
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "month", "full")).toBe(results.officeVisits.monthly);
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "week", "full")).toBe(180); // 9000 ÷ 50
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "day", "full")).toBe(40); // 9000 ÷ 225
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "day", "half")).toBe(20);
    expect(goalFor(GOALS, SCHEDULE, "revenue", "week", "full")).toBe(18_000);
    expect(goalFor(GOALS, SCHEDULE, "officeVisits", "day", "off")).toBeNull();
  });
});

describe("missing data is never filled in", () => {
  it("no goal → 'No goal set'; nothing logged → 'No stats logged'", () => {
    expect(compare({ value: 12, logged: true }, null)).toEqual({ status: "no_goal" });
    expect(compare({ value: 12, logged: true }, 0)).toEqual({ status: "no_goal" });
    expect(compare({ value: 0, logged: false }, 40)).toEqual({ status: "no_stats" });
    // A logged 0 is a real number, not "no stats".
    expect(compare({ value: 0, logged: true }, 40)).toMatchObject({ status: "compared", pct: -100 });
  });

  it("builds every period with the right status, with no pace or estimate anywhere", () => {
    const today = "2026-10-08"; // Thursday (full day)
    const c = buildGoalsComparison({
      today,
      goalYear: 2026,
      goals: { ...GOALS, yearlyNewPatients: null },
      workDays: SCHEDULE,
      enabledStats: ALL,
      rows: [row("2026-10-05", { officeVisits: 38, collections: 4_000 }), row(today, { officeVisits: 22 })],
    });
    const day = c.periods.find((p) => p.period === "day")!;
    expect(day.metrics.map((m) => m.result.status)).toEqual(["compared", "no_goal", "no_stats"]);
    expect(day.metrics[0].result).toMatchObject({ actual: 22, goal: 40, diff: -18 });
    const week = c.periods.find((p) => p.period === "week")!;
    expect(week.metrics[0].result).toMatchObject({ actual: 60, goal: 180 }); // full week's goal, no pro-rating
    expect(week.metrics[2].result).toMatchObject({ actual: 4_000, goal: 18_000 });
    expect(c.week.map((d) => d.future)).toEqual([false, false, false, false, true, true, true]);
    expect(JSON.stringify(c)).not.toMatch(/pace|projected|estimate/i);
  });

  it("a day off shows 'Day off · no daily goal' but the week still compares", () => {
    const c = buildGoalsComparison({ today: "2026-10-10", goalYear: 2026, goals: GOALS, workDays: SCHEDULE, enabledStats: ALL, rows: [row("2026-10-06", { officeVisits: 40 })] });
    expect(c.periods[0].metrics.every((m) => m.result.status === "day_off")).toBe(true);
    expect(c.periods[1].metrics[0].result.status).toBe("compared");
  });

  it("no goals at all → hasGoals false and every result 'No goal set'", () => {
    const c = buildGoalsComparison({ today: "2026-10-08", goalYear: 2026, goals: null, workDays: SCHEDULE, enabledStats: ALL, rows: [row("2026-10-08", { officeVisits: 5 })] });
    expect(c.hasGoals).toBe(false);
    expect(c.periods.flatMap((p) => p.metrics).every((m) => m.result.status === "no_goal")).toBe(true);
  });

  it("past year = whole year only; future year = nothing logged", () => {
    const past = buildGoalsComparison({ today: "2026-10-08", goalYear: 2025, goals: GOALS, workDays: SCHEDULE, enabledStats: ALL, rows: [row("2025-03-03", { officeVisits: 9_500 })] });
    expect(past.yearMode).toBe("past");
    expect(past.periods.map((p) => p.period)).toEqual(["year"]);
    expect(past.periods[0].metrics[0].result).toMatchObject({ actual: 9_500, goal: 9_000, diff: 500 });
    const future = buildGoalsComparison({ today: "2026-10-08", goalYear: 2027, goals: GOALS, workDays: SCHEDULE, enabledStats: ALL, rows: [] });
    expect(future.periods[0].metrics[0].result.status).toBe("no_stats");
  });

  it("weekly/monthly Log Past Stats totals count toward week, month and year, never a day", () => {
    const today = "2026-10-05"; // Monday; a weekly total stored on this Monday
    const rows = [row(today, { notes: "Weekly total (backlog entry)", officeVisits: 150 }), row(today, { officeVisits: 30 })];
    expect(sumActuals(rows, { excludeBacklogTotals: true }).officeVisits).toEqual({ value: 30, logged: true });
    expect(sumActuals(rows, { excludeBacklogTotals: false }).officeVisits).toEqual({ value: 180, logged: true });
    const c = buildGoalsComparison({ today, goalYear: 2026, goals: GOALS, workDays: SCHEDULE, enabledStats: ALL, rows });
    expect(c.periods.map((p) => (p.metrics[0].result as { actual: number }).actual)).toEqual([30, 180, 180, 180]);
    expect(c.week[0].officeVisits.value).toBe(30);
  });

  it("a week that started in December still counts its December days", () => {
    const c = buildGoalsComparison({ today: "2027-01-01", goalYear: 2027, goals: GOALS, workDays: SCHEDULE, enabledStats: ALL, rows: [row("2026-12-29", { officeVisits: 40 }), row("2027-01-01", { officeVisits: 10 })] });
    const week = c.periods.find((p) => p.period === "week")!;
    expect(week.range.start).toBe("2026-12-28");
    expect(week.metrics[0].result).toMatchObject({ actual: 50 });
    expect(c.periods.find((p) => p.period === "year")!.metrics[0].result).toMatchObject({ actual: 10 });
  });
});

describe("unchecked stats and the Collections ($) mapping", () => {
  it("a stat unchecked in Log Stats settings shows 'Not tracked in Log Stats', not −100%", () => {
    const enabled = enabledBuiltinStats("collections,newPatients");
    const c = buildGoalsComparison({ today: "2026-10-08", goalYear: 2026, goals: GOALS, workDays: SCHEDULE, enabledStats: enabled, rows: [row("2026-10-08", { officeVisits: 40 })] });
    for (const p of c.periods) {
      expect(p.metrics.map((m) => m.result.status)).toEqual(["compared", "not_tracked", "not_tracked"]);
    }
  });

  it("Collections is a built-in stat, on by default, with a dollar range", () => {
    expect(BUILTIN_STAT_KEYS).toContain("collections");
    expect(enabledBuiltinStats(null)).toContain("collections");
    expect(enabledBuiltinStats("")).toContain("collections");
    expect(builtinStatMax("collections")).toBe(10_000_000);
    expect(builtinStatMax("officeVisits")).toBe(9999);
    expect(formatBuiltinStatValue("collections", 12500)).toBe("$12,500");
  });

  it("revenue's actual is Collections; NULL (old entries, or left blank) is 'not logged', never $0", () => {
    const legacy: ComparisonSessionRow = { sessionDate: "2026-10-08", notes: null, trackedStats: null, officeVisits: 30, newPatients: 2, collections: null };
    const a = sumActuals([legacy], { excludeBacklogTotals: false });
    expect(a.revenue).toEqual({ value: 0, logged: false });
    expect(a.officeVisits).toEqual({ value: 30, logged: true }); // legacy rows: originals tracked
    expect(compare(a.revenue, 4_000)).toEqual({ status: "no_stats" });
    const withMoney = sumActuals([legacy, row("2026-10-08", { collections: 2_500 }), row("2026-10-08", { collections: 0 })], { excludeBacklogTotals: false });
    expect(withMoney.revenue).toEqual({ value: 2_500, logged: true });
  });

  it("a stat left off the form is not counted as logged", () => {
    const a = sumActuals([row("2026-10-08", { trackedStats: "newPatients", officeVisits: 0, newPatients: 3 })], { excludeBacklogTotals: false });
    expect(a.officeVisits.logged).toBe(false);
    expect(a.newPatients).toEqual({ value: 3, logged: true });
  });

  it("old rows never count Collections as tracked; adding it to an old row makes the list explicit", () => {
    expect(trackedBuiltinStats(null)).not.toContain("collections");
    expect(mergeTrackedStats(null, ["officeVisits"])).toBeNull();
    expect(mergeTrackedStats(null, ["collections"])).toBe(
      "officeVisits,newPatients,recall,testResults,progressExams,performanceReviews,carePlansSigned,collections",
    );
  });

  it("weekly CSV backup includes Collections (blank when not logged) and keeps the formula guard", () => {
    const csv = toCSV([
      { id: 1, notes: "=HYPERLINK(1)", collections: 12500 },
      { id: 2, notes: "ok", collections: null },
    ]);
    expect(csv.split("\n")).toEqual(["id,notes,collections", "1,'=HYPERLINK(1),12500", "2,ok,"]);
    expect(readFileSync("server/wwld-backup.ts", "utf8")).toContain("collections: wwldSessions.collections");
  });

  it("migration is additive and idempotent: nullable column, no default, no rewrite", () => {
    const m = WWLD_STATS_MIGRATIONS.filter((s) => /collections/i.test(s));
    expect(m).toEqual(["ALTER TABLE wwld_sessions ADD COLUMN IF NOT EXISTS collections INTEGER"]);
    expect(WWLD_STATS_MIGRATIONS.join("\n")).not.toMatch(/\bDROP\b|\bDELETE\b|\bUPDATE\b|ALTER COLUMN/i);
  });
});
