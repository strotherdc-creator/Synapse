/**
 * Engagement feature-flag guard.
 * Currently ALL features are enabled for ALL authenticated users.
 * The flag system is kept for future use but always returns true.
 */
export function isEngagementEnabled(_feature: EngagementFeature, _clerkId?: string): boolean {
  return true;
}

export type EngagementFeature = "dailyPlan" | "actions" | "contentActivation" | "weeklyReview" | "email" | "campaigns";
