/**
 * Communication Coach deep-link contract (Communication Module handoff).
 *
 * Head Dev (v1): external URL + returnUrl — NOT iframe / same-origin proxy.
 * Env: VITE_COMM_BASE = Comm Module public https origin (no trailing slash). Never hardcode.
 * Entry: `{VITE_COMM_BASE}/` + Comm Module query shape; returnUrl back to Synapse.
 * Auth: Comm Coach is NOT Clerk — no shared session. Never put PHI in query params.
 *
 * Shape:
 *   {VITE_COMM_BASE}/?coach=1&outcome=...&channel=verbal|text|email
 *     &direction=incoming|outgoing|both&planStepId={id}
 *     &returnUrl=...&scriptId={optional}
 * Optional: tone, stage, obstacles, urgency, conversation (short; no PHI).
 *
 * TODO(Head Dev): set VITE_COMM_BASE in Railway/client env. Until set, UI uses a
 * clear in-app /communication placeholder so local review still works.
 */

export type CommCoachChannel = "verbal" | "text" | "email";
export type CommCoachDirection = "incoming" | "outgoing" | "both";

export type CommCoachDeepLinkParams = {
  outcome?: string;
  channel?: CommCoachChannel;
  direction?: CommCoachDirection;
  planStepId: string | number;
  returnUrl?: string;
  scriptId?: string;
  tone?: string;
  stage?: string;
  obstacles?: string;
  urgency?: string;
  /** Short context only — never paste PHI / patient identifiers. */
  conversation?: string;
};

/** Action category keys that are talk/script related → deep-link to Comm Coach. */
export const TALK_SCRIPT_ACTION_KEYS = new Set([
  "referral_ask",
  "patient_outreach",
  "community_connection",
]);

export function isTalkScriptAction(sourceRef: string | null | undefined): boolean {
  return Boolean(sourceRef && TALK_SCRIPT_ACTION_KEYS.has(sourceRef));
}

/** Sensible defaults per Today’s Plan action key (no PHI). */
export function defaultsForPlanAction(
  sourceRef: string | null | undefined
): Partial<CommCoachDeepLinkParams> {
  switch (sourceRef) {
    case "referral_ask":
      return {
        outcome: "Ask for a referral using today's trigger line",
        channel: "verbal",
        direction: "outgoing",
      };
    case "patient_outreach":
      return {
        outcome: "Check in or recall a patient",
        channel: "text",
        direction: "outgoing",
      };
    case "community_connection":
      return {
        outcome: "Start a community / referral-source conversation",
        channel: "verbal",
        direction: "outgoing",
      };
    default:
      return {
        outcome: "Practice today's conversation",
        channel: "verbal",
        direction: "both",
      };
  }
}

/** Comm Module public origin from env. Empty/unset until Head Dev configures it. */
export function getCommBase(): string | null {
  const raw = (import.meta.env.VITE_COMM_BASE as string | undefined)?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Build the Comm Coach entry URL.
 * Prefer external `{VITE_COMM_BASE}/?...`. If unset, fall back to in-app `/communication?...`
 * placeholder (not a proxy — just so reviewers can click the path locally).
 */
export function buildCommCoachDeepLink(params: CommCoachDeepLinkParams): {
  href: string;
  external: boolean;
} {
  const base = getCommBase();
  const external = Boolean(base);
  const url = external
    ? new URL(`${base}/`)
    : new URL(
        "/communication",
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      );

  url.searchParams.set("coach", "1");
  url.searchParams.set("planStepId", String(params.planStepId));

  if (params.outcome) url.searchParams.set("outcome", params.outcome);
  if (params.channel) url.searchParams.set("channel", params.channel);
  if (params.direction) url.searchParams.set("direction", params.direction);
  if (params.scriptId) url.searchParams.set("scriptId", params.scriptId);
  if (params.tone) url.searchParams.set("tone", params.tone);
  if (params.stage) url.searchParams.set("stage", params.stage);
  if (params.obstacles) url.searchParams.set("obstacles", params.obstacles);
  if (params.urgency) url.searchParams.set("urgency", params.urgency);
  if (params.conversation) url.searchParams.set("conversation", params.conversation);

  const returnUrl =
    params.returnUrl ??
    (typeof window !== "undefined" ? `${window.location.origin}/today` : "/today");
  url.searchParams.set("returnUrl", returnUrl);

  if (external) {
    return { href: url.toString(), external: true };
  }
  return { href: `${url.pathname}${url.search}`, external: false };
}
