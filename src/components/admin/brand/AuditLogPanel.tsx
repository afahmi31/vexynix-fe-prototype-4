"use client";

import { useState } from "react";
import { useAdminMerchantAudit } from "@/hooks/useAdminMerchant";

export default function AuditLogPanel() {
  const audit = useAdminMerchantAudit();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  if (audit.isLoading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading audit log...</span>
        </div>
      </div>
    );
  }

  if (audit.isError || !audit.data) {
    return <div className="alert alert-danger">Failed to load audit log.</div>;
  }

  const entries = audit.data.slice(0, page * pageSize);
  const hasMore = audit.data.length > entries.length;

  return (
    <div>
      <h4 className="mb-3">Your Audit Log</h4>

      {entries.length === 0 ? (
        <div className="text-center py-4 text-muted">
          <i className="fa fa-clock-o fa-2x mb-2 d-block" />
          No actions recorded yet.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{ width: "180px" }}>Timestamp</th>
                <th style={{ width: "150px" }}>Actor</th>
                <th>Action</th>
                <th style={{ width: "200px" }}>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-muted small font-monospace">
                    {new Date(entry.created_at ?? "").toLocaleString()}
                  </td>
                  <td>{entry.actor}</td>
                  <td>
                    <code className="badge bg-secondary">{entry.action}</code>
                  </td>
                  <td>{entry.target}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="text-center mt-3">
          <button
            className="btn btn-outline-theme btn-sm"
            onClick={() => setPage((p) => p + 1)}
          >
            Load More ({audit.data.length - entries.length} remaining)
          </button>
        </div>
      )}

      {!hasMore && entries.length > 0 && (
        <div className="text-muted small mt-2">
          Showing all {audit.data.length} entries
        </div>
      )}
    </div>
  );
}
