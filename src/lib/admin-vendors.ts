/**
 * Vendor activation (P7.8) — pure mapping/validation between wire types
 * and the vendor list UI.
 *
 * Wire shapes are NOT live-verified (docs/03-ADMIN-SURFACES.md §3.1 says
 * GET /api/games/vendors is a "BFF special route") — every accessor
 * coerces defensively so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import type { ToggleVendorReq, VendorsRes } from "@/types/api";

// ---------------------------------------------------------------------------
// Vendor list
// ---------------------------------------------------------------------------

export interface VendorView {
  id: string;
  name: string;
  status: string;
  enabled: boolean;
}

export interface VendorListView {
  rows: VendorView[];
  total: number;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toBool(value: unknown): boolean {
  return value === true;
}

/** Normalize one vendor row; null input → undefined. */
export function toVendorRow(v: unknown): VendorView | undefined {
  if (v == null || typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;

  const id = toText(obj.id);
  if (id === "") return undefined;

  return {
    id,
    name: toText(obj.name),
    status: toText(obj.status),
    enabled: toBool(obj.enabled),
  };
}

/** Normalize the vendors list; missing/garbage → empty list. */
export function toVendorList(res: VendorsRes | undefined): VendorListView {
  const list = res?.vendors;
  if (!Array.isArray(list)) return { rows: [], total: 0 };
  const rows = list.map(toVendorRow).filter((r): r is VendorView => r !== undefined);
  return { rows, total: rows.length };
}

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

export interface ToggleVendorInput {
  vendor_id: string;
  enabled: boolean;
}

/**
 * Validate the toggle vendor form. ID must be non-empty.
 */
export function validateToggleVendorInput(input: ToggleVendorInput): {
  req: ToggleVendorReq;
  error: null;
} | {
  req: null;
  error: string;
} {
  const vendorId = input.vendor_id.trim();
  if (vendorId === "") {
    return { req: null, error: "Vendor ID is required." };
  }
  return {
    req: {
      vendor_id: vendorId,
      enabled: input.enabled,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a vendor action failure to display copy.
 */
export function mapVendorActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to manage vendors.";
  }
  if (isApiError(err, 404)) {
    return "Vendor not found.";
  }
  if (isApiError(err, 409)) {
    return err.message || "Conflicting vendor state — refresh and try again.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request — check the form values.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the vendor state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}
