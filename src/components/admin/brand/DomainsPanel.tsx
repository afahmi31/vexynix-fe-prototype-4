"use client";

import { useState } from "react";
import {
  useAdminMerchantDomains,
  useAddMerchantDomain,
  useVerifyMerchantDomain,
} from "@/hooks/useAdminMerchant";
import type { MerchantDomainView } from "@/lib/admin-merchant";

export default function DomainsPanel() {
  const domains = useAdminMerchantDomains();
  const addDomain = useAddMerchantDomain();
  const verifyDomain = useVerifyMerchantDomain();

  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newDomain.trim() === "") {
      setError("Domain is required.");
      return;
    }

    try {
      await addDomain.mutateAsync({ domain: newDomain.trim() });
      setSuccess(`Domain "${newDomain.trim()}" added. Check DNS TXT record below.`);
      setNewDomain("");
    } catch {
      setError("Failed to add domain. Check the domain format.");
    }
  };

  const handleVerifyDomain = async (domain: MerchantDomainView) => {
    setBusyIds((prev) => new Set(prev).add(domain.id));
    setError(null);
    setSuccess(null);

    try {
      await verifyDomain.mutateAsync({ id: domain.id });
      setSuccess(`Domain "${domain.domain}" verification triggered.`);
    } catch {
      setError("Failed to trigger domain verification.");
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(domain.id);
        return next;
      });
    }
  };

  if (domains.isLoading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading domains...</span>
        </div>
      </div>
    );
  }

  if (domains.isError || !domains.data) {
    return <div className="alert alert-danger">Failed to load domains.</div>;
  }

  return (
    <div>
      <h4 className="mb-3">Domains</h4>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="mb-4">
        <form onSubmit={handleAddDomain}>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <button type="submit" className="btn btn-theme" disabled={addDomain.isPending}>
              {addDomain.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Adding...
                </>
              ) : (
                "Add Domain"
              )}
            </button>
          </div>
          <small className="text-muted">
            Enter a domain (e.g., example.com) to add it to your merchant account.
          </small>
        </form>
      </div>

      {domains.data.length === 0 ? (
        <div className="text-center py-4 text-muted">
          <i className="fa fa-globe fa-2x mb-2 d-block" />
          No domains added yet.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Status</th>
                <th>DNS TXT Record</th>
                <th style={{ width: "120px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.data.map((domain) => (
                <tr key={domain.id}>
                  <td className="font-monospace">{domain.domain}</td>
                  <td>
                    <span
                      className={`badge ${
                        domain.status === "verified"
                          ? "bg-success"
                          : domain.status === "pending"
                          ? "bg-warning"
                          : "bg-danger"
                      }`}
                    >
                      {domain.status}
                    </span>
                  </td>
                  <td>
                    {domain.dnsTxtRecord ? (
                      <div className="font-monospace small text-muted">
                        {domain.dnsTxtRecord}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {domain.status === "pending" && (
                      <button
                        className="btn btn-sm btn-outline-theme"
                        onClick={() => handleVerifyDomain(domain)}
                        disabled={busyIds.has(domain.id)}
                      >
                        {busyIds.has(domain.id) ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" role="status" />
                            Verifying...
                          </>
                        ) : (
                          "Verify"
                        )}
                      </button>
                    )}
                    {domain.status === "verified" && (
                      <span className="text-success">Verified</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="alert alert-info mt-3">
        <i className="fa fa-info-circle me-2" />
        <strong>Note:</strong> Unverified domains block activation. Create the DNS TXT record shown above for each pending domain, then click Verify.
      </div>
    </div>
  );
}
