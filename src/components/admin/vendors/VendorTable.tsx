"use client";

import type { VendorView } from "@/lib/admin-vendors";

interface VendorTableProps {
  rows: VendorView[];
  total: number;
  loading: boolean;
  onToggle: (vendorId: string, enabled: boolean) => Promise<void>;
  busyIds: Set<string>;
}

export default function VendorTable({
  rows,
  total,
  loading,
  onToggle,
  busyIds,
}: VendorTableProps) {
  const handleToggle = async (v: VendorView) => {
    await onToggle(v.id, !v.enabled);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading vendors...</span>
        </div>
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fa fa-puzzle-piece fa-3x mb-3 d-block text-muted" />
        <h5 className="mb-2">No vendors found</h5>
        <p className="text-muted">There are no game providers configured yet.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Vendor Name</th>
            <th>ID</th>
            <th>Status</th>
            <th style={{ width: "120px" }}>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td>
                <strong>{v.name}</strong>
                <div className="text-muted small">{v.status}</div>
              </td>
              <td className="font-monospace small text-muted">{v.id}</td>
              <td>
                <span className={`badge ${v.enabled ? "bg-success" : "bg-secondary"}`}>
                  {v.enabled ? "Active" : "Disabled"}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className={`btn btn-sm ${v.enabled ? "btn-outline-warning" : "btn-outline-success"}`}
                  onClick={() => handleToggle(v)}
                  disabled={busyIds.has(v.id)}
                >
                  {busyIds.has(v.id) ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                      {v.enabled ? "Disabling..." : "Enabling..."}
                    </>
                  ) : (
                    v.enabled ? "Disable" : "Enable"
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && total > rows.length && (
        <div className="mt-2 text-muted small">
          Showing {rows.length} of {total} vendors
        </div>
      )}
    </div>
  );
}
