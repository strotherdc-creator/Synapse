/**
 * Legacy draft → published BTG progress credit.
 *
 * Default path is a read-time overlay (no writes): computeModuleComplete,
 * modules.list, coaching.getSteps / getModuleProgress, and step gating treat
 * mapped draft completions as satisfying the corresponding BTG module/steps.
 * Draft progress rows are never deleted.
 *
 * Optional persist (admin apply) copies answers onto BTG step rows. It is
 * dry-run by default and requires SYNAPSE_LEGACY_CREDIT_APPLY=1 plus confirm.
 */
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import {
  buildLegacyCreditProjection,
  creditedStepNumbers,
  getCreditedAnswer,
  isBtgModuleFullyCredited,
  isBtgStepCredited,
  LEGACY_TO_BTG_CREDIT_MAP,
  mergeCoachingCompletion,
  planModuleCredit,
  type LegacyCreditProjection,
  type ResolvedCreditPair,
} from "../shared/curriculumUnlock";

export const LEGACY_CREDIT_APPLY_ENV = "SYNAPSE_LEGACY_CREDIT_APPLY";

export type LegacyCreditIndex = LegacyCreditProjection;

export async function loadLegacyCreditIndex(userId: number): Promise<LegacyCreditIndex> {
  const [modules, steps, progress] = await Promise.all([
    db.listModules(false),
    db.listAllModuleSteps(),
    db.getAllUserStepProgress(userId),
  ]);
  return buildLegacyCreditProjection({
    modules: modules.map((m) => ({ id: m.id, title: m.title })),
    steps: steps.map((s) => ({ id: s.id, moduleId: s.moduleId, stepNumber: s.stepNumber })),
    progress: progress.map((p) => ({
      userId: p.userId,
      moduleId: p.moduleId,
      stepId: p.stepId,
      completed: p.completed,
      finalAnswer: p.finalAnswer,
    })),
  });
}

export function mergeModuleCoachingProgress(
  index: LegacyCreditIndex,
  moduleId: number,
  steps: Array<{ id: number; stepNumber: number }>,
  stepProgress: Array<{ stepId: number; completed: boolean }>
) {
  const actualCompletedStepIds = new Set(
    stepProgress.filter((p) => p.completed).map((p) => p.stepId)
  );
  return mergeCoachingCompletion({
    steps,
    actualCompletedStepIds,
    creditedStepNumbers: creditedStepNumbers(index, moduleId),
  });
}

export function moduleSatisfiedByLegacy(index: LegacyCreditIndex, moduleId: number, stepCount: number): boolean {
  return isBtgModuleFullyCredited(index, moduleId, stepCount);
}

export function stepSatisfiedByLegacy(
  index: LegacyCreditIndex,
  moduleId: number,
  stepNumber: number
): boolean {
  return isBtgStepCredited(index, moduleId, stepNumber);
}

export function creditedAnswerForStep(
  index: LegacyCreditIndex,
  moduleId: number,
  stepNumber: number
): string | null {
  return getCreditedAnswer(index, moduleId, stepNumber);
}

export type LegacyCreditUserRow = {
  userId: number;
  name: string | null;
  email: string | null;
  pairs: Array<{
    position: number;
    legacyModuleId: number | null;
    legacyTitle: string;
    btgModuleId: number | null;
    btgTitle: string;
    legacyCompletedSteps: number;
    legacyStepCount: number;
    btgStepCount: number;
    alreadyCompletedBtgSteps: number;
    wouldCreditSteps: number;
    wouldCompleteBtgModule: boolean;
    insertsNeeded: number;
  }>;
  totalWouldCreditSteps: number;
  totalInsertsNeeded: number;
  modulesWouldComplete: number;
};

export type LegacyCreditPreview = {
  mapping: Array<{
    position: number;
    legacyTitle: string;
    btgTitle: string;
    rationale: string;
    legacyId: number | null;
    btgId: number | null;
    usedFallbackId: boolean;
  }>;
  usersAffected: number;
  usersWithInserts: number;
  stepsWouldCredit: number;
  insertsNeeded: number;
  modulesWouldComplete: number;
  users: LegacyCreditUserRow[];
  destructiveDeletes: false;
  applyEnabled: boolean;
};

