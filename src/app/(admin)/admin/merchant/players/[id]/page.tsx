"use client";

/**
 * P7.3 — Player 360° profile page (/admin/merchant/players/[id]).
 * GET /api/spg/v1/admin/players/:id — registry + read-only balance (I1) +
 * play stats + compliance + pending withdrawals, plus action dialogs.
 */
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import AdminNotFound from "@/components/admin/AdminNotFound";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PlayerActionDialogs from "@/components/admin/players/PlayerActionDialogs";
import PlayerNotes from "@/components/admin/players/PlayerNotes";
import PlayerAudit from "@/components/admin/players/PlayerAudit";
import {
  useAdminPlayerProfile,
  useFreezePlayer,
  useUnfreezePlayer,
  useSetPlayerStatus,
} from "@/hooks/useAdminPlayers";
import {
  statusBadgeClass,
  mapPlayerActionError,
  type PlayerProfileView,
} from "@/lib/admin-players";
import { formatMoney, formatDateTime } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const profile = useAdminPlayerProfile(id);

  // Tenant-scoped 404 → plain "not found" (cross-tenant ids leak nothing).
  if (isApiError(profile.error, 404)) {
    return <AdminNotFound what="player" />;
  }

  const p = profile.data;

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="page-header mb-0">
          Player 360° {p ? `— ${p.username}` : ""}
        </h1>
        <Link href="/admin/merchant/players" className="btn btn-sm btn-default ms-auto">
          <i className="fa fa-arrow-left me-1" />
          Back to directory
        </Link>
      </div>

      {profile.isLoading && <AdminTableSkeleton rows={6} />}
      {profile.isError && !isApiError(profile.error, 404) && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between">
          <span>
            <i className="fa fa-triangle-exclamation me-2" />
            Failed to load the player profile.
          </span>
          <button className="btn btn-sm btn-danger" onClick={() => profile.refetch()}>
            Retry
          </button>
        </div>
      )}
      {profile.isSuccess && p && <ProfileBody id={id} profile={p} />}
    </>
  );
}

