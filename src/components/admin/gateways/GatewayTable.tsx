"use client";

/**
 * Gateway list table (P7.6) — shows provider configs with actions.
 * Each row has an Edit button (opens form) and status toggle.
 */
import { GatewayRow } from "@/lib/admin-gateways";
import { formatDateTime } from "@/lib/admin-dashboard";
import { AdminTableSkeleton } from "@/components/shared/skeletons";

interface GatewayTableProps {
  rows: GatewayRow[];
  total: number;
  loading: boolean;
  onEdit: (row: GatewayRow) => void;
  busyIds: Set<string>;
}

export default function GatewayTable({
  rows,
  total,
  loading,
  onEdit,
  busyIds,
}: GatewayTableProps) {
  if (loading) {
    return <AdminTableSkeleton rows={6} />;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="fa fa-plug fa-2x mb-2 d-block" />
        No payment gateways configured.
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-hover m-0 align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Adapter</th>
              <th>Merchant</th>
              <th>Client</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id}>
                <td className="font-monospace small">{g.id.slice(0, 8)}…</td>
                <td>
                  <span className="badge bg-info">{g.adapter}</span>
                </td>
                <td className="small">{g.merchantUuid || "—"}</td>
                <td className="small">{g.clientName || "—"}</td>
                <td>
                  <span
                    className={`badge ${
                      g.status === "active" ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {g.status.toUpperCase()}
                  </span>
                </td>
                <td className="small text-muted">
                  {g.updatedAt ? formatDateTime(g.updatedAt) : "—"}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => onEdit(g)}
                    disabled={busyIds.has(g.id)}
                    title="Edit gateway configuration"
                  >
                    {busyIds.has(g.id) ? (
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
        Showing {rows.length} of {total} gateways
      </div>
    </>
  );
}
