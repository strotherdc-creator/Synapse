/**
 * The browser's copy of the doctor's own calendar clock (Oct 15 2026).
 *
 * The zone comes from the doctor's profile (users.timezone) so the browser and the server agree
 * on "today", this week, month and year even when the phone is set to another zone. Until a zone
 * is saved, the browser's detected zone is used (and saved once), falling back to New York.
 */
import { appDateKey, DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from "@shared/appTime";

let currentZone = DEFAULT_TIME_ZONE;

/** The phone/computer's own IANA zone, or null if the browser can't tell us a valid one. */
export function detectBrowserTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/**
 * The zone the SERVER uses for this doctor: the saved profile zone if valid, else New York.
 * The browser uses exactly this (never the phone's zone until it has been saved), so both
 * sides always agree on "today" — e.g. Log Stats' same-day check never rejects an entry.
 */
export function serverMatchingTimeZone(saved: string | null | undefined): string {
  return resolveTimeZone(saved);
}

/** Suggested zone for the Profile picker: saved zone if valid, else this device's, else New York. */
export function chooseClientTimeZone(saved: string | null | undefined): string {
  if (isValidTimeZone(saved)) return saved;
  return detectBrowserTimeZone() ?? DEFAULT_TIME_ZONE;
}

export function setClientTimeZone(zone: string | null | undefined): void {
  currentZone = resolveTimeZone(zone);
}

export function getClientTimeZone(): string {
  return currentZone;
}

/** Today's (or `date`'s) "YYYY-MM-DD" on the doctor's own calendar. */
export function userDateKey(date: Date = new Date()): string {
  return appDateKey(date, currentZone);
}

/** All IANA zone names this browser knows (for the Profile picker). */
export function listTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  try {
    const zones = supported ? supported("timeZone") : [];
    if (zones.length > 0) return zones.includes("UTC") ? zones : [...zones, "UTC"];
  } catch {
    // fall through
  }
  return [
    "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
    "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver", "America/Mexico_City",
    "America/Sao_Paulo", "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
    "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Perth",
    "Australia/Brisbane", "Australia/Sydney", "Pacific/Auckland", "UTC",
  ];
}
