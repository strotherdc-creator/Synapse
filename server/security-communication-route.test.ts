import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Communication Coach security boundary", () => {
  it("requires Clerk authentication, bounds input, and avoids returning raw internal errors", () => {
    const router = source("server/communication/router.ts");

    expect(router).toContain('import { getAuth } from "@clerk/express"');
    expect(router).toContain("if (!auth.userId)");
    expect(router).toContain("RATE_LIMIT_MAX_REQUESTS");
    expect(router).toContain("MAX_CONVERSATION_LENGTH");
    expect(router).toContain('error: "Unable to generate a response right now. Please try again."');
    expect(router).not.toContain("res.status(500).json({ error: error.message");
  });

  it("mounts the protected Communication Coach route after Clerk middleware and sends a Clerk token from the client", () => {
    const server = source("server/_core/index.ts");
    const client = source("client/src/pages/CommunicationCoach.tsx");

    expect(server.indexOf('app.use("/api/communication", communicationRouter);')).toBeGreaterThan(
      server.indexOf("clerkMiddleware({")
    );
    expect(server).toContain('express.json({ limit: "1mb" })');
    expect(client).toContain("const { getToken } = useAuth()");
    expect(client).toContain("Authorization: `Bearer ${token}`");
  });
});
