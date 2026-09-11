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
    const moduleDetail = source("client/src/pages/ModuleDetail.tsx");
    const moduleCoaching = source("client/src/pages/ModuleCoaching.tsx");
    const home = source("client/src/pages/Home.tsx");
    const unlock = source("shared/curriculumUnlock.ts");

    expect(router).toContain("const curriculumComplete = moduleLessons.length > 0 && completedCount >= moduleLessons.length;");
    expect(router).toContain("const moduleComplete = steps.length > 0 ? coachingComplete : curriculumComplete;");
    expect(router).toContain("unlocked: isModuleUnlockedAtIndex(ordered, index)");
    expect(router).toContain("sortModulesForUnlock");
    expect(curriculum).toContain("const usesCoachingSteps = mod.stepCount > 0;");
    expect(curriculum).toContain("const showComplete = unlocked && mod.moduleComplete");
    expect(curriculum).toContain("{completedItems}/{totalItems} {progressLabel}");
    expect(curriculum).toContain("isModuleUnlockedAtIndex");
    // Lock and Complete are mutually exclusive (no locked+Complete contradiction)
    expect(curriculum).toContain("!unlocked ? (");
    expect(curriculum).toContain(") : showComplete ? (");

    // Detail / coaching / home must use the same unlock/complete metric as Curriculum
    expect(moduleDetail).toContain("getModuleUnlockState(allModules, moduleId)");
    expect(moduleCoaching).toContain("getModuleUnlockState(allModules, moduleId)");
    expect(home).toContain("modules?.filter((m) => m.moduleComplete)");
    expect(home).toContain("const showComplete = unlocked && mod.moduleComplete");
    expect(moduleDetail).not.toContain("if (!prevModule?.coachingComplete)");
    expect(moduleCoaching).not.toContain("if (!prevModule?.coachingComplete)");
    expect(unlock).toContain("every((m) => m.moduleComplete === true)");
  });

  it("learner modules.list is published-only; drafts only via adminList / Manage Modules", () => {
    const router = source("server/routers.ts");
    const curriculum = source("client/src/pages/Curriculum.tsx");
    const home = source("client/src/pages/Home.tsx");
    const adminModules = source("client/src/pages/AdminModules.tsx");

    // Learner list must not gate publishedOnly on admin role (that leaked drafts to ADMIN_EMAIL smoke)
    expect(router).not.toContain("listModules(!isAdmin)");
    expect(router).toContain("adminList: adminProcedure");
    expect(router).toContain("const allModules = await db.listModules(true);");
    expect(router).toContain("await db.listLessons(mod.id, true)");
    // Manage Modules keeps drafts
    expect(adminModules).toContain("trpc.modules.adminList.useQuery()");
    expect(adminModules).toContain("utils.modules.adminList.invalidate()");
    // Client defense-in-depth on Curriculum / Home
    expect(curriculum).toContain('m.status === "published"');
    expect(curriculum).not.toContain("Draft");
    expect(home).toContain('m.status === "published"');
  });

  it("demotes obsolete lesson-seed modules out of the learner Curriculum path", () => {
    const seedCoaching = source("server/seed-coaching.ts");
    const seedLessons = source("server/seed.ts");
    const unlock = source("shared/curriculumUnlock.ts");
    expect(seedCoaching).toContain("demoteObsoleteLessonSeedModules");
    expect(seedCoaching).toContain("isObsoleteLessonSeedTitle");
    expect(seedCoaching).toContain('status: "draft"');
    expect(unlock).toContain("Messaging & Positioning");
    expect(seedLessons).toContain('status: "draft" as const');
    expect(seedLessons).toContain("sortOrder: 101 + i");
  });

  it("seeds coaching steps by title/sortOrder instead of hardcoded module IDs", () => {
    const seedCoaching = source("server/seed-coaching.ts");
    expect(seedCoaching).toContain("COACHING_MODULE_META");
    expect(seedCoaching).toContain("resolveCoachingModuleId");
    expect(seedCoaching).toContain("ensureBridgeTheGapModules");
    expect(seedCoaching).toContain("claimedIds");
    expect(seedCoaching).toContain('titleExcludesAny: ["positioning"]');
    expect(seedCoaching).toContain("findReferralIdentityRenameCandidate");
    expect(seedCoaching).not.toContain("Module steps already exist (${count} steps), skipping seed");
  });

  it("documents one-time orphan cleanup for mis-attached coaching steps", () => {
    const cleanupDoc = source("docs/curriculum-orphan-cleanup.md");
    expect(cleanupDoc).toContain("one-time");
    expect(cleanupDoc).toContain("module_steps");
    expect(cleanupDoc).toContain("Referral Identity");
    expect(cleanupDoc).toContain("Demotes");
    expect(cleanupDoc).toContain("demotes the five known lesson-seed titles");
  });


  it("credits demoted draft completions onto published BTG without deleting draft rows", () => {
    const unlock = source("shared/curriculumUnlock.ts");
    const credit = source("server/legacyCurriculumCredit.ts");
    const router = source("server/routers.ts");
    const docs = source("docs/legacy-curriculum-credit.md");
    expect(unlock).toContain("LEGACY_TO_BTG_CREDIT_MAP");
    expect(unlock).toContain("planModuleCredit");
    expect(unlock).toContain("Messaging & Positioning");
    expect(unlock).toContain("Local Positioning");
    expect(credit).toContain("loadLegacyCreditIndex");
    expect(credit).toContain("SYNAPSE_LEGACY_CREDIT_APPLY");
    expect(credit).not.toMatch(/\.delete\(/);
    expect(router).toContain("loadLegacyCreditIndex");
    expect(router).toContain("previewLegacyCurriculumCredit");
    expect(router).toContain("mergeModuleCoachingProgress");
    expect(docs).toContain("HOLD");
    expect(docs).toContain("1→6");
    expect(docs).toContain("Marcus");
  });

  it("cascades coaching rows when a module is deleted", () => {
    const dbSource = source("server/db.ts");
    expect(dbSource).toContain("await db.delete(moduleSteps).where(eq(moduleSteps.moduleId, id));");
    expect(dbSource).toContain("await db.delete(userStepProgress).where(eq(userStepProgress.moduleId, id));");
  });
});


describe("Synapse daily action popup", () => {
  it("persists dismiss for the day and does not overlay curriculum/today routes", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain("synapse.dailyActionPopup.dismissed.");
    expect(app).toContain("persistDailyPopupDismissed");
    expect(app).toContain('location.startsWith("/curriculum")');
    expect(app).toContain('location === "/today"');
  });

  it("uses SPA navigation from Today\'s Plan to curriculum (no full reload hrefs)", () => {
    const plan = source("client/src/pages/TodaysGrowthPlan.tsx");
    expect(plan).toContain('setLocation("/curriculum")');
    expect(plan).toContain("setLocation(`/curriculum/${nextId}`)");
    expect(plan).not.toContain('href={`/curriculum/${curriculum.incompleteModules[0]?.id}/coaching`}');
    expect(plan).not.toContain('href="/curriculum"');
  });
});
