/**
 * Curriculum unlock / finishability helpers.
 * Client Curriculum UI and server assertModuleUnlocked must agree:
 * a module is unlocked iff it is first in sort order, or every prior
 * published module is moduleComplete.
 */

export type SortableModule = { id: number; sortOrder: number };

/** Bridge-the-Gap coaching path (canonical learner sequence). */
export const BTG_CANONICAL_MODULE_TITLES = [
  "Differentiation",
  "Local Positioning",
  "Messaging",
  "Trust & Referral Generation",
  "Visibility — Weekly Rhythm",
  "Referral Identity",
] as const;

/**
 * Obsolete lesson-seed module titles from server/seed.ts.
 * These are reference/legacy content — not the BTG coaching path.
 * Seed demotes them to draft + raised sortOrder so learners only see BTG.
 */
export const OBSOLETE_LESSON_SEED_MODULE_TITLES = [
  "Bridge the Gap: Foundation",
  "Messaging & Positioning",
  "Content Creation System",
  "Patient Experience & Retention",
  "Growth Strategy & Metrics",
] as const;

/** Stable curriculum order: sortOrder asc, then id asc (matches assertModuleUnlocked). */
export function sortModulesForUnlock<T extends SortableModule>(modules: T[]): T[] {
  return [...modules].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * Whether the module at `index` in an already-sorted list is unlocked.
 * Requires every previous module's `moduleComplete` to be true.
 */
export function isModuleUnlockedAtIndex(
  sortedModules: Array<{ moduleComplete?: boolean }>,
  index: number
): boolean {
  if (index < 0) return false;
  if (index === 0) return true;
  return sortedModules.slice(0, index).every((m) => m.moduleComplete === true);
}

/** Unlock state for a module id within a published list. */
export function getModuleUnlockState<T extends SortableModule & { moduleComplete?: boolean }>(
  modules: T[],
  moduleId: number
): { sorted: T[]; index: number; unlocked: boolean } {
  const sorted = sortModulesForUnlock(modules);
  const index = sorted.findIndex((m) => m.id === moduleId);
  return {
    sorted,
    index,
    unlocked: isModuleUnlockedAtIndex(sorted, index),
  };
}

export function isObsoleteLessonSeedTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return OBSOLETE_LESSON_SEED_MODULE_TITLES.some((known) => known.toLowerCase() === t);
}

export function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isBtgCanonicalTitle(title: string): boolean {
  return BTG_CANONICAL_MODULE_TITLES.some((known) => titlesMatch(known, title));
}

/** Extra learner-facing / prod short titles that still mean the mapped draft. */
export const LEGACY_TITLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "Bridge the Gap: Foundation": ["Foundation"],
};

export function matchesLegacyMappedTitle(moduleTitle: string, canonical: string): boolean {
  if (titlesMatch(moduleTitle, canonical)) return true;
  return (LEGACY_TITLE_ALIASES[canonical] ?? []).some((alias) => titlesMatch(moduleTitle, alias));
}

/**
 * Draft (demoted lesson-seed) → published BTG credit map.
 *
 * Titles are NOT 1:1. Mapping is positional / thematic, not a rename:
 *   Foundation → Differentiation
 *   Messaging & Positioning → Local Positioning  (not BTG "Messaging")
 *   Content Creation System → Messaging
 *   Patient Experience & Retention → Trust & Referral Generation
 *   Growth Strategy & Metrics → Visibility — Weekly Rhythm
 * BTG "Referral Identity" has no legacy pair.
 *
 * Prod often used ids 1–5 (draft) and 6–11 (published). Fallback id map
 * 1→6 … 5→10 is accepted only when those rows still have the expected titles.
 */
export type LegacyBtgCreditMapEntry = {
  position: number;
  legacyTitle: (typeof OBSOLETE_LESSON_SEED_MODULE_TITLES)[number];
  btgTitle: (typeof BTG_CANONICAL_MODULE_TITLES)[number];
  rationale: string;
};

