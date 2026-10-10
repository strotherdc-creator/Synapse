import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILTIN_STAT_KEYS,
  MAX_CUSTOM_STATS,
  enabledBuiltinStats,
  mergeTrackedStats,
  parseStatKeyList,
  serializeStatKeyList,
  trackedBuiltinStats,
} from "../shared/wwldStats";
import { WWLD_STATS_MIGRATIONS } from "./wwld/migrations";
import { StatSettingsError, normalizeCustomStatsInput } from "./wwld/statSettings";
import { submittedBuiltinStats } from "./db";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Log Stats settings defaults", () => {
  it("shows every built-in stat when a doctor has no saved settings", () => {
    expect(enabledBuiltinStats(undefined)).toEqual(BUILTIN_STAT_KEYS);
    expect(enabledBuiltinStats(null)).toEqual(BUILTIN_STAT_KEYS);
    expect(enabledBuiltinStats("")).toEqual(BUILTIN_STAT_KEYS);
  });

  it("hides only the unchecked stats", () => {
    expect(enabledBuiltinStats("recall,progressExams")).toEqual([
      "officeVisits",
      "newPatients",
      "testResults",
      "performanceReviews",
      "carePlansSigned",
      "collections",
    ]);
  });

  it("ignores unknown keys and keeps canonical order", () => {
    expect(parseStatKeyList("carePlansSigned, bogus ,officeVisits")).toEqual(["officeVisits", "carePlansSigned"]);
    expect(serializeStatKeyList(["carePlansSigned", "officeVisits", "nope"])).toBe("officeVisits,carePlansSigned");
  });
});

describe("Log Stats tracked-stat provenance (history never invents values)", () => {
  it("treats legacy rows (NULL) as every original built-in stat tracked, but never Collections", () => {
    const original = BUILTIN_STAT_KEYS.filter((k) => k !== "collections");
    expect(trackedBuiltinStats(null)).toEqual(original);
    expect(trackedBuiltinStats(undefined)).toEqual(original);
    expect(trackedBuiltinStats(null)).not.toContain("collections");
  });

  it("only reports stats that were on the form when the row was saved", () => {
    expect(trackedBuiltinStats("")).toEqual([]);
    expect(trackedBuiltinStats("officeVisits,newPatients")).toEqual(["officeVisits", "newPatients"]);
  });

  it("keeps previously tracked stats when a session is edited with fewer stats", () => {
    expect(mergeTrackedStats("officeVisits,recall", ["officeVisits"])).toBe("officeVisits,recall");
    expect(mergeTrackedStats("officeVisits", ["newPatients"])).toBe("officeVisits,newPatients");
    expect(mergeTrackedStats(null, ["officeVisits"])).toBeNull();
  });

  it("detects which built-in stats were submitted", () => {
    expect(submittedBuiltinStats({ officeVisits: 0, recall: 3 })).toEqual(["officeVisits", "recall"]);
    expect(submittedBuiltinStats({})).toEqual([]);
  });
});

describe("Custom stats", () => {
  it("allows at most 3 custom stats", () => {
    expect(MAX_CUSTOM_STATS).toBe(3);
    const four = ["A", "B", "C", "D"].map((name) => ({ name }));
    expect(() => normalizeCustomStatsInput(four)).toThrow(StatSettingsError);
    expect(normalizeCustomStatsInput(four.slice(0, 3))).toHaveLength(3);
  });

  it("trims names, requires a name, rejects duplicates, and normalizes optional units", () => {
    expect(normalizeCustomStatsInput([{ name: "  Reactivations  ", unit: "  " }])).toEqual([
      { id: undefined, name: "Reactivations", unit: null, sortOrder: 0 },
    ]);
    expect(() => normalizeCustomStatsInput([{ name: "   " }])).toThrow(StatSettingsError);
    expect(() => normalizeCustomStatsInput([{ name: "Calls" }, { name: "calls " }])).toThrow(StatSettingsError);
  });
});

describe("Log Stats database safety", () => {
  it("migrations are additive only", () => {
    for (const sql of WWLD_STATS_MIGRATIONS) {
      expect(sql).toMatch(/^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|ALTER TABLE \w+ ADD COLUMN IF NOT EXISTS)/);
      expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER COLUMN|RENAME)\b/i);
    }
  });

  it("settings code never deletes stats rows; removed custom stats are soft-archived", () => {
    const code = source("server/wwld/statSettings.ts");
    expect(code).not.toMatch(/\.delete\(/);
    expect(code).toContain("archivedAt: now");
  });

  it("editing a session only overwrites the stats that were submitted", () => {
    const db = source("server/db.ts");
    expect(db).toContain("...submittedValues,");
    expect(db).toContain("mergeTrackedStats(existing[0].trackedStats, submitted)");
  });

  it("the daily log form only shows enabled built-in stats plus custom stats", () => {
    const form = source("client/src/components/wwld/StatEntryForm.tsx");
    expect(form).toContain("trpc.wwld.getStatSettings.useQuery");
    expect(form).toContain("BUILTIN_STATS.filter((s) => enabled.has(s.key))");
    expect(form).toContain("customStats.map((stat)");
  });
});

