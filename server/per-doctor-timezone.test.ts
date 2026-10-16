/**
 * Per-doctor time zone (Oct 15 2026): each doctor's day, week, month and year follow THEIR
 * zone (users.timezone); invalid or missing zones fall back to America/New_York. Pure; no DB.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_TIME_ZONE,
  appDateKey,
  isValidTimeZone,
  mondayDateKey,
  monthStartKey,
  resolveTimeZone,
  weekdayShort,
  yearStartKey,
  zonedClock,
} from "../shared/appTime";
import { buildGoalsComparison, periodRanges, type ComparisonSessionRow } from "../shared/goalsComparison";
import { BUILTIN_STAT_KEYS } from "../shared/wwldStats";
import { getAppDateKey, userTimeZone } from "./db";
import {
  DAILY_REMINDER,
  WEEKLY_REVIEW,
  isLocalSendWindow,
} from "./engagement/email-reminders";

const LA = "America/Los_Angeles";
const LONDON = "Europe/London";
const SYDNEY = "Australia/Sydney";
const NY = "America/New_York";

describe("zone validation and fallback", () => {
  it("accepts real IANA zones and rejects junk", () => {
    for (const z of [LA, LONDON, SYDNEY, NY, "Asia/Kolkata", "UTC", "America/Argentina/Buenos_Aires"]) {
      expect(isValidTimeZone(z)).toBe(true);
    }
    for (const z of ["", "Mars/Olympus", "America/Nowhere", "EST5EDT; DROP TABLE users", "../etc/passwd", null, undefined, 42, "a".repeat(80)]) {
      expect(isValidTimeZone(z)).toBe(false);
    }
  });

  it("falls back to America/New_York for missing or invalid zones", () => {
    expect(DEFAULT_TIME_ZONE).toBe(NY);
    expect(resolveTimeZone(null)).toBe(NY);
    expect(resolveTimeZone("")).toBe(NY);
    expect(resolveTimeZone("Not/AZone")).toBe(NY);
    expect(resolveTimeZone(LONDON)).toBe(LONDON);
    expect(userTimeZone({ timezone: "garbage" })).toBe(NY);
    expect(userTimeZone(null)).toBe(NY);
    expect(userTimeZone({ timezone: SYDNEY })).toBe(SYDNEY);
    const instant = new Date("2026-10-15T03:30:00Z"); // NY: Oct 14 11:30 PM
    expect(appDateKey(instant, "Bogus/Zone")).toBe("2026-10-14");
    expect(getAppDateKey(instant, undefined)).toBe("2026-10-14");
    expect(getAppDateKey(instant, "Bogus/Zone")).toBe("2026-10-14");
  });
});

describe("client zone matches the server until saved", () => {
  it("serverMatchingTimeZone = saved zone if valid, else New York (never the phone's zone)", async () => {
    const { serverMatchingTimeZone } = await import("../client/src/lib/userTime");
    expect(serverMatchingTimeZone(null)).toBe(NY);
    expect(serverMatchingTimeZone("")).toBe(NY);
    expect(serverMatchingTimeZone("Bogus/Zone")).toBe(NY);
    expect(serverMatchingTimeZone(SYDNEY)).toBe(SYDNEY);
  });
});

describe("day boundaries follow each doctor's own zone", () => {
  it("same instant, different 'today' in LA, NY, London and Sydney", () => {
    const instant = new Date("2026-10-15T06:30:00Z");
    expect(appDateKey(instant, LA)).toBe("2026-10-14"); // 11:30 PM Oct 14
    expect(appDateKey(instant, NY)).toBe("2026-10-15"); // 2:30 AM
    expect(appDateKey(instant, LONDON)).toBe("2026-10-15"); // 7:30 AM BST
    expect(appDateKey(instant, SYDNEY)).toBe("2026-10-15"); // 5:30 PM AEDT
    expect(getAppDateKey(instant, LA)).toBe("2026-10-14");
  });

  it("midnight is midnight local: one minute either side", () => {
    expect(appDateKey(new Date("2026-10-15T06:59:00Z"), LA)).toBe("2026-10-14"); // 11:59 PM PDT
    expect(appDateKey(new Date("2026-10-15T07:00:00Z"), LA)).toBe("2026-10-15"); // 12:00 AM PDT
    expect(appDateKey(new Date("2026-10-14T12:59:00Z"), SYDNEY)).toBe("2026-10-14"); // 11:59 PM AEDT
    expect(appDateKey(new Date("2026-10-14T13:00:00Z"), SYDNEY)).toBe("2026-10-15");
  });
});

describe("week, month and year boundaries per zone", () => {
  it("week: Sunday night in LA is still last week; it's already Monday in Sydney", () => {
    const instant = new Date("2026-10-19T05:00:00Z"); // LA Sun Oct 18 10 PM; Sydney Mon Oct 19 4 PM
    expect(mondayDateKey(appDateKey(instant, LA))).toBe("2026-10-12");
    expect(mondayDateKey(appDateKey(instant, SYDNEY))).toBe("2026-10-19");
    expect(mondayDateKey(appDateKey(instant, LONDON))).toBe("2026-10-19"); // Mon 6 AM BST
  });

  it("month: Oct 31 evening in LA is November in London", () => {
    const instant = new Date("2026-11-01T02:00:00Z"); // LA Oct 31 7 PM; London Nov 1 2 AM (GMT)
    expect(monthStartKey(appDateKey(instant, LA))).toBe("2026-10-01");
    expect(monthStartKey(appDateKey(instant, LONDON))).toBe("2026-11-01");
  });

  it("year: New Year's Eve in LA is already the new year in Sydney and London", () => {
    const instant = new Date("2027-01-01T03:00:00Z"); // LA Dec 31 7 PM; NY 10 PM; London 3 AM; Sydney 2 PM
    expect(yearStartKey(appDateKey(instant, LA))).toBe("2026-01-01");
    expect(yearStartKey(appDateKey(instant, NY))).toBe("2026-01-01");
    expect(yearStartKey(appDateKey(instant, LONDON))).toBe("2027-01-01");
    expect(yearStartKey(appDateKey(instant, SYDNEY))).toBe("2027-01-01");
    expect(periodRanges(appDateKey(instant, SYDNEY)).year).toEqual({ start: "2027-01-01", end: "2027-01-01" });
    expect(periodRanges(appDateKey(instant, LA)).year).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("DST transitions", () => {
  it("US spring forward (Mar 8 2026): LA midnight moves from UTC-8 to UTC-7", () => {
    expect(appDateKey(new Date("2026-03-08T07:59:00Z"), LA)).toBe("2026-03-07"); // 11:59 PM PST
    expect(appDateKey(new Date("2026-03-08T08:00:00Z"), LA)).toBe("2026-03-08");
    expect(appDateKey(new Date("2026-03-09T06:59:00Z"), LA)).toBe("2026-03-08"); // 11:59 PM PDT
    expect(appDateKey(new Date("2026-03-09T07:00:00Z"), LA)).toBe("2026-03-09");
  });

  it("UK fall back (Oct 25 2026): London midnight before is UTC+1, after is UTC+0", () => {
    expect(appDateKey(new Date("2026-10-24T22:59:00Z"), LONDON)).toBe("2026-10-24");
    expect(appDateKey(new Date("2026-10-24T23:00:00Z"), LONDON)).toBe("2026-10-25"); // BST midnight
    expect(appDateKey(new Date("2026-10-25T23:59:00Z"), LONDON)).toBe("2026-10-25"); // GMT 11:59 PM
    expect(appDateKey(new Date("2026-10-26T00:00:00Z"), LONDON)).toBe("2026-10-26");
  });

  it("Sydney DST starts Oct 4 2026 (AEST → AEDT)", () => {
    expect(appDateKey(new Date("2026-10-03T13:59:00Z"), SYDNEY)).toBe("2026-10-03"); // AEST 11:59 PM
    expect(appDateKey(new Date("2026-10-03T14:00:00Z"), SYDNEY)).toBe("2026-10-04");
    expect(appDateKey(new Date("2026-10-04T12:59:00Z"), SYDNEY)).toBe("2026-10-04"); // AEDT 11:59 PM
    expect(appDateKey(new Date("2026-10-04T13:00:00Z"), SYDNEY)).toBe("2026-10-05");
  });

  it("zonedClock reports local wall time across DST", () => {
    expect(zonedClock(new Date("2026-03-09T14:30:00Z"), LA)).toEqual({ dateKey: "2026-03-09", weekday: 1, minutes: 7 * 60 + 30 });
    expect(zonedClock(new Date("2026-03-06T15:30:00Z"), LA)).toEqual({ dateKey: "2026-03-06", weekday: 5, minutes: 7 * 60 + 30 });
    expect(weekdayShort("2026-10-15")).toBe("thu");
  });
});

describe("Goals comparison uses the doctor's own 'today'", () => {
  const GOALS = { yearlyRevenue: 900_000, yearlyOfficeVisits: 9_000, yearlyNewPatients: 450, weeksWorked: 50 };
  const SCHEDULE = "mon:full,tue:full,wed:full,thu:full,fri:full,sat:off,sun:off";
  const row = (date: string, officeVisits: number): ComparisonSessionRow =>
    ({ sessionDate: date, notes: null, trackedStats: "officeVisits,newPatients,collections", officeVisits, newPatients: 0, collections: null });

  it("Monday morning in Sydney is a new week; in LA it is still last Sunday", () => {
    const instant = new Date("2026-10-18T22:00:00Z"); // Sydney Mon Oct 19 9 AM; LA Sun Oct 18 3 PM
    const rows = [row("2026-10-16", 30), row("2026-10-19", 12)];
    const build = (zone: string) =>
      buildGoalsComparison({ today: appDateKey(instant, zone), goalYear: 2026, goals: GOALS, workDays: SCHEDULE, enabledStats: [...BUILTIN_STAT_KEYS], rows });
    const sydney = build(SYDNEY);
    const la = build(LA);
    expect(sydney.asOf).toBe("2026-10-19");
    expect(la.asOf).toBe("2026-10-18");
    const week = (c: ReturnType<typeof build>) => c.periods.find((p) => p.period === "week")!;
    const ov = (c: ReturnType<typeof build>) => week(c).metrics.find((m) => m.metric === "officeVisits")!.result;
    expect(ov(sydney)).toMatchObject({ actual: 12 }); // only Mon Oct 19
    expect(ov(la)).toMatchObject({ actual: 30 }); // Mon Oct 12 – Sun Oct 18 (Oct 19 is tomorrow in LA)
  });
});

describe("reminder emails at 7:30 AM in each doctor's own zone", () => {
  afterEach(() => vi.useRealTimers());

  it("an every-15-minutes tick picks only the doctors whose local time is 7:30 on a weekday", () => {
    const tick = new Date("2026-10-15T14:30:00Z"); // Thu: LA 7:30 AM, NY 10:30, London 3:30 PM
    expect(isLocalSendWindow(tick, LA, DAILY_REMINDER)).toBe(true);
    expect(isLocalSendWindow(tick, NY, DAILY_REMINDER)).toBe(false);
    expect(isLocalSendWindow(new Date("2026-10-15T06:30:00Z"), LONDON, DAILY_REMINDER)).toBe(true); // 7:30 BST
    expect(isLocalSendWindow(new Date("2026-10-14T20:30:00Z"), SYDNEY, DAILY_REMINDER)).toBe(true); // Thu 7:30 AEDT
    expect(isLocalSendWindow(new Date("2026-10-15T11:30:00Z"), "Bogus/Zone", DAILY_REMINDER)).toBe(true); // falls back to NY
  });

  it("each doctor matches exactly one tick per day, and none on weekends", () => {
    const count = (zone: string, day: string) => {
      let n = 0;
      const start = Date.parse(`${day}T00:00:00Z`) - 86_400_000;
      for (let t = start; t < start + 3 * 86_400_000; t += 15 * 60_000) {
        const now = new Date(t);
        if (isLocalSendWindow(now, zone, DAILY_REMINDER) && appDateKey(now, zone) === day) n++;
      }
      return n;
    };
    for (const zone of [LA, NY, LONDON, SYDNEY, "Asia/Kolkata", "Asia/Kathmandu"]) {
      expect(count(zone, "2026-10-15")).toBe(1); // Thursday
      expect(count(zone, "2026-10-17")).toBe(0); // Saturday
      expect(count(zone, "2026-03-09")).toBe(1); // Monday after US spring-forward
    }
  });

  it("weekly review: Friday 5 PM local", () => {
    expect(isLocalSendWindow(new Date("2026-10-16T16:00:00Z"), LONDON, WEEKLY_REVIEW)).toBe(true); // Fri 5 PM BST
    expect(isLocalSendWindow(new Date("2026-10-16T16:00:00Z"), NY, WEEKLY_REVIEW)).toBe(false); // Fri noon
  });
});

describe("wiring: every server date uses the requesting doctor's zone", () => {
  const src = (f: string) => readFileSync(f, "utf8");
  it("routers, engagement, goals, WWLD Coach and the Lyle quote SQL take the zone", () => {
    const routers = src("server/routers.ts");
    expect(routers.match(/db\.getAppDateKey\(\)/g)).toBeNull();
    expect(routers).toContain("db.shiftDateKey(db.getAppDateKey(new Date(), ctx.user.timezone), -30)");
    expect(routers).toContain("goals.getGoalsComparison(ctx.user.id, workDays, input?.goalYear, ctx.user.timezone)");
    const engagement = src("server/engagement/router.ts");
    expect(engagement).not.toContain("todayStr()");
    expect(engagement).toContain("shiftDateKey(todayStr(ctx.user.timezone), 1)");
    expect(engagement).not.toContain("new Date().getFullYear()");
    expect(src("server/goals/goals.ts")).toContain("getAppDateKey(new Date(), zone)");
    expect(src("server/wwld-coach/router.ts")).toContain("buildWwldContext(user.id, user.timezone)");
    expect(src("server/db.ts")).not.toContain("AT TIME ZONE 'America/New_York'");
    const reminders = src("server/engagement/email-reminders.ts");
    expect(reminders).toContain("const weekStartStr = mondayDateKey(localDate);");
    expect(reminders).toContain("const localDate = zonedClock(now, zone).dateKey;");
    // Claim in the send-log before sending; one query joins users; per-recipient try/catch.
    expect(reminders.indexOf("claimReminderSend(db, r.userId, kind, localDate)")).toBeLessThan(reminders.indexOf("getTransporter().sendMail"));
    expect(reminders).toContain(".innerJoin(users, eq(users.id, userEngagementPreferences.userId))");
    expect(reminders).not.toContain("db.select().from(users).where(eq(users.id, pref.userId))");
    expect(reminders).not.toContain("toISOString()");
  });

  it("the browser uses the profile zone, never the bare New York helper", () => {
    for (const f of ["client/src/App.tsx", "client/src/pages/WWLD.tsx", "client/src/pages/TodaysGrowthPlan.tsx", "client/src/pages/Goals.tsx", "client/src/pages/DailyRoutine.tsx", "client/src/pages/WwldHistory.tsx"]) {
      expect(src(f)).not.toMatch(/\bappDateKey\(/);
    }
    expect(src("client/src/App.tsx")).toContain('source: "detected"');
    expect(src("client/src/pages/Profile.tsx")).toContain('source: "manual"');
  });

  it("the browser stays on the server's zone (NY) until the detected zone is saved; set in an effect", () => {
    const app = src("client/src/App.tsx");
    expect(app).toContain("const zone = serverMatchingTimeZone(saved);");
    expect(app).not.toContain("chooseClientTimeZone");
    expect(app).toMatch(/useLayoutEffect\(\(\) => \{\s*setClientTimeZone\(zone\);/);
    expect(app).not.toMatch(/\n  if \(user\) setClientTimeZone/);
    expect(app).toContain("if (loading || (user && !zoneReady))");
    expect(src("client/src/pages/Profile.tsx")).not.toContain("setClientTimeZone(");
  });

  it("users.timezone is nullable with no default; no data backfill", () => {
    expect(src("shared/schema.ts")).toContain('timezone: varchar("timezone", { length: 64 }),');
    expect(src("server/engagement/migrations.ts")).toContain("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64)`");
    expect(src("server/engagement/migrations.ts")).not.toMatch(/UPDATE users SET timezone/i);
  });
});
