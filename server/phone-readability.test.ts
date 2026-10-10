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
    // Goals vs Log Stats: up/down is a sign + arrow + word, never color alone.
    const comparison = source("client/src/components/goals/GoalsComparison.tsx");
    expect(comparison).toContain("ArrowUp");
    expect(comparison).toContain("ArrowDown");
    const shared = source("shared/goalsComparison.ts");
    expect(shared).toContain("Right on goal");
    expect(shared).toMatch(/"ahead" : "short"/);
    expect(comparison).toContain("aria-pressed={on}");
    expect(comparison).toContain("min-h-12");
  });

  it("Goals year arrows can't be squeezed below 44px", () => {
    const goals = source("client/src/pages/Goals.tsx");
    expect(goals.match(/className="flex h-11 w-11 shrink-0 /g)?.length).toBe(2);
  });

  it("layout footer and mobile menu button meet size + contrast", () => {
    const layout = source("client/src/components/DashboardLayout.tsx");
    expect(layout).toContain('<span className="text-base text-muted-foreground tracking-widest uppercase">Powered by Synapse</span>');
    expect(layout).not.toContain("text-muted-foreground/40 tracking-widest");
    expect(layout).toMatch(/aria-label="Open menu"\s+(?:aria-expanded=\{openMobile\}\s+)?className="h-11 w-11 shrink-0/);
  });
});
