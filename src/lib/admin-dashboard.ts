/**
 * Merchant admin dashboard (P7.2) — pure mapping/normalization between the
 * wire types (src/types/api.ts) and what the dashboard renders.
 *
 * Wire shapes are not yet live-verified (see note in types/api.ts), so every
 * accessor here is defensive: missing or malformed fields coerce to zero and
 * an empty tenant renders "zeros, not errors" (per the P7.2 edge-case rule).
 */
import type { AdminDashboardRes, DashboardSeriesRes } from "@/types/api";

/** View model for one KPI widget on the dashboard. */
export interface KpiCard {
  key: string;
  title: string;
  /** Pre-formatted display value (money includes currency). */
  value: string;
  /** Secondary line under the value. */
  desc: string;
  icon: string;
  /** Color Admin palette class, e.g. "bg-teal". */
  color: string;
}

/** One chart-ready point (money already coerced to finite numbers). */
export interface SeriesPoint {
  date: string;
  deposits: number;
  withdrawals: number;
  net: number;
}

/** Coerce an unknown wire field to a finite number; anything else → 0. */
function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Like toAmount but clamps to a non-negative integer (counts never go below 0). */
function toCount(value: unknown): number {
  const n = toAmount(value);
  return n > 0 ? Math.floor(n) : 0;
}

/** Integer money amount in minor units → "IDR 1.500.000" style string. */
export function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `${currency} ${formatted}`;
}

/** Count → grouped string ("1.234"). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

/**
 * ISO timestamp → id-ID short datetime ("9 Agu 2026, 14.32"). Missing or
 * unparseable input renders "—" (admin tables show a dash, never crash).
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Build the six KPI cards for the dashboard. `undefined`/partial input (empty
 * tenant, shape drift) yields zeroed cards instead of errors.
 */
export function buildKpiCards(res: AdminDashboardRes | undefined): KpiCard[] {
  const currency = typeof res?.currency === "string" && res.currency ? res.currency : "IDR";
  const housePnl = toAmount(res?.house_pnl_today);

  return [
    {
      key: "deposits_today",
      title: "Deposits Today",
      value: formatMoney(toAmount(res?.deposits_today_amount), currency),
      desc: `${formatCount(toCount(res?.deposits_today_count))} transactions`,
      icon: "fa-circle-down",
      color: "bg-teal",
    },
    {
      key: "withdrawals_today",
      title: "Withdrawals Today",
      value: formatMoney(toAmount(res?.withdrawals_today_amount), currency),
      desc: `${formatCount(toCount(res?.withdrawals_today_count))} transactions`,
      icon: "fa-circle-up",
      color: "bg-orange",
    },
    {
      key: "pending_approvals",
      title: "Pending Approvals",
      value: formatCount(toCount(res?.withdrawals_pending_count)),
      desc: "withdrawals awaiting action",
      icon: "fa-hourglass-half",
      color: "bg-red",
    },
    {
      key: "active_players",
      title: "Active Players Today",
      value: formatCount(toCount(res?.players_active_today)),
      desc: "unique players with activity",
      icon: "fa-user-check",
      color: "bg-blue",
    },
    {
      key: "total_players",
      title: "Total Players",
      value: formatCount(toCount(res?.players_total)),
      desc: "registered on this tenant",
      icon: "fa-users",
      color: "bg-indigo",
    },
    {
      key: "house_pnl",
      title: "House PnL Today",
      value: formatMoney(housePnl, currency),
      desc: housePnl >= 0 ? "house is up" : "house is down",
      icon: "fa-scale-balanced",
      color: housePnl >= 0 ? "bg-green" : "bg-red",
    },
  ];
}

/**
 * Normalize the dashboard-series response for the chart: coerce numbers,
 * drop malformed points, sort ascending by date. Empty tenant → [].
 */
export function toSeriesPoints(res: DashboardSeriesRes | undefined): SeriesPoint[] {
  const points = res?.points;
  if (!Array.isArray(points)) return [];

  return points
    .filter((p): p is NonNullable<typeof p> => p != null && typeof p === "object")
    .map((p) => ({
      date: typeof p.date === "string" ? p.date : "",
      deposits: toAmount(p.deposits),
      withdrawals: toAmount(p.withdrawals),
      net: toAmount(p.net),
    }))
    .filter((p) => p.date !== "")
    .sort((a, b) => a.date.localeCompare(b.date));
}
