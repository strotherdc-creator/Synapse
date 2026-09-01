import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Today’s Plan Lyle quote readability", () => {
  it("renders the full daily instruction instead of truncating it to two lines", () => {
    const page = readFileSync(
      resolve(process.cwd(), "client/src/pages/TodaysGrowthPlan.tsx"),
      "utf8",
    );

    expect(page).toContain("Lyle says");
    expect(page).toContain("leading-relaxed break-words");
    expect(page).not.toContain("font-semibold text-white mt-1 line-clamp-2");
  });
});
