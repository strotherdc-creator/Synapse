/**
 * Oct 15 2026 quick wins: hidden (draft) or locked lessons can't be opened, listed, completed
 * or answered by ID. Database calls are mocked; no real DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const M = (id: number, status: "published" | "draft", sortOrder: number) => ({ id, title: `Module ${id}`, status, sortOrder, description: null, iconEmoji: null, createdAt: new Date(), updatedAt: new Date() });
const L = (id: number, moduleId: number, status: "published" | "draft") => ({ id, moduleId, status, title: `Lesson ${id}`, summary: null, content: "x", sortOrder: id, createdAt: new Date(), updatedAt: new Date() });

const state = {
  modules: [M(1, "published", 1), M(2, "published", 2), M(9, "draft", 99)],
  lessons: [L(11, 1, "published"), L(12, 1, "draft"), L(21, 2, "published"), L(91, 9, "published")],
  // Module 1 (lesson module): complete when lesson 11 is done
  progress: [] as { lessonId: number; moduleId: number; completed: boolean }[],
};

const writes: string[] = [];
vi.mock("./db", async (orig) => {
  const actual = await orig<typeof import("./db")>();
  return {
    ...actual,
    getDb: async () => null,
    listModules: async (publishedOnly = false) => state.modules.filter((m) => !publishedOnly || m.status === "published"),
    getModuleById: async (id: number) => state.modules.find((m) => m.id === id),
    getLessonById: async (id: number) => state.lessons.find((l) => l.id === id),
    listLessons: async (moduleId: number, publishedOnly = false) => state.lessons.filter((l) => l.moduleId === moduleId && (!publishedOnly || l.status === "published")),
    getUserModuleProgress: async (_u: number, moduleId: number) => state.progress.filter((p) => p.moduleId === moduleId),
    getUserProgress: async () => state.progress,
    getModuleSteps: async () => [],
    getUserStepProgress: async () => [],
    listAllModuleSteps: async () => [],
    getAllUserStepProgress: async () => [],
    toggleLessonComplete: async () => { writes.push("toggle"); },
    saveUserAnswer: async () => { writes.push("answer"); },
  };
});

const { appRouter } = await import("./routers");

function caller(role: "user" | "admin" = "user") {
  const user = { id: 7, clerkId: "c7", email: "t@example.com", name: "Dr T", role, bio: null, avatarUrl: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  return appRouter.createCaller({ user, req: { protocol: "https", headers: {} }, res: {} } as never);
}

beforeEach(() => {
  writes.length = 0;
  state.progress = [];
});

describe("lessons by ID respect drafts and unlocks", () => {
  it("opens a published lesson in an unlocked module", async () => {
    await expect(caller().lessons.getById({ id: 11 })).resolves.toMatchObject({ id: 11 });
    await expect(caller().lessons.list({ moduleId: 1 })).resolves.toHaveLength(1); // draft lesson 12 hidden
  });

  it("hides draft lessons and lessons inside draft modules", async () => {
    await expect(caller().lessons.getById({ id: 12 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().lessons.getById({ id: 91 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller().lessons.list({ moduleId: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("blocks lessons in a module that is still locked", async () => {
    await expect(caller().lessons.getById({ id: 21 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().lessons.list({ moduleId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    state.progress = [{ lessonId: 11, moduleId: 1, completed: true }];
    await expect(caller().lessons.getById({ id: 21 })).resolves.toMatchObject({ id: 21 });
  });

  it("progress.toggle and answers.save refuse hidden, locked or mismatched lessons", async () => {
    const bad = [
      { lessonId: 12, moduleId: 1 }, // draft lesson
      { lessonId: 91, moduleId: 9 }, // draft module
      { lessonId: 21, moduleId: 2 }, // locked module
      { lessonId: 11, moduleId: 2 }, // lesson/module mismatch
    ];
    for (const b of bad) {
      await expect(caller().progress.toggle({ ...b, completed: true })).rejects.toBeTruthy();
      await expect(caller().answers.save({ ...b, questionKey: "q", answer: "a" })).rejects.toBeTruthy();
    }
    expect(writes).toEqual([]);
    await caller().progress.toggle({ lessonId: 11, moduleId: 1, completed: true });
    await caller().answers.save({ lessonId: 11, moduleId: 1, questionKey: "q", answer: "a" });
    expect(writes).toEqual(["toggle", "answer"]);
  });

  it("admins can still preview drafts", async () => {
    await expect(caller("admin").lessons.getById({ id: 12 })).resolves.toMatchObject({ id: 12 });
    await expect(caller("admin").lessons.getById({ id: 91 })).resolves.toMatchObject({ id: 91 });
  });
});
