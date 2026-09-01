import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getScheduledDayType, parseWorkSchedule } from "./db";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("WWLD schedule-aware comparisons", () => {
  const schedule = parseWorkSchedule("mon:full,tue:half,wed:full,thu:full,fri:off,sat:half,sun:off");

  it("keeps half-days distinct from full clinic days", () => {
    expect(getScheduledDayType("2026-09-01", schedule)).toBe("half"); // Tuesday
    expect(getScheduledDayType("2026-09-02", schedule)).toBe("full"); // Wednesday
    expect(getScheduledDayType("2026-09-05", schedule)).toBe("half"); // Saturday
    expect(getScheduledDayType("2026-09-04", schedule)).toBe("off"); // Friday
  });

  it("passes the saved schedule to analytics, removes half-day inflation, and avoids slow-day rankings", () => {
    const router = source("server/routers.ts");
    const page = source("client/src/pages/WWLD.tsx");

    expect(router).toContain("db.getWwldAnalytics(ctx.user.id, (ctx.user as any).workDays)");
    expect(router).not.toContain("Weight half days 2x");
    expect(page).toContain("Schedule-Aware Day Patterns");
    expect(page).toContain("Half-days are compared only with the same weekday");
    expect(page).not.toContain("your lightest recurring day");
    expect(page).not.toContain("your busiest recurring day");
  });
});
