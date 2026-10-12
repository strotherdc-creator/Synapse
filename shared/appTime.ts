/**
 * Synapse's one calendar clock (Doc, Oct 10 2026): every "today", week, month and year is
 * counted in America/New_York, on the server AND in the browser, so Log Stats, Today's Plan,
 * Goals and the goals-vs-stats summary always agree no matter where the phone is.
 *
 * Date keys are plain "YYYY-MM-DD" strings. All arithmetic below is done on those keys in UTC,
 * so it never depends on the host's (or the phone's) own time zone or on DST.
 */
export const APP_TIME_ZONE = "America/New_York";

const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today's (or `date`'s) calendar date in New York, e.g. "2026-10-10". */
export function appDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
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
