import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isBacklogWwldSession, mondayDateKey, shiftDateKey } from "./db";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("WWLD calendar and data provenance", () => {
  it("uses calendar-safe Central Time week boundaries", () => {
    expect(mondayDateKey("2026-08-26")).toBe("2026-08-24");
    expect(mondayDateKey("2026-08-30")).toBe("2026-08-24");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("recognizes weekly and monthly backlog totals as aggregates rather than daily activity", () => {
    expect(isBacklogWwldSession("Weekly total (backlog entry)")).toBe(true);
    expect(isBacklogWwldSession("Monthly total (backlog entry)")).toBe(true);
    expect(isBacklogWwldSession(null)).toBe(false);
    expect(isBacklogWwldSession("normal end-of-day note")).toBe(false);
  });
});

describe("WWLD insight guardrails", () => {
  it("excludes backlog totals, compares matched calendar days, and limits weekday patterns to current data", () => {
    const db = source("server/db.ts");
    const client = source("client/src/pages/WWLD.tsx");
    const router = source("server/routers.ts");

    expect(db).toContain("const dailySessions = sessions.filter((session) => !isBacklogWwldSession(session.notes));");
    expect(db).toContain("for (const d of last30Days)");
    expect(db).toContain("const lastWeekThroughSameWeekdayStr = shiftDateKey(endStr, -7);");
    expect(router).toContain("currentWeekDaily.reduce");
    expect(client).toContain("last30Days.length < 15");
    expect(client).toContain("thisWeek.length >= 2 && lastWeek.length >= 2");
    expect(client).toContain("d.dataPoints >= 4");
    expect(client).toContain("Weekly and monthly backlog totals are excluded from daily trends");
  });
});