export const LEGACY_TO_BTG_CREDIT_MAP: readonly LegacyBtgCreditMapEntry[] = [
  {
    position: 1,
    legacyTitle: "Bridge the Gap: Foundation",
    btgTitle: "Differentiation",
    rationale: "Same opening arc: unique value / who you serve. Typical prod ids 1→6.",
  },
  {
    position: 2,
    legacyTitle: "Messaging & Positioning",
    btgTitle: "Local Positioning",
    rationale:
      "Legacy positioning work maps to owning a local category — not BTG Messaging. Typical prod ids 2→7.",
  },
  {
    position: 3,
    legacyTitle: "Content Creation System",
    btgTitle: "Messaging",
    rationale: "Closest prior to BTG table-talk / stories / FAQs. Typical prod ids 3→8.",
  },
  {
    position: 4,
    legacyTitle: "Patient Experience & Retention",
    btgTitle: "Trust & Referral Generation",
    rationale: "Retention and experience map onto trust + referral proof. Typical prod ids 4→9.",
  },
  {
    position: 5,
    legacyTitle: "Growth Strategy & Metrics",
    btgTitle: "Visibility — Weekly Rhythm",
    rationale:
      "Growth cadence maps onto weekly visibility. Typical prod ids 5→10. Referral Identity has no legacy source.",
  },
] as const;

/** Fallback only after title verify (see resolveLegacyToBtgPairs). */
export const FALLBACK_LEGACY_TO_BTG_ID_MAP: Readonly<Record<number, number>> = {
  1: 6,
  2: 7,
  3: 8,
  4: 9,
  5: 10,
};

export type ResolvedCreditPair = {
  position: number;
  legacyTitle: string;
  btgTitle: string;
  rationale: string;
  legacyId: number | null;
  btgId: number | null;
  usedFallbackId: boolean;
};

export function resolveLegacyToBtgPairs(
  modules: Array<{ id: number; title: string }>
): ResolvedCreditPair[] {
  return LEGACY_TO_BTG_CREDIT_MAP.map((entry) => {
    const legacyByTitle = modules.find((m) => matchesLegacyMappedTitle(m.title, entry.legacyTitle));
    const btgByTitle = modules.find((m) => titlesMatch(m.title, entry.btgTitle));
    const fallbackBtgId = FALLBACK_LEGACY_TO_BTG_ID_MAP[entry.position];
    const legacyById = modules.find((m) => m.id === entry.position);
    const btgById = modules.find((m) => m.id === fallbackBtgId);

    let legacyId = legacyByTitle?.id ?? null;
    let btgId = btgByTitle?.id ?? null;
    let usedFallbackId = false;

    if (legacyId == null && legacyById && matchesLegacyMappedTitle(legacyById.title, entry.legacyTitle)) {
      legacyId = legacyById.id;
      usedFallbackId = true;
    }
    if (btgId == null && btgById && isBtgCanonicalTitle(btgById.title)) {
      btgId = btgById.id;
      usedFallbackId = true;
    }

    return {
      position: entry.position,
      legacyTitle: entry.legacyTitle,
      btgTitle: entry.btgTitle,
      rationale: entry.rationale,
      legacyId,
      btgId,
      usedFallbackId,
    };
  });
}

export type ModuleCreditPlan = {
  creditStepCount: number;
  completeBtg: boolean;
};

/**
 * Equivalent-progress credit for one mapped pair.
 * Full legacy completion (completed >= that module's own step count) satisfies
 * the mapped BTG module entirely. Partial completion credits the first K BTG
 * steps (unlock-equivalent progress, not a title-matched step rename).
 * If the draft module no longer has steps but progress rows remain, K completed
 * rows still credit the first K BTG steps.
 */
export function planModuleCredit(input: {
  legacyCompletedSteps: number;
  legacyStepCount: number;
  btgStepCount: number;
}): ModuleCreditPlan {
  const { legacyCompletedSteps, legacyStepCount, btgStepCount } = input;
  if (legacyCompletedSteps <= 0 || btgStepCount <= 0) {
    return { creditStepCount: 0, completeBtg: false };
  }
  const legacyFullyComplete = legacyStepCount > 0 && legacyCompletedSteps >= legacyStepCount;
  if (legacyFullyComplete) {
    return { creditStepCount: btgStepCount, completeBtg: true };
  }
  const creditStepCount = Math.min(legacyCompletedSteps, btgStepCount);
  return {
    creditStepCount,
    completeBtg: creditStepCount >= btgStepCount,
  };
}

export type CreditStepSnapshot = { id: number; moduleId: number; stepNumber: number };
export type CreditProgressSnapshot = {
  userId?: number;
  moduleId: number;
  stepId: number;
  completed: boolean;
  finalAnswer?: string | null;
};

