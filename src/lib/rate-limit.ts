import { isApiError } from "@/lib/api/client";

/**
 * Shared 429 (rate-limit) copy + mapping (P5.4).
 * Used by login (P1.5), step-up (P4.1) and withdraw (P4.4).
 * No auto-retry anywhere — the user waits and retries manually.
 */
export const RATE_LIMIT_MESSAGE =
  "Terlalu banyak percobaan — mohon tunggu sebentar dan coba lagi.";

export function isRateLimited(err: unknown): boolean {
  return isApiError(err, 429);
}

/**
 * Returns the shared rate-limit message when `err` is a 429 ApiError,
 * otherwise null (caller falls through to its other mappings).
 */
export function rateLimitMessage(err: unknown): string | null {
  return isRateLimited(err) ? RATE_LIMIT_MESSAGE : null;
}
