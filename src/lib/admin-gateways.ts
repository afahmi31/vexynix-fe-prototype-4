/**
 * Payment gateways (P7.6) — pure mapping/validation between the wire types
 * (src/types/api.ts) and the gateways UI.
 *
 * Wire shapes are not live-verified (see types/api.ts) — every accessor
 * coerces defensively so shape drift degrades to zeros/empty, never a crash.
 *
 * Zod is used for config JSON validation client-side before submit.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import { z } from "zod";
import type {
  CreateProviderReq,
  PaymentAdapter,
  ProviderRow,
  ProvidersListRes,
  UpdateProviderReq,
} from "@/types/api";

/** Known adapters (from spec; list is extensible). */
export const PAYMENT_ADAPTERS = [
  { value: "mock", label: "Mock" },
  { value: "otomatis", label: "Otomatis" },
] as const;

/** Credential reference scheme regex: ^(env|file|vault|dev):NAME */
export const CREDENTIAL_REF_RE = /^(env|file|vault|dev):[a-zA-Z0-9_\-\/\.]+$/;

/** Check if a string is a valid credential reference. */
export function isCredentialRef(value: unknown): value is string {
  return typeof value === "string" && CREDENTIAL_REF_RE.test(value);
}

/** Check if a credential ref is a dev: reference (allowed locally, warned in prod). */
export function isDevCredentialRef(ref: string): boolean {
  return ref.startsWith("dev:");
}

/** Known status values for UI filtering. */
export const PROVIDER_STATUSES = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
] as const;

// ---------------------------------------------------------------------------
// List normalization
// ---------------------------------------------------------------------------

export interface GatewayRow {
  id: string;
  adapter: PaymentAdapter;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  /** Pre-formatted config display (truncated JSON). */
  configPreview: string;
  /** Extracted common config fields for quick display. */
  merchantUuid: string | null;
  clientName: string | null;
  /** Whether config contains any dev: credential refs. */
  hasDevRef: boolean;
  /** Full config object for editing. */
  config: Record<string, unknown>;
}

export interface GatewayListView {
  rows: GatewayRow[];
  total: number;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIsoOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Extract a display preview of config (truncated).
 */
function toConfigPreview(config: unknown): string {
  if (typeof config !== "object" || config === null) return "{}";
  try {
    const str = JSON.stringify(config);
    return str.length > 80 ? `${str.slice(0, 80)}…` : str;
  } catch {
    return "{}";
  }
}

/** Check whether a config object contains any dev: credential refs. */
function hasDevCredentialRef(config: unknown): boolean {
  if (typeof config !== "object" || config === null) return false;
  const scan = (obj: unknown): boolean => {
    if (typeof obj === "string") return isDevCredentialRef(obj);
    if (Array.isArray(obj)) return obj.some(scan);
    if (typeof obj === "object" && obj !== null) {
      return Object.values(obj).some(scan);
    }
    return false;
  };
  return scan(config);
}

/** Normalize one provider row; null input → undefined. */
export function toGatewayRow(p: ProviderRow | undefined): GatewayRow | undefined {
  if (p == null || typeof p !== "object") return undefined;
  const config = typeof p.config === "object" && p.config !== null ? p.config : {};
  return {
    id: toText(p.id),
    adapter: toText(p.adapter) || "mock",
    status: toText(p.status) || "disabled",
    createdAt: toIsoOrNull(p.created_at),
    updatedAt: toIsoOrNull(p.updated_at),
    configPreview: toConfigPreview(config),
    merchantUuid: toText(config.merchant_uuid) || null,
    clientName: toText(config.client_name) || null,
    hasDevRef: hasDevCredentialRef(config),
    config,
  };
}

/** Normalize the providers list; missing/garbage → empty list. */
export function toGatewayList(res: ProvidersListRes | undefined): GatewayListView {
  const list = res?.providers;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list
    .map(toGatewayRow)
    .filter((r): r is GatewayRow => r !== undefined);
  const total = toAmount(res?.total) || rows.length;
  return { rows, total };
}

// ---------------------------------------------------------------------------
// Form validation (Zod for config JSONB)
// ---------------------------------------------------------------------------

/** Config schema — loose (additionalProperties) because backend shape is TBD. */
const gatewayConfigSchema = z.record(z.string(), z.unknown());

/** Adapter schema — must be one of the known values. */
const adapterSchema = z.enum(["mock", "otomatis"]);

/** Status schema. */
const statusSchema = z.enum(["active", "disabled"]);

/**
 * Validate a config JSON string (from the form textarea). Returns the parsed
 * object or an error message.
 */
export function validateConfigJson(
  jsonStr: string
): { config: Record<string, unknown>; error: null } | { config: null; error: string } {
  const trimmed = jsonStr.trim();
  if (trimmed === "") {
    return { config: null, error: "Config JSON is required." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      config: null,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }
  const result = gatewayConfigSchema.safeParse(parsed);
  if (!result.success) {
    return {
      config: null,
      error: `Config must be a valid JSON object: ${result.error.issues[0]?.message ?? "invalid"}`,
    };
  }
  return { config: result.data, error: null };
}

/**
 * Validate the full gateway form (adapter + config JSON + status).
 * Returns validated request objects or an error.
 */
export function validateGatewayForm(input: {
  adapter: string;
  configJson: string;
  status: string;
  isEdit?: boolean;
}): {
  createReq: CreateProviderReq;
  updateReq: UpdateProviderReq;
  error: null;
} | {
  createReq: null;
  updateReq: null;
  error: string;
} {
  const adapterResult = adapterSchema.safeParse(input.adapter);
  if (!adapterResult.success) {
    return {
      createReq: null,
      updateReq: null,
      error: `Adapter must be one of: ${PAYMENT_ADAPTERS.map((a) => a.value).join(", ")}`,
    };
  }

  const configResult = validateConfigJson(input.configJson);
  if (configResult.error !== null) {
    return { createReq: null, updateReq: null, error: configResult.error };
  }

  const statusResult = statusSchema.safeParse(input.status);
  if (!statusResult.success) {
    return {
      createReq: null,
      updateReq: null,
      error: "Status must be 'active' or 'disabled'.",
    };
  }

  const createReq: CreateProviderReq = {
    adapter: adapterResult.data,
    config: configResult.config,
    status: statusResult.data,
  };

  const updateReq: UpdateProviderReq = {
    adapter: adapterResult.data,
    config: configResult.config,
    status: statusResult.data,
  };

  return { createReq, updateReq, error: null };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a gateway action failure to display copy. Returns "" for the silent case.
 */
export function mapGatewayActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to manage gateways.";
  }
  if (isApiError(err, 404)) {
    return "Gateway not found.";
  }
  if (isApiError(err, 409)) {
    return err.message || "Conflicting gateway state — refresh and try again.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request — check the gateway configuration.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the gateway state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}