function ProfileBody({ id, profile: p }: { id: string; profile: PlayerProfileView }) {
  const [dialog, setDialog] = useState<
    null | "limits" | "self-exclude" | "freeze" | "unfreeze" | "status"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const freeze = useFreezePlayer(id);
  const unfreeze = useUnfreezePlayer(id);
  const setStatus = useSetPlayerStatus(id);

  const busy = freeze.isPending || unfreeze.isPending || setStatus.isPending;

  const runAction = (
    mutation: { mutateAsync: () => Promise<unknown> },
    onDone: () => void
  ) => {
    setActionError(null);
    mutation
      .mutateAsync()
      .then(onDone)
      .catch((err) => setActionError(mapPlayerActionError(err) || null));
  };

  return (
    <div className="row">
      {/* Registry + read-only balance + play stats */}
      <div className="col-lg-8">
        <Panel>
          <PanelHeader>Registry</PanelHeader>
          <PanelBody>
            <div className="row g-3">
              <div className="col-md-6">
                <dl className="row mb-0">
                  <dt className="col-sm-5">User ID</dt>
                  <dd className="col-sm-7">{p.userId}</dd>
                  <dt className="col-sm-5">Username</dt>
                  <dd className="col-sm-7">{p.username}</dd>
                  <dt className="col-sm-5">Phone</dt>
                  <dd className="col-sm-7">{p.phone || "—"}</dd>
                  <dt className="col-sm-5">Currency</dt>
                  <dd className="col-sm-7">{p.currency}</dd>
                </dl>
              </div>
              <div className="col-md-6">
                <dl className="row mb-0">
                  <dt className="col-sm-5">Status</dt>
                  <dd className="col-sm-7">
                    <span className={`badge ${statusBadgeClass(p.status)}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </dd>
                  <dt className="col-sm-5">Registered</dt>
                  <dd className="col-sm-7">{formatDateTime(p.createdAt)}</dd>
                  <dt className="col-sm-5">Last login</dt>
                  <dd className="col-sm-7">{formatDateTime(p.lastLoginAt)}</dd>
                </dl>
              </div>
            </div>
          </PanelBody>
        </Panel>

        {/* Balance — READ-ONLY (I1: never editable from any admin surface) */}
        <Panel>
          <PanelHeader>Balance (read-only)</PanelHeader>
          <PanelBody>
            {p.balance ? (
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded p-3">
                    <div className="text-muted small">Available</div>
                    <div className="fs-5 fw-semibold">
                      {formatMoney(p.balance.available, p.currency)}
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3">
                    <div className="text-muted small">Held</div>
                    <div className="fs-5 fw-semibold">
                      {formatMoney(p.balance.held, p.currency)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted mb-0">Balance not available.</p>
            )}
            <p className="text-muted small mt-2 mb-0">
              Balances are never editable from the admin console.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>Play statistics</PanelHeader>
          <PanelBody>
            <div className="row g-3">
              <StatCell label="Lifetime deposits" value={formatMoney(p.stats.totalDeposits, p.currency)} />
              <StatCell label="Lifetime withdrawals" value={formatMoney(p.stats.totalWithdrawals, p.currency)} />
              <StatCell label="Total bets" value={formatMoney(p.stats.totalBets, p.currency)} />
              <StatCell label="Total wins" value={formatMoney(p.stats.totalWins, p.currency)} />
              <StatCell label="Bet count" value={String(p.stats.betCount)} />
              <StatCell label="Last active" value={formatDateTime(p.stats.lastActiveAt)} />
            </div>
          </PanelBody>
        </Panel>

        {/* Pending withdrawals */}
        <Panel>
          <PanelHeader>Pending withdrawals</PanelHeader>
          <PanelBody>
            {p.pendingWithdrawals.length === 0 ? (
              <p className="text-muted mb-0">No pending withdrawals.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th className="text-end">Amount</th>
                      <th>Status</th>
                      <th>Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.pendingWithdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="font-monospace small">{w.id.slice(0, 8)}…</td>
                        <td className="text-end">{formatMoney(w.amount, w.currency)}</td>
                        <td>
                          <span className="badge bg-warning text-dark">{w.status}</span>
                        </td>
                        <td className="text-muted small">{formatDateTime(w.requestedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>

        <PlayerNotes id={id} />
        <PlayerAudit id={id} />
      </div>

      {/* Compliance + actions sidebar */}
      <div className="col-lg-4">
        <Panel>
          <PanelHeader>Compliance</PanelHeader>
          <PanelBody>
            <dl className="row mb-0">
              <dt className="col-sm-6">Frozen</dt>
              <dd className="col-sm-6">
                {p.compliance.frozen ? (
                  <span className="badge bg-danger">FROZEN</span>
                ) : (
                  <span className="badge bg-success">No</span>
                )}
              </dd>
              <dt className="col-sm-6">Self-excluded</dt>
              <dd className="col-sm-6">
                {p.compliance.selfExcludedUntil
                  ? `until ${formatDateTime(p.compliance.selfExcludedUntil)}`
                  : "No"}
              </dd>
              <dt className="col-sm-6">Daily limit</dt>
              <dd className="col-sm-6">
                {p.compliance.limits.daily != null
                  ? formatMoney(p.compliance.limits.daily, p.currency)
                  : "—"}
              </dd>
              <dt className="col-sm-6">Weekly limit</dt>
              <dd className="col-sm-6">
                {p.compliance.limits.weekly != null
                  ? formatMoney(p.compliance.limits.weekly, p.currency)
                  : "—"}
              </dd>
              <dt className="col-sm-6">Monthly limit</dt>
              <dd className="col-sm-6">
                {p.compliance.limits.monthly != null
                  ? formatMoney(p.compliance.limits.monthly, p.currency)
                  : "—"}
              </dd>
            </dl>
            {p.compliance.amlFlags.length > 0 && (
              <div className="mt-3">
                <div className="text-muted small mb-1">AML flags</div>
                {p.compliance.amlFlags.map((f) => (
                  <span key={f} className="badge bg-danger me-1">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>Actions</PanelHeader>
          <PanelBody>
            {actionError && (
              <div className="alert alert-danger py-2 small">{actionError}</div>
            )}
            <div className="d-grid gap-2">
              <button
                className="btn btn-outline-theme btn-sm"
                onClick={() => setDialog("limits")}
                disabled={busy}
              >
                <i className="fa fa-gauge me-1" />
                Set RG limits
              </button>
              <button
                className="btn btn-outline-warning btn-sm"
                onClick={() => setDialog("self-exclude")}
                disabled={busy}
              >
                <i className="fa fa-ban me-1" />
                Self-exclude
              </button>
              {!p.compliance.frozen ? (
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setDialog("freeze")}
                  disabled={busy}
                >
                  <i className="fa fa-snowflake me-1" />
                  Freeze player
                </button>
              ) : (
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setDialog("unfreeze")}
                  disabled={busy}
                >
                  <i className="fa fa-fire me-1" />
                  Unfreeze player
                </button>
              )}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setDialog("status")}
                disabled={busy}
              >
                <i className="fa fa-arrows-rotate me-1" />
                Change status
              </button>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Action dialogs */}
      <PlayerActionDialogs id={id} dialog={dialog} onClose={() => setDialog(null)} profile={p} />

      {/* Freeze — strong warning (fraud-kill path) */}
      <ConfirmDialog
        open={dialog === "freeze"}
        title={`Freeze ${p.username}?`}
        variant="danger"
        confirmLabel="Freeze player"
        submitting={freeze.isPending}
        error={actionError}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          runAction({ mutateAsync: () => freeze.mutateAsync() }, () => setDialog(null))
        }
      >
        <div className="alert alert-danger">
          <strong>Warning — fraud-kill path.</strong> Freezing this player{" "}
          <strong>kills all of their sessions immediately</strong> and{" "}
          <strong>freezes their wallet</strong>. Use only for suspected fraud or
          account takeover.
        </div>
      </ConfirmDialog>

      {/* Unfreeze — four-eyes note */}
      <ConfirmDialog
        open={dialog === "unfreeze"}
        title={`Unfreeze ${p.username}?`}
        confirmLabel="Unfreeze player"
        submitting={unfreeze.isPending}
        error={actionError}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          runAction({ mutateAsync: () => unfreeze.mutateAsync() }, () => setDialog(null))
        }
      >
        <div className="alert alert-info mb-0">
          <i className="fa fa-circle-info me-1" />
          Four-eyes rule: the freeze must have been placed by a{" "}
          <strong>different operator</strong> — the backend enforces this and
          will refuse a self-unfreeze.
        </div>
      </ConfirmDialog>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-md-4 col-sm-6">
      <div className="border rounded p-2 h-100">
        <div className="text-muted small">{label}</div>
        <div className="fw-semibold">{value}</div>
      </div>
    </div>
  );
}
