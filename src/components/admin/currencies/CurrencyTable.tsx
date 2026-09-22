"use client";

/**
 * Currency list table (P7.7) — shows active/inactive currencies with actions.
 */
import { CurrencyView } from "@/lib/admin-currencies";
import { formatDateTime } from "@/lib/admin-dashboard";
import { AdminTableSkeleton } from "@/components/shared/skeletons";

interface CurrencyTableProps {
  rows: CurrencyView[];
  total: number;
  loading: boolean;
  onEdit: (row: CurrencyView) => void;
  busyIds: Set<string>;
}

export default function CurrencyTable({
  rows,
  total,
  loading,
  onEdit,
  busyIds,
}: CurrencyTableProps) {
  if (loading) {
    return <AdminTableSkeleton rows={5} />;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="fa fa-coins fa-2x mb-2 d-block" />
        No currencies configured.
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover m-0 align-middle">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Decimals</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.code}>
                <td className="font-monospace fw-bold">{c.code}</td>
                <td>{c.name}</td>
                <td className="small">{c.symbol}</td>
                <td>{c.decimals}</td>
                <td>
                  <span
                    className={`badge ${
                      c.isActive ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {c.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td className="small text-muted">
                  {c.updatedAt ? formatDateTime(c.updatedAt) : "—"}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => onEdit(c)}
                    disabled={busyIds.has(c.code)}
                    title="Edit currency"
                  >
                    {busyIds.has(c.code) ? (
                      <span className="spinner-border spinner-border-sm" role="status" />
                    ) : (
                      "Edit"
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small text-muted mt-2 px-2">
        Showing {rows.length} of {total} currencies
      </div>
    </>
  );
}
