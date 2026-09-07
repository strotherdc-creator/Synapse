import { describe, it, expect } from "vitest";

// This test verifies the deployed environment's ADMIN_EMAIL, not application
// logic — it only makes sense to run where that variable is actually set
// (e.g. a production/staging smoke test), so it skips itself in a clean
// checkout instead of failing every local/CI run with no env configured.
const adminEmail = process.env.ADMIN_EMAIL;

describe.skipIf(!adminEmail)("ADMIN_EMAIL environment variable", () => {
  it("should be set to a valid email address", () => {
    expect(adminEmail).toBeDefined();
    expect(adminEmail).not.toBe("");
    expect(adminEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("should match the expected admin email", () => {
    expect(adminEmail?.toLowerCase()).toBe("strotherdc@gmail.com");
  });
});
