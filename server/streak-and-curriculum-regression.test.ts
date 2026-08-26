import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCentralDateKey, previousDateKey } from "./db";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Synapse streak calendar", () => {
  it("uses the Central Time calendar at the UTC boundary", () => {
    expect(getCentralDateKey(new Date("2026-08-26T04:30:00.000Z"))).toBe("2026-08-25");
    expect(getCentralDateKey(new Date("2026-08-26T05:30:00.000Z"))).toBe("2026-08-26");
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
  });

  it("counts one completed action rather than requiring every daily task", () => {
    const routine = source("server/routers.ts");
    const engagement = source("server/engagement/router.ts");

    expect(routine).toContain("if (input.completed) {");
    expect(routine).toContain("await db.updateStreak(ctx.user.id, serverDate);");
    expect(engagement).toContain("await db.updateStreak(ctx.user.id, date);");
    expect(engagement).not.toContain("const allComplete = allActions.every");
  });
});

describe("Synapse curriculum completion badge", () => {
  it("uses the same active curriculum metric for the Complete badge, progress count, and module unlock", () => {
    const router = source("server/routers.ts");
    const curriculum = source("client/src/pages/Curriculum.tsx");

    expect(router).toContain("const curriculumComplete = moduleLessons.length > 0 && completedCount >= moduleLessons.length;");
    expect(router).toContain("const moduleComplete = steps.length > 0 ? coachingComplete : curriculumComplete;");
    expect(curriculum).toContain("const usesCoachingSteps = mod.stepCount > 0;");
    expect(curriculum).toContain("{mod.moduleComplete && (");
    expect(curriculum).toContain("{completedItems}/{totalItems} {progressLabel}");
    expect(curriculum).toContain("modules[index - 1]?.moduleComplete === true");
  });
});
