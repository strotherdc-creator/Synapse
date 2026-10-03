import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

// Doc's standing order (Sep 8): Communication Coach stays fully separate from Synapse.
// No nav items, deep-links or CTAs into it from the Synapse client; /communication redirects home.
describe("Communication Coach stays separate from the Synapse client", () => {
  const layout = source("client/src/components/DashboardLayout.tsx");
  const app = source("client/src/App.tsx");

  it("has no Communication Coach nav item", () => {
    expect(layout).not.toContain("Communication Coach");
    expect(layout).not.toContain('"/communication"');
  });

  it("redirects /communication (and anything under it) to home instead of rendering the coach", () => {
    expect(app).not.toContain("component={CommunicationCoach}");
    expect(app).not.toContain('from "./pages/CommunicationCoach"');
    expect(app).toMatch(/<Route path="\/communication\/\*\?">\s*<Redirect to="\/" replace \/>\s*<\/Route>/);
  });

  it("keeps WWLD Coach, Log Stats, Goals and Today's Plan reachable from the sidebar", () => {
    expect(layout).toContain('{ icon: Target, label: "WWLD Coach", path: "/wwld-coach", badge: "BETA" }');
    expect(layout).toContain('path: "/wwld"');
    expect(layout).toContain('path: "/goals"');
    expect(layout).toContain('path: "/today"');
    expect(app).toContain('<Route path="/wwld-coach" component={WwldCoach} />');
  });

  it("WWLD Coach no longer points people at Communication Coach", () => {
    expect(source("client/src/pages/WwldCoach.tsx")).not.toContain("Communication Coach");
  });

  it("mobile menu button reports open/closed state", () => {
    expect(layout).toMatch(/aria-label="Open menu"\s+aria-expanded=\{openMobile\}/);
  });
});
