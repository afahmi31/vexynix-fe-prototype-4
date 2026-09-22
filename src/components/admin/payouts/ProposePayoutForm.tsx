"use client";

/**
 * Propose payout form (P7.5) — maker action.
 * Validates amount (positive integer minor units), method, destination.
 * Uses client_ref for idempotency.
 */
import { useState, useCallback, useMemo } from "react";
import { useProposeOperatorPayout } from "@/hooks/useAdminPayouts";
import { useClientRef } from "@/lib/idempotency";
import { validateProposeForm, mapPayoutActionError } from "@/lib/admin-payouts";
import { formatMoney } from "@/lib/admin-dashboard";
import type { CreateOperatorPayoutRes } from "@/types/api";

interface ProposePayoutFormProps {
  onSuccess?: (res: CreateOperatorPayoutRes) => void;
}

export default function ProposePayoutForm({ onSuccess }: ProposePayoutFormProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { ref: clientRef, reset: resetClientRef } = useClientRef();
  const proposeMutation = useProposeOperatorPayout();

  const formattedAmount = useMemo(() => {
    const n = Number(amount.trim());
    return Number.isInteger(n) && n > 0 ? formatMoney(n, "IDR") : null;
  }, [amount]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);

      const validation = validateProposeForm(
        { amount, method, destination },
        clientRef
      );
      if (validation.error) {
        setError(validation.error);
        return;
      }

      setBusy(true);
      try {
        const result = await proposeMutation.mutateAsync(validation.req!);
        setSuccess(`Payout ${result.id} proposed successfully.`);
        setAmount("");
        setDestination("");
        setMethod("bank_transfer");
        resetClientRef(); // Reset for next proposal
        onSuccess?.(result);
      } catch (err) {
        const msg = mapPayoutActionError(err);
        setError(msg || "Failed to propose payout.");
      } finally {
        setBusy(false);
      }
    },
    [amount, method, destination, clientRef, proposeMutation, resetClientRef, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between py-2 mb-3">
          <span>{error}</span>
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="alert alert-success d-flex align-items-center justify-content-between py-2 mb-3">
          <span>{success}</span>
          <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="payout-amount" className="form-label">
            Amount <span className="text-danger">*</span>
          </label>
          <input
            id="payout-amount"
            type="number"
            className="form-control"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            required
          />
          {formattedAmount && (
            <div className="form-text text-muted">{formattedAmount}</div>
          )}
        </div>

        <div className="col-md-6">
          <label htmlFor="payout-method" className="form-label">
            Method <span className="text-danger">*</span>
          </label>
          <select
            id="payout-method"
            className="form-select"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={busy}
            required
          >
            <option value="bank_transfer">Bank Transfer</option>
            <option value="ewallet">E-Wallet</option>
          </select>
        </div>

        <div className="col-12">
          <label htmlFor="payout-destination" className="form-label">
            Destination <span className="text-danger">*</span>
          </label>
          <input
            id="payout-destination"
            type="text"
            className="form-control"
            placeholder="e.g. BCA-123456 or wallet-ref-abc"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={busy}
            required
          />
          <div className="form-text text-muted">
            Account number, wallet ID, or other destination reference.
          </div>
        </div>

        <div className="col-12">
          <button
            type="submit"
            className="btn btn-theme"
            disabled={busy || !amount.trim() || !method.trim() || !destination.trim()}
          >
            {busy ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Proposing...
              </>
            ) : (
              "Propose Payout"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
