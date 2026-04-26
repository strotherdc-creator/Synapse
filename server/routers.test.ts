import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    clerkId: "clerk_test_001",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    bio: null,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return { ctx };
}

function createAdminContext(): { ctx: TrpcContext } {
  return createUserContext({ role: "admin" });
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeTruthy();
    expect(result?.clerkId).toBe("clerk_test_001");
  });

  it("returns null when unauthenticated", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("profile", () => {
  it("requires authentication for profile.get", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profile.get()).rejects.toThrow();
  });

  it("returns user data for profile.get", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profile.get();
    expect(result.name).toBe("Test User");
    expect(result.email).toBe("test@example.com");
  });
});

describe("modules (admin)", () => {
  it("rejects module creation from non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.modules.create({ title: "Test Module" })
    ).rejects.toThrow();
  });

  it("rejects module creation from unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.modules.create({ title: "Test Module" })
    ).rejects.toThrow();
  });
});

describe("lessons (admin)", () => {
  it("rejects lesson creation from non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.lessons.create({ moduleId: 1, title: "Test Lesson" })
    ).rejects.toThrow();
  });
});

describe("progress", () => {
  it("requires authentication for progress.getAll", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.progress.getAll()).rejects.toThrow();
  });
});

describe("ai.chat", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.chat({ message: "Hello", lessonId: null })
    ).rejects.toThrow();
  });
});

describe("ai.history", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.ai.history({ lessonId: null })
    ).rejects.toThrow();
  });
});

describe("content.generate", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.content.generate({
        contentType: "social_post",
        topic: "Test topic",
      })
    ).rejects.toThrow();
  });
});

describe("routine.getTasks", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.routine.getTasks({ date: "2026-04-24" })
    ).rejects.toThrow();
  });
});

describe("coupons", () => {
  it("rejects coupon creation from non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.coupons.create({ code: "TEST", discountPercent: 50 })
    ).rejects.toThrow();
  });

  it("rejects coupon list from non-admin users", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.coupons.list()).rejects.toThrow();
  });
});

describe("answers", () => {
  it("requires authentication for answers.getAll", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.answers.getAll()).rejects.toThrow();
  });
});
