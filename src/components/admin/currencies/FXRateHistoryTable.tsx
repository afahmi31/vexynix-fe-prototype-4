"use client";

/**
 * FX rate history table (P7.7) — shows effective-dated rate entries.
 */
import { FXRateView } from "@/lib/admin-currencies";
import { formatDateTime } from "@/lib/admin-dashboard";
import { AdminTableSkeleton } from "@/components/shared/skeletons";

interface FXRateHistoryTableProps {
  rows: FXRateView[];
  total: number;
  loading: boolean;
}

export default function FXRateHistoryTable({
  rows,
  total,
  loading,
}: FXRateHistoryTableProps) {
  if (loading) {
    return <AdminTableSkeleton rows={5} />;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="fa fa-chart-line fa-2x mb-2 d-block" />
        No FX rates configured yet.
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover m-0 align-middle">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th className="text-end">Rate</th>
              <th>Effective From</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.from}-${r.to}-${r.effectiveFrom}-${idx}`}>
                <td className="font-monospace fw-bold">{r.from}</td>
                <td className="font-monospace fw-bold">{r.to}</td>
                <td className="text-end font-monospace">
                  {r.rate.toLocaleString("id-ID", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </td>
                <td>
                  <span className="badge bg-info">
                    {r.effectiveFrom || "—"}
                  </span>
                </td>
                <td className="small text-muted">
                  {r.updatedAt ? formatDateTime(r.updatedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small text-muted mt-2 px-2">
        Showing {rows.length} of {total} rates
      </div>
    </>
  );
}
