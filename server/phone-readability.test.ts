import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

// Static guards for the phone-readability / WCAG AA pass on Goals and Log Stats.
describe("phone readability (Goals + Log Stats)", () => {
  const css = source("client/src/index.css");

  it("defines the scoped .readable contrast + type-size block", () => {
    expect(css).toContain(".readable {");
    expect(css).toContain("--muted-foreground: oklch(0.82");
    expect(css).toContain("--border: oklch(0.55");
    expect(css).toMatch(/\.readable :is\(\.text-\\\[10px\\\], \.text-\\\[11px\\\], \.text-xs, \.text-sm\)/);
  });

  it("applies .readable to every Goals / Log Stats screen and dialog", () => {
    for (const file of [
      "client/src/pages/Goals.tsx",
      "client/src/pages/WWLD.tsx",
      "client/src/pages/WwldStatSettings.tsx",
      "client/src/pages/WwldHistory.tsx",
      "client/src/components/wwld/BacklogModal.tsx",
    ]) {
      expect(source(file), file).toMatch(/className="readable /);
    }
  });

  it("Goals breakdown is stacked cards, not a wide table", () => {
    const goals = source("client/src/pages/Goals.tsx");
    expect(goals).not.toContain("<table");
    expect(goals).toContain("Per full day");
  });

  it("state is never shown by color alone", () => {
    const wwld = source("client/src/pages/WWLD.tsx");
    expect(wwld).toContain("Not logged");
    expect(wwld).toContain("aria-pressed");
    const history = source("client/src/pages/WwldHistory.tsx");
    expect(history).toContain("Dot = stats logged");
    const goals = source("client/src/pages/Goals.tsx");
    expect(goals).toMatch(/Behind pace|Ahead of pace|On pace/);
  });
});
