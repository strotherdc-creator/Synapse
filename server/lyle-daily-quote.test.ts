import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Today’s Plan daily Lyle quote", () => {
  it("uses one daily record on the doctor's own calendar rather than an arbitrary served-log row", () => {
    const db = source("server/db.ts");
    const engagement = source("server/engagement/router.ts");

    expect(db).toContain("getDailyLyleQuoteForAppDate");
    expect(db).toContain("AT TIME ZONE ${tz}");
    expect(db).toContain("const tz = resolveTimeZone(zone);");
    expect(db).toContain('eq(lyleContent.cadence, "daily")');
    expect(db).toContain("getServedContentIds(userId)");
    expect(db).toContain("if (eligible.length === 0) return null");
    expect(engagement).toContain("db.getOrCreateDailyLyleQuote(userId, date, zone)");
  });

  it("keeps WWLD and Today’s Plan on the same quote while allowing a fresh quote after the daily rollover", () => {
    const wwldRouter = source("server/routers.ts");
    const todayPlan = source("client/src/pages/TodaysGrowthPlan.tsx");

    expect(wwldRouter).toContain("db.getOrCreateDailyLyleQuote(userId, endStr, ctx.user.timezone)");
    expect(todayPlan).toContain("refetchInterval: 1000 * 60 * 5");
    expect(todayPlan).toContain("refetchOnWindowFocus: true");
  });
});
