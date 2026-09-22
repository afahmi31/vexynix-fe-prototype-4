/**
 * Where to send someone whose session is no longer usable.
 *
 * The reason ("your session ended") rides in sessionStorage rather than the
 * URL: clearing the session also trips the layout's own no-token guard, so two
 * redirects to /login can race and the last one wins. A flag survives that,
 * a query param would not. The return path is a query param — both redirects
 * carry the same value, so a clobber is harmless.
 */
import { isApiError } from "@/lib/api/client";

/** Page to return to once the user signs in again. */
export const NEXT_PARAM = "next";

const EXPIRED_KEY = "gw_session_expired";

/**
 * Only same-origin absolute paths survive. Protocol-relative ("//evil.com"),
 * absolute URLs and backslash tricks are dropped so ?next= can never be used
 * as an open redirect.
 */
export function safeNextPath(raw?: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

/** Build the /login URL, remembering where we were. */
export function loginHref(next?: string | null): string {
  const target = safeNextPath(next);
  if (!target || target === "/login" || target === "/register") return "/login";
  return `/login?${NEXT_PARAM}=${encodeURIComponent(target)}`;
}

/** Record that the trip to /login was caused by a dead session. */
export function markSessionExpired(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EXPIRED_KEY, "1");
}

/** Read and clear the flag — the notice is shown once. */
export function takeSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  const was = sessionStorage.getItem(EXPIRED_KEY) === "1";
  if (was) sessionStorage.removeItem(EXPIRED_KEY);
  return was;
}

/**
 * A 401 that means "sign in again". Step-up challenges also come back as 401
 * but are answered by the step-up dialog, not by logging out.
 */
export function isSessionExpiredError(err: unknown): boolean {
  return isApiError(err, 401) && err.code !== "STEP_UP_REQUIRED";
}
