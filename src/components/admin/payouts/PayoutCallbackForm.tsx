"use client";

/**
 * Payout result callback form (P7.5) — marks a payout with its final result
 * and reference number. Uses POST /:id/payout-callback.
 */
import { useState, useCallback } from "react";
import { useOperatorPayoutCallback } from "@/hooks/useAdminPayouts";
import { validateCallbackForm, mapPayoutActionError } from "@/lib/admin-payouts";

interface PayoutCallbackFormProps {
  payoutId: string;
  currentStatus: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PayoutCallbackForm({
  payoutId,
  currentStatus,
  onSuccess,
  onCancel,
}: PayoutCallbackFormProps) {
  const [result, setResult] = useState("PAID");
  const [referenceNo, setReferenceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const callbackMutation = useOperatorPayoutCallback();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const validation = validateCallbackForm({ result, reference_no: referenceNo });
      if (validation.error) {
        setError(validation.error);
        return;
      }

      setBusy(true);
      try {
        await callbackMutation.mutateAsync({
          id: payoutId,
          req: validation.req!,
        });
        onSuccess?.();
      } catch (err) {
        const msg = mapPayoutActionError(err);
        setError(msg || "Failed to mark payout result.");
      } finally {
        setBusy(false);
      }
    },
    [payoutId, result, referenceNo, callbackMutation, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="mb-3">
        <label htmlFor="callback-result" className="form-label">
          Result <span className="text-danger">*</span>
        </label>
        <select
          id="callback-result"
          className="form-select"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          disabled={busy}
          required
        >
          <option value="PAID">PAID</option>
          <option value="FAILED">FAILED</option>
          <option value="REFUNDED">REFUNDED</option>
        </select>
        <div className="form-text text-muted">
          Final payout status. Current: <span className="badge bg-warning text-dark">{currentStatus}</span>
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="callback-ref" className="form-label">
          Reference No
        </label>
        <input
          id="callback-ref"
          type="text"
          className="form-control"
          placeholder="e.g. BANK-REF-123456"
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
          disabled={busy}
          maxLength={64}
        />
        <div className="form-text text-muted">Optional — bank/provider reference.</div>
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-theme" disabled={busy || !result.trim()}>
          {busy ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" />
              Saving...
            </>
          ) : (
            "Mark Result"
          )}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
