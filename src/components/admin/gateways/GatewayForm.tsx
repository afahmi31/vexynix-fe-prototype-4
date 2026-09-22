"use client";

/**
 * Gateway create/edit form (P7.6).
 *
 * Features:
 * - Adapter select (mock/otomatis)
 * - Config JSONB textarea with Zod validation
 * - Credential refs validated client-side: ^(env|file|vault|dev):
 * - dev: refs show a warning badge
 * - Status toggle (active/disabled)
 */
import { useState, useEffect } from "react";
import { useCreateGateway, useUpdateGateway } from "@/hooks/useAdminGateways";
import {
  validateGatewayForm,
  isDevCredentialRef,
  mapGatewayActionError,
} from "@/lib/admin-gateways";
import type { GatewayRow } from "@/lib/admin-gateways";

interface GatewayFormProps {
  mode: "create" | "edit";
  initial?: GatewayRow | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function GatewayForm({
  mode,
  initial,
  onSuccess,
  onCancel,
}: GatewayFormProps) {
  const [adapter, setAdapter] = useState<"mock" | "otomatis">(
    (initial?.adapter as "mock" | "otomatis") || "mock"
  );
  const [configJson, setConfigJson] = useState(
    initial ? JSON.stringify(initial.config, null, 2) : "{}"
  );
  const [status, setStatus] = useState<"active" | "disabled">(
    (initial?.status as "active" | "disabled") || "active"
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [devRefWarning, setDevRefWarning] = useState(false);

  const createMutation = useCreateGateway();
  const updateMutation = useUpdateGateway();

  // Client-side JSON validation (debounced)
  useEffect(() => {
    if (configJson.trim() === "") {
      setJsonError("Config JSON is required.");
      setDevRefWarning(false);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson);
    } catch (err) {
      setJsonError(`Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`);
      setDevRefWarning(false);
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setJsonError("Config must be a JSON object.");
      setDevRefWarning(false);
      return;
    }
    setJsonError(null);
    // Check for dev: refs in the parsed config
    const scan = (obj: unknown): boolean => {
      if (typeof obj === "string") return isDevCredentialRef(obj);
      if (Array.isArray(obj)) return obj.some(scan);
      if (typeof obj === "object" && obj !== null) {
        return Object.values(obj).some(scan);
      }
      return false;
    };
    setDevRefWarning(scan(parsed));
  }, [configJson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateGatewayForm({
      adapter,
      configJson,
      status,
    });
    if (validation.error) {
      setError(validation.error);
      return;
    }

    setBusy(true);
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(validation.createReq!);
      } else {
        if (!initial) {
          setError("No gateway selected for editing.");
          return;
        }
        await updateMutation.mutateAsync({
          id: initial.id,
          req: validation.updateReq!,
        });
      }
      onSuccess?.();
    } catch (err) {
      const msg = mapGatewayActionError(err);
      setError(msg || "Failed to save gateway.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <label htmlFor="gateway-adapter" className="form-label">
            Adapter <span className="text-danger">*</span>
          </label>
          <select
            id="gateway-adapter"
            className="form-select"
            value={adapter}
            onChange={(e) => setAdapter(e.target.value as "mock" | "otomatis")}
            disabled={busy}
            required
          >
            <option value="mock">Mock</option>
            <option value="otomatis">Otomatis</option>
          </select>
        </div>

        <div className="col-md-6">
          <label htmlFor="gateway-status" className="form-label">
            Status <span className="text-danger">*</span>
          </label>
          <select
            id="gateway-status"
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "disabled")}
            disabled={busy}
            required
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="col-12">
          <label htmlFor="gateway-config" className="form-label">
            Configuration (JSONB) <span className="text-danger">*</span>
          </label>
          <textarea
            id="gateway-config"
            className={`form-control font-monospace ${jsonError ? "is-invalid" : ""}`}
            rows={12}
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            disabled={busy}
            required
            placeholder='{"merchant_uuid":"...","client_name":"...","endpoints":{"deposit":"..."},"credentials":{"api_key":"env:..."}}'
          />
          {jsonError && (
            <div className="invalid-feedback d-block">{jsonError}</div>
          )}
          {devRefWarning && (
            <div className="alert alert-warning mt-2 py-2 small">
              <i className="fa fa-exclamation-triangle me-2" />
              <strong>Warning:</strong> This configuration contains <code>dev:</code> credential
              references. These are only suitable for local development and will fail in
              production.
            </div>
          )}
          <div className="form-text text-muted">
            Credentials must be referenced (e.g. <code>env:API_KEY</code>, <code>file:/path</code>{" "}
            or <code>vault:secret/path</code>) — never raw secrets.
          </div>
        </div>

        <div className="col-12">
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-theme"
              disabled={busy || !!jsonError}
            >
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create Gateway"
              ) : (
                "Update Gateway"
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
