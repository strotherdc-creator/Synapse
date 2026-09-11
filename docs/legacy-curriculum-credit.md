# Legacy draft → published BTG progress credit

HOLD merge / prod writes until Head Dev GO. This path is reversible and does **not** delete draft progress.

## Why

Demoting lesson-seed modules 1–5 to `draft` hid them from learners but left `user_step_progress` on the old `module_id`s. Published Bridge-the-Gap modules 6–11 therefore look empty even when a learner (Marcus, user id 8, and anyone else on drafts 1–3) already completed equivalent work.

## Mapping (titles are not 1:1)

| Pos | Legacy draft (demoted) | Published BTG | Typical ids | Why |
| --- | --- | --- | --- | --- |
| 1 | Bridge the Gap: Foundation | Differentiation | 1→6 | Same opening arc: unique value / who you serve |
| 2 | Messaging & Positioning | Local Positioning | 2→7 | Positioning → local category. **Not** BTG Messaging |
| 3 | Content Creation System | Messaging | 3→8 | Closest prior to table-talk / stories |
| 4 | Patient Experience & Retention | Trust & Referral Generation | 4→9 | Experience / retention → trust + referrals |
| 5 | Growth Strategy & Metrics | Visibility — Weekly Rhythm | 5→10 | Growth cadence → weekly visibility |

BTG **Referral Identity** has no legacy pair.

Fallback id map `1→6 … 5→10` is used only when those rows still have the expected titles. Title match wins if ids differ.

## How credit works (default: read-time, no writes)

When computing curriculum unlock / module completion / step gating (`assertModuleUnlocked`, `modules.list`, `completeStep`, `getSteps`):

- A **fully completed** mapped draft (completed steps ≥ that draft's step count) satisfies the mapped BTG module. All of that BTG module's steps are treated complete for unlock and badges.
- **Partial** draft progress credits the first K published steps (`K = completed draft steps`).
- If draft steps were removed but progress rows remain, those completed rows still credit the first K BTG steps.
- Draft rows are left untouched.

Example (Marcus): Foundation 4/4 + Messaging & Positioning 5/5 + Content Creation 1/n → Differentiation complete, Local Positioning complete, Messaging 1 step credited → first 3 BTG modules unlocked.

## Dry-run counts

Admin (no writes):

```
trpc.adminStats.previewLegacyCurriculumCredit
```

Returns the mapping, `usersAffected`, `stepsWouldCredit`, `insertsNeeded`, and per-user pair rows (includes user id 8 when he has draft completions).

## Optional persist (still HOLD)

`trpc.adminStats.applyLegacyCurriculumCredit` defaults to dry-run. It writes BTG step rows only when **all** of these are true:

1. `SYNAPSE_LEGACY_CREDIT_APPLY=1`
2. `confirm: true`
3. `dryRun: false`

Apply is idempotent: it never overwrites an already-completed BTG step and never deletes draft progress.

## How to verify (after merge GO — not now)

1. Call `previewLegacyCurriculumCredit` on staging/prod replica. Confirm mapping ids and Marcus (user 8) row: 4+5+1 → modules 6+7 complete, module 8 has 1 credited step.
2. Log in as Marcus: Curriculum should show Differentiation + Local Positioning complete (or credited), Messaging unlocked.
3. Confirm draft `user_step_progress` rows on modules 1–5 still exist.
4. Do **not** run apply until Head Dev explicitly enables the env flag.

## Risk

- Virtual credit can mark BTG complete without a persisted BTG row until apply runs. Overlay keeps `getSteps` / unlock consistent.
- Wrong title match would credit the wrong module; resolver requires exact known titles (or verified fallback ids).
- Apply writes answers onto BTG steps (copy / placeholder). Reversible by deleting only the *new* BTG rows, never drafts.
