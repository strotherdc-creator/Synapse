import { describe, expect, it } from "vitest";
import {
  getModuleUnlockState,
  isModuleUnlockedAtIndex,
  isObsoleteLessonSeedTitle,
  OBSOLETE_LESSON_SEED_MODULE_TITLES,
  sortModulesForUnlock,
} from "../shared/curriculumUnlock";

describe("curriculum unlock helpers", () => {
  const mods = [
    { id: 10, sortOrder: 2, moduleComplete: true, title: "B" },
    { id: 7, sortOrder: 1, moduleComplete: true, title: "A" },
    { id: 12, sortOrder: 2, moduleComplete: false, title: "C-tie" },
    { id: 20, sortOrder: 3, moduleComplete: true, title: "D" },
  ];

  it("sorts by sortOrder then id", () => {
    const sorted = sortModulesForUnlock(mods);
    expect(sorted.map((m) => m.id)).toEqual([7, 10, 12, 20]);
  });

  it("requires all previous modules complete (not only the immediate previous)", () => {
    const sorted = sortModulesForUnlock(mods);
    expect(isModuleUnlockedAtIndex(sorted, 0)).toBe(true);
    expect(isModuleUnlockedAtIndex(sorted, 1)).toBe(true); // A complete
    expect(isModuleUnlockedAtIndex(sorted, 2)).toBe(true); // A+B complete
    // D is complete but C-tie (index 2) is not — D must stay locked
    expect(isModuleUnlockedAtIndex(sorted, 3)).toBe(false);
    expect(getModuleUnlockState(mods, 20).unlocked).toBe(false);
  });

  it("never treats a complete-but-locked module as unlocked", () => {
    const state = getModuleUnlockState(mods, 20);
    expect(state.sorted[state.index].moduleComplete).toBe(true);
    expect(state.unlocked).toBe(false);
  });

  it("recognizes obsolete lesson-seed titles", () => {
    expect(isObsoleteLessonSeedTitle("Messaging & Positioning")).toBe(true);
    expect(isObsoleteLessonSeedTitle("messaging & positioning")).toBe(true);
    expect(isObsoleteLessonSeedTitle("Messaging")).toBe(false);
    expect(OBSOLETE_LESSON_SEED_MODULE_TITLES).toContain("Messaging & Positioning");
  });
});
