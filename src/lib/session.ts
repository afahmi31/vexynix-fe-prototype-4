/**
 * Session storage — token + profile in localStorage (shared across the origin's tabs).
 * device_id also in localStorage (persisted per browser profile).
 *
 * ⭐ Why localStorage and not sessionStorage (changed 2026-08-28): games open in a NEW TAB via
 * `window.open(url, "_blank", "noopener")` — `noopener` is required so third-party game pages
 * cannot script us, but it also makes the game tab a fresh browsing context that inherits NO
 * sessionStorage. When a vendor's in-game Home button (e.g. PP's `lobbyUrl`) navigated that tab
 * back to /lobby, the app booted with no session and the player looked logged out. localStorage
 * is origin-wide, so the returning tab (and any second tab) finds the session. The multi-tab
 * lock model is unaffected — BroadcastChannel('balance-sync') was already origin-wide — and
 * logout/401 still clears the record for every future page load. The per-tab
 * "session expired" notice stays in sessionStorage (auth-redirect.ts), where per-tab is right.
 */
import { resetAuthFailure, setTokenGetter } from "./api/client";
import type { LoginRes } from "@/types/api";

const SESSION_KEY = "gw_session";
const DEVICE_KEY = "gw_device_id";

interface StoredSession {
  token: string;
  user_id: number;
  username: string;
  currency: string;
  status: string;
  role: string;
  merchant_id: number | null;
  must_change_password: boolean;
  phone_number?: string;
}

export function saveSession(login: LoginRes): void {
  if (typeof window === "undefined") return;
  const session: StoredSession = {
    token: login.token,
    user_id: login.user_id,
    username: login.username,
    currency: login.currency,
    status: login.status,
    role: login.role,
    merchant_id: login.merchant_id,
    must_change_password: login.must_change_password,
    phone_number: login.phone_number,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  setTokenGetter(() => login.token);
  // A fresh session must be able to trigger the 401 redirect again — the
  // handler latches after firing once.
  resetAuthFailure();
}

// readStored returns the raw session record, migrating a pre-2026-08-28 sessionStorage record
// into localStorage once so the deploy itself logs nobody out.
function readStored(): string | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) return raw;
  const legacy = sessionStorage.getItem(SESSION_KEY);
  if (legacy) {
    localStorage.setItem(SESSION_KEY, legacy);
    sessionStorage.removeItem(SESSION_KEY);
    return legacy;
  }
  return null;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = readStored();
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredSession).token;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = readStored();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY); // a legacy per-tab record must not resurrect the session
  setTokenGetter(() => null);
  // Deliberately not resetting the auth-failure latch here: clearSession runs
  // *inside* the 401 handler, and releasing it mid-redirect would let every
  // other in-flight 401 fire another navigation. Login re-arms it.
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

// Wire token getter on module load (client-side only)
if (typeof window !== "undefined") {
  setTokenGetter(getToken);
}
