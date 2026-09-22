/**
 * Players admin (P7.3) — pure mapping/validation between the wire types
 * (src/types/api.ts) and the directory / 360° profile UI.
 *
 * Wire shapes are not live-verified (see types/api.ts) — every accessor
 * coerces defensively so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import { toWithdrawalRow, type WithdrawalRow } from "@/lib/admin-approvals";
import type {
  AccountStatus,
  AdminPlayerListRes,
  AdminPlayerProfileRes,
  AdminPlayerSummary,
  AdminRegisterPlayerReq,
  SetPlayerLimitsReq,
} from "@/types/api";
import type { ListPlayersParams } from "@/lib/api/admin";

export const PLAYER_PAGE_SIZE = 20;

/** Statuses offered by the directory filter ("" = all). */
export const PLAYER_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
] as const;

/** Lifecycle statuses the set-status dialog may transition to. */
export const PLAYER_LIFECYCLE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
] as const;

// ---------------------------------------------------------------------------
// Directory query params (mirrored in the URL for shareable links)
// ---------------------------------------------------------------------------

export interface DirectoryQuery {
  page: number;
  limit: number;
  search: string;
  status: string;
}

/** Minimal read interface — satisfied by URLSearchParams and next/navigation's ReadonlyURLSearchParams. */
export interface QueryParamReader {
  get(name: string): string | null;
}

export function parseDirectoryQuery(sp: QueryParamReader): DirectoryQuery {
  const rawPage = Number.parseInt(sp.get("page") ?? "", 10);
  const status = sp.get("status") ?? "";
  const knownStatus = PLAYER_STATUS_OPTIONS.some((o) => o.value === status)
    ? status
    : "";
  return {
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    limit: PLAYER_PAGE_SIZE,
    search: (sp.get("q") ?? "").trim(),
    status: knownStatus,
  };
}

/** Convenience for PlayerDirectory import compatibility. */
export function listPlayersParamsFromQuery(
  sp: QueryParamReader
): ListPlayersParams {
  const q = parseDirectoryQuery(sp);
  return { ...q, search: q.search };
}

