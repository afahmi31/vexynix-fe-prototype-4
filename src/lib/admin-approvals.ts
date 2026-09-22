/**
 * Withdrawal approvals (P7.4) — pure mapping between the wire types and what
 * the approvals queue renders, plus the concurrent-approve error mapping.
 *
 * Wire shapes are not live-verified (see types/api.ts) — every accessor
 * coerces defensively so shape drift degrades to empty values, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import type { AdminWithdrawal, AdminWithdrawalListRes } from "@/types/api";

/** Queue tabs — the two actionable withdrawal states (docs §3.1). */
export const QUEUE_TABS = [
  { status: "PENDING_APPROVAL", label: "Pending Approval" },
  { status: "AML_HOLD", label: "AML Hold" },
] as const;

export type QueueStatus = (typeof QUEUE_TABS)[number]["status"];

/** Resolve the ?status= URL param to a known tab; anything else → first tab. */
export function parseQueueStatus(raw: string | null): QueueStatus {
  return raw === "AML_HOLD" ? "AML_HOLD" : "PENDING_APPROVAL";
}

/** One normalized queue row (camelCase, display-ready primitives). */
export interface WithdrawalRow {
  id: string;
  userId: number;
  username: string;
  amount: number;
  currency: string;
  status: string;
  destination: string;
  requestedAt: string | null;
  amlFlags: string[];
  clientRef: string;
}

function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is string => typeof f === "string" && f !== "");
}

/** Normalize one wire withdrawal; rows without an id are dropped by the list. */
export function toWithdrawalRow(w: AdminWithdrawal): WithdrawalRow {
  return {
    id: toText(w?.id),
    userId: toAmount(w?.user_id),
    username: toText(w?.username) || `#${toAmount(w?.user_id)}`,
    amount: toAmount(w?.amount),
    currency: toText(w?.currency) || "IDR",
    status: toText(w?.status),
    destination: toText(w?.destination),
    requestedAt: typeof w?.requested_at === "string" ? w.requested_at : null,
    amlFlags: toFlags(w?.aml_flags),
    clientRef: toText(w?.client_ref),
  };
}

export interface WithdrawalQueueView {
  rows: WithdrawalRow[];
  total: number;
}

/** Normalize the queue response; missing/garbage → empty queue. */
export function toWithdrawalQueue(
  res: AdminWithdrawalListRes | undefined
): WithdrawalQueueView {
  const list = res?.withdrawals;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list
    .filter((w): w is AdminWithdrawal => w != null && typeof w === "object")
    .map(toWithdrawalRow)
    .filter((r) => r.id !== "");
  const total = toAmount(res?.total) || rows.length;
  return { rows, total };
}

/**
 * Map an approve / AML-resolve failure to display copy.
 *
 * Concurrent-approve edge (spec P7.4): the backend refuses the second approve
 * with a state-CAS 4xx (409 Conflict, or 400/404 when the row already left
 * the queue) → "already processed" + the caller invalidates the queue.
 * Returns "" for the silent cases (step-up cancelled by the operator — the
 * apiFetch step-up retry rejects with the string "cancel").
 */
export function mapApprovalActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 409) || isApiError(err, 400) || isApiError(err, 404)) {
    return "This withdrawal was already processed — the queue has been refreshed.";
  }
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to process withdrawals.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the withdrawal state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}

/** True when the error means the row left the queue (CAS refusal). */
export function isAlreadyProcessedError(err: unknown): boolean {
  return isApiError(err, 409) || isApiError(err, 400) || isApiError(err, 404);
}
