import { describe, it, expect } from "vitest";

describe("ADMIN_EMAIL environment variable", () => {
  it("should be set to a valid email address", () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    expect(adminEmail).toBeDefined();
    expect(adminEmail).not.toBe("");
    expect(adminEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("should match the expected admin email", () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    expect(adminEmail?.toLowerCase()).toBe("strotherdc@gmail.com");
  });
});
