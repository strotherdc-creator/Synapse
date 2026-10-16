/**
 * Plain-words curriculum progress for learners (Oct 15 2026 quick wins):
 * "Continue: Module X, Step Y", "Step N of M", and lock reasons like "Finish Module 1 to open".
 * Pure helpers shared by Home, Curriculum and Today's Plan so they always say the same thing.
 */
import { isModuleUnlockedAtIndex, sortModulesForUnlock } from "./curriculumUnlock";

export type ProgressModule = {
  id: number;
  sortOrder: number;
  title: string;
  status?: string;
  stepCount: number;
  completedStepCount: number;
  lessonCount: number;
  completedCount: number;
  moduleComplete: boolean;
  unlocked?: boolean;
};

export type ModuleCardState = {
  moduleNumber: number;
  unlocked: boolean;
  complete: boolean;
  /** "steps" for coaching modules, "lessons" for legacy lesson modules. */
  unit: "steps" | "lessons";
  done: number;
  total: number;
  /** Short, plain label for the card: "Step 3 of 5", "All 4 steps done", "Finish Module 1 to open". */
  label: string;
  percent: number;
};

function counts(mod: ProgressModule) {
  const steps = mod.stepCount > 0;
  const total = steps ? mod.stepCount : mod.lessonCount;
  const done = Math.min(steps ? mod.completedStepCount : mod.completedCount, total);
  return { unit: (steps ? "steps" : "lessons") as "steps" | "lessons", total, done };
}

/** Published modules in the learner's order, each with its plain-words card state. */
export function moduleCardStates<T extends ProgressModule>(modules: T[] | null | undefined): Array<T & { card: ModuleCardState }> {
  const ordered = sortModulesForUnlock((modules ?? []).filter((m) => m.status === undefined || m.status === "published"));
  return ordered.map((mod, index) => {
    const unlocked = typeof mod.unlocked === "boolean" ? mod.unlocked : isModuleUnlockedAtIndex(ordered, index);
    const { unit, total, done } = counts(mod);
    const complete = unlocked && mod.moduleComplete;
    const noun = unit === "steps" ? "Step" : "Lesson";
    let label: string;
    if (!unlocked) {
      // Name the earliest unfinished module before this one — that's what actually opens it.
      const blocker = ordered.findIndex((m, i) => i < index && !m.moduleComplete);
      label = `Finish Module ${(blocker >= 0 ? blocker : Math.max(index - 1, 0)) + 1} to open`;
    } else if (complete) {
      label = total > 0 ? `All ${total} ${unit} done` : "Done";
    } else if (total === 0) {
      label = "Coming soon";
    } else {
      label = `${noun} ${Math.min(done + 1, total)} of ${total}`;
    }
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { ...mod, card: { moduleNumber: index + 1, unlocked, complete, unit, done, total, label, percent } };
  });
}

export type NextCurriculumStep = {
  moduleId: number;
  moduleNumber: number;
  moduleTitle: string;
  kind: "step" | "lesson";
  itemNumber: number;
  total: number;
  /** Button text: "Continue: Module 2, Step 3". */
  label: string;
  /** Where the button goes: the coaching screen opens on the first unfinished step. */
  href: string;
};

/** The learner's next unfinished step (or lesson), or null when everything open is done. */
export function nextCurriculumStep(modules: ProgressModule[] | null | undefined): NextCurriculumStep | null {
  const states = moduleCardStates(modules);
  const next = states.find((m) => m.card.unlocked && !m.card.complete && m.card.total > 0);
  if (!next) return null;
  const kind = next.card.unit === "steps" ? "step" : "lesson";
  const itemNumber = Math.min(next.card.done + 1, next.card.total);
  return {
    moduleId: next.id,
    moduleNumber: next.card.moduleNumber,
    moduleTitle: next.title,
    kind,
    itemNumber,
    total: next.card.total,
    label: `Continue: Module ${next.card.moduleNumber}, ${kind === "step" ? "Step" : "Lesson"} ${itemNumber}`,
    href: kind === "step" ? `/curriculum/${next.id}/coaching` : `/curriculum/${next.id}`,
  };
}
