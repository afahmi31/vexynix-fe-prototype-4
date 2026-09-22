/**
 * Recon & reports (P7.10) — pure mapping/validation between wire types
 * and the recon/reports UIs.
 *
 * Wire shapes are NOT live-verified — every accessor coerces defensively
 * so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import type {
  AutoWDDecision,
  AutoWDDecisionsRes,
  AutoWDRule,
  AutoWDRulesRes,
  DepositTransaction,
  DepositTransactionsRes,
  PaymentsReportRes,
  PayoutMismatch,
  PayoutMismatchesRes,
  ProviderBalance,
  ProviderBalanceRes,
  SwingConfig,
  SwingHistoryRes,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Shared coercion helpers
// ---------------------------------------------------------------------------

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function toBool(value: unknown): boolean {
  return value === true;
}

// ---------------------------------------------------------------------------
// Payout reconciliation
// ---------------------------------------------------------------------------

export interface PayoutReconcileView {
  id?: string;
  status?: string;
  mismatchesCount?: number;
  completedAt?: string | null;
}

export function toPayoutReconcileRun(run: unknown): PayoutReconcileView {
  if (run == null || typeof run !== "object") {
    return { id: "", status: "", mismatchesCount: 0 };
  }
  const obj = run as Record<string, unknown>;
  return {
    id: toText(obj.id),
    status: toText(obj.status),
    mismatchesCount: toAmount(obj.mismatches_found),
    completedAt: toIsoOrNull(obj.completed_at),
  };
}

export interface PayoutMismatchView {
  id: string;
  transactionId: string;
  playerUsername: string;
  amount: number;
  currency: string;
  reason: string;
  createdAt: string;
}

export function toPayoutMismatch(m: PayoutMismatch | undefined): PayoutMismatchView | undefined {
  if (m == null || typeof m !== "object") return undefined;
  return {
    id: toText(m.id),
    transactionId: toText(m.transaction_id),
    playerUsername: toText(m.player_username) || "Unknown",
    amount: toAmount(m.amount),
    currency: toText(m.currency) || "IDR",
    reason: toText(m.reason) || "Unknown discrepancy",
    createdAt: toIsoOrNull(m.created_at) || new Date().toISOString(),
  };
}

export function toPayoutMismatchesList(res: PayoutMismatchesRes | undefined): PayoutMismatchView[] {
  const list = res?.mismatches;
  if (!Array.isArray(list)) return [];
  return list.map(toPayoutMismatch).filter((r): r is PayoutMismatchView => r !== undefined);
}

// ---------------------------------------------------------------------------
// Provider balance
// ---------------------------------------------------------------------------

export interface ProviderBalanceView {
  providerId: string;
  balance: number;
  currency: string;
  status: string;
}

export function toProviderBalance(b: ProviderBalance | undefined): ProviderBalanceView | undefined {
  if (b == null || typeof b !== "object") return undefined;
  return {
    providerId: toText(b.provider_id),
    balance: toAmount(b.balance),
    currency: toText(b.currency) || "IDR",
    status: toText(b.status) || "healthy",
  };
}

export function toProviderBalanceList(res: ProviderBalanceRes | undefined): ProviderBalanceView[] {
  const list = res?.providers;
  if (!Array.isArray(list)) return [];
  return list.map(toProviderBalance).filter((r): r is ProviderBalanceView => r !== undefined);
}

// ---------------------------------------------------------------------------
// Deposit monitor
// ---------------------------------------------------------------------------

export interface DepositTransactionView {
  id: string;
  playerUsername: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  createdAt: string;
  completedAt: string | null;
}

export function toDepositTransaction(t: DepositTransaction | undefined): DepositTransactionView | undefined {
  if (t == null || typeof t !== "object") return undefined;
  return {
    id: toText(t.id),
    playerUsername: toText(t.player_username) || "Unknown",
    amount: toAmount(t.amount),
    currency: toText(t.currency) || "IDR",
    status: toText(t.status),
    method: toText(t.method) || "—",
    createdAt: toIsoOrNull(t.created_at) || new Date().toISOString(),
    completedAt: toIsoOrNull(t.completed_at),
  };
}

export function toDepositTransactionsList(res: DepositTransactionsRes | undefined): {
  transactions: DepositTransactionView[];
  total: number;
} {
  const list = res?.transactions;
  if (!Array.isArray(list)) return { transactions: [], total: 0 };
  const transactions = list.map(toDepositTransaction).filter((r): r is DepositTransactionView => r !== undefined);
  return {
    transactions,
    total: toAmount(res?.total) || transactions.length,
  };
}

// ---------------------------------------------------------------------------
// Payments report
// ---------------------------------------------------------------------------

export interface PaymentReportSummaryView {
  period: string;
  totalDeposits: number;
  totalWithdrawals: number;
  totalFees: number;
  netRevenue: number;
  currency: string;
}

export function toPaymentReportSummary(summary: unknown): PaymentReportSummaryView {
  if (summary == null || typeof summary !== "object") {
    return {
      period: "",
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalFees: 0,
      netRevenue: 0,
      currency: "IDR",
    };
  }
  const obj = summary as Record<string, unknown>;
  return {
    period: toText(obj.period) || "All time",
    totalDeposits: toAmount(obj.total_deposits),
    totalWithdrawals: toAmount(obj.total_withdrawals),
    totalFees: toAmount(obj.total_fees),
    netRevenue: toAmount(obj.net_revenue),
    currency: toText(obj.currency) || "IDR",
  };
}

export function toPaymentsReport(res: PaymentsReportRes | undefined): {
  summary: PaymentReportSummaryView;
  byMethod: Array<{ method: string; count: number; totalAmount: number }> | undefined;
} {
  return {
    summary: toPaymentReportSummary(res?.summary),
    byMethod: Array.isArray(res?.by_method)
      ? res.by_method.map((m) => ({
          method: toText(m.method),
          count: toAmount(m.count),
          totalAmount: toAmount(m.total_amount),
        }))
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Auto-WD rules
// ---------------------------------------------------------------------------

export interface AutoWDRuleView {
  id: string;
  name: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  playerSegment: string;
  createdAt: string;
  updatedAt: string;
}

export function toAutoWDRule(r: AutoWDRule | undefined): AutoWDRuleView | undefined {
  if (r == null || typeof r !== "object") return undefined;
  return {
    id: toText(r.id),
    name: toText(r.name) || "Auto-withdrawal rule",
    enabled: toBool(r.enabled),
    minAmount: toAmount(r.min_amount),
    maxAmount: toAmount(r.max_amount),
    currency: toText(r.currency) || "IDR",
    playerSegment: toText(r.player_segment) || "All players",
    createdAt: toIsoOrNull(r.created_at) || new Date().toISOString(),
    updatedAt: toIsoOrNull(r.updated_at) || new Date().toISOString(),
  };
}

export function toAutoWDRulesList(res: AutoWDRulesRes | undefined): {
  rules: AutoWDRuleView[];
  total: number;
} {
  const list = res?.rules;
  if (!Array.isArray(list)) return { rules: [], total: 0 };
  const rules = list.map(toAutoWDRule).filter((r): r is AutoWDRuleView => r !== undefined);
  return {
    rules,
    total: toAmount(res?.total) || rules.length,
  };
}

// ---------------------------------------------------------------------------
// Auto-WD decisions
// ---------------------------------------------------------------------------

export interface AutoWDDecisionView {
  id: string;
  ruleId: string;
  playerUsername: string;
  amount: number;
  decision: string;
  reason: string;
  createdAt: string;
}

export function toAutoWDDecision(d: AutoWDDecision | undefined): AutoWDDecisionView | undefined {
  if (d == null || typeof d !== "object") return undefined;
  return {
    id: toText(d.id),
    ruleId: toText(d.rule_id),
    playerUsername: toText(d.player_username) || "Unknown",
    amount: toAmount(d.amount),
    decision: toText(d.decision) || "pending",
    reason: toText(d.reason) || "-",
    createdAt: toIsoOrNull(d.created_at) || new Date().toISOString(),
  };
}

export function toAutoWDDecisionsList(res: AutoWDDecisionsRes | undefined): AutoWDDecisionView[] {
  const list = res?.decisions;
  if (!Array.isArray(list)) return [];
  return list.map(toAutoWDDecision).filter((r): r is AutoWDDecisionView => r !== undefined);
}

// ---------------------------------------------------------------------------
// Swing config
// ---------------------------------------------------------------------------

export interface SwingConfigView {
  enabled: boolean;
  strategy: string;
  rebalanceIntervalMinutes: number;
}

export function toSwingConfig(config: SwingConfig | undefined): SwingConfigView {
  if (config == null || typeof config !== "object") {
    return { enabled: false, strategy: "round_robin", rebalanceIntervalMinutes: 60 };
  }
  return {
    enabled: toBool(config.enabled),
    strategy: toText(config.strategy) || "round_robin",
    rebalanceIntervalMinutes: toAmount(config.rebalance_interval_minutes) || 60,
  };
}

// ---------------------------------------------------------------------------
// Swing history
// ---------------------------------------------------------------------------

export interface SwingHistoryRun {
  id: string;
  status: string;
  rebalancedProviders: number;
  startedAt: string;
  completedAt: string | null;
}

export function toSwingHistoryRun(run: unknown): SwingHistoryRun | undefined {
  if (run == null || typeof run !== "object") return undefined;
  const obj = run as Record<string, unknown>;
  return {
    id: toText(obj.id),
    status: toText(obj.status) || "running",
    rebalancedProviders: toAmount(obj.rebalanced_providers) || 0,
    startedAt: toIsoOrNull(obj.started_at) || new Date().toISOString(),
    completedAt: toIsoOrNull(obj.completed_at),
  };
}

export function toSwingHistoryList(res: SwingHistoryRes | undefined): SwingHistoryRun[] {
  const list = res?.runs;
  if (!Array.isArray(list)) return [];
  return list.map(toSwingHistoryRun).filter((r): r is SwingHistoryRun => r !== undefined);
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

export function mapReconActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to access recon tools.";
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
