"use client";

/**
 * Currency create/edit form (P7.7).
 * Code must be 3 letters; name required; decimals 0-8; status toggle.
 */
import { useState, useCallback } from "react";
import { useUpsertCurrency } from "@/hooks/useAdminCurrencies";
import { validateCurrencyForm, mapCurrencyActionError } from "@/lib/admin-currencies";
import type { CurrencyView } from "@/lib/admin-currencies";

interface CurrencyFormProps {
  mode: "create" | "edit";
  initial?: CurrencyView | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CurrencyForm({
  mode,
  initial,
  onSuccess,
  onCancel,
}: CurrencyFormProps) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [symbol, setSymbol] = useState(initial?.symbol || "");
  const [decimals, setDecimals] = useState(initial?.decimals?.toString() || "2");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upsertMutation = useUpsertCurrency();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const decimalsNum = Number(decimals);
      const validation = validateCurrencyForm({
        code,
        name,
        symbol,
        decimals: decimalsNum,
        is_active: isActive,
      });
      if (validation.error) {
        setError(validation.error);
        return;
      }

      setBusy(true);
      try {
        await upsertMutation.mutateAsync(validation.req!);
        onSuccess?.();
      } catch (err) {
        const msg = mapCurrencyActionError(err);
        setError(msg || "Failed to save currency.");
      } finally {
        setBusy(false);
      }
    },
    [code, name, symbol, decimals, isActive, upsertMutation, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="currency-code" className="form-label">
            Code <span className="text-danger">*</span>
          </label>
          <input
            id="currency-code"
            type="text"
            className="form-control font-monospace text-uppercase"
            placeholder="IDR"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy || mode === "edit"} // Disable code in edit mode (PK)
            maxLength={3}
            required
          />
          <div className="form-text text-muted">ISO 4217 3-letter code (e.g. IDR, USD).</div>
        </div>

        <div className="col-md-6">
          <label htmlFor="currency-name" className="form-label">
            Name <span className="text-danger">*</span>
          </label>
          <input
            id="currency-name"
            type="text"
            className="form-control"
            placeholder="Indonesian Rupiah"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        <div className="col-md-4">
          <label htmlFor="currency-symbol" className="form-label">
            Symbol
          </label>
          <input
            id="currency-symbol"
            type="text"
            className="form-control"
            placeholder="Rp"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={busy}
            maxLength={5}
          />
        </div>

        <div className="col-md-4">
          <label htmlFor="currency-decimals" className="form-label">
            Decimals <span className="text-danger">*</span>
          </label>
          <input
            id="currency-decimals"
            type="number"
            className="form-control"
            placeholder="0"
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            disabled={busy}
            min={0}
            max={8}
            required
          />
          <div className="form-text text-muted">0-8; IDR = 0, USD = 2.</div>
        </div>

        <div className="col-md-4">
          <label htmlFor="currency-status" className="form-label">
            Status <span className="text-danger">*</span>
          </label>
          <select
            id="currency-status"
            className="form-select"
            value={isActive ? "active" : "inactive"}
            onChange={(e) => setIsActive(e.target.value === "active")}
            disabled={busy}
            required
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="col-12">
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-theme" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create Currency"
              ) : (
                "Update Currency"
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