function countCompletedOnModule(
  progress: Array<{ moduleId: number; completed: boolean }>,
  moduleId: number
): number {
  return progress.filter((p) => p.moduleId === moduleId && p.completed).length;
}

function buildUserRow(input: {
  userId: number;
  name: string | null;
  email: string | null;
  pairs: ResolvedCreditPair[];
  steps: Array<{ id: number; moduleId: number; stepNumber: number }>;
  userProgress: Array<{ moduleId: number; stepId: number; completed: boolean }>;
}): LegacyCreditUserRow {
  const pairRows = input.pairs.map((pair) => {
    const legacyStepCount =
      pair.legacyId == null
        ? 0
        : input.steps.filter((s) => s.moduleId === pair.legacyId).length;
    const btgSteps =
      pair.btgId == null
        ? []
        : input.steps
            .filter((s) => s.moduleId === pair.btgId)
            .sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);
    const legacyCompletedSteps =
      pair.legacyId == null ? 0 : countCompletedOnModule(input.userProgress, pair.legacyId);
    const alreadyCompletedBtgSteps =
      pair.btgId == null ? 0 : countCompletedOnModule(input.userProgress, pair.btgId);
    const plan = planModuleCredit({
      legacyCompletedSteps,
      legacyStepCount,
      btgStepCount: btgSteps.length,
    });
    const alreadyIds = new Set(
      input.userProgress
        .filter((p) => p.moduleId === pair.btgId && p.completed)
        .map((p) => p.stepId)
    );
    const insertsNeeded = btgSteps
      .slice(0, plan.creditStepCount)
      .filter((s) => !alreadyIds.has(s.id)).length;
    return {
      position: pair.position,
      legacyModuleId: pair.legacyId,
      legacyTitle: pair.legacyTitle,
      btgModuleId: pair.btgId,
      btgTitle: pair.btgTitle,
      legacyCompletedSteps,
      legacyStepCount,
      btgStepCount: btgSteps.length,
      alreadyCompletedBtgSteps,
      wouldCreditSteps: plan.creditStepCount,
      wouldCompleteBtgModule: plan.completeBtg,
      insertsNeeded,
    };
  });

  return {
    userId: input.userId,
    name: input.name,
    email: input.email,
    pairs: pairRows,
    totalWouldCreditSteps: pairRows.reduce((sum, row) => sum + row.wouldCreditSteps, 0),
    totalInsertsNeeded: pairRows.reduce((sum, row) => sum + row.insertsNeeded, 0),
    modulesWouldComplete: pairRows.filter((row) => row.wouldCompleteBtgModule).length,
  };
}

export async function previewLegacyCurriculumCredit(filterUserId?: number): Promise<LegacyCreditPreview> {
  const [modules, steps, completedProgress] = await Promise.all([
    db.listModules(false),
    db.listAllModuleSteps(),
    db.listCompletedStepProgress(),
  ]);
  const pairs = buildLegacyCreditProjection({
    modules: modules.map((m) => ({ id: m.id, title: m.title })),
    steps: steps.map((s) => ({ id: s.id, moduleId: s.moduleId, stepNumber: s.stepNumber })),
    progress: [],
  }).pairs;

  const legacyIds = new Set(pairs.map((p) => p.legacyId).filter((id): id is number => id != null));
  const candidateUserIds = new Set(
    completedProgress
      .filter((p) => legacyIds.has(p.moduleId))
      .map((p) => p.userId)
      .filter((id) => (filterUserId == null ? true : id === filterUserId))
  );

  const users = await db.listUsersByIds([...candidateUserIds]);
  const userById = new Map(users.map((u) => [u.id, u]));

  const rows: LegacyCreditUserRow[] = [];
  for (const userId of candidateUserIds) {
    const userProgress = completedProgress.filter((p) => p.userId === userId);
    const profile = userById.get(userId);
    const row = buildUserRow({
      userId,
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      pairs,
      steps: steps.map((s) => ({ id: s.id, moduleId: s.moduleId, stepNumber: s.stepNumber })),
      userProgress,
    });
    if (row.totalWouldCreditSteps > 0) rows.push(row);
  }
  rows.sort((a, b) => a.userId - b.userId);

  return {
    mapping: pairs.map((p) => ({
      position: p.position,
      legacyTitle: p.legacyTitle,
      btgTitle: p.btgTitle,
      rationale: p.rationale,
      legacyId: p.legacyId,
      btgId: p.btgId,
      usedFallbackId: p.usedFallbackId,
    })),
    usersAffected: rows.length,
    usersWithInserts: rows.filter((r) => r.totalInsertsNeeded > 0).length,
    stepsWouldCredit: rows.reduce((sum, r) => sum + r.totalWouldCreditSteps, 0),
    insertsNeeded: rows.reduce((sum, r) => sum + r.totalInsertsNeeded, 0),
    modulesWouldComplete: rows.reduce((sum, r) => sum + r.modulesWouldComplete, 0),
    users: rows,
    destructiveDeletes: false,
    applyEnabled: process.env[LEGACY_CREDIT_APPLY_ENV] === "1",
  };
}

