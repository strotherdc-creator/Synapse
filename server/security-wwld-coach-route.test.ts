import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("WWLD Coach security and scope boundary", () => {
  it("requires Clerk authentication, bounds input, and avoids returning raw internal errors", () => {
    const router = source("server/wwld-coach/router.ts");

    expect(router).toContain('import { getAuth } from "@clerk/express"');
    expect(router).toContain("if (!auth.userId)");
    expect(router).toContain("RATE_LIMIT_MAX_REQUESTS");
    expect(router).toContain("MAX_MESSAGE_LENGTH");
    expect(router).toContain('error: "Unable to answer right now. Please try again."');
    expect(router).not.toContain("res.status(500).json({ error: error.message");
  });

  it("mounts the protected WWLD Coach route after Clerk middleware and sends a Clerk token from the client", () => {
    const server = source("server/_core/index.ts");
    const client = source("client/src/pages/WwldCoach.tsx");
    const prompt = source("server/wwld-coach/system-prompt.ts");

    expect(server.indexOf('app.use("/api/wwld-coach", wwldCoachRouter);')).toBeGreaterThan(
      server.indexOf("clerkMiddleware({")
    );
    expect(client).toContain("const { getToken } = useAuth()");
    expect(client).toContain("Authorization: `Bearer ${token}`");
    expect(prompt).toContain("WWLD_SYSTEM_PROMPT");
    expect(prompt).toContain("Do NOT answer Bridge-the-Gap curriculum");
    expect(prompt).toContain("Communication Coach");
  });

  it("builds answers from WWLD stats context, not curriculum answers", () => {
    const router = source("server/wwld-coach/router.ts");
    expect(router).toContain("getWwldTotalsForRange");
    expect(router).toContain("WWLD_SYSTEM_PROMPT");
    expect(router).not.toContain("getUserAnswers");
  });
});
