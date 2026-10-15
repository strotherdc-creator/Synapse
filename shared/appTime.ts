/**
 * Synapse's calendar clock (Doc, Oct 15 2026): doctors use Synapse from around the world, so
 * every "today", week, month and year is counted in THAT DOCTOR'S own IANA time zone
 * (users.timezone), on the server AND in the browser, so Log Stats, Today's Plan, Goals and
 * the goals-vs-stats summary always agree. A missing or invalid zone falls back to
 * America/New_York.
 *
 * Date keys are plain "YYYY-MM-DD" strings. All arithmetic below is done on those keys in UTC,
 * so it never depends on the host's (or the phone's) own time zone or on DST.
 */
export const DEFAULT_TIME_ZONE = "America/New_York";
/** @deprecated kept for fixed-zone jobs (e.g. backup filenames); use the doctor's zone instead. */
export const APP_TIME_ZONE = DEFAULT_TIME_ZONE;

const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+){0,2}$/;
const validZoneCache = new Map<string, boolean>();

/** True for a real IANA zone name such as "Europe/London" (as the runtime's tz database knows it). */
export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0 || zone.length > 64 || !ZONE_PATTERN.test(zone)) {
    return false;
  }
  const cached = validZoneCache.get(zone);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    ok = true;
  } catch {
    ok = false;
  }
  validZoneCache.set(zone, ok);
  return ok;
}

/** The doctor's zone if it is valid, otherwise America/New_York. */
export function resolveTimeZone(zone?: string | null): string {
  return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

function zonedFields(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>;
}

/** Today's (or `date`'s) calendar date in `zone` (default New York), e.g. "2026-10-10". */
export function appDateKey(date: Date = new Date(), zone: string | null = DEFAULT_TIME_ZONE): string {
  const v = zonedFields(date, resolveTimeZone(zone));
  return `${v.year}-${v.month}-${v.day}`;
}

/** Wall-clock date key, weekday (0 = Sunday) and minutes past midnight in `zone`. */
export function zonedClock(date: Date, zone: string | null) {
  const v = zonedFields(date, resolveTimeZone(zone));
  const dateKey = `${v.year}-${v.month}-${v.day}`;
  return {
    dateKey,
    weekday: dayOfWeek(dateKey),
    minutes: Number(v.hour) * 60 + Number(v.minute),
  };
}

export function isDateKey(value: string): boolean {
  if (!KEY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Move a date key by whole calendar days. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date key. */
export function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** The Monday that starts the Mon–Sun week containing `dateKey`. */
export function mondayDateKey(dateKey: string): string {
  const dow = dayOfWeek(dateKey);
  return shiftDateKey(dateKey, dow === 0 ? -6 : 1 - dow);
}

export function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function yearStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 4)}-01-01`;
}

/** Inclusive list of date keys from start to end (empty when end < start). */
export function dateKeysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end; k = shiftDateKey(k, 1)) out.push(k);
  return out;
}

/** Three-letter lower-case weekday ("mon") for a date key. */
export function weekdayShort(dateKey: string): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayOfWeek(dateKey)];
}
