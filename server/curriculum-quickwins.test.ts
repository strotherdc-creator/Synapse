/** Oct 15 2026 UI quick wins: plain progress words, Continue button target, safe Coach link params. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { moduleCardStates, nextCurriculumStep, type ProgressModule } from "../shared/curriculumProgress";
import { safeLinkText, safeReturnPath } from "../shared/safeLinkParams";

const mod = (id: number, stepCount: number, done: number, extra: Partial<ProgressModule> = {}): ProgressModule & { iconEmoji: null } => ({
  id, sortOrder: id, title: `M${id}`, status: "published", stepCount, completedStepCount: done, lessonCount: 0, completedCount: 0,
  moduleComplete: stepCount > 0 && done >= stepCount, iconEmoji: null, ...extra,
});

describe("Step N of M and lock reasons", () => {
  it("labels done, in-progress and locked modules in plain words", () => {
    const cards = moduleCardStates([mod(1, 4, 4), mod(2, 5, 2), mod(3, 4, 0), mod(4, 5, 0)]).map((m) => m.card);
    expect(cards.map((c) => c.label)).toEqual(["All 4 steps done", "Step 3 of 5", "Finish Module 2 to open", "Finish Module 2 to open"]);
    expect(cards.map((c) => c.moduleNumber)).toEqual([1, 2, 3, 4]);
    expect(cards.map((c) => c.unlocked)).toEqual([true, true, false, false]);
  });

  it("first module not started says Step 1; the server's unlocked flag wins", () => {
    const cards = moduleCardStates([mod(1, 4, 0), mod(2, 5, 0, { unlocked: false })]).map((m) => m.card);
    expect(cards[0].label).toBe("Step 1 of 4");
    expect(cards[1].label).toBe("Finish Module 1 to open");
  });

  it("never shows drafts and keeps the server order", () => {
    const cards = moduleCardStates([mod(2, 5, 0), mod(1, 4, 4), mod(9, 3, 0, { status: "draft" })]);
    expect(cards.map((m) => m.id)).toEqual([1, 2]);
  });

  it("lesson modules count lessons", () => {
    const [c] = moduleCardStates([mod(1, 0, 0, { lessonCount: 3, completedCount: 1 })]).map((m) => m.card);
    expect(c.label).toBe("Lesson 2 of 3");
  });
});

describe("Continue: Module X, Step Y", () => {
  it("goes straight to the coaching screen of the next unfinished module", () => {
    expect(nextCurriculumStep([mod(1, 4, 4), mod(2, 5, 2), mod(3, 4, 0)])).toMatchObject({
      label: "Continue: Module 2, Step 3", href: "/curriculum/2/coaching", moduleTitle: "M2",
    });
    expect(nextCurriculumStep([mod(1, 0, 0, { lessonCount: 2, completedCount: 0 })])).toMatchObject({
      label: "Continue: Module 1, Lesson 1", href: "/curriculum/1",
    });
  });
  it("hides when everything open is done or there is nothing yet", () => {
    expect(nextCurriculumStep([mod(1, 4, 4), mod(2, 5, 5)])).toBeNull();
    expect(nextCurriculumStep([])).toBeNull();
    expect(nextCurriculumStep(undefined)).toBeNull();
  });
});

describe("Communication Coach link inputs", () => {
  it("allows only same-origin paths for the return link", () => {
    expect(safeReturnPath("/today")).toBe("/today");
    expect(safeReturnPath("/today?tab=plan#next")).toBe("/today?tab=plan#next");
    for (const bad of ["https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", " javascript:alert(1)", "data:text/html,x", "today", "", null, undefined, "/a\nb", "/" + "a".repeat(600)]) {
      expect(safeReturnPath(bad as string)).toBeNull();
    }
  });
  it("cleans and caps text settings", () => {
    expect(safeLinkText("  hello\u0000 ")).toBe("hello");
    expect(safeLinkText("x".repeat(900))).toHaveLength(500);
    expect(safeLinkText("   ")).toBeNull();
    expect(safeLinkText("line1\nline2", 4000)).toBe("line1\nline2");
  });
  it("Coach page keeps its menu link and settings-from-link, now validated", () => {
    const page = readFileSync("client/src/pages/CommunicationCoach.tsx", "utf8");
    expect(page).toContain('params.get("coach") !== "1"');
    expect(page).toContain('safeReturnPath(params.get("returnUrl"))');
    expect(page).toContain('href={safeReturnPath(returnUrl) ?? "/today"}');
    expect(readFileSync("client/src/components/DashboardLayout.tsx", "utf8")).toContain("/communication");
  });
});

describe("readable pages", () => {
  it("Curriculum, Module Coaching, Module Detail, Lesson and Home use the .readable scope", () => {
    for (const f of ["Curriculum", "ModuleCoaching", "ModuleDetail", "LessonView", "Home"]) {
      expect(readFileSync(`client/src/pages/${f}.tsx`, "utf8")).toMatch(/className="readable /);
    }
  });
});