/** Build the shareable URL query string (empty/default values omitted). */
export function buildDirectoryQueryString(q: DirectoryQuery): string {
  const sp = new URLSearchParams();
  if (q.search) sp.set("q", q.search);
  if (q.status) sp.set("status", q.status);
  if (q.page > 1) sp.set("page", String(q.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Directory normalization
// ---------------------------------------------------------------------------

export interface PlayerRow {
  userId: number;
  username: string;
  phone: string;
  currency: string;
  status: string;
  totalDeposits: number;
  totalWithdrawals: number;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export interface PlayerListView {
  rows: PlayerRow[];
  total: number;
  page: number;
  limit: number;
}

function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

export function toPlayerRow(p: AdminPlayerSummary): PlayerRow {
  return {
    userId: toAmount(p?.user_id),
    username: toText(p?.username) || `#${toAmount(p?.user_id)}`,
    phone: toText(p?.phone_number),
    currency: toText(p?.currency) || "IDR",
    status: toText(p?.status) || "pending",
    totalDeposits: toAmount(p?.total_deposits),
    totalWithdrawals: toAmount(p?.total_withdrawals),
    createdAt: toIsoOrNull(p?.created_at),
    lastLoginAt: toIsoOrNull(p?.last_login_at),
  };
}

export function toPlayerList(res: AdminPlayerListRes | undefined): PlayerListView {
  const list = res?.players;
  const rows = Array.isArray(list)
    ? list
        .filter((p): p is AdminPlayerSummary => p != null && typeof p === "object")
        .map(toPlayerRow)
        .filter((r) => r.userId > 0)
    : [];
  return {
    rows,
    total: toAmount(res?.total) || rows.length,
    page: toAmount(res?.page) || 1,
    limit: toAmount(res?.limit) || PLAYER_PAGE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// 360° profile normalization
// ---------------------------------------------------------------------------

export interface PlayerProfileView {
  userId: number;
  username: string;
  phone: string;
  currency: string;
  status: AccountStatus;
  createdAt: string | null;
  lastLoginAt: string | null;
  /** null = balance not present in the response (still never editable, I1). */
  balance: { available: number; held: number } | null;
  stats: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalBets: number;
    totalWins: number;
    betCount: number;
    lastActiveAt: string | null;
  };
  compliance: {
    frozen: boolean;
    selfExcludedUntil: string | null;
    limits: {
      daily: number | null;
      weekly: number | null;
      monthly: number | null;
    };
    amlFlags: string[];
  };
  pendingWithdrawals: WithdrawalRow[];
}

function toLimitOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function toPlayerProfile(
  res: AdminPlayerProfileRes | undefined
): PlayerProfileView | null {
  if (res == null || typeof res !== "object") return null;
  const compliance = res.compliance;
  const limits = compliance?.limits;
  const pending = res.pending_withdrawals;

  return {
    userId: toAmount(res.user_id),
    username: toText(res.username) || `#${toAmount(res.user_id)}`,
    phone: toText(res.phone_number),
    currency: toText(res.currency) || "IDR",
    status: (toText(res.status) || "pending") as AccountStatus,
    createdAt: toIsoOrNull(res.created_at),
    lastLoginAt: toIsoOrNull(res.last_login_at),
    balance:
      res.balance != null && typeof res.balance === "object"
        ? {
            available: toAmount(res.balance.available),
            held: toAmount(res.balance.held),
          }
        : null,
    stats: {
      totalDeposits: toAmount(res.stats?.total_deposits),
      totalWithdrawals: toAmount(res.stats?.total_withdrawals),
      totalBets: toAmount(res.stats?.total_bets),
      totalWins: toAmount(res.stats?.total_wins),
      betCount: toAmount(res.stats?.bet_count),
      lastActiveAt: toIsoOrNull(res.stats?.last_active_at),
    },
    compliance: {
      frozen: compliance?.frozen === true,
      selfExcludedUntil: toIsoOrNull(compliance?.self_excluded_until),
      limits: {
        daily: toLimitOrNull(limits?.daily_deposit_limit),
        weekly: toLimitOrNull(limits?.weekly_deposit_limit),
        monthly: toLimitOrNull(limits?.monthly_deposit_limit),
      },
      amlFlags: Array.isArray(compliance?.aml_flags)
        ? compliance.aml_flags.filter((f): f is string => typeof f === "string")
        : [],
    },
    pendingWithdrawals: Array.isArray(pending)
      ? pending.map(toWithdrawalRow).filter((r) => r.id !== "")
      : [],
  };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-success";
    case "pending":
      return "bg-warning text-dark";
    case "suspended":
      return "bg-danger";
    case "closed":
      return "bg-secondary";
    default:
      return "bg-secondary";
  }
}

// ---------------------------------------------------------------------------
// Form validation (plain helpers — the dialogs keep controlled state)
// ---------------------------------------------------------------------------

export interface LimitsInput {
  daily: string;
  weekly: string;
  monthly: string;
}

/** Empty field = no limit (null). Values must be non-negative integers. */
export function validateLimitsInput(
  input: LimitsInput
): { values: SetPlayerLimitsReq; error: null } | { values: null; error: string } {
  const parse = (label: string, raw: string): number | null | string => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 0) {
      return `${label} must be a non-negative whole number (minor units).`;
    }
    return n;
  };

  const daily = parse("Daily limit", input.daily);
  if (typeof daily === "string") return { values: null, error: daily };
  const weekly = parse("Weekly limit", input.weekly);
  if (typeof weekly === "string") return { values: null, error: weekly };
  const monthly = parse("Monthly limit", input.monthly);
  if (typeof monthly === "string") return { values: null, error: monthly };

  return {
    values: {
      daily_deposit_limit: daily,
      weekly_deposit_limit: weekly,
      monthly_deposit_limit: monthly,
    },
    error: null,
  };
}

/** Self-exclusion duration in days: whole number, 1..3650. */
export function validateSelfExcludeDays(raw: string): { days: number; error: null } | { days: null; error: string } {
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1 || n > 3650) {
    return { days: null, error: "Duration must be a whole number of days (1–3650)." };
  }
  return { days: n, error: null };
}

export interface RegisterInput {
  username: string;
  phone: string;
  password: string;
  currency: string;
}

/** Mirrors the documented register contract (min-8-char password). */
export function validateRegisterInput(
  input: RegisterInput
): { values: AdminRegisterPlayerReq; error: null } | { values: null; error: string } {
  const username = input.username.trim();
  if (username.length < 3) {
    return { values: null, error: "Username must be at least 3 characters." };
  }
  const phone = input.phone.trim();
  if (phone.length < 6) {
    return { values: null, error: "Phone number is required." };
  }
  if (input.password.length < 8) {
    return { values: null, error: "Password must be at least 8 characters." };
  }
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { values: null, error: "Currency must be a 3-letter code (e.g. IDR)." };
  }
  return {
    values: { username, phone_number: phone, password: input.password, currency },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Action error mapping (limits / self-exclude / freeze / unfreeze / status)
// ---------------------------------------------------------------------------

/**
 * Map a player-action failure to display copy. Returns "" for the silent
 * case (operator cancelled the step-up modal — apiFetch's step-up retry
 * rejects with the string "cancel").
 *
 * Four-eyes unfreeze: the backend refuses a self-unfreeze (different operator
 * must have frozen) with a 403 whose message names the rule — surfaced as-is.
 */
export function mapPlayerActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) return err.message || "You do not have permission for this action.";
  if (isApiError(err, 404)) return "Player not found.";
  if (isApiError(err, 409)) return err.message || "Conflicting player state — refresh and try again.";
  if (isApiError(err, 429)) return "Too many attempts — wait a moment and try again.";
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the player state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}