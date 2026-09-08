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
