import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWeeklyStatEmail, weeklyGoalLines, WEEKLY_SUBJECT, SYNAPSE_URL } from "./engagement/weekly-stat-email";
import type { GoalsComparison, ComparisonResult } from "../shared/goalsComparison";

function comp(week: Partial<Record<"officeVisits" | "newPatients" | "revenue", ComparisonResult>>, hasGoals = true): GoalsComparison {
  const range = { start: "2026-10-12", end: "2026-10-16" };
  return {
    asOf: "2026-10-16", goalYear: 2026, yearMode: "current", hasGoals, week: [], weekTotal: null,
    periods: [{ period: "week", range, fullRange: { start: "2026-10-12", end: "2026-10-18" }, dayType: "full", soFar: true,
      metrics: (["revenue", "officeVisits", "newPatients"] as const).map((metric) => ({ metric, result: week[metric] ?? { status: "no_goal" } })) }],
  } as GoalsComparison;
}
const c = (actual: number, goal: number): ComparisonResult => ({ status: "compared", actual, goal, diff: actual - goal, pct: 0 });

describe("weekly stat email", () => {
  it("shows 'X of Y' in whole numbers, only for goals that are set", () => {
    const lines = weeklyGoalLines(comp({ officeVisits: c(244, 250.4), revenue: c(12400.6, 15384.6) }));
    expect(lines).toEqual(["Visits: 244 of 250", "Revenue: $12,401 of $15,385"]);
  });
  it("leaves out untracked goals and says when nothing is logged", () => {
    expect(weeklyGoalLines(comp({ officeVisits: { status: "not_tracked" }, newPatients: { status: "no_stats" } }))).toEqual([
      "New patients: nothing logged yet this week",
    ]);
  });
  it("subject starts with Synapse; text and html carry the link, save-link line and log-in nudge", () => {
    const m = buildWeeklyStatEmail({ name: "Dr Lee", comparison: comp({ officeVisits: c(244, 250) }) });
    expect(m.subject).toBe(WEEKLY_SUBJECT);
    expect(m.subject.startsWith("Synapse")).toBe(true);
    for (const body of [m.text, m.html]) {
      expect(body).toContain(SYNAPSE_URL);
      expect(body).toContain("Save this link, the address is a bit unusual");
      expect(body).toContain("Log in and log your numbers");
    }
    expect(m.text).toContain("Visits: 244 of 250");
    expect(m.html).toContain(">Open Synapse</a>");
    expect(m.html).toContain('name="viewport"');
    expect(m.text).not.toMatch(/\d\.\d/);
  });
  it("no goals set: asks them to set goals with a /goals link and shows no numbers", () => {
    const m = buildWeeklyStatEmail({ name: null, comparison: comp({}, false) });
    expect(m.text).toContain("Hi Doctor,");
    expect(m.text).toContain(`${SYNAPSE_URL}/goals`);
    expect(m.html).toContain(`href="${SYNAPSE_URL}/goals"`);
    expect(m.text).not.toContain(" of ");
  });
  it("escapes the doctor's name in HTML", () => {
    expect(buildWeeklyStatEmail({ name: "<b>x</b>", comparison: comp({}, false) }).html).not.toContain("<b>x</b>");
  });
});

describe("SMTP env name fallback", () => {
  const keys = ["SMTP_USER", "SMTP_PASS", "Smtp_user", "Smtp_pass"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  afterEach(() => { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } vi.resetModules(); });
  it("reads Smtp_user / Smtp_pass when the upper-case names are missing", async () => {
    delete process.env.SMTP_USER; delete process.env.SMTP_PASS;
    process.env.Smtp_user = "lower@example.com"; process.env.Smtp_pass = "p1";
    vi.resetModules();
    const { ENV } = await import("./_core/env");
    expect(ENV.smtpUser).toBe("lower@example.com");
    expect(ENV.smtpPass).toBe("p1");
  });
  it("prefers SMTP_USER / SMTP_PASS when both are set", async () => {
    process.env.SMTP_USER = "upper@example.com"; process.env.SMTP_PASS = "p2";
    process.env.Smtp_user = "lower@example.com"; process.env.Smtp_pass = "p1";
    vi.resetModules();
    const { ENV } = await import("./_core/env");
    expect(ENV.smtpUser).toBe("upper@example.com");
    expect(ENV.smtpPass).toBe("p2");
  });
});
