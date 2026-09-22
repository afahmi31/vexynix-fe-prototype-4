/**
 * Reports (P7.10) — pure mapping/validation between wire types and the
 * payments report / auto-WD rules + decisions / swing config UIs.
 *
 * Wire shapes are NOT live-verified — every accessor coerces defensively
 * so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import { toPaymentsReport, type PaymentReportSummaryView } from "./admin-recon";
import type { AutoWDRule, SwingConfig } from "@/types/api";

export { toPaymentsReport, type PaymentReportSummaryView };

// ---------------------------------------------------------------------------
// Payments report
// ---------------------------------------------------------------------------

export function formatMoney(amount: number, currency: string = "IDR"): string {
  const formatter = new Intl.NumberFormat("id-ID", { style: "currency", currency });
  return formatter.format(amount);
}

// ---------------------------------------------------------------------------
// Auto-WD rules
// ---------------------------------------------------------------------------

export interface AutoWDRuleFormInput {
  name: string;
  enabled: boolean;
  min_amount: string;
  max_amount: string;
  currency: string;
  player_segment: string;
}

export function validateAutoWDRule(input: AutoWDRuleFormInput): {
  rule: Partial<AutoWDRule>;
  error: null;
} | {
  rule: null;
  error: string;
} {
  if (!input.name.trim()) {
    return { rule: null, error: "Rule name is required." };
  }

  const minAmount = parseFloat(String(input.min_amount).trim());
  if (Number.isNaN(minAmount) || minAmount < 0) {
    return { rule: null, error: "Minimum amount must be a non-negative number." };
  }

  const maxAmount = parseFloat(String(input.max_amount).trim());
  if (Number.isNaN(maxAmount) || maxAmount < 0) {
    return { rule: null, error: "Maximum amount must be a non-negative number." };
  }

  return {
    rule: {
      name: input.name.trim(),
      enabled: input.enabled,
      min_amount: minAmount,
      max_amount: maxAmount,
      currency: String(input.currency || "IDR"),
      player_segment: input.player_segment.trim() || "All players",
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Swing config
// ---------------------------------------------------------------------------

export interface SwingConfigFormInput {
  enabled: boolean;
  strategy: string;
  rebalanceIntervalMinutes: string;
}

export function validateSwingConfig(input: SwingConfigFormInput): {
  req: SwingConfig;
  error: null;
} | {
  req: null;
  error: string;
} {
  const interval = parseInt(String(input.rebalanceIntervalMinutes));
  if (Number.isNaN(interval) || interval <= 0) {
    return { req: null, error: "Rebalance interval must be a positive integer (minutes)." };
  }

  const strategy = (input.strategy || "round_robin") as "round_robin" | "weighted" | "performance";
  return {
    req: {
      enabled: input.enabled,
      strategy,
      rebalance_interval_minutes: interval,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

export function mapReportsActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to access reports.";
  }
  if (isApiError(err, 404)) {
    return "Data not found.";
  }
  if (isApiError(err, 409)) {
    return err.message || "Conflicting state — refresh and try again.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the data before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}
