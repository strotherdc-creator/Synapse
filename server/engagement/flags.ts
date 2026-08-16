import { ENV } from "../_core/env";

/**
 * Engagement feature-flag guard.
 * Returns true only when the feature is enabled AND the user is in the pilot allowlist
 * (or the allowlist is empty, meaning all users are allowed).
 */
export function isEngagementEnabled(feature: keyof typeof featureMap, clerkId?: string): boolean {
  const enabled = featureMap[feature];
  if (!enabled) return false;
  // If a pilot allowlist is defined, restrict to those users
  if (ENV.engagementPilotClerkIds.length > 0 && clerkId) {
    return ENV.engagementPilotClerkIds.includes(clerkId);
  }
  // No allowlist = feature is open to all authenticated users
  return true;
}

const featureMap = {
  dailyPlan: ENV.engagementDailyPlanEnabled,
  actions: ENV.engagementActionsEnabled,
  contentActivation: ENV.engagementContentActivationEnabled,
  weeklyReview: ENV.engagementWeeklyReviewEnabled,
  email: ENV.engagementEmailEnabled,
  campaigns: ENV.engagementCampaignsEnabled,
} as const;

export type EngagementFeature = keyof typeof featureMap;
