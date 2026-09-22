"use client";

/**
 * P7.5 — Operator payouts page (/admin/merchant/payouts).
 *
 * Features:
 * - Earnings card: GET /v1/operator-payouts/earnings
 * - History table: GET /v1/operator-payouts (client-paginated)
 * - Propose form: POST /v1/operator-payouts (maker, step-up-fresh)
 * - Approve action: POST /:id/approve (checker ≠ maker, four-eyes enforced in UI)
 * - Result entry: POST /:id/payout-callback (mark PAID/FAILED/REFUNDED)
 *
 * Four-eyes UI enforcement: hide Approve button on payouts proposed by the
 * current session user. Server still 403s — UI is defense in depth.
 */
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import {
  useOperatorEarnings,
  usePayoutHistory,
  useApproveOperatorPayout,
} from "@/hooks/useAdminPayouts";
import { isApiError } from "@/lib/api/client";
import { mapPayoutActionError } from "@/lib/admin-payouts";
import { useSessionStore } from "@/stores/session";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import EarningsCard from "@/components/admin/payouts/EarningsCard";
import ProposePayoutForm from "@/components/admin/payouts/ProposePayoutForm";
import AdminNotFound from "@/components/admin/AdminNotFound";

const PayoutHistoryTable = dynamic(
  () => import("@/components/admin/payouts/PayoutHistoryTable"),
  { ssr: false, loading: () => <AdminTableSkeleton rows={8} /> }
);

const PayoutCallbackForm = dynamic(
  () => import("@/components/admin/payouts/PayoutCallbackForm"),
  { ssr: false }
);

export default function OperatorPayoutsPage() {
  const [error, setError] = useState<string | null>(null);
  const [callbackId, setCallbackId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const session = useSessionStore();

  const earnings = useOperatorEarnings();
  const history = usePayoutHistory();
  const approveMutation = useApproveOperatorPayout();

  const busy = approveMutation.isPending;

  // Four-eyes check: current session username vs proposed_by
  const currentUsername = session.username || "";

  const handleApprove = useCallback(
    async (id: string) => {
      setError(null);
      setBusyIds((prev) => new Set(prev).add(id));
      try {
        await approveMutation.mutateAsync(id);
      } catch (err) {
        const msg = mapPayoutActionError(err);
        if (msg) setError(msg);
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [approveMutation]
  );

  const handleResultClick = useCallback((id: string) => {
    setCallbackId(id);
    setError(null);
  }, []);

  const handleCallbackSuccess = useCallback(() => {
    setCallbackId(null);
    // History will auto-refresh via hook invalidation
  }, []);

  // Tenant-scoped 404 → plain "not found" (never leak cross-tenant info)
  if (isApiError(history.error, 404) || isApiError(earnings.error, 404)) {
    return <AdminNotFound what="operator payouts" />;
  }

  return (
    <>
      <h1 className="page-header">Operator Payouts</h1>

      {/* Global error banner */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between mb-3">
          <span>
            <i className="fa fa-triangle-exclamation me-2" />
            {error}
          </span>
          <button
            className="btn btn-sm btn-default"
            onClick={() => setError(null)}
            disabled={busy}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Earnings Card */}
      <Panel>
        <PanelHeader>House Earnings</PanelHeader>
        <PanelBody>
          {earnings.isLoading && <EarningsCard data={earnings.data!} loading={true} />}
          {earnings.isError && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <span>Failed to load earnings.</span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => earnings.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {earnings.isSuccess && <EarningsCard data={earnings.data} />}
        </PanelBody>
      </Panel>

      {/* Propose Form */}
      <Panel>
        <PanelHeader>Propose Payout</PanelHeader>
        <PanelBody>
          <p className="text-muted small mb-3">
            Maker action — another operator must approve (four-eyes). Amount in minor units (IDR).
          </p>
          <ProposePayoutForm />
        </PanelBody>
      </Panel>

      {/* History Table */}
      <Panel>
        <PanelHeader>Payout History</PanelHeader>
        <PanelBody>
          {history.isLoading && <AdminTableSkeleton rows={8} />}
          {history.isError && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <span>Failed to load payout history.</span>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => history.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {history.isSuccess && (
            <PayoutHistoryTable
              rows={history.data.rows}
              total={history.data.total}
              loading={false}
              sessionUsername={currentUsername}
              busyIds={busyIds}
              onApprove={handleApprove}
              onResultClick={handleResultClick}
            />
          )}
        </PanelBody>
      </Panel>

      {/* Result entry modal (lazy) */}
      {callbackId && history.data && (
        <PayoutCallbackForm
          payoutId={callbackId}
          currentStatus={
            history.data.rows.find((r) => r.id === callbackId)?.status || "PENDING"
          }
          onSuccess={handleCallbackSuccess}
          onCancel={() => setCallbackId(null)}
        />
      )}
    </>
  );
}
