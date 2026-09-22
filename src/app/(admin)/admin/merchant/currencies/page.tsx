"use client";

/**
 * P7.7 — Currencies & FX page (/admin/merchant/currencies).
 *
 * Features:
 * - Currency list/upsert: GET/POST /v1/admin/currencies
 * - FX rate entry: POST /v1/admin/fx-rates (effective-dated, prominent field)
 * - FX rate history: GET /v1/admin/fx-rates
 * - Convert preview: GET /v1/admin/fx/convert?from&to&amount (debounced)
 */
import { useState, useCallback } from "react";
import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";
import {
  useAdminCurrencies,
  useAdminFXRates,
} from "@/hooks/useAdminCurrencies";
import { isApiError } from "@/lib/api/client";
import CurrencyTable from "@/components/admin/currencies/CurrencyTable";
import CurrencyForm from "@/components/admin/currencies/CurrencyForm";
import FXRateForm from "@/components/admin/currencies/FXRateForm";
import FXRateHistoryTable from "@/components/admin/currencies/FXRateHistoryTable";
import FXConvertPreview from "@/components/admin/currencies/FXConvertPreview";
import AdminNotFound from "@/components/admin/AdminNotFound";
import type { CurrencyView } from "@/lib/admin-currencies";

type PanelView =
  | { kind: "list" }
  | { kind: "currency-form"; mode: "create" | "edit"; initial?: CurrencyView }
  | { kind: "fxrate-form" };

export default function CurrenciesPage() {
  const [view, setView] = useState<PanelView>({ kind: "list" });
  const [busyIds] = useState<Set<string>>(new Set());

  const currencies = useAdminCurrencies();
  const fxRates = useAdminFXRates();

  const handleCreateCurrency = useCallback(() => {
    setView({ kind: "currency-form", mode: "create" });
  }, []);

  const handleEditCurrency = useCallback((row: CurrencyView) => {
    setView({ kind: "currency-form", mode: "edit", initial: row });
  }, []);

  const handleNewFXRate = useCallback(() => {
    setView({ kind: "fxrate-form" });
  }, []);

  const handleBackToList = useCallback(() => {
    setView({ kind: "list" });
  }, []);

  // Tenant-scoped 404 → plain "not found"
  if (isApiError(currencies.error, 404) || isApiError(fxRates.error, 404)) {
    return <AdminNotFound what="currencies & FX" />;
  }

  return (
    <>
      <h1 className="page-header">Currencies & FX</h1>

      {view.kind === "list" ? (
        <>
          {/* Action buttons */}
          <div className="d-flex gap-2 mb-3">
            <button
              className="btn btn-theme btn-sm"
              onClick={handleCreateCurrency}
            >
              <i className="fa fa-plus me-2" />
              New Currency
            </button>
            <button
              className="btn btn-info btn-sm"
              onClick={handleNewFXRate}
            >
              <i className="fa fa-chart-line me-2" />
              New FX Rate
            </button>
          </div>

          {/* Currency list */}
          <Panel>
            <PanelHeader>Currencies</PanelHeader>
            <PanelBody>
              {currencies.isLoading && <CurrencyTable rows={[]} total={0} loading={true} onEdit={() => {}} busyIds={busyIds} />}
              {currencies.isError && (
                <div className="alert alert-danger d-flex align-items-center justify-content-between">
                  <span>Failed to load currencies.</span>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => currencies.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {currencies.isSuccess && (
                <CurrencyTable
                  rows={currencies.data.rows}
                  total={currencies.data.total}
                  loading={false}
                  onEdit={handleEditCurrency}
                  busyIds={busyIds}
                />
              )}
            </PanelBody>
          </Panel>

          {/* FX Rate history */}
          <Panel>
            <PanelHeader>FX Rates</PanelHeader>
            <PanelBody>
              {fxRates.isLoading && <FXRateHistoryTable rows={[]} total={0} loading={true} />}
              {fxRates.isError && (
                <div className="alert alert-danger d-flex align-items-center justify-content-between">
                  <span>Failed to load FX rates.</span>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => fxRates.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {fxRates.isSuccess && (
                <FXRateHistoryTable
                  rows={fxRates.data.rows}
                  total={fxRates.data.total}
                  loading={false}
                />
              )}
            </PanelBody>
          </Panel>

          {/* FX Convert preview */}
          <Panel>
            <PanelHeader>FX Preview Calculator</PanelHeader>
            <PanelBody>
              <FXConvertPreview defaultFrom="USD" defaultTo="IDR" defaultAmount={5} />
            </PanelBody>
          </Panel>
        </>
      ) : view.kind === "currency-form" ? (
        <Panel>
          <PanelHeader>
            {view.mode === "create" ? "New Currency" : "Edit Currency"}
          </PanelHeader>
          <PanelBody>
            <CurrencyForm
              mode={view.mode}
              initial={view.initial}
              onSuccess={handleBackToList}
              onCancel={handleBackToList}
            />
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader>New FX Rate</PanelHeader>
          <PanelBody>
            <FXRateForm onSuccess={handleBackToList} onCancel={handleBackToList} />
          </PanelBody>
        </Panel>
      )}
    </>
  );
}
