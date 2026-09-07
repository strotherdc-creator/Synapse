import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import {
  clearRateLimitBuckets,
  consumeRateLimit,
  RATE_LIMIT_MAX_REQUESTS,
  assertRateLimit,
} from "./_core/rateLimit";
import { TRPCError } from "@trpc/server";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("shared in-process rate limiter", () => {
  beforeEach(() => {
    clearRateLimitBuckets();
  });

  it("allows up to RATE_LIMIT_MAX_REQUESTS then blocks", () => {
    const key = "test:user:1";
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(consumeRateLimit(key)).toBe(true);
    }
    expect(consumeRateLimit(key)).toBe(false);
    expect(() => assertRateLimit(key)).toThrow(TRPCError);
  });

  it("documents multi-instance Redis limitation", () => {
    const limiter = source("server/_core/rateLimit.ts");
    expect(limiter).toContain("Redis");
    expect(limiter).toContain("process-local");
  });
});

describe("tRPC LLM path rate limits and generic errors", () => {
  it("rate-limits ai.chat, coaching.chat, and content.generate before invokeLLM", () => {
    const router = source("server/routers.ts");
    expect(router).toContain('assertRateLimit(`trpc:ai.chat:${ctx.user.id}`)');
    expect(router).toContain('assertRateLimit(`trpc:coaching.chat:${ctx.user.id}`)');
    expect(router).toContain('assertRateLimit(`trpc:content.generate:${ctx.user.id}`)');
    expect(router).toContain("GENERIC_LLM_ERROR");
    expect(router).toContain("mapLlmError");
  });

  it("persists curriculum/coaching chat messages only after successful LLM", () => {
    const router = source("server/routers.ts");
    // User message save must appear after invokeLLM in both chat handlers
    const aiIdx = router.indexOf("assertRateLimit(`trpc:ai.chat:");
    const aiInvoke = router.indexOf("await invokeLLM(messages)", aiIdx);
    const aiSaveUser = router.indexOf("role: \"user\"", aiInvoke);
    expect(aiInvoke).toBeGreaterThan(aiIdx);
    expect(aiSaveUser).toBeGreaterThan(aiInvoke);

    const coachIdx = router.indexOf("assertRateLimit(`trpc:coaching.chat:");
    const coachInvoke = router.indexOf("await invokeLLM(messages)", coachIdx);
    const coachSaveUser = router.indexOf('role: "user"', coachInvoke);
    expect(coachInvoke).toBeGreaterThan(coachIdx);
    expect(coachSaveUser).toBeGreaterThan(coachInvoke);
  });

  it("maps coaching.chat missing step to TRPCError NOT_FOUND", () => {
    const router = source("server/routers.ts");
    expect(router).toContain('throw new TRPCError({ code: "NOT_FOUND", message: "Step not found" })');
    expect(router).not.toContain('throw new Error("Step not found")');
  });
});

describe("draft disclosure and completeStep integrity", () => {
  it("hides unpublished modules and lessons from non-admins on getById", () => {
    const router = source("server/routers.ts");
    expect(router).toContain('mod.status !== "published" && ctx.user.role !== "admin"');
    expect(router).toContain('lesson.status !== "published" && ctx.user.role !== "admin"');
  });

  it("requires step.moduleId to match input.moduleId on completeStep", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("step.moduleId !== input.moduleId");
    expect(router).toContain("Step does not belong to this module.");
  });

  it("enforces server-side curriculum unlock and previous-step order", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("async function assertModuleUnlocked");
    expect(router).toContain("async function assertPreviousStepsComplete");
    expect(router).toContain("await assertModuleUnlocked(ctx.user.id, input.moduleId");
    expect(router).toContain("Complete previous modules to unlock this content.");
    expect(router).toContain("Complete previous steps before continuing.");
  });
});

describe("client UX and compliance follow-ups", () => {
  it("shows a generic toast on curriculum chat failure", () => {
    const chat = source("client/src/pages/Chat.tsx");
    expect(chat).toContain("onError:");
    expect(chat).toContain("Unable to get a response right now");
    expect(chat).toContain('import { toast } from "sonner"');
  });

  it("avoids raw LLM error toasts in Content Studio", () => {
    const studio = source("client/src/pages/ContentStudio.tsx");
    expect(studio).toContain("Generation failed. Please try again.");
    expect(studio).not.toContain("toast.error(error.message)");
  });

  it("does not hardcode a Clerk pk_test fallback in the client", () => {
    const main = source("client/src/main.tsx");
    expect(main).not.toMatch(/pk_test_[a-z0-9]+/);
    expect(main).toContain("VITE_CLERK_PUBLISHABLE_KEY");
    expect(main).toContain("Missing VITE_CLERK_PUBLISHABLE_KEY");
  });

  it("replaces #GetFixed with a compliant hashtag", () => {
    const engagement = source("server/engagement/router.ts");
    expect(engagement).not.toContain('tags.push("#GetFixed"');
    expect(engagement).toContain('tags.push("#SpineHealth"');
  });

  it("bounds answers and finalAnswer inputs", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("answer: z.string().min(1).max(MAX_ANSWER_LENGTH)");
    expect(router).toContain("finalAnswer: z.string().min(1).max(MAX_ANSWER_LENGTH)");
  });
});

describe("llm.ts client error surface", () => {
  it("throws a generic message after logging provider details", () => {
    const llm = source("server/_core/llm.ts");
    expect(llm).toContain("ALL PROVIDERS FAILED");
    expect(llm).toContain("Unable to generate a response right now. Please try again.");
    expect(llm).not.toContain("All LLM providers failed. Details:");
  });
});