describe("Head Developer review fixes (PR #16)", () => {
  it("startup awaits migrations before listening (no half-migrated window)", () => {
    const index = source("server/_core/index.ts");
    const migrate = index.indexOf("await runMigrations(ENGAGEMENT_MIGRATIONS)");
    const listen = index.indexOf("await listenOnAvailablePort(server");
    expect(migrate).toBeGreaterThan(-1);
    expect(listen).toBeGreaterThan(migrate);
    expect(index).not.toContain("runMigrations(ENGAGEMENT_MIGRATIONS).catch");
    // startServer() failures exit non-zero
    expect(index).toMatch(/startServer\(\)\.catch\([\s\S]*process\.exit\(1\)/);
  });

  it("runMigrations throws when any statement fails", () => {
    const dbSrc = source("server/db.ts");
    expect(dbSrc).toContain("if (failures.length > 0)");
    expect(dbSrc).toContain("throw new Error(`[Migrations] ${failures.length} of");
  });

  it("settings saves run in one transaction under a per-doctor lock and re-count the cap", () => {
    const code = source("server/wwld/statSettings.ts");
    expect(code).toContain("db.transaction(async (tx)");
    expect(code).toContain("pg_advisory_xact_lock(");
    expect(code).toContain("Number(activeCount) > MAX_CUSTOM_STATS");
    // id validation happens before the settings upsert
    const save = code.slice(code.indexOf("export async function saveStatSettings"));
    expect(save.indexOf("Validate ids before writing anything")).toBeLessThan(save.indexOf(".insert(wwldStatSettings)"));
  });

  it("log form and past-days form only send touched custom stats and checked built-ins", () => {
    const form = source("client/src/components/wwld/StatEntryForm.tsx");
    expect(form).toContain(".filter((stat) => touchedCustomIds.has(stat.id))");
    const backlog = source("client/src/components/wwld/BacklogModal.tsx");
    expect(backlog).toContain("useStatFieldConfig()");
    expect(backlog).toContain("buildLogPayload(stats, fields.builtinFields, fields.customStats, custom)");
    expect(backlog).not.toContain("...stats,");
  });
});

describe("Plain-English error messages", () => {
  it("passes our own sentences through and hides raw validation output", async () => {
    const { friendlyErrorMessage } = await import("../client/src/lib/friendlyError");
    const fallback = "Please try again.";
    expect(friendlyErrorMessage({ message: "You can have at most 3 custom stats.", data: { code: "BAD_REQUEST" } }, fallback))
      .toBe("You can have at most 3 custom stats.");
    const zodish = '[{"code":"too_big","maximum":3,"path":["customStats"],"message":"Too big"}]';
    const out = friendlyErrorMessage({ message: zodish, data: { code: "BAD_REQUEST" } }, fallback);
    expect(out).not.toContain("{");
    expect(out).toMatch(/check the numbers and names/);
    expect(friendlyErrorMessage({ message: "x", data: { code: "BAD_REQUEST", zodError: {} } }, fallback)).toMatch(/check/);
    expect(friendlyErrorMessage({ message: "Please sign in to continue", data: { code: "UNAUTHORIZED" } }, fallback)).toMatch(/sign in/);
    expect(friendlyErrorMessage({ message: "column x does not exist", data: { code: "INTERNAL_SERVER_ERROR" } }, fallback)).not.toContain("column");
    expect(friendlyErrorMessage(null, fallback)).toBe(fallback);
  });
});

describe("Log Stats header actions are obvious (Doc request)", () => {
  it("shows labeled Customize stats and View past days buttons with large tap targets", () => {
    const page = source("client/src/pages/WWLD.tsx");
    expect(page).toContain("<span>Customize stats</span>");
    expect(page).toContain("<span>View past days</span>");
    expect(page).toContain('href="/wwld/settings"');
    expect(page).toContain('href="/wwld/history"');
    // Labels are always visible (not hidden on mobile) and buttons are at least 44px tall
    expect(page).not.toContain('<span className="hidden sm:inline">Settings</span>');
    expect(page.match(/min-h-11/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // The log form keeps its own link to settings
    expect(source("client/src/components/wwld/StatEntryForm.tsx")).toContain("Choose which stats appear here");
  });
});
