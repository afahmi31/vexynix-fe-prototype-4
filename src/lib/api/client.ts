/**
 * Typed fetch client for the Go BFF.
 * All player-facing and admin calls go through this single function.
 */

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

/** Sentinel code for network-level failures (fetch threw, no response). */
export const NETWORK_ERROR_CODE = "NETWORK";

/**
 * Core fetch wrapper. Prepends BFF origin, sets JSON content-type on bodies,
 * attaches Bearer token from the registered token getter, and parses Echo
 * error bodies into machine-readable codes.
 *
 * On non-2xx: throws ApiError with { status, code, message }.
 *   - code is extracted from Echo's {"message": "..."} body (the backend
 *     puts machine codes like STEP_UP_REQUIRED there).
 *   - non-JSON error bodies get code "HTTP_<status>".
 * On network failure: throws ApiError with { status: 0, code: "NETWORK" }.
 * On 204/empty body: returns undefined.
 */
export async function apiFetch<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  return apiFetchInternal<T>(path, opts, false);
}

async function apiFetchInternal<T>(
  path: string,
  opts: RequestInit,
  stepUpRetried: boolean
): Promise<T> {
  // Browser: use relative path (Next.js rewrite proxies to BFF, same-origin).
  // Server-side (SSR/route handlers): prepend BFF origin directly.
  // In the browser the path stays RELATIVE, and that is what makes one deployment serve
  // every brand: the request goes to whatever `app.<domain>` the player is on, and the BFF
  // resolves Host -> tenant from there (game-docs/11 §5). Only a server-side fetch, which has
  // no Host of its own, needs an absolute origin — and that one points at the BFF on the
  // internal network, never at a brand's public host.
  const url = typeof window !== "undefined" ? path : `${bffOrigin}${path}`;

  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };

  if (opts.body) {
    headers["Content-Type"] = "application/json";
  }

  const token = tokenGetter?.();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...opts, headers });
  } catch {
    throw { status: 0, code: NETWORK_ERROR_CODE, message: "Network error" } satisfies ApiError;
  }

  // 204 or empty body → no JSON to parse
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const text = await response.text();

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = response.statusText;

    // Echo returns {"message": "..."} — the message field often carries
    // machine-readable codes like STEP_UP_REQUIRED, ACCOUNT_FROZEN, etc.
    try {
      const body = JSON.parse(text);
      if (body?.message) {
        code = body.message;
        message = body.message;
      }
    } catch {
      // Non-JSON error body — use generic code
      if (text) message = text;
    }

    const apiError = { status: response.status, code, message };

    // STEP_UP_RETRY: retry exactly once on 401 STEP_UP_REQUIRED
    if (stepUpRetried === false && response.status === 401 && code === "STEP_UP_REQUIRED") {
      // Dynamically import stepUpStore to avoid circular deps
      let requestStepUp: () => Promise<void>;
      try {
        const mod = await import("@/stores/stepup");
        requestStepUp = mod.useStepUpStore.getState().requestStepUp;
      } catch {
        // Store not ready yet — throw original error
        throw apiError;
      }

      try {
        await requestStepUp();
        const optsWithBody: RequestInit = { ...opts };
        if (opts.body) {
          optsWithBody.body = opts.body;
        }
        return await apiFetchInternal<T>(path, optsWithBody, true);
      } catch (cancelOrFail) {
        // User cancelled (reject) or second attempt still fails
        throw cancelOrFail;
      }
    }

    // Global auth-failure handling: if this is a session-expiry 401
    // (not step-up, not invalid credentials), invoke the registered handler.
    if (
      response.status === 401 &&
      code !== "STEP_UP_REQUIRED" &&
      code !== "invalid credentials" &&
      code !== "Invalid credentials" &&
      !authFailureTriggered
    ) {
      authFailureTriggered = true;
      authFailureHandler?.();
    }

    throw apiError;
  }

  // Try to parse JSON; if body is empty or non-JSON, return undefined
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

/** Type guard for ApiError. Optionally check status and/or code. */
export function isApiError(
  err: unknown,
  status?: number,
  code?: string
): err is ApiError {
  if (typeof err !== "object" || err === null) return false;
  const e = err as ApiError;
  if (typeof e.status !== "number" || typeof e.code !== "string") return false;
  if (status !== undefined && e.status !== status) return false;
  if (code !== undefined && e.code !== code) return false;
  return true;
}

// --- Configuration (wired by session.ts in P1) ---

let bffOrigin = process.env.NEXT_PUBLIC_BFF_ORIGIN || "http://localhost:18080";

/** Override the BFF origin at runtime (used by tests). */
export function setBffOrigin(origin: string): void {
  bffOrigin = origin;
}

type TokenGetter = () => string | null;
let tokenGetter: TokenGetter | null = null;

/**
 * Register a function that returns the current session token.
 * Called by lib/session.ts during app bootstrap (P1).
 */
export function setTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

// --- onAuthFailure callback ---

export type AuthFailureHandler = () => void;

let authFailureHandler: AuthFailureHandler | null = null;
let authFailureTriggered = false;

/**
 * Register a handler invoked when apiFetch receives a 401 that is NOT
 * STEP_UP_REQUIRED and NOT a credentials error (invalid credentials / login).
 * The app layout registers this to clear session and redirect to /login.
 * Must NOT fire for 401 STEP_UP_REQUIRED (handled by step-up modal in P4).
 *
 * Idempotent: once triggered, subsequent 401s are ignored until reset.
 */
export function setAuthFailureHandler(handler: AuthFailureHandler): void {
  authFailureHandler = handler;
}

/**
 * Reset the idempotency flag — called by login/logout so a new session
 * starts clean.
 */
export function resetAuthFailure(): void {
  authFailureTriggered = false;
}
