"use client";

/**
 * P7.2 — Merchant admin dashboard.
 * KPI cards: GET /api/spg/v1/admin/dashboard
 * Time-series chart: GET /api/spg/v1/admin/reports/dashboard-series
 * (recharts dynamic-imported with ssr:false to respect the 200KB budget, P6.3).
 *
 * Edge cases (per spec): empty tenant → zeros, not errors; API error →
 * panel-level error state with retry (hooks use retry:2); tenant-scoped 404 →
 * plain "not found" (AdminNotFound, shared tenant-404 pattern).
 */
import dynamic from "next/dynamic";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";
import { useAdminDashboardSeries } from "@/hooks/useAdminDashboardSeries";
import { buildKpiCards, toSeriesPoints } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";
import {
  DashboardKpiSkeleton,
  DashboardChartSkeleton,
} from "@/components/shared/skeletons";
import AdminNotFound from "@/components/admin/AdminNotFound";

const DashboardChart = dynamic(() => import("@/components/admin/DashboardChart"), {
  ssr: false,
  loading: () => <DashboardChartSkeleton />,
});

function KpiError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between">
      <span>
        <i className="fa fa-triangle-exclamation me-2" />
        Failed to load dashboard metrics.
      </span>
      <button className="btn btn-sm btn-danger" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export default function MerchantDashboardPage() {
  const kpi = useAdminDashboard();
  const series = useAdminDashboardSeries();

  const cards = buildKpiCards(kpi.data);
  const points = toSeriesPoints(series.data);
  const currency = kpi.data?.currency || series.data?.currency || "IDR";

  // Tenant-scoped 404 → plain "not found" (never "other merchant" wording).
  if (isApiError(kpi.error, 404)) {
    return <AdminNotFound what="dashboard" />;
  }

  return (
    <>
      <h1 className="page-header">Merchant Dashboard</h1>

      {/* KPI widgets */}
      {kpi.isLoading && <DashboardKpiSkeleton />}
      {kpi.isError && !isApiError(kpi.error, 404) && (
        <KpiError onRetry={() => kpi.refetch()} />
      )}
      {kpi.isSuccess && (
        <div className="row g-3 mb-3">
          {cards.map((c) => (
            <div className="col-xl-2 col-lg-4 col-md-4 col-sm-6" key={c.key}>
              <div className={`widget widget-stats ${c.color}`}>
                <div className="stats-icon">
                  <i className={`fa ${c.icon}`} />
                </div>
                <div className="stats-info">
                  <h4>{c.title}</h4>
                  <p>{c.value}</p>
                </div>
                <div className="stats-link">
                  <span className="text-white-50 small px-3 py-2 d-block">
                    {c.desc}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Time-series chart */}
      <Panel>
        <PanelHeader>Deposits vs Withdrawals</PanelHeader>
        <PanelBody>
          {series.isLoading && <DashboardChartSkeleton />}
          {series.isError && (
            <div className="text-center py-4">
              <p className="text-muted">Failed to load chart data.</p>
              <button
                className="btn btn-theme btn-sm"
                onClick={() => series.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {series.isSuccess && points.length === 0 && (
            <div className="text-center py-4 text-muted">
              <i className="fa fa-chart-line fa-2x mb-2 d-block" />
              No activity yet — chart appears once the tenant has transactions.
            </div>
          )}
          {series.isSuccess && points.length > 0 && (
            <DashboardChart points={points} currency={currency} />
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
