/**
 * Log Stats — per-doctor settings, custom stats, and day-by-day history.
 *
 * Data rules:
 *  - Additive only. Unchecking a built-in stat or removing a custom stat never
 *    deletes stored values; custom stats are soft-archived (archived_at).
 *  - History returns only what is stored. Days with nothing logged are absent.
 */
import { and, asc, count, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb, isBacklogWwldSession, upsertWwldSession, type WwldSessionInput } from "../db";
import {
  wwldCustomStats,
  wwldCustomStatValues,
  wwldSessions,
  wwldStatSettings,
} from "../../shared/schema";
import {
  BUILTIN_STAT_KEYS,
  CUSTOM_STAT_NAME_MAX,
  CUSTOM_STAT_UNIT_MAX,
  CUSTOM_STAT_VALUE_MAX,
  MAX_CUSTOM_STATS,
  enabledBuiltinStats,
  normalizeCustomStatName,
  serializeStatKeyList,
  trackedBuiltinStats,
  type BuiltinStatKey,
} from "../../shared/wwldStats";

export class StatSettingsError extends Error {}

export type CustomStatDto = {
  id: number;
  name: string;
  unit: string | null;
  valueType: string;
  sortOrder: number;
  archived: boolean;
};

function toDto(row: typeof wwldCustomStats.$inferSelect): CustomStatDto {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    valueType: row.valueType,
    sortOrder: row.sortOrder,
    archived: row.archivedAt !== null,
  };
}

export async function getStatSettings(userId: number) {
  const db = await getDb();
  if (!db) {
    return { enabledBuiltinStats: [...BUILTIN_STAT_KEYS], customStats: [] as CustomStatDto[], hasSavedSettings: false };
  }
  const [settings] = await db
    .select()
    .from(wwldStatSettings)
    .where(eq(wwldStatSettings.userId, userId))
    .limit(1);
  const custom = await db
    .select()
    .from(wwldCustomStats)
    .where(and(eq(wwldCustomStats.userId, userId), isNull(wwldCustomStats.archivedAt)))
    .orderBy(asc(wwldCustomStats.sortOrder), asc(wwldCustomStats.id));
  return {
    enabledBuiltinStats: enabledBuiltinStats(settings?.hiddenBuiltinStats),
    customStats: custom.map(toDto),
    hasSavedSettings: Boolean(settings),
  };
}

export type SaveStatSettingsInput = {
  enabledBuiltinStats: string[];
  customStats: Array<{ id?: number; name: string; unit?: string | null }>;
};

/** Validate + normalize custom stat input. Pure; exported for tests. */
export function normalizeCustomStatsInput(customStats: SaveStatSettingsInput["customStats"]) {
  if (customStats.length > MAX_CUSTOM_STATS) {
    throw new StatSettingsError(`You can have at most ${MAX_CUSTOM_STATS} custom stats.`);
  }
  const seen = new Set<string>();
  return customStats.map((stat, index) => {
    const name = stat.name.trim().replace(/\s+/g, " ");
    if (!name) throw new StatSettingsError("Each custom stat needs a name.");
    if (name.length > CUSTOM_STAT_NAME_MAX) {
      throw new StatSettingsError(`Custom stat names must be ${CUSTOM_STAT_NAME_MAX} characters or fewer.`);
    }
    const key = normalizeCustomStatName(name);
    if (seen.has(key)) throw new StatSettingsError(`"${name}" is listed twice.`);
    seen.add(key);
    const unit = (stat.unit ?? "").trim();
    if (unit.length > CUSTOM_STAT_UNIT_MAX) {
      throw new StatSettingsError(`Units must be ${CUSTOM_STAT_UNIT_MAX} characters or fewer.`);
    }
    return { id: stat.id, name, unit: unit || null, sortOrder: index };
  });
}

/**
 * Lock namespace for per-doctor Log Stats writes (pg_advisory_xact_lock(ns, userId)).
 * Serializes settings saves and log submissions for ONE doctor; other doctors never wait.
 */
