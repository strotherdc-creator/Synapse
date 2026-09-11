import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLegacyCreditProjection,
  creditedStepNumbers,
  getModuleUnlockState,
  isBtgStepCredited,
  mergeCoachingCompletion,
  sortModulesForUnlock,
} from "../shared/curriculumUnlock";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/** Confirmed prod-shaped ids: drafts 1–5, published BTG 6–11. */
const modules = [
  { id: 1, title: "Bridge the Gap: Foundation", sortOrder: 101, status: "draft" },
  { id: 2, title: "Messaging & Positioning", sortOrder: 102, status: "draft" },
  { id: 3, title: "Content Creation System", sortOrder: 103, status: "draft" },
  { id: 4, title: "Patient Experience & Retention", sortOrder: 104, status: "draft" },
  { id: 5, title: "Growth Strategy & Metrics", sortOrder: 105, status: "draft" },
  { id: 6, title: "Differentiation", sortOrder: 1, status: "published" },
  { id: 7, title: "Local Positioning", sortOrder: 2, status: "published" },
  { id: 8, title: "Messaging", sortOrder: 3, status: "published" },
  { id: 9, title: "Trust & Referral Generation", sortOrder: 4, status: "published" },
  { id: 10, title: "Visibility — Weekly Rhythm", sortOrder: 5, status: "published" },
  { id: 11, title: "Referral Identity", sortOrder: 6, status: "published" },
];

function stepsFor(moduleId: number, count: number, idBase: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: idBase + i,
    moduleId,
    stepNumber: i + 1,
  }));
}

const steps = [
  ...stepsFor(1, 4, 100),
  ...stepsFor(2, 5, 200),
  ...stepsFor(3, 4, 300),
  ...stepsFor(4, 5, 400),
  ...stepsFor(5, 5, 500),
  ...stepsFor(6, 4, 600),
  ...stepsFor(7, 5, 700),
  ...stepsFor(8, 4, 800),
  ...stepsFor(9, 5, 900),
  ...stepsFor(10, 5, 1000),
  ...stepsFor(11, 5, 1100),
];

/** Marcus: 4 + 5 + 1 completed on drafts 1–3; zero on published BTG. */
const marcusProgress = [
  ...[100, 101, 102, 103].map((stepId) => ({
    userId: 8,
    moduleId: 1,
    stepId,
    completed: true,
    finalAnswer: `foundation-${stepId}`,
  })),
  ...[200, 201, 202, 203, 204].map((stepId) => ({
    userId: 8,
    moduleId: 2,
    stepId,
    completed: true,
    finalAnswer: `positioning-${stepId}`,
  })),
  {
    userId: 8,
    moduleId: 3,
    stepId: 300,
    completed: true,
    finalAnswer: "content-start",
  },
];

describe("Marcus-style legacy credit projection", () => {
  const projection = buildLegacyCreditProjection({
    modules,
    steps,
    progress: marcusProgress,
  });

  it("credits Differentiation + Local Positioning fully and 1 Messaging step", () => {
    expect(creditedStepNumbers(projection, 6)).toEqual([1, 2, 3, 4]);
    expect(creditedStepNumbers(projection, 7)).toEqual([1, 2, 3, 4, 5]);
    expect(creditedStepNumbers(projection, 8)).toEqual([1]);
    expect(creditedStepNumbers(projection, 9)).toEqual([]);
    expect(creditedStepNumbers(projection, 11)).toEqual([]);
    expect(isBtgStepCredited(projection, 8, 1)).toBe(true);
    expect(isBtgStepCredited(projection, 8, 2)).toBe(false);
  });

  it("unlocks the first 3 published BTG modules (2 full legacy + next work)", () => {
    const published = modules
      .filter((m) => m.status === "published")
      .map((m) => {
        const moduleSteps = steps.filter((s) => s.moduleId === m.id);
        const merged = mergeCoachingCompletion({
          steps: moduleSteps,
          actualCompletedStepIds: new Set(),
          creditedStepNumbers: creditedStepNumbers(projection, m.id),
        });
        return { ...m, moduleComplete: merged.moduleComplete, completedStepCount: merged.completedStepCount };
      });
    const sorted = sortModulesForUnlock(published);
    expect(sorted.map((m) => m.id)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(sorted[0].moduleComplete).toBe(true);
    expect(sorted[1].moduleComplete).toBe(true);
    expect(sorted[2].moduleComplete).toBe(false);
    expect(sorted[2].completedStepCount).toBe(1);
    expect(getModuleUnlockState(published, 6).unlocked).toBe(true);
    expect(getModuleUnlockState(published, 7).unlocked).toBe(true);
    expect(getModuleUnlockState(published, 8).unlocked).toBe(true);
    expect(getModuleUnlockState(published, 9).unlocked).toBe(false);
  });

  it("does not invent progress on unpublished draft ids", () => {
    expect(creditedStepNumbers(projection, 1)).toEqual([]);
    expect(creditedStepNumbers(projection, 2)).toEqual([]);
  });

  it("is a no-op when the learner has no legacy completions", () => {
    const empty = buildLegacyCreditProjection({ modules, steps, progress: [] });
    expect(creditedStepNumbers(empty, 6)).toEqual([]);
    const published = modules.filter((m) => m.status === "published").map((m) => ({
      ...m,
      moduleComplete: false,
    }));
    expect(getModuleUnlockState(published, 6).unlocked).toBe(true);
    expect(getModuleUnlockState(published, 7).unlocked).toBe(false);
  });
});

describe("legacy credit safety", () => {
  it("never deletes draft progress in credit or router code", () => {
    const credit = source("server/legacyCurriculumCredit.ts");
    const router = source("server/routers.ts");
    const unlock = source("shared/curriculumUnlock.ts");
    expect(credit).not.toMatch(/\.delete\(/);
    expect(credit).toContain("never deleted");
    expect(credit).toContain("dry-run");
    expect(credit).toContain("SYNAPSE_LEGACY_CREDIT_APPLY");
    expect(router).toContain("previewLegacyCurriculumCredit");
    expect(router).toContain("loadLegacyCreditIndex");
    expect(unlock).toContain("LEGACY_TO_BTG_CREDIT_MAP");
    expect(unlock).toContain("Messaging & Positioning");
    expect(unlock).toContain("Local Positioning");
  });

  it("keeps apply behind confirm + env flag", () => {
    const credit = source("server/legacyCurriculumCredit.ts");
    expect(credit).toContain('process.env[LEGACY_CREDIT_APPLY_ENV] !== "1"');
    expect(credit).toContain("dryRun !== false");
    expect(credit).toContain("!input.confirm");
  });
});
