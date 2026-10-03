import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Mock the data layer so these router tests never touch a database. Each mock records the
// userId it was called with, which is how we prove the router only ever uses ctx.user.id.
vi.mock("./goals/goals", () => ({
  getGoals: vi.fn(async () => null),
  saveGoals: vi.fn(async (_userId: number, input: Record<string, unknown>) => ({ ...input, updatedAt: null })),
  saveClinicDays: vi.fn(async () => undefined),
  getYearProgress: vi.fn(async () => ({ asOf: "2026-10-03", officeVisits: 0, newPatients: 0, hasData: false })),
}));

import * as goalsData from "./goals/goals";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { GOALS_MIGRATIONS } from "./goals/migrations";
import {
  DEFAULT_WORK_DAYS,
  calculateGoals,
  formatCount,
  formatMoney,
  formatMoneyCents,
  isValidWorkDays,
  paceTarget,
  parseClinicSchedule,
  parseGoalInput,
  safeDivide,
  scheduleCounts,
  serializeClinicSchedule,
  wholeNeeded,
  yearElapsedFraction,
} from "../shared/goals";

const fiveFull = parseClinicSchedule("mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off");

describe("Goals math", () => {
  it("PVA = visits ÷ new patients, OVA = revenue ÷ visits", () => {
    const r = calculateGoals({ yearlyRevenue: 600_000, yearlyOfficeVisits: 12_000, yearlyNewPatients: 400, weeksWorked: 50, schedule: fiveFull });
    expect(r.pva).toBe(30);
    expect(r.ova).toBe(50);
  });

  it("breaks yearly goals into month, week, full day and half day", () => {
    // Mon/Wed/Thu full, Tue/Fri half -> 3 + 0.5×2 = 4 day-equivalents/week; ×48 weeks = 192 clinic days
    const schedule = parseClinicSchedule("mon:full,tue:half,wed:full,thu:full,fri:half,sat:off,sun:off");
    const r = calculateGoals({ yearlyRevenue: 576_000, yearlyOfficeVisits: 9_600, yearlyNewPatients: 240, weeksWorked: 48, schedule });
    expect(r.fullDaysPerWeek).toBe(3);
    expect(r.halfDaysPerWeek).toBe(2);
    expect(r.dayEquivalentsPerWeek).toBe(4);
    expect(r.clinicDaysPerYear).toBe(192);
    expect(r.revenue).toEqual({ yearly: 576_000, monthly: 48_000, weekly: 12_000, fullDay: 3_000, halfDay: 1_500 });
    expect(r.officeVisits).toEqual({ yearly: 9_600, monthly: 800, weekly: 200, fullDay: 50, halfDay: 25 });
    expect(r.newPatients.fullDay).toBeCloseTo(1.25, 10);
    expect(r.newPatients.halfDay).toBeCloseTo(0.625, 10);
  });

  it("weekly goal times weeks worked equals the yearly goal, and daily totals add back up", () => {
    const r = calculateGoals({ yearlyRevenue: 750_000, yearlyOfficeVisits: 13_000, yearlyNewPatients: 350, weeksWorked: 50, schedule: fiveFull });
    expect(r.revenue.weekly! * 50).toBeCloseTo(750_000, 6);
    expect(r.officeVisits.fullDay! * r.clinicDaysPerYear!).toBeCloseTo(13_000, 6);
    // Per-day revenue lines up with OVA × per-day visits
    expect(r.revenue.fullDay!).toBeCloseTo(r.ova! * r.officeVisits.fullDay!, 6);
  });

  it("never divides by zero: empty inputs, zero new patients, zero visits, no clinic days", () => {
    const empty = calculateGoals({ yearlyRevenue: null, yearlyOfficeVisits: null, yearlyNewPatients: null, weeksWorked: 50, schedule: fiveFull });
    expect(empty.pva).toBeNull();
    expect(empty.ova).toBeNull();
    expect(empty.revenue).toEqual({ yearly: null, monthly: null, weekly: null, fullDay: null, halfDay: null });

    const zeros = calculateGoals({ yearlyRevenue: 100_000, yearlyOfficeVisits: 0, yearlyNewPatients: 0, weeksWorked: 50, schedule: fiveFull });
    expect(zeros.pva).toBeNull();
    expect(zeros.ova).toBeNull();

    const closed = calculateGoals({ yearlyRevenue: 100_000, yearlyOfficeVisits: 1_000, yearlyNewPatients: 50, weeksWorked: 50, schedule: parseClinicSchedule("mon:off,tue:off,wed:off,thu:off,fri:off,sat:off,sun:off") });
    expect(closed.clinicDaysPerYear).toBeNull();
    expect(closed.revenue.fullDay).toBeNull();
    expect(closed.revenue.halfDay).toBeNull();
    expect(closed.revenue.weekly).toBeCloseTo(2_000, 6); // weekly doesn't depend on clinic days

    const noWeeks = calculateGoals({ yearlyRevenue: 100_000, yearlyOfficeVisits: 1_000, yearlyNewPatients: 50, weeksWorked: null, schedule: fiveFull });
    expect(noWeeks.revenue.weekly).toBeNull();
    expect(noWeeks.revenue.fullDay).toBeNull();
    expect(noWeeks.revenue.monthly).toBeCloseTo(8_333.33, 1);

    expect(safeDivide(1, 0)).toBeNull();
    expect(safeDivide(null, 5)).toBeNull();
    expect(safeDivide(Number.NaN, 5)).toBeNull();
  });

  it("half day counts as 0.5 of a full day", () => {
    expect(scheduleCounts(parseClinicSchedule("mon:half,tue:half,wed:off,thu:off,fri:off,sat:off,sun:off")).dayEquivalents).toBe(1);
  });

  it("reads the Profile schedule format and defaults like the rest of the app", () => {
    expect(serializeClinicSchedule(parseClinicSchedule(null))).toBe(DEFAULT_WORK_DAYS);
    expect(serializeClinicSchedule(parseClinicSchedule("tue:half,mon:full"))).toBe("mon:full,tue:half,wed:off,thu:off,fri:off,sat:off,sun:off");
    expect(isValidWorkDays(DEFAULT_WORK_DAYS)).toBe(true);
    expect(isValidWorkDays("mon:full,mon:full,wed:full,thu:full,fri:full,sat:off,sun:off")).toBe(false);
    expect(isValidWorkDays("mon:full")).toBe(false);
    expect(isValidWorkDays("mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:maybe")).toBe(false);
  });

  it("rounds sensibly for display", () => {
    expect(formatMoney(1234.5)).toBe("$1,235");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoneyCents(62.5)).toBe("$62.50");
    expect(formatCount(12.04)).toBe("12");
    expect(formatCount(7.25)).toBe("7.3");
    expect(formatCount(null)).toBe("—");
    expect(wholeNeeded(7.2)).toBe(8);
    expect(wholeNeeded(52.000000000001)).toBe(52);
  });

  it("parses form input without inventing numbers", () => {
    expect(parseGoalInput("")).toBeNull();
    expect(parseGoalInput("   ")).toBeNull();
    expect(parseGoalInput("$750,000")).toBe(750_000);
    expect(parseGoalInput("abc")).toBeNull();
    expect(parseGoalInput("-5")).toBeNull();
  });

  it("this-year pace uses the share of the year that has passed", () => {
    expect(yearElapsedFraction(2026, "2026-01-01")).toBeCloseTo(1 / 365, 10);
    expect(yearElapsedFraction(2026, "2026-12-31")).toBe(1);
    expect(yearElapsedFraction(2027, "2026-10-03")).toBe(0);
    expect(yearElapsedFraction(2025, "2026-10-03")).toBe(1);
    expect(yearElapsedFraction(2028, "2028-12-31")).toBe(1); // leap year
    expect(paceTarget(3650, yearElapsedFraction(2026, "2026-01-10"))).toBeCloseTo(100, 6);
    expect(paceTarget(null, 0.5)).toBeNull();
  });
});

