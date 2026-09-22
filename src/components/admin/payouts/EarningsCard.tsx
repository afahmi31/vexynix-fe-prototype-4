"use client";

/**
 * Earnings card (P7.5) — house balance overview.
 * Shows the operator's earnings from GET /v1/operator-payouts/earnings.
 * Balance state color: healthy (green), low (orange), critical (red).
 */
import { EarningsView } from "@/lib/admin-payouts";
import { formatMoney, formatDateTime } from "@/lib/admin-dashboard";

interface EarningsCardProps {
  data: EarningsView;
  loading?: boolean;
}

export default function EarningsCard({ data, loading }: EarningsCardProps) {
  const stateClass = {
    healthy: "bg-success",
    low: "bg-orange",
    critical: "bg-red",
  }[data.balanceState];

  const stateLabel = {
    healthy: "Healthy",
    low: "Low",
    critical: "Critical",
  }[data.balanceState];

  if (loading) {
    return (
      <div className="placeholder-glow mb-3">
        <span className="placeholder col-12 rounded" style={{ height: "180px" }} />
      </div>
    );
  }

  return (
    <div className="widget widget-stats bg-theme mb-3">
      <div className="stats-icon">
        <i className="fa fa-house-chimney" />
      </div>
      <div className="stats-info">
        <h4>House Balance</h4>
        <p className="fs-4 fw-bold mb-0">
          {formatMoney(data.availableBalance, data.currency)}
        </p>
        <p className="small text-white-50 mb-2">
          State: <span className={`badge ${stateClass}`}>{stateLabel}</span>
        </p>
      </div>
      <div className="stats-link">
        <div className="row g-2 mt-2 pt-2 border-top">
          <div className="col-6 col-md-3">
            <div className="small text-white-50">PnL YTD</div>
            <div className="fs-6">{formatMoney(data.pnlYtd, data.currency)}</div>
          </div>
          <div className="col-6 col-md-3">
            <div className="small text-white-50">Withdrawals This Month</div>
            <div className="fs-6">{formatMoney(data.withdrawalsThisMonth, data.currency)}</div>
          </div>
          <div className="col-12 col-md-6">
            <div className="small text-white-50">Effective Date</div>
            <div className="fs-6">
              {data.effectiveDate ? formatDateTime(data.effectiveDate) : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
