import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("ModuleCoaching mobile context safeguards", () => {
  it("keeps a persistent lesson guide and saved-answer review reachable", () => {
    const source = readProjectFile("client/src/pages/ModuleCoaching.tsx");

    expect(source).toContain("Lesson Guide");
    expect(source).toContain("What this lesson is asking");
    expect(source).toContain("Your saved answer");
    expect(source).toContain("Completed answers in this module");
    expect(source).toContain("Ask coach about this lesson");
  });

  it("does not force-scroll away from lesson context on input focus or visual viewport changes", () => {
    const source = readProjectFile("client/src/pages/ModuleCoaching.tsx");

    expect(source).not.toContain("onFocus={() => {");
    expect(source).not.toContain("}, [viewportHeight, scrollToBottom]);");
  });
});
