import { TRPCError } from "@trpc/server";

/**
 * Per-user in-memory rate limiter for expensive LLM endpoints.
 *
 * This is intentionally process-local: it resets on restart and is NOT shared
 * across multiple Railway/app instances. Multi-instance deployments need a
 * shared store (e.g. Redis) or gateway-level rate limiting.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the request is allowed; false if the bucket is exhausted. */
export function consumeRateLimit(
  key: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) return false;
  bucket.count += 1;
  return true;
}

/** Throws TRPCError TOO_MANY_REQUESTS when the per-key limit is exceeded. */
export function assertRateLimit(key: string): void {
  if (!consumeRateLimit(key)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please wait a minute and try again.",
    });
  }
}

/** Test helper — clears all buckets. */
export function clearRateLimitBuckets(): void {
  requestBuckets.clear();
}
