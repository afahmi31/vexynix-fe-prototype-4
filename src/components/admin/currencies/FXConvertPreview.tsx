"use client";

/**
 * FX conversion preview calculator (P7.7).
 * Debounced preview: GET /v1/admin/fx/convert?from&to&amount
 * Displays result as integer rupiah (round-half-up).
 */
import { useState, useCallback, useEffect } from "react";
import { useFXConvertPreview } from "@/hooks/useAdminCurrencies";
import { formatMoney } from "@/lib/admin-dashboard";

const DEBOUNCE_MS = 500;

interface FXConvertPreviewProps {
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
}

export default function FXConvertPreview({
  defaultFrom = "USD",
  defaultTo = "IDR",
  defaultAmount = 5,
}: FXConvertPreviewProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertMutation = useFXConvertPreview();

  const debouncedConvert = useCallback(
    async (fromCode: string, toCode: string, amountVal: string) => {
      if (!fromCode || !toCode || !amountVal) return;
      const n = Number(amountVal);
      if (!Number.isFinite(n) || n <= 0) return;

      setLoading(true);
      setError(null);
      try {
        const res = await convertMutation.mutateAsync({
          from: fromCode,
          to: toCode,
          amount: n,
        });
        setResult(res.formattedConverted);
      } catch {
        setError("Failed to convert. Check currencies and rate availability.");
      } finally {
        setLoading(false);
      }
    },
    [convertMutation]
  );

  // Debounce input changes
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedConvert(from, to, amount);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [from, to, amount, debouncedConvert]);

  const amountNum = Number(amount);
  const fromFormatted = formatMoney(amountNum, from);

  return (
    <div className="card bg-light">
      <div className="card-body">
        <h6 className="card-title mb-3">
          <i className="fa fa-exchange me-2" />
          FX Conversion Preview
        </h6>

        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label htmlFor="fx-preview-from" className="form-label small">
              From
            </label>
            <input
              id="fx-preview-from"
              type="text"
              className="form-control form-control-sm text-uppercase"
              placeholder="USD"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              maxLength={3}
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="fx-preview-to" className="form-label small">
              To
            </label>
            <input
              id="fx-preview-to"
              type="text"
              className="form-control form-control-sm text-uppercase"
              placeholder="IDR"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={3}
            />
          </div>

          <div className="col-md-4">
            <label htmlFor="fx-preview-amount" className="form-label small">
              Amount
            </label>
            <input
              id="fx-preview-amount"
              type="number"
              className="form-control form-control-sm"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              step={1}
            />
          </div>
        </div>

        {loading && (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            <span className="text-muted">Converting...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger py-2 small mb-0">{error}</div>
        )}

        {result && !loading && (
          <div className="alert alert-success py-2 mb-0">
            <div className="d-flex justify-content-between align-items-center">
              <span>
                <strong>{fromFormatted}</strong> = <strong>{result}</strong>
              </span>
              <span className="small text-muted">Round-half-up integer display</span>
            </div>
          </div>
        )}

        <div className="form-text text-muted mt-2">
          <i className="fa fa-info-circle me-1" />
          Preview uses current effective-dated rates. Result is integer minor units (round-half-up).
        </div>
      </div>
    </div>
  );
}
