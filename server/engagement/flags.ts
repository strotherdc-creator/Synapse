/**
 * Engagement feature-flag guard.
 * Reads environment variables LIVE on every call (not cached at import time)
 * so that Railway env var changes take effect immediately after restart.
 */
export function isEngagementEnabled(feature: EngagementFeature, clerkId?: string): boolean {
  const enabled = getFeatureFlag(feature);
  if (!enabled) return false;
  // If a pilot allowlist is defined, restrict to those users
  const pilotIds = (process.env.ENGAGEMENT_PILOT_CLERK_IDS ?? "").split(",").filter(Boolean);
  if (pilotIds.length > 0 && clerkId) {
    return pilotIds.includes(clerkId);
  }
  // No allowlist = feature is open to all authenticated users
  return true;
}

function getFeatureFlag(feature: EngagementFeature): boolean {
  switch (feature) {
    case "dailyPlan": return process.env.ENGAGEMENT_DAILY_PLAN_ENABLED === "true";
    case "actions": return process.env.ENGAGEMENT_ACTIONS_ENABLED === "true";
    case "contentActivation": return process.env.ENGAGEMENT_CONTENT_ACTIVATION_ENABLED === "true";
    case "weeklyReview": return process.env.ENGAGEMENT_WEEKLY_REVIEW_ENABLED === "true";
    case "email": return process.env.ENGAGEMENT_EMAIL_ENABLED === "true";
    case "campaigns": return process.env.ENGAGEMENT_CAMPAIGNS_ENABLED === "true";
    default: return false;
  }
}

export type EngagementFeature = "dailyPlan" | "actions" | "contentActivation" | "weeklyReview" | "email" | "campaigns";
