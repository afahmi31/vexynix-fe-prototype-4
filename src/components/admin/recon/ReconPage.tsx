"use client";

import { useState } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { useAdminPayoutMismatches, useTriggerPayoutReconciliation } from "@/hooks/useAdminRecon";
import { useAdminProviderBalance } from "@/hooks/useAdminRecon";
import { mapReconActionError } from "@/lib/admin-recon";

export default function ReconPage() {
  const [showMismatches, setShowMismatches] = useState(false);
  const [recentRun, setRecentRun] = useState<{ id?: string; status?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatchesQuery = useAdminPayoutMismatches();
  const providersQuery = useAdminProviderBalance();
  const reconcileMutation = useTriggerPayoutReconciliation();

  const handleRunReconciliation = async () => {
    if (window.confirm("Run payout reconciliation? This is detect-and-flag only.")) {
      setBusy(true);
      try {
        await reconcileMutation.mutateAsync();
        setRecentRun({ id: "", status: "" });
        setShowMismatches(true);
      } catch {
        alert(mapReconActionError("unknown"));
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <>
      <h1 className="page-header">Reconciliation</h1>

      <div className="row g-4">
        {/* Payout Reconciliation */}
        <div className="col-12">
          <Panel>
            <PanelHeader>Payout Reconciliation</PanelHeader>
            <PanelBody>
              <div className="mb-3">
                <button
                  className="btn btn-theme"
                  onClick={handleRunReconciliation}
                  disabled={busy || reconcileMutation.isPending}
                >
                  {reconcileMutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Running...
                    </>
                  ) : busy ? (
                    "Running..."
                  ) : (
                    "Run Reconciliation"
                  )}
                </button>

                {mismatchesQuery.isError && (
                  <div className="alert alert-danger mt-3">
                    Failed to load mismatches.{" "}
                    <button className="btn btn-sm btn-danger" onClick={() => mismatchesQuery.refetch()}>
                      Retry
                    </button>
                  </div>
                )}

                {!showMismatches && !reconcileMutation.isError && !mismatchesQuery.data?.length ? (
                  <div className="mt-3 text-muted small">
                    <i className="fa fa-info-circle me-1" />
                    Reconciliation detects discrepancies between our records and vendor statements.
                    It does not fix anything automatically.
                  </div>
                ) : (
                  showMismatches && (
                    <div className="mt-3">
                      {recentRun && (
                        <div className="mb-2 text-muted small">
                          Recent run ID: {recentRun.id || "-"} | Status:{" "}
                          <code>{recentRun.status || "-"}</code>
                        </div>
                      )}
                      {mismatchesQuery.isLoading && <div>Loading...</div>}
                      {!mismatchesQuery.isLoading && mismatchesQuery.data?.length === 0 && (
                        <div className="alert alert-success">
                          <i className="fa fa-check-circle me-2" />
                          No discrepancies found in this reconciliation run.
                        </div>
                      )}
                      {mismatchesQuery.data && mismatchesQuery.data.length > 0 && (
                        <>
                          <p className="text-danger">
                            <strong>{mismatchesQuery.data.length} discrepancy(ies) detected.</strong>
                          </p>
                          <p className="text-muted small">
                            ⚠️ Recon is detect-and-flag only — no automatic fixes are performed.
                            Investigate these manually with vendor support.
                          </p>
                          <div className="table-responsive">
                            <table className="table table-hover mb-0">
                              <thead>
                                <tr>
                                  <th style={{ width: "180px" }}>Timestamp</th>
                                  <th>Transaction ID</th>
                                  <th>Player</th>
                                  <th style={{ width: "120px" }}>Amount</th>
                                  <th style={{ width: "250px" }}>Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mismatchesQuery.data.slice(0, 50).map((mismatch) => (
                                  <tr key={mismatch.id}>
                                    <td className="small font-monospace text-muted">
                                      {new Date(mismatch.createdAt).toLocaleString()}
                                    </td>
                                    <td className="font-monospace">{mismatch.transactionId}</td>
                                    <td>{mismatch.playerUsername}</td>
                                    <td>{mismatch.amount.toLocaleString()}</td>
                                    <td>{mismatch.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>

        {/* Provider Float */}
        <div className="col-12">
          <Panel>
            <PanelHeader>Provider Balance Float</PanelHeader>
            <PanelBody>
              {providersQuery.isLoading && <div>Checking balances...</div>}
              {providersQuery.isError && (
                <div className="alert alert-danger">Failed to load provider balances.</div>
              )}
              {!providersQuery.isLoading && !providersQuery.isError && providersQuery.data?.length === 0 && (
                <div className="text-muted small">No providers configured yet.</div>
              )}
              {providersQuery.data?.map((provider) => (
                <div key={provider.providerId} className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                  <div>
                    <strong>{provider.providerId}</strong>
                    <span className="ms-2 text-muted">({provider.currency})</span>
                  </div>
                  <div className="text-end">
                    <div className="font-monospace">{provider.balance.toLocaleString()}</div>
                    <span
                      className={`badge ${
                        provider.status === "healthy"
                          ? "bg-success"
                          : provider.status === "low"
                          ? "bg-warning"
                          : "bg-danger"
                      }`}
                    >
                      {provider.status}
                    </span>
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </>
  );
}
