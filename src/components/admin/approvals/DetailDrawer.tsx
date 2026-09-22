"use client";

/**
 * P7.4 — Withdrawal detail drawer (side panel).
 * Shows full player + amount + destination + AML flags. Allows AML resolve actions
 * (release / reject) with step-up and concurrent-safe retry on CAS refusal.
 */
import { useState } from "react";
import { useResolveAml, useWithdrawalQueue } from "@/hooks/useAdminApprovals";
import { mapApprovalActionError, isAlreadyProcessedError } from "@/lib/admin-approvals";
import { formatMoney, formatDateTime } from "@/lib/admin-dashboard";

export default function DetailDrawer({
  open,
  onClose,
  withdrawal,
}: {
  open: boolean;
  onClose: () => void;
  withdrawal: AdminWithdrawalRow | null;
}) {
  const [actionConfirm, setActionConfirm] = useState<"release" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useWithdrawalQueue("AML_HOLD");

  const busy = actionConfirm !== null || q.isLoading;

  const resolveAml = useResolveAml();

  const runResolve = async (decision: "release" | "reject") => {
    if (!withdrawal) return;
    setError(null);
    setActionConfirm(decision);
    try {
      await resolveAml.mutateAsync({
        id: withdrawal.id,
        body: { decision, note: decision === "reject" ? "Declined by admin." : "" },
      });
      onClose(); // success — close drawer
    } catch (err) {
      if (!isAlreadyProcessedError(err)) {
        setError(mapApprovalActionError(err) || "AML resolve failed.");
      }
      // On CAS refusal, don't show blocking error — just let user see the queue refreshed
    } finally {
      setActionConfirm(null);
    }
  };

  if (!open) return null;

  return (
    <div className={`modal ${open ? "show" : ""} d-block`} tabIndex={-1}>
      {/* Overlay click closes */}
      <div className="modal-backdrop show" onClick={() => !busy && onClose()} />
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Withdrawal details <span className="badge bg-primary">{withdrawal?.status}</span>
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
          </div>
          <div className="modal-body">
            {q.isLoading || !withdrawal ? (
              <p className="text-muted">Loading...</p>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small mb-2">Player</div>
                      <div className="d-flex justify-content-between align-items-center">
                        <strong>{withdrawal.username}</strong>
                        <small className="text-muted">#{withdrawal.userId}</small>
                      </div>
                      <div className="mt-2 text-muted small">{withdrawal.destination || "—"}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="border rounded p-3 h-100">
                      <div className="text-muted small mb-2">Amount & currency</div>
                      <div className="fs-5 fw-semibold text-end">
                        {formatMoney(withdrawal.amount, withdrawal.currency)}
                      </div>
                      <div className="mt-2 text-muted small text-end">
                        Requested {formatDateTime(withdrawal.requestedAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status timeline */}
                <div className="mb-4">
                  <h6 className="mb-2">Status</h6>
                  <ul className="list-unstyled m-0">
                    <li
                      className={`badge ${
                        ["PAYING", "PAID"].includes(withdrawal.status)
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}
                    >
                      {withdrawal.status.toUpperCase()}
                    </li>
                  </ul>
                  <p className="text-muted small mt-1 mb-0">
                    ID: <code>{withdrawal.id}</code> • Ref: {withdrawal.clientRef || "—"}
                  </p>
                </div>

                {/* AML flags */}
                {Array.isArray(withdrawal.amlFlags) && withdrawal.amlFlags.length > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-2">AML flags</h6>
                    {withdrawal.amlFlags.map((f: string) => (
                      <span key={f} className="badge bg-danger me-1">{f}</span>
                    ))}
                  </div>
                )}

                {/* AML actions (only show for AML_HOLD status) */}
                {withdrawal.status === "AML_HOLD" ? (
                  <div>
                    <h6 className="mb-2">AML review</h6>
                    <p className="text-muted small mb-3">
                      Decide whether to release this withdrawal or reject it. Both actions
                      are step-up-required and will immediately refresh the queue.
                    </p>
                    <div className="d-grid gap-2">
                      <button
                        className="btn btn-success btn-lg"
                        onClick={() => runResolve("release")}
                        disabled={busy}
                      >
                        {actionConfirm === "release" ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Resolving...
                          </>
                        ) : (
                          "Release (approve)"
                        )}
                      </button>
                      <button
                        className="btn btn-danger btn-lg"
                        onClick={() => runResolve("reject")}
                        disabled={busy}
                      >
                        {actionConfirm === "reject" ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" />
                            Rejecting...
                          </>
                        ) : (
                          "Reject"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info mb-0">
                    This withdrawal is not on an AML hold and has been processed via approve.
                  </div>
                )}
              </>
            )}
            {error && (
              <div className="mt-3 alert alert-danger py-2">
                {error}{" "}
                <button
                  className="btn btn-sm btn-link"
                  onClick={() => setError(null)}
                  disabled={busy}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdminWithdrawalRow {
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
