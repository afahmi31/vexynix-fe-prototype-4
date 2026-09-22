"use client";

/**
 * Payout history table (P7.5) — shows operator payout requests with status.
 * Action buttons: Approve (four-eyes guarded), Result (callback form trigger).
 */
import { PayoutRow, payoutStatusBadgeClass, isProposer } from "@/lib/admin-payouts";
import { formatMoney, formatDateTime } from "@/lib/admin-dashboard";
import { AdminTableSkeleton } from "@/components/shared/skeletons";

interface PayoutHistoryTableProps {
  rows: PayoutRow[];
  total: number;
  loading: boolean;
  sessionUsername: string;
  busyIds: Set<string>;
  onApprove: (id: string) => void;
  onResultClick: (id: string) => void;
}

export default function PayoutHistoryTable({
  rows,
  total,
  loading,
  sessionUsername,
  busyIds,
  onApprove,
  onResultClick,
}: PayoutHistoryTableProps) {
  if (loading) {
    return <AdminTableSkeleton rows={8} />;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="fa fa-money-bill-transfer fa-2x mb-2 d-block" />
        No payout history yet.
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
              <th>Player</th>
              <th className="text-end">Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Proposed by</th>
              <th>Proposed at</th>
              <th>Result</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const isCurrentUser = isProposer(p, sessionUsername);
              const isPending = p.status.toUpperCase() === "PENDING";
              const isProcessing = busyIds.has(p.id);
              const canApprove = isPending && !isCurrentUser;
              const canResult = !isPending; // After approve, can enter result

              return (
                <tr key={p.id}>
                  <td className="font-monospace small">{p.id.slice(0, 8)}…</td>
                  <td>{p.username}</td>
                  <td className="text-end">{formatMoney(p.amount, p.currency)}</td>
                  <td className="small">{p.method}</td>
                  <td>
                    <span className={`badge ${payoutStatusBadgeClass(p.status)}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="small">{p.proposedBy || "—"}</td>
                  <td className="small text-muted">
                    {p.proposedAt ? formatDateTime(p.proposedAt) : "—"}
                  </td>
                  <td className="small">
                    {p.result ? (
                      <span className={`badge ${p.result.toUpperCase() === "PAID" ? "bg-success" : "bg-danger"}`}>
                        {p.result.toUpperCase()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      {isPending && (
                        <button
                          className="btn btn-success"
                          onClick={() => onApprove(p.id)}
                          disabled={!canApprove || isProcessing}
                          title={
                            !canApprove
                              ? "You proposed this payout — four-eyes rule (another operator must approve)"
                              : "Approve payout"
                          }
                        >
                          {isProcessing ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            "Approve"
                          )}
                        </button>
                      )}
                      {canResult && (
                        <button
                          className="btn btn-info"
                          onClick={() => onResultClick(p.id)}
                          disabled={isProcessing}
                          title="Mark payout result (PAID/FAILED/REFUNDED)"
                        >
                          {isProcessing ? (
                            <span className="spinner-border spinner-border-sm" role="status" />
                          ) : (
                            "Result"
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="small text-muted mt-2 px-2">
        Showing {rows.length} of {total} payouts
      </div>
    </>
  );
}