// ─── Router: auth + IDOR ────────────────────────────────────────────

function ctxFor(user: { id: number; workDays?: string | null } | null): TrpcContext {
  return {
    user: user
      ? ({
          id: user.id,
          clerkId: `clerk_${user.id}`,
          email: `u${user.id}@example.com`,
          name: "Doc",
          role: "user",
          workDays: user.workDays ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as unknown as NonNullable<TrpcContext["user"]>)
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const validSave = { goalYear: 2026, yearlyRevenue: 600_000, yearlyOfficeVisits: 12_000, yearlyNewPatients: 400, weeksWorked: 50 };

describe("goals router auth and ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("every goals endpoint requires sign-in", async () => {
    const caller = appRouter.createCaller(ctxFor(null));
    await expect(caller.goals.get({ goalYear: 2026 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.goals.save(validSave)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.goals.saveClinicDays({ workDays: DEFAULT_WORK_DAYS })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.goals.getProgress({ goalYear: 2026 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(goalsData.saveGoals).not.toHaveBeenCalled();
    expect(goalsData.saveClinicDays).not.toHaveBeenCalled();
  });

  it("save always writes the signed-in doctor's row, even if the request names another user", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 7 }));
    await caller.goals.save({ ...validSave, userId: 99 } as typeof validSave);
    expect(goalsData.saveGoals).toHaveBeenCalledTimes(1);
    const [userId, input] = vi.mocked(goalsData.saveGoals).mock.calls[0];
    expect(userId).toBe(7);
    expect(input).not.toHaveProperty("userId");
  });

  it("get, getProgress and saveClinicDays are scoped to the signed-in doctor", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 7, workDays: "mon:full,tue:half,wed:off,thu:full,fri:full,sat:off,sun:off" }));
    const got = await caller.goals.get({ goalYear: 2026, userId: 99 } as { goalYear: number });
    expect(vi.mocked(goalsData.getGoals).mock.calls[0][0]).toBe(7);
    expect(got).toEqual({ goals: null, workDays: "mon:full,tue:half,wed:off,thu:full,fri:full,sat:off,sun:off" });
    await caller.goals.getProgress({ goalYear: 2026, userId: 99 } as { goalYear: number });
    expect(vi.mocked(goalsData.getYearProgress).mock.calls[0][0]).toBe(7);
    await caller.goals.saveClinicDays({ workDays: DEFAULT_WORK_DAYS, userId: 99 } as { workDays: string });
    expect(vi.mocked(goalsData.saveClinicDays).mock.calls[0]).toEqual([7, DEFAULT_WORK_DAYS]);
  });

  it("new doctors start with no goals and the default schedule (nothing invented)", async () => {
    const got = await appRouter.createCaller(ctxFor({ id: 8 })).goals.get({ goalYear: 2026 });
    expect(got.goals).toBeNull();
    expect(got.workDays).toBe(DEFAULT_WORK_DAYS);
  });

  it("rejects bad input before touching the database", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 7 }));
    await expect(caller.goals.save({ ...validSave, yearlyRevenue: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.goals.save({ ...validSave, yearlyOfficeVisits: 1.5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.goals.save({ ...validSave, weeksWorked: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.goals.save({ ...validSave, weeksWorked: 53 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.goals.save({ ...validSave, goalYear: 1999 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.goals.saveClinicDays({ workDays: "mon:full; DROP TABLE users" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.goals.saveClinicDays({ workDays: "mon:full,mon:full,wed:full,thu:full,fri:full,sat:off,sun:off" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(goalsData.saveGoals).not.toHaveBeenCalled();
    expect(goalsData.saveClinicDays).not.toHaveBeenCalled();
  });

  it("empty goals are allowed (save some now, fill in the rest later)", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: 7 }));
    await caller.goals.save({ ...validSave, yearlyRevenue: null, yearlyNewPatients: null });
    expect(vi.mocked(goalsData.saveGoals).mock.calls[0][1]).toMatchObject({ yearlyRevenue: null, yearlyNewPatients: null });
  });
});

describe("Goals migrations and wiring", () => {
  const root = path.resolve(__dirname, "..");
  const source = (p: string) => readFileSync(path.join(root, p), "utf8");

  it("migrations are additive only", () => {
    for (const sql of GOALS_MIGRATIONS) {
      expect(sql).toMatch(/^\s*CREATE TABLE IF NOT EXISTS doctor_goals/);
      expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER\s+TABLE\s+\w+\s+(DROP|ALTER))\b/i);
    }
    expect(GOALS_MIGRATIONS.join("\n")).toContain("UNIQUE (user_id, goal_year)");
    expect(source("server/db.ts")).toContain("...GOALS_MIGRATIONS");
  });

  it("Goals is in the sidebar and routed at /goals", () => {
    expect(source("client/src/components/DashboardLayout.tsx")).toContain('label: "Goals", path: "/goals"');
    expect(source("client/src/App.tsx")).toContain('<Route path="/goals" component={Goals} />');
  });
});
