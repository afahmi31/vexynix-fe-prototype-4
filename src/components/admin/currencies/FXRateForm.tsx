"use client";

/**
 * FX rate entry form (P7.7).
 * Rate is effective-dated (NOT retroactive). Effective-from is prominent.
 */
import { useState, useCallback, useMemo } from "react";
import { useSetFXRate } from "@/hooks/useAdminCurrencies";
import { validateFXRateForm, mapCurrencyActionError } from "@/lib/admin-currencies";

interface FXRateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FXRateForm({ onSuccess, onCancel }: FXRateFormProps) {
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("IDR");
  const [rate, setRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setFXRateMutation = useSetFXRate();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const validation = validateFXRateForm({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate,
        effective_from: effectiveFrom,
      });
      if (validation.error) {
        setError(validation.error);
        return;
      }

      setBusy(true);
      try {
        await setFXRateMutation.mutateAsync(validation.req!);
        onSuccess?.();
      } catch (err) {
        const msg = mapCurrencyActionError(err);
        setError(msg || "Failed to save FX rate.");
      } finally {
        setBusy(false);
      }
    },
    [fromCurrency, toCurrency, rate, effectiveFrom, setFXRateMutation, onSuccess]
  );

  const ratePreview = useMemo(() => {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `${fromCurrency} 1 = ${toCurrency} ${n.toLocaleString("id-ID")}`;
  }, [rate, fromCurrency, toCurrency]);

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="alert alert-info mb-3">
        <i className="fa fa-info-circle me-2" />
        <strong>Effective-dated rates only.</strong> The rate applies from the effective
        date forward and is <strong>not retroactive</strong>.
      </div>

      <div className="row g-3">
        <div className="col-md-3">
          <label htmlFor="fx-from" className="form-label">
            From <span className="text-danger">*</span>
          </label>
          <input
            id="fx-from"
            type="text"
            className="form-control font-monospace text-uppercase"
            placeholder="USD"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            disabled={busy}
            maxLength={3}
            required
          />
        </div>

        <div className="col-md-3">
          <label htmlFor="fx-to" className="form-label">
            To <span className="text-danger">*</span>
          </label>
          <input
            id="fx-to"
            type="text"
            className="form-control font-monospace text-uppercase"
            placeholder="IDR"
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            disabled={busy}
            maxLength={3}
            required
          />
        </div>

        <div className="col-md-3">
          <label htmlFor="fx-rate" className="form-label">
            Rate <span className="text-danger">*</span>
          </label>
          <input
            id="fx-rate"
            type="number"
            className="form-control"
            placeholder="0.00"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={busy}
            min={0.000001}
            step="0.000001"
            required
          />
        </div>

        <div className="col-md-3">
          <label htmlFor="fx-effective" className="form-label">
            Effective From <span className="text-danger">*</span>
          </label>
          <input
            id="fx-effective"
            type="date"
            className="form-control"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={busy}
            required
          />
          <div className="form-text text-muted">
            Rate applies from this date (YYYY-MM-DD).
          </div>
        </div>

        {ratePreview && (
          <div className="col-12">
            <div className="alert alert-light">
              <strong>Preview:</strong> {ratePreview}
            </div>
          </div>
        )}

        <div className="col-12">
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Saving...
                </>
              ) : (
                "Set FX Rate"
              )}
            </button>
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
