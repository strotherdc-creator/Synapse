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
    ]);
  });

  it("ignores unknown keys and keeps canonical order", () => {
    expect(parseStatKeyList("carePlansSigned, bogus ,officeVisits")).toEqual(["officeVisits", "carePlansSigned"]);
    expect(serializeStatKeyList(["carePlansSigned", "officeVisits", "nope"])).toBe("officeVisits,carePlansSigned");
  });
});

describe("Log Stats tracked-stat provenance (history never invents values)", () => {
  it("treats legacy rows (NULL) as every built-in stat tracked", () => {
    expect(trackedBuiltinStats(null)).toEqual(BUILTIN_STAT_KEYS);
    expect(trackedBuiltinStats(undefined)).toEqual(BUILTIN_STAT_KEYS);
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
