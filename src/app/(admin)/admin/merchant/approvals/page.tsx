"use client";

/**
 * P7.4 — Withdrawals approvals queue page (/admin/merchant/approvals).
 * GET /api/spg/v1/withdrawals?status=PENDING_APPROVAL or ?status=AML_HOLD.
 * Row actions: Approve, AML resolve — both step-up-fresh and auto-refresh on CAS refusal.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import { useWithdrawalQueue, useApproveWithdrawal, useResolveAml } from "@/hooks/useAdminApprovals";
import { QUEUE_TABS, mapApprovalActionError } from "@/lib/admin-approvals";
import { formatMoney } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";
import AdminNotFound from "@/components/admin/AdminNotFound";

const Drawer = dynamic(() => import("@/components/admin/approvals/DetailDrawer"), { ssr: false });

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<"PENDING_APPROVAL" | "AML_HOLD">("PENDING_APPROVAL");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queue = useWithdrawalQueue(activeTab);
  const approve = useApproveWithdrawal();
  const resolveAml = useResolveAml();

  const busy = approve.isPending || resolveAml.isPending;

  const approveRow = async (id: string) => {
    setError(null);
    try {
      await approve.mutateAsync(id);
    } catch (err) {
      // CAS refusal = already processed by another approver — queue auto-refreshes.
      setError(mapApprovalActionError(err) || "Approve failed.");
    }
  };

  // Tenant-scoped 404 → plain not found (all hooks called before this point).
  if (isApiError(queue.error, 404)) {
    return <AdminNotFound what="approvals" />;
  }

  return (
    <>
      <h1 className="page-header">Withdrawal Approvals</h1>

      <Panel>
        <PanelHeader>Queue</PanelHeader>
        <PanelBody>
          {/* Tabs */}
          <div className="d-flex gap-2 mb-3 border-bottom pb-2">
            {QUEUE_TABS.map((tab) => (
              <button
                key={tab.status}
                className={`btn btn-sm ${activeTab === tab.status ? "btn-theme" : "btn-outline-theme"}`}
                onClick={() => setActiveTab(tab.status)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Skeleton | Error | Empty | Queue */}
          {queue.isLoading && <AdminTableSkeleton rows={6} />}
          {queue.isError && !isApiError(queue.error, 404) && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <span>Failed to load withdrawal queue.</span>
              <button className="btn btn-sm btn-danger" onClick={() => queue.refetch()}>
                Retry
              </button>
            </div>
          )}
          {queue.isSuccess && queue.data.rows.length === 0 && (
            <p className="text-muted text-center py-4">No withdrawals in this queue.</p>
          )}
          {queue.isSuccess && queue.data.rows.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover m-0 align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Player</th>
                    <th className="text-end">Amount</th>
                    <th>Status</th>
                    <th className="text-start">Destination</th>
                    <th>Requested at</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.rows.map((w) => (
                    <tr key={w.id}>
                      <td className="font-monospace small">{w.id.slice(0, 8)}…</td>
                      <td>{w.username}</td>
                      <td className="text-end">{formatMoney(w.amount, w.currency)}</td>
                      <td>
                        <span
                          className={`badge ${
                            w.status === "PAYING" || w.status === "PAID"
                              ? "bg-success"
                              : "bg-warning text-dark"
                          }`}
                        >
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{w.destination || "—"}</td>
                      <td className="small text-muted">{w.requestedAt || "—"}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-success"
                            onClick={() => {
                              if (w.status !== "PAID") approveRow(w.id);
                            }}
                            disabled={busy || approve.isPending || w.status === "PAID"}
                            title={w.status === "PAID" ? "Already paid" : "Approve withdrawal"}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-info"
                            onClick={() => setSelected(w.id)}
                            disabled={busy || w.status !== "AML_HOLD"}
                            title="Review details"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Detail drawer (right panel, collapsible) */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        withdrawal={selected ? (queue.data?.rows.find((w) => w.id === selected) ?? null) : null}
      />

      {/* Global error banner near tabs */}
      {error && (
        <div className="mt-2 alert alert-danger d-flex align-items-center justify-content-between">
          <span>
            <i className="fa fa-triangle-exclamation me-2" />
            {error}
          </span>
          <button
            className="btn btn-sm btn-default ms-2"
            onClick={() => setError(null)}
            disabled={busy}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