export const STAT_SETTINGS_LOCK_NAMESPACE = 72_001;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function lockDoctorStats(tx: DbTx, userId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(${STAT_SETTINGS_LOCK_NAMESPACE}, ${userId})`);
}

/**
 * Save a doctor's Log Stats settings atomically.
 *  - One transaction + a per-doctor advisory lock, so concurrent saves (double-tap,
 *    two tabs, phone + desktop) run one after another instead of interleaving.
 *  - Everything is validated BEFORE any write; any rejection rolls back the whole save
 *    (built-in checkboxes included).
 *  - Active custom stats are re-counted inside the transaction; more than 3 aborts.
 */
export async function saveStatSettings(userId: number, input: SaveStatSettingsInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Pure validation first (no DB access).
  const enabled = new Set(input.enabledBuiltinStats.filter((k) => (BUILTIN_STAT_KEYS as string[]).includes(k)));
  const custom = normalizeCustomStatsInput(input.customStats);
  if (enabled.size === 0 && custom.length === 0) {
    throw new StatSettingsError("Keep at least one stat checked (or add a custom stat) so there is something to log.");
  }
  const hidden = serializeStatKeyList(BUILTIN_STAT_KEYS.filter((k) => !enabled.has(k)));

  await db.transaction(async (tx) => {
    await lockDoctorStats(tx, userId);
    const now = new Date();

    // Read current state under the lock.
    const active = await tx
      .select()
      .from(wwldCustomStats)
      .where(and(eq(wwldCustomStats.userId, userId), isNull(wwldCustomStats.archivedAt)));
    const activeIds = new Set(active.map((row) => row.id));

    // Validate ids before writing anything.
    for (const stat of custom) {
      if (stat.id !== undefined && !activeIds.has(stat.id)) {
        throw new StatSettingsError("One of those custom stats no longer exists. Refresh the page and try again.");
      }
    }

    await tx
      .insert(wwldStatSettings)
      .values({ userId, hiddenBuiltinStats: hidden })
      .onConflictDoUpdate({
        target: wwldStatSettings.userId,
        set: { hiddenBuiltinStats: hidden, updatedAt: now },
      });

    const keepIds = new Set(custom.filter((s) => s.id !== undefined).map((s) => s.id as number));
    // Soft-archive removed custom stats: hidden from the log form, past values kept for history.
    const toArchive = active.filter((row) => !keepIds.has(row.id)).map((row) => row.id);
    if (toArchive.length > 0) {
      await tx
        .update(wwldCustomStats)
        .set({ archivedAt: now, updatedAt: now })
        .where(and(eq(wwldCustomStats.userId, userId), inArray(wwldCustomStats.id, toArchive)));
    }

    for (const stat of custom) {
      if (stat.id !== undefined) {
        await tx
          .update(wwldCustomStats)
          .set({ name: stat.name, unit: stat.unit, sortOrder: stat.sortOrder, updatedAt: now })
          .where(and(eq(wwldCustomStats.userId, userId), eq(wwldCustomStats.id, stat.id)));
      } else {
        await tx.insert(wwldCustomStats).values({
          userId,
          name: stat.name,
          unit: stat.unit,
          valueType: "number",
          sortOrder: stat.sortOrder,
        });
      }
    }

    // Final guard inside the transaction: never commit more than the cap.
    const [{ activeCount }] = await tx
      .select({ activeCount: count() })
      .from(wwldCustomStats)
      .where(and(eq(wwldCustomStats.userId, userId), isNull(wwldCustomStats.archivedAt)));
    if (Number(activeCount) > MAX_CUSTOM_STATS) {
      throw new StatSettingsError(`You can have at most ${MAX_CUSTOM_STATS} custom stats.`);
    }
  });

  return getStatSettings(userId);
}

/**
 * Save one log submission (built-in stats + custom stat values) atomically, under the
 * same per-doctor lock as settings saves. If any custom stat is not active, nothing is written.
 */
export async function logSessionWithCustomStats(
  input: WwldSessionInput,
  customStats: Array<{ customStatId: number; value: number }> = [],
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    await lockDoctorStats(tx, input.userId);
    if (customStats.length > 0) {
      await assertActiveCustomStatsWith(tx, input.userId, customStats.map((c) => c.customStatId));
    }
    const session = await upsertWwldSession(input, tx);
    if (customStats.length > 0) {
      await writeCustomStatValues(tx, input.userId, input.sessionDate, input.sessionType, customStats);
    }
    return session;
  });
}

async function assertActiveCustomStatsWith(executor: Db | DbTx, userId: number, customStatIds: number[]) {
  const ids = Array.from(new Set(customStatIds));
  if (ids.length === 0) return;
  const owned = await executor
    .select({ id: wwldCustomStats.id })
    .from(wwldCustomStats)
    .where(and(eq(wwldCustomStats.userId, userId), isNull(wwldCustomStats.archivedAt), inArray(wwldCustomStats.id, ids)));
  if (owned.length !== ids.length) {
    throw new StatSettingsError("One of your custom stats was changed or removed. Refresh the page and try again.");
  }
}

async function writeCustomStatValues(
  executor: Db | DbTx,
  userId: number,
  sessionDate: string,
  sessionType: string,
  values: Array<{ customStatId: number; value: number }>,
) {
  const now = new Date();
  for (const { customStatId, value } of values) {
    const safeValue = Math.max(0, Math.min(CUSTOM_STAT_VALUE_MAX, Math.trunc(value)));
    await executor
      .insert(wwldCustomStatValues)
      .values({ userId, customStatId, sessionDate, sessionType, value: safeValue })
      .onConflictDoUpdate({
        target: [
          wwldCustomStatValues.userId,
          wwldCustomStatValues.customStatId,
          wwldCustomStatValues.sessionDate,
          wwldCustomStatValues.sessionType,
        ],
        set: { value: safeValue, updatedAt: now },
      });
  }
}

/** Throw unless every id is an active custom stat owned by this doctor. */
export async function assertActiveCustomStats(userId: number, customStatIds: number[]) {
  if (customStatIds.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await assertActiveCustomStatsWith(db, userId, customStatIds);
}

/** Save custom stat values for one session. Only the doctor's active custom stats are accepted. */
export async function upsertCustomStatValues(
  userId: number,
  sessionDate: string,
  sessionType: string,
  values: Array<{ customStatId: number; value: number }>,
) {
  if (values.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await lockDoctorStats(tx, userId);
    await assertActiveCustomStatsWith(tx, userId, values.map((v) => v.customStatId));
    await writeCustomStatValues(tx, userId, sessionDate, sessionType, values);
  });
}

export async function getCustomStatValuesForDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      customStatId: wwldCustomStatValues.customStatId,
      sessionType: wwldCustomStatValues.sessionType,
      value: wwldCustomStatValues.value,
    })
    .from(wwldCustomStatValues)
    .where(and(eq(wwldCustomStatValues.userId, userId), eq(wwldCustomStatValues.sessionDate, date)));
}

export type HistorySession = {
  sessionType: string;
  isBacklogTotal: boolean;
  note: string | null;
  builtin: Partial<Record<BuiltinStatKey, number>>;
  custom: Record<string, number>; // customStatId -> value
};

export type HistoryDay = {
  date: string;
  sessions: HistorySession[];
};

/**
 * Everything actually stored for one calendar year, grouped by day.
 * Built-in values are included only where the stat was tracked on that row
 * (legacy rows count every built-in stat as tracked). Nothing is filled in.
 */
export async function getStatsHistoryForYear(userId: number, year: number) {
  const db = await getDb();
  const empty = { year, days: [] as HistoryDay[], customStats: [] as CustomStatDto[] };
  if (!db) return empty;

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const sessions = await db
    .select()
    .from(wwldSessions)
    .where(and(eq(wwldSessions.userId, userId), gte(wwldSessions.sessionDate, start), lte(wwldSessions.sessionDate, end)))
    .orderBy(asc(wwldSessions.sessionDate));

  const customValues = await db
    .select()
    .from(wwldCustomStatValues)
    .where(
      and(
        eq(wwldCustomStatValues.userId, userId),
        gte(wwldCustomStatValues.sessionDate, start),
        lte(wwldCustomStatValues.sessionDate, end),
      ),
    );

  // Include archived custom stats so their past values still have a name.
  const customStats = await db
    .select()
    .from(wwldCustomStats)
    .where(eq(wwldCustomStats.userId, userId))
    .orderBy(asc(wwldCustomStats.sortOrder), asc(wwldCustomStats.id));

  const byDay = new Map<string, Map<string, HistorySession>>();
  const sessionFor = (date: string, sessionType: string) => {
    let day = byDay.get(date);
    if (!day) {
      day = new Map();
      byDay.set(date, day);
    }
    let session = day.get(sessionType);
    if (!session) {
      session = { sessionType, isBacklogTotal: false, note: null, builtin: {}, custom: {} };
      day.set(sessionType, session);
    }
    return session;
  };

  for (const row of sessions) {
    const session = sessionFor(row.sessionDate, row.sessionType);
    session.isBacklogTotal = isBacklogWwldSession(row.notes);
    session.note = row.notes ?? null;
    for (const key of trackedBuiltinStats(row.trackedStats)) {
      session.builtin[key] = (row as Record<BuiltinStatKey, number>)[key] ?? 0;
    }
  }
  for (const row of customValues) {
    sessionFor(row.sessionDate, row.sessionType).custom[String(row.customStatId)] = row.value;
  }

  const order: Record<string, number> = { morning: 0, afternoon: 1, end_of_day: 2 };
  const days: HistoryDay[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, map]) => ({
      date,
      sessions: Array.from(map.values()).sort((a, b) => (order[a.sessionType] ?? 9) - (order[b.sessionType] ?? 9)),
    }));

  return { year, days, customStats: customStats.map(toDto) };
}
