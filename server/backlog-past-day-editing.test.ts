import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("WWLD past-day editing", () => {
  it("loads a selected day and pre-fills its saved end-of-day values before updating", () => {
    const component = readFileSync(
      resolve(process.cwd(), "client/src/components/wwld/BacklogModal.tsx"),
      "utf8",
    );

    expect(component).toContain("trpc.wwld.getToday.useQuery");
    expect(component).toContain('sessionType === "end_of_day"');
    expect(component).toContain("setStats(sessionToStats(existingEndOfDay))");
    expect(component).toContain("Edit saved totals — change only the number that is wrong");
    expect(component).toContain('isEditingSavedDay ? "Save changes to" : "Save"');
  });
});
