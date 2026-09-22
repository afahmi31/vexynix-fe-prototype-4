"use client";

/**
 * P7.3 — player audit trail (read-only table, GET /api/spg/v1/admin/players/:id/audit).
 */
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import { AdminTableSkeleton } from "@/components/shared/skeletons";
import { usePlayerAudit } from "@/hooks/useAdminPlayers";
import { formatDateTime } from "@/lib/admin-dashboard";
import { isApiError } from "@/lib/api/client";

export default function PlayerAudit({ id }: { id: string }) {
  const audit = usePlayerAudit(id);

  if (isApiError(audit.error, 404)) return null; // never shown on tenant-scoped paths

  return (
    <Panel>
      <PanelHeader>Audit trail</PanelHeader>
      <PanelBody>
        {audit.isLoading ? (
          <AdminTableSkeleton rows={6} />
        ) : (
          <>
            {(audit.data?.length ?? 0) === 0 ? (
              <p className="text-muted mb-0">No audit entries.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover m-0">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data?.map((e) => (
                      <tr key={String(e.id)}>
                        <td className="text-muted small">{formatDateTime(e.created_at)}</td>
                        <td>{e.action}</td>
                        <td className="text-muted small">{e.actor ?? "—"}</td>
                        <td className="font-monospace small">{e.detail ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
