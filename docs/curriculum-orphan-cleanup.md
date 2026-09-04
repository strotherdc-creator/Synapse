# Curriculum orphan cleanup (one-time)

Use after deploying seed claim-exclusion / Bridge-the-Gap ensure (`seedCoachingSteps`).

## When you need this

Deploy logs or Admin show:

- Coaching steps sitting on **non–Bridge-the-Gap** modules (e.g. lesson-seed titles like `Bridge the Gap: Foundation`, `Messaging & Positioning`)
- Duplicate modules (old lesson rows **and** new BTG rows)
- `module_steps` rows whose `module_id` no longer exists (true orphans after hard deletes before cascade landed)

The startup seed **does not delete or move** existing steps. It only:

1. Ensures the 6 BTG modules exist (create / rename Referral Identity candidates)
2. Seeds steps onto BTG modules that still have **zero** steps

## Inspect

```sql
-- Modules + step counts
SELECT m.id, m.title, m.sort_order, m.status, COUNT(s.id) AS step_count
FROM modules m
LEFT JOIN module_steps s ON s.module_id = m.id
GROUP BY m.id
ORDER BY m.sort_order, m.id;

-- Steps on modules that are NOT the 6 BTG canonical titles
SELECT m.id, m.title, COUNT(s.id) AS steps
FROM modules m
JOIN module_steps s ON s.module_id = m.id
WHERE lower(m.title) NOT IN (
  'differentiation',
  'local positioning',
  'messaging',
  'trust & referral generation',
  'visibility — weekly rhythm',
  'referral identity'
)
GROUP BY m.id, m.title
ORDER BY m.id;

-- True orphan steps (no parent module)
SELECT s.module_id, COUNT(*) AS steps
FROM module_steps s
LEFT JOIN modules m ON m.id = s.module_id
WHERE m.id IS NULL
GROUP BY s.module_id;
```

## Safe cleanup (run only after backup)

Prefer **draft/archive** old lesson modules in Admin if doctors still need reference lessons.

To remove steps from wrong modules (destructive — also clears progress/chat for those steps):

```sql
BEGIN;

-- Example: collect step ids on non-BTG modules
WITH wrong AS (
  SELECT s.id AS step_id
  FROM module_steps s
  JOIN modules m ON m.id = s.module_id
  WHERE lower(m.title) NOT IN (
    'differentiation',
    'local positioning',
    'messaging',
    'trust & referral generation',
    'visibility — weekly rhythm',
    'referral identity'
  )
)
DELETE FROM step_chat_messages
WHERE step_id IN (SELECT step_id FROM wrong);

WITH wrong AS (
  SELECT s.id AS step_id, s.module_id
  FROM module_steps s
  JOIN modules m ON m.id = s.module_id
  WHERE lower(m.title) NOT IN (
    'differentiation',
    'local positioning',
    'messaging',
    'trust & referral generation',
    'visibility — weekly rhythm',
    'referral identity'
  )
)
DELETE FROM user_step_progress
WHERE step_id IN (SELECT step_id FROM wrong)
   OR module_id IN (SELECT DISTINCT module_id FROM wrong);

DELETE FROM module_steps s
USING modules m
WHERE s.module_id = m.id
  AND lower(m.title) NOT IN (
    'differentiation',
    'local positioning',
    'messaging',
    'trust & referral generation',
    'visibility — weekly rhythm',
    'referral identity'
  );

COMMIT;
```

Then **restart** the Synapse service so `seedCoachingSteps` can attach steps to any still-empty BTG modules.

## Optional: hide old lesson-seed modules

If the five lesson-seed modules should not appear in Curriculum unlock order, set them to `draft` or raise `sort_order` above 100 in Admin (or SQL) after BTG modules occupy sort_order 1–6.