export async function applyLegacyCurriculumCredit(input: {
  dryRun?: boolean;
  confirm?: boolean;
  userId?: number;
}): Promise<LegacyCreditPreview & { applied: boolean; inserted: number }> {
  const dryRun = input.dryRun !== false;
  const preview = await previewLegacyCurriculumCredit(input.userId);

  if (dryRun || !input.confirm) {
    return { ...preview, applied: false, inserted: 0 };
  }
  if (process.env[LEGACY_CREDIT_APPLY_ENV] !== "1") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Persist disabled. Set ${LEGACY_CREDIT_APPLY_ENV}=1 after Head Dev GO, then call with dryRun=false and confirm=true.`,
    });
  }

  const [modules, steps, completedProgress] = await Promise.all([
    db.listModules(false),
    db.listAllModuleSteps(),
    db.listCompletedStepProgress(),
  ]);
  const indexPairs = buildLegacyCreditProjection({
    modules: modules.map((m) => ({ id: m.id, title: m.title })),
    steps: steps.map((s) => ({ id: s.id, moduleId: s.moduleId, stepNumber: s.stepNumber })),
    progress: [],
  }).pairs;

  let inserted = 0;
  for (const row of preview.users) {
    const userProgress = completedProgress.filter((p) => p.userId === row.userId);
    const projection = buildLegacyCreditProjection({
      modules: modules.map((m) => ({ id: m.id, title: m.title })),
      steps: steps.map((s) => ({ id: s.id, moduleId: s.moduleId, stepNumber: s.stepNumber })),
      progress: userProgress,
    });
    for (const pair of indexPairs) {
      if (pair.legacyId == null || pair.btgId == null) continue;
      const btgSteps = steps
        .filter((s) => s.moduleId === pair.btgId)
        .sort((a, b) => a.stepNumber - b.stepNumber || a.id - b.id);
      const already = new Set(
        userProgress.filter((p) => p.moduleId === pair.btgId && p.completed).map((p) => p.stepId)
      );
      const creditNums = creditedStepNumbers(projection, pair.btgId);
      for (const step of btgSteps) {
        if (!creditNums.includes(step.stepNumber) || already.has(step.id)) continue;
        const raw = getCreditedAnswer(projection, pair.btgId, step.stepNumber);
        const answer =
          (raw && raw.trim()) ||
          `[Credited from legacy module ${pair.legacyId} "${pair.legacyTitle}" step ${step.stepNumber}]`;
        await db.completeStep(row.userId, pair.btgId, step.id, answer);
        inserted++;
      }
    }
  }

  const after = await previewLegacyCurriculumCredit(input.userId);
  return { ...after, applied: true, inserted };
}

export const LEGACY_CREDIT_MAP_FOR_DOCS = LEGACY_TO_BTG_CREDIT_MAP;
