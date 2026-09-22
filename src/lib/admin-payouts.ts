/**
 * Operator payouts (P7.5) — pure mapping/validation between the wire types
 * (src/types/api.ts) and the payouts UI.
 *
 * Wire shapes are not live-verified (see types/api.ts) — every accessor
 * coerces defensively so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import type {
  OperatorEarningsRes,
  OperatorPayoutCallbackReq,
  OperatorPayoutDetailRes,
  OperatorPayoutListRes,
  ProposeOperatorPayoutReq,
} from "@/types/api";

/** House balance color coding thresholds (integer minor units). */
export const HOUSE_BALANCE_THRESHOLDS = {
  /** Below this → show as "low" (orange). */
  LOW: 10_000_000,
  /** Negative → show as "critical" (red). */
  CRITICAL: 0,
} as const;

/**
 * Payout method options. Kept client-side because the backend's config schema
 * is not documented; these are the standard options for the reference adapter.
 * Assumed from spec: "bank_transfer" and "ewallet" are supported.
 */
export const PAYOUT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "ewallet", label: "E-Wallet" },
] as const;

/** Payout lifecycle states we render. */
export const PAYOUT_STATES = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;

// ---------------------------------------------------------------------------
// Earnings view
// ---------------------------------------------------------------------------

export interface EarningsView {
  currency: string;
  availableBalance: number;
  pnlYtd: number;
  withdrawalsThisMonth: number;
  effectiveDate: string | null;
  /** Derived display state for the house-balance widget. */
  balanceState: "critical" | "low" | "healthy";
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

/** Normalize the earnings response; missing/garbage → zeros. */
export function toEarningsView(res: OperatorEarningsRes | undefined): EarningsView {
  const availableBalance = toAmount(res?.available_balance);
  let balanceState: EarningsView["balanceState"] = "healthy";
  if (availableBalance < HOUSE_BALANCE_THRESHOLDS.CRITICAL) {
    balanceState = "critical";
  } else if (availableBalance > HOUSE_BALANCE_THRESHOLDS.CRITICAL && availableBalance < HOUSE_BALANCE_THRESHOLDS.LOW) {
    balanceState = "low";
  }
  return {
    currency: toText(res?.currency) || "IDR",
    availableBalance,
    pnlYtd: toAmount(res?.pnl_ytd),
    withdrawalsThisMonth: toAmount(res?.withdrawals_this_month),
    effectiveDate: toIsoOrNull(res?.effective_date),
    balanceState,
  };
}

// ---------------------------------------------------------------------------
// Payout history rows
// ---------------------------------------------------------------------------

export interface PayoutRow {
  id: string;
  userId: number;
  username: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  proposedBy: string;
  proposedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  result: string | null;
  referenceNo: string | null;
  callbackAt: string | null;
}

export interface PayoutHistoryView {
  rows: PayoutRow[];
  total: number;
}

function toPayoutRow(w: import("@/types/api").OperatorPayoutRow): PayoutRow {
  return {
    id: toText(w?.id),
    userId: toAmount(w?.user_id),
    username: toText(w?.username) || `#${toAmount(w?.user_id)}`,
    amount: toAmount(w?.amount),
    currency: toText(w?.currency) || "IDR",
    status: toText(w?.status),
    method: toText(w?.method),
    proposedBy: toText(w?.proposed_by),
    proposedAt: toIsoOrNull(w?.proposed_at),
    approvedBy: toText(w?.approved_by) || null,
    approvedAt: toIsoOrNull(w?.approved_at),
    result: toText(w?.result) || null,
    referenceNo: toText(w?.reference_no) || null,
    callbackAt: toIsoOrNull(w?.callback_at),
  };
}

/** Normalize the history response; missing/garbage → empty list. */
export function toPayoutHistory(
  res: OperatorPayoutListRes | undefined
): PayoutHistoryView {
  const list = res?.payouts;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list
    .filter(
      (w): w is import("@/types/api").OperatorPayoutRow =>
        w != null && typeof w === "object"
    )
    .map(toPayoutRow)
    .filter((r) => r.id !== "");
  const total = toAmount(res?.total) || rows.length;
  return { rows, total };
}

/** Normalize a detail response (used by the detail drawer). */
export function toPayoutDetail(
  res: OperatorPayoutDetailRes | undefined
): PayoutRow | null {
  if (res == null || typeof res !== "object") return null;
  return {
    id: toText(res.id),
    userId: toAmount(res.user_id),
    username: toText(res.username) || `#${toAmount(res.user_id)}`,
    amount: toAmount(res.amount),
    currency: toText(res.currency) || "IDR",
    status: toText(res.status),
    method: toText(res.method),
    proposedBy: toText(res.proposed_by),
    proposedAt: toIsoOrNull(res.proposed_at),
    approvedBy: toText(res.approved_by) || null,
    approvedAt: toIsoOrNull(res.approved_at),
    result: toText(res.result) || null,
    referenceNo: toText(res.reference_no) || null,
    callbackAt: toIsoOrNull(res.callback_at),
  };
}

// ---------------------------------------------------------------------------
// Four-eyes checker UI enforcement (defense in depth — server still 403s)
// ---------------------------------------------------------------------------

/**
 * Check whether the current admin session is the proposer of this payout.
 * The server enforces maker ≠ checker with a 403; we hide the Approve button
 * in the UI to make the rule visible (and avoid a round-trip).
 */
export function isProposer(payout: PayoutRow, sessionUsername: string): boolean {
  const proposer = payout.proposedBy.trim().toLowerCase();
  const actor = sessionUsername.trim().toLowerCase();
  if (proposer === "" || actor === "") return false;
  return proposer === actor;
}

/**
 * Status badge class for payout state. Unknown/empty → secondary.
 */
export function payoutStatusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  switch (s) {
    case "PENDING":
      return "bg-warning text-dark";
    case "APPROVED":
    case "PAID":
      return "bg-success";
    case "REJECTED":
    case "FAILED":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
}

// ---------------------------------------------------------------------------
// Propose form validation
// ---------------------------------------------------------------------------

export interface ProposeFormInput {
  amount: string;
  method: string;
  destination: string;
}

export interface ProposeFormResult {
  req: ProposeOperatorPayoutReq;
  error: null;
}

export interface ProposeFormError {
  req: null;
  error: string;
}

/**
 * Validate the propose-payout form. Amount must be a positive integer in
 * minor units; method and destination are required. Client-side validation
 * only — the server will still validate and return 4xx for business rules.
 */
export function validateProposeForm(
  input: ProposeFormInput,
  clientRef: string
): ProposeFormResult | ProposeFormError {
  const amountStr = input.amount.trim();
  if (amountStr === "") {
    return { req: null, error: "Amount is required." };
  }
  const amount = Number(amountStr);
  if (!Number.isInteger(amount) || amount <= 0) {
    return { req: null, error: "Amount must be a positive whole number (minor units)." };
  }
  const method = input.method.trim();
  if (method === "") {
    return { req: null, error: "Payout method is required." };
  }
  const destination = input.destination.trim();
  if (destination === "") {
    return { req: null, error: "Destination reference is required." };
  }
  return {
    req: { amount, method, destination, client_ref: clientRef },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Payout-callback form validation
// ---------------------------------------------------------------------------

export interface CallbackFormInput {
  result: string;
  reference_no: string;
}

/**
 * Validate the payout-callback form. `result` is a short status string
 * (e.g. "PAID", "FAILED", "REFUNDED"). `reference_no` is optional.
 */
export function validateCallbackForm(
  input: CallbackFormInput
): { req: OperatorPayoutCallbackReq; error: null } | { req: null; error: string } {
  const result = input.result.trim();
  if (result === "") {
    return { req: null, error: "Result is required (e.g. PAID, FAILED)." };
  }
  if (result.length > 32) {
    return { req: null, error: "Result must be 32 characters or fewer." };
  }
  const referenceNo = input.reference_no.trim();
  if (referenceNo.length > 64) {
    return { req: null, error: "Reference must be 64 characters or fewer." };
  }
  return {
    req: { result, reference_no: referenceNo === "" ? undefined : referenceNo },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map an operator-payout action failure to display copy.
 * Returns "" for the silent case (operator cancelled the step-up modal —
 * apiFetch's step-up retry rejects with the string "cancel").
 *
 * Over-draw beyond house_pnl → backend 4xx → mapped to "insufficient house balance".
 */
export function mapPayoutActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to perform this action.";
  }
  if (isApiError(err, 404)) {
    return "Payout not found.";
  }
  if (isApiError(err, 409)) {
    // Per spec P7.5: over-draw beyond house_pnl → map to "insufficient house balance".
    // 409 from this endpoint is the state-CAS / over-draw path.
    return "Insufficient house balance or conflicting state — the payout was not approved.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request — check the payout details.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the payout state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}

/** True when the error is the over-draw / insufficient-balance case. */
export function isInsufficientBalanceError(err: unknown): boolean {
  return (
    isApiError(err, 409) &&
    (err.message?.toLowerCase().includes("insufficient") ||
      err.message?.toLowerCase().includes("balance") ||
      err.code?.toLowerCase().includes("insufficient"))
  );
}
