import { describe, expect, it } from "vitest";
import { neutralizeFormula, toCSV } from "./wwld-backup";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("CSV formula-injection guard (WWLD and doctor-goals backups)", () => {
  it("prefixes ' to text starting with =, +, -, @, tab or CR", () => {
    expect(neutralizeFormula("=HYPERLINK(\"http://evil\",\"x\")")).toBe("'=HYPERLINK(\"http://evil\",\"x\")");
    expect(neutralizeFormula("+1+cmd|' /C calc'!A0")).toBe("'+1+cmd|' /C calc'!A0");
    expect(neutralizeFormula("-2+3")).toBe("'-2+3");
    expect(neutralizeFormula("-cmd")).toBe("'-cmd");
    expect(neutralizeFormula("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(neutralizeFormula("\t=1+1")).toBe("'\t=1+1");
    expect(neutralizeFormula("\r=1+1")).toBe("'\r=1+1");
  });

  it("leaves pure numbers alone, including negatives (documented choice)", () => {
    expect(neutralizeFormula(-5)).toBe("-5");
    expect(neutralizeFormula("-5")).toBe("-5");
    expect(neutralizeFormula("-12.5")).toBe("-12.5");
    expect(neutralizeFormula(0)).toBe("0");
    expect(neutralizeFormula(650000)).toBe("650000");
    // Not a pure number -> treated as possible formula
    expect(neutralizeFormula("-5e3")).toBe("'-5e3");
    expect(neutralizeFormula("- 5")).toBe("'- 5");
    expect(neutralizeFormula("-")).toBe("'-");
  });

  it("leaves ordinary values unchanged", () => {
    expect(neutralizeFormula("Dr Smith")).toBe("Dr Smith");
    expect(neutralizeFormula("a=b")).toBe("a=b");
    expect(neutralizeFormula(null)).toBe("");
    expect(neutralizeFormula(undefined)).toBe("");
    expect(neutralizeFormula("mon:full,tue:half")).toBe("mon:full,tue:half");
  });

  it("toCSV applies the guard before quoting, for every column", () => {
    const csv = toCSV([
      { userName: "=1+1", notes: "-2+3, then more", officeVisits: -5, yearlyRevenue: 600000, email: "@x" },
      { userName: "Dr \"Q\"", notes: "line1\nline2", officeVisits: 12, yearlyRevenue: null, email: "\r=evil" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("userName,notes,officeVisits,yearlyRevenue,email");
    expect(lines[1]).toBe(`'=1+1,"'-2+3, then more",-5,600000,'@x`);
    expect(csv).toContain(`"Dr ""Q"""`);
    expect(csv).toContain(`"line1\nline2"`);
    expect(csv).toContain(`"'\r=evil"`);
    expect(toCSV([])).toBe("No data");
  });

  it("both backup attachments go through toCSV", () => {
    const src = readFileSync(path.resolve(__dirname, "wwld-backup.ts"), "utf8");
    expect(src).toContain("const csv = toCSV(rows as Record<string, unknown>[]);");
    expect(src).toContain("const goalsCsv = toCSV(goalRows as Record<string, unknown>[]);");
  });
});


describe("Migrations stop at the first lock timeout", () => {
  it("stops on SQLSTATE 55P03 and reports what was skipped", async () => {
    const { runMigrationStatements } = await import("./db");
    const ran: string[] = [];
    const client = {
      query: async (sql: string) => {
        ran.push(sql);
        if (sql === "B") throw Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" });
      },
    };
    const failures = await runMigrationStatements(client, ["A", "B", "C", "D"]);
    expect(ran).toEqual(["A", "B"]);
    expect(failures).toHaveLength(2);
    expect(failures[1]).toBe("stopped after lock timeout; 2 remaining migration(s) not attempted");
  });

  it("other errors still attempt every statement (unchanged behavior)", async () => {
    const { runMigrationStatements } = await import("./db");
    const ran: string[] = [];
    const client = {
      query: async (sql: string) => {
        ran.push(sql);
        if (sql === "B") throw Object.assign(new Error("relation does not exist"), { code: "42P01" });
      },
    };
    const failures = await runMigrationStatements(client, ["A", "B", "C"]);
    expect(ran).toEqual(["A", "B", "C"]);
    expect(failures).toHaveLength(1);
  });

  it("runMigrations uses it inside the advisory lock", () => {
    const db = readFileSync(path.resolve(__dirname, "db.ts"), "utf8");
    expect(db).toContain('LOCK_NOT_AVAILABLE = "55P03"');
    expect(db).toContain("failures.push(...(await runMigrationStatements(client, migrations)));");
  });
});
