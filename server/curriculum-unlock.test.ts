import { describe, expect, it } from "vitest";
import {
  BTG_CANONICAL_MODULE_TITLES,
  FALLBACK_LEGACY_TO_BTG_ID_MAP,
  LEGACY_TO_BTG_CREDIT_MAP,
  getModuleUnlockState,
  isBtgCanonicalTitle,
  isModuleUnlockedAtIndex,
  isObsoleteLessonSeedTitle,
  OBSOLETE_LESSON_SEED_MODULE_TITLES,
  planModuleCredit,
  resolveLegacyToBtgPairs,
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

describe("legacy draft → BTG credit map", () => {
  it("maps five demoted drafts onto the first five BTG titles (not Referral Identity)", () => {
    expect(LEGACY_TO_BTG_CREDIT_MAP).toHaveLength(5);
    expect(LEGACY_TO_BTG_CREDIT_MAP.map((e) => e.legacyTitle)).toEqual([
      ...OBSOLETE_LESSON_SEED_MODULE_TITLES,
    ]);
    expect(LEGACY_TO_BTG_CREDIT_MAP.map((e) => e.btgTitle)).toEqual([
      "Differentiation",
      "Local Positioning",
      "Messaging",
      "Trust & Referral Generation",
      "Visibility — Weekly Rhythm",
    ]);
    expect(BTG_CANONICAL_MODULE_TITLES).toContain("Referral Identity");
    expect(LEGACY_TO_BTG_CREDIT_MAP.map((e) => e.btgTitle)).not.toContain("Referral Identity");
  });

  it("does not map Messaging & Positioning onto BTG Messaging", () => {
    const row = LEGACY_TO_BTG_CREDIT_MAP.find((e) => e.legacyTitle === "Messaging & Positioning");
    expect(row?.btgTitle).toBe("Local Positioning");
    expect(row?.btgTitle).not.toBe("Messaging");
  });

  it("resolves pairs by title even when ids are not 1→6", () => {
    const modules = [
      { id: 21, title: "Bridge the Gap: Foundation" },
      { id: 22, title: "Messaging & Positioning" },
      { id: 23, title: "Content Creation System" },
      { id: 24, title: "Patient Experience & Retention" },
      { id: 25, title: "Growth Strategy & Metrics" },
      { id: 31, title: "Differentiation" },
      { id: 32, title: "Local Positioning" },
      { id: 33, title: "Messaging" },
      { id: 34, title: "Trust & Referral Generation" },
      { id: 35, title: "Visibility — Weekly Rhythm" },
      { id: 36, title: "Referral Identity" },
    ];
    const pairs = resolveLegacyToBtgPairs(modules);
    expect(pairs.map((p) => [p.legacyId, p.btgId])).toEqual([
      [21, 31],
      [22, 32],
      [23, 33],
      [24, 34],
      [25, 35],
    ]);
    expect(pairs.every((p) => p.usedFallbackId === false)).toBe(true);
  });

  it("uses fallback ids 1→6 … 5→10 only when titles still match", () => {
    const modules = [
      { id: 1, title: "Bridge the Gap: Foundation" },
      { id: 2, title: "Messaging & Positioning" },
      { id: 3, title: "Content Creation System" },
      { id: 4, title: "Patient Experience & Retention" },
      { id: 5, title: "Growth Strategy & Metrics" },
      { id: 6, title: "Differentiation" },
      { id: 7, title: "Local Positioning" },
      { id: 8, title: "Messaging" },
      { id: 9, title: "Trust & Referral Generation" },
      { id: 10, title: "Visibility — Weekly Rhythm" },
      { id: 11, title: "Referral Identity" },
    ];
    // Wipe titles so title match fails; fallback should still accept known titles on those ids
    const pairs = resolveLegacyToBtgPairs(modules);
    expect(FALLBACK_LEGACY_TO_BTG_ID_MAP).toEqual({ 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 });
    expect(pairs[0].legacyId).toBe(1);
    expect(pairs[0].btgId).toBe(6);
    expect(isBtgCanonicalTitle("Differentiation")).toBe(true);
  });

  it("rejects fallback ids when those rows are the wrong titles", () => {
    const modules = [
      { id: 1, title: "Random Draft" },
      { id: 6, title: "Also Random" },
    ];
    const pairs = resolveLegacyToBtgPairs(modules);
    expect(pairs[0].legacyId).toBeNull();
    expect(pairs[0].btgId).toBeNull();
    expect(pairs[0].usedFallbackId).toBe(false);
  });

  it("credits a full legacy module as a complete BTG module", () => {
    expect(
      planModuleCredit({ legacyCompletedSteps: 4, legacyStepCount: 4, btgStepCount: 4 })
    ).toEqual({ creditStepCount: 4, completeBtg: true });
  });

  it("credits partial legacy progress as the first K BTG steps", () => {
    expect(
      planModuleCredit({ legacyCompletedSteps: 1, legacyStepCount: 4, btgStepCount: 4 })
    ).toEqual({ creditStepCount: 1, completeBtg: false });
  });

  it("still credits orphaned progress when draft steps were removed", () => {
    expect(
      planModuleCredit({ legacyCompletedSteps: 4, legacyStepCount: 0, btgStepCount: 4 })
    ).toEqual({ creditStepCount: 4, completeBtg: true });
  });
});

  it("resolves the Foundation alias onto Differentiation", () => {
    const pairs = resolveLegacyToBtgPairs([
      { id: 1, title: "Foundation" },
      { id: 6, title: "Differentiation" },
    ]);
    expect(pairs[0].legacyId).toBe(1);
    expect(pairs[0].btgId).toBe(6);
  });
