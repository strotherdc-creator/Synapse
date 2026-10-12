/**
 * Log Stats (WWLD) — shared stat definitions and pure helpers.
 *
 * Built-in stats map 1:1 to columns on `wwld_sessions`. Each doctor can hide
 * built-in stats they do not track and add up to MAX_CUSTOM_STATS custom stats.
 * Hiding a stat never deletes data: history keeps showing anything that was
 * actually logged.
 */

export const BUILTIN_STATS = [
  { key: "officeVisits", label: "Office Visits", alias: "OV" },
  { key: "newPatients", label: "New Patients", alias: "Day 1" },
  { key: "recall", label: "Recall", alias: "RC" },
  { key: "testResults", label: "Test Results", alias: "Day 2" },
  { key: "progressExams", label: "Progress Exams", alias: "PE" },
  { key: "performanceReviews", label: "Performance Reviews", alias: "PR" },
  { key: "carePlansSigned", label: "Care Plans Signed", alias: "CPS" },
  // Added Oct 2026 for Goals vs Log Stats (revenue's "actual"). Whole dollars. Unlike the stats
  // above, the column is NULL when not logged, so "no collections entered" is never read as $0.
  { key: "collections", label: "Collections ($)", alias: "Revenue" },
] as const;

export type BuiltinStatKey = (typeof BUILTIN_STATS)[number]["key"];

export const BUILTIN_STAT_KEYS: BuiltinStatKey[] = BUILTIN_STATS.map((s) => s.key);

/**
 * Built-in stats whose column is NULL (not 0) when nothing was entered. Rows saved before such a
 * stat existed never count it as tracked, and a NULL value is "not logged", never 0.
 */
export const NULLABLE_BUILTIN_STATS: readonly BuiltinStatKey[] = ["collections"];

export function isNullableBuiltinStat(key: string): boolean {
  return (NULLABLE_BUILTIN_STATS as readonly string[]).includes(key);
}

/** Largest value accepted for one session of a built-in stat. */
export const BUILTIN_STAT_MAX = 9999;
export const COLLECTIONS_MAX = 10_000_000;
export function builtinStatMax(key: BuiltinStatKey): number {
  return key === "collections" ? COLLECTIONS_MAX : BUILTIN_STAT_MAX;
}

/** How much the − / + buttons move a built-in stat (dollars move in $100 steps). */
export function builtinStatStep(key: BuiltinStatKey): number {
  return key === "collections" ? 100 : 1;
}

/** Display a built-in stat value (Collections as dollars). */
export function formatBuiltinStatValue(key: BuiltinStatKey, value: number): string {
  return key === "collections" ? `$${Math.round(value).toLocaleString("en-US")}` : value.toLocaleString("en-US");
}

export const MAX_CUSTOM_STATS = 3;
export const CUSTOM_STAT_NAME_MAX = 60;
export const CUSTOM_STAT_UNIT_MAX = 20;
export const CUSTOM_STAT_VALUE_MAX = 9_999_999;

export function isBuiltinStatKey(value: string): value is BuiltinStatKey {
  return (BUILTIN_STAT_KEYS as string[]).includes(value);
}

/** Parse a stored comma-separated key list, keeping only known built-in keys (in canonical order). */
export function parseStatKeyList(raw: string | null | undefined): BuiltinStatKey[] {
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((k) => k.trim()).filter(Boolean));
  return BUILTIN_STAT_KEYS.filter((k) => wanted.has(k));
}

/** Serialize a key list in canonical order for storage. */
export function serializeStatKeyList(keys: Iterable<string>): string {
  const wanted = new Set(keys);
  return BUILTIN_STAT_KEYS.filter((k) => wanted.has(k)).join(",");
}

/**
 * Built-in stats a doctor sees in their daily log.
 * No saved settings (null/empty hidden list) means every built-in stat is shown,
 * so existing doctors see no change until they edit their settings.
 */
export function enabledBuiltinStats(hiddenRaw: string | null | undefined): BuiltinStatKey[] {
  const hidden = new Set(parseStatKeyList(hiddenRaw));
  return BUILTIN_STAT_KEYS.filter((k) => !hidden.has(k));
}

/**
 * Which built-in stats were actually tracked on a saved session.
 * `tracked_stats` is NULL on every row saved before this feature existed; those
 * rows were logged with the full form, so every built-in stat counts as tracked.
 */
export function trackedBuiltinStats(trackedRaw: string | null | undefined): BuiltinStatKey[] {
  // Legacy rows predate the nullable stats (e.g. Collections), so those never count as tracked.
  if (trackedRaw === null || trackedRaw === undefined) return BUILTIN_STAT_KEYS.filter((k) => !isNullableBuiltinStat(k));
  return parseStatKeyList(trackedRaw);
}

/**
 * Merge the tracked list when an existing session is edited. Values for stats the
 * doctor did not submit are left untouched, so they stay tracked.
 * Returns null (= "all tracked", legacy meaning) when the result covers every stat
 * and the existing row was legacy.
 */
export function mergeTrackedStats(
  existingRaw: string | null | undefined,
  submitted: Iterable<string>,
): string | null {
  if (existingRaw === null || existingRaw === undefined) {
    // Legacy row = every original stat tracked. Adding a nullable stat (Collections) makes the
    // list explicit so the new stat counts as tracked from now on.
    const submittedList = [...submitted];
    if (!submittedList.some((k) => isNullableBuiltinStat(k))) return null;
    return serializeStatKeyList([...trackedBuiltinStats(null), ...submittedList]);
  }
  const merged = new Set<string>([...parseStatKeyList(existingRaw), ...submitted]);
  return serializeStatKeyList(merged);
}

/** Normalize a custom stat name for comparison (duplicate detection). */
export function normalizeCustomStatName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
