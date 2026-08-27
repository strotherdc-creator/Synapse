import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCentralDateKey, previousDateKey } from "./db";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("daily check-in streak", () => {
  it("uses the Central Time calendar so one check-in per calendar day can advance the streak", () => {
    expect(getCentralDateKey(new Date("2026-08-27T04:30:00.000Z"))).toBe("2026-08-26");
    expect(getCentralDateKey(new Date("2026-08-27T05:30:00.000Z"))).toBe("2026-08-27");
    expect(previousDateKey("2026-08-27")).toBe("2026-08-26");
  });

  it("records an authenticated daily check-in independently from completed-action counts", () => {
    const router = source("server/routers.ts");
    const app = source("client/src/App.tsx");
    const todayPlan = source("client/src/pages/TodaysGrowthPlan.tsx");

    expect(router).toContain("recordDailyCheckIn: protectedProcedure.mutation");
    expect(router).toContain("await db.updateStreak(ctx.user.id, serverDate);");
    expect(app).toContain("trpc.routine.recordDailyCheckIn.useMutation");
    expect(app).toContain("recordDailyCheckIn();");
    expect(todayPlan).toContain("check-in streak");
  });
});