export type LegacyCreditProjection = {
  pairs: ResolvedCreditPair[];
  /** BTG module id → credited step numbers (sorted) */
  creditedStepNumbersByBtgId: Map<number, number[]>;
  /** BTG module id → stepNumber → copied legacy answer (if any) */
  creditedAnswersByBtgId: Map<number, Map<number, string | null>>;
};

export function buildLegacyCreditProjection(input: {
  modules: Array<{ id: number; title: string }>;
  steps: CreditStepSnapshot[];
  progress: CreditProgressSnapshot[];
}): LegacyCreditProjection {
  const pairs = resolveLegacyToBtgPairs(input.modules);
  const creditedStepNumbersByBtgId = new Map<number, number[]>();
  const creditedAnswersByBtgId = new Map<number, Map<number, string | null>>();

  const stepsFor = (moduleId: number) =>
    input.steps
      .filter((s) => s.moduleId === moduleId)
      .sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);

  for (const pair of pairs) {
    if (pair.legacyId == null || pair.btgId == null) continue;
    const legacySteps = stepsFor(pair.legacyId);
    const btgSteps = stepsFor(pair.btgId);
    const completedLegacy = input.progress.filter(
      (p) => p.moduleId === pair.legacyId && p.completed
    );
    const plan = planModuleCredit({
      legacyCompletedSteps: completedLegacy.length,
      legacyStepCount: legacySteps.length,
      btgStepCount: btgSteps.length,
    });
    if (plan.creditStepCount <= 0) continue;

    const creditedSteps = btgSteps.slice(0, plan.creditStepCount);
    creditedStepNumbersByBtgId.set(
      pair.btgId,
      creditedSteps.map((s) => s.stepNumber)
    );

    const legacyAnswersInOrder = completedLegacy
      .map((p) => {
        const step = legacySteps.find((s) => s.id === p.stepId);
        return {
          stepNumber: step?.stepNumber ?? Number.MAX_SAFE_INTEGER,
          answer: p.finalAnswer ?? null,
        };
      })
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((row) => row.answer);

    const answers = new Map<number, string | null>();
    creditedSteps.forEach((step, i) => {
      answers.set(step.stepNumber, legacyAnswersInOrder[i] ?? null);
    });
    creditedAnswersByBtgId.set(pair.btgId, answers);
  }

  return { pairs, creditedStepNumbersByBtgId, creditedAnswersByBtgId };
}

export function creditedStepNumbers(
  projection: LegacyCreditProjection,
  btgModuleId: number
): number[] {
  return projection.creditedStepNumbersByBtgId.get(btgModuleId) ?? [];
}

export function isBtgStepCredited(
  projection: LegacyCreditProjection,
  btgModuleId: number,
  stepNumber: number
): boolean {
  return creditedStepNumbers(projection, btgModuleId).includes(stepNumber);
}

export function isBtgModuleFullyCredited(
  projection: LegacyCreditProjection,
  btgModuleId: number,
  btgStepCount: number
): boolean {
  if (btgStepCount <= 0) return false;
  return creditedStepNumbers(projection, btgModuleId).length >= btgStepCount;
}

export function getCreditedAnswer(
  projection: LegacyCreditProjection,
  btgModuleId: number,
  stepNumber: number
): string | null {
  return projection.creditedAnswersByBtgId.get(btgModuleId)?.get(stepNumber) ?? null;
}

/** Merge actual BTG completions with legacy credit for unlock / progress display. */
export function mergeCoachingCompletion(input: {
  steps: Array<{ id: number; stepNumber: number }>;
  actualCompletedStepIds: Set<number>;
  creditedStepNumbers: number[];
}): { completedStepCount: number; moduleComplete: boolean; completedStepNumbers: number[] } {
  const completed = new Set<number>();
  for (const step of input.steps) {
    if (input.actualCompletedStepIds.has(step.id) || input.creditedStepNumbers.includes(step.stepNumber)) {
      completed.add(step.stepNumber);
    }
  }
  const completedStepNumbers = [...completed].sort((a, b) => a - b);
  return {
    completedStepCount: completedStepNumbers.length,
    moduleComplete: input.steps.length > 0 && completedStepNumbers.length >= input.steps.length,
    completedStepNumbers,
  };
}
