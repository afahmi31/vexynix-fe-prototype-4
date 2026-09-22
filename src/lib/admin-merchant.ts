/**
 * Merchant self-service (P7.9) — pure mapping/validation between wire types
 * and the brand/profile/domains/password/audit UI.
 *
 * Wire shapes are NOT live-verified (docs/03-ADMIN-SURFACES.md §3.2 says these
 * are merchant self-service endpoints) — every accessor coerces defensively
 * so shape drift degrades to zeros/empty, never a crash.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import { parseColorToHex } from "@/lib/color-contrast";
import type { MerchantAuditEntry, MerchantAuditRes, MerchantDomain, MerchantPasswordReq, MerchantProfileRes } from "@/types/api";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface MerchantProfileView {
  merchantId: number | null;
  name: string;
  logoUrl: string;
  theme: {
    primaryColor: string | null;
    secondaryColor: string | null;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MerchantDomainView {
  id: string;
  domain: string;
  status: string;
  dnsTxtRecord: string | null;
  createdAt: string | null;
  verifiedAt: string | null;
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

/** Normalize the merchant profile; missing/garbage → empty view. */
export function toMerchantProfile(res: MerchantProfileRes | undefined): MerchantProfileView {
  if (res == null || typeof res !== "object") {
    return {
      merchantId: null,
      name: "",
      logoUrl: "",
      theme: { primaryColor: null, secondaryColor: null },
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    merchantId: toAmount(res.merchant_id) || null,
    name: toText(res.name),
    logoUrl: toText(res.logo_url),
    theme: {
      primaryColor: res.theme?.primary_color != null ? parseColorToHex(res.theme.primary_color) : null,
      secondaryColor: res.theme?.secondary_color != null ? parseColorToHex(res.theme.secondary_color) : null,
    },
    createdAt: toIsoOrNull(res.created_at),
    updatedAt: toIsoOrNull(res.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

/** Normalize one domain row; null input → undefined. */
export function toMerchantDomainRow(d: unknown): MerchantDomainView | undefined {
  if (d == null || typeof d !== "object") return undefined;
  const obj = d as Record<string, unknown>;

  const id = toText(obj.id);
  if (id === "") return undefined;

  const status = toText(obj.status);

  return {
    id,
    domain: toText(obj.domain),
    status,
    dnsTxtRecord: toText(obj.dns_txt_record) || null,
    createdAt: toIsoOrNull(obj.created_at),
    verifiedAt: toIsoOrNull(obj.verified_at),
  };
}

/** Normalize the domains list; missing/garbage → empty list. */
export function toMerchantDomainList(domains: MerchantDomain[] | undefined): MerchantDomainView[] {
  if (!Array.isArray(domains)) return [];
  return domains
    .map(toMerchantDomainRow)
    .filter((r): r is MerchantDomainView => r !== undefined);
}

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validateChangePasswordForm(form: ChangePasswordForm): {
  req: MerchantPasswordReq;
  error: null;
} | {
  req: null;
  error: string;
} {
  const { currentPassword, newPassword, confirmPassword } = form;

  if (currentPassword === "") {
    return { req: null, error: "Current password is required." };
  }
  if (newPassword.length < 8) {
    return { req: null, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { req: null, error: "New passwords do not match." };
  }

  return {
    req: {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** Normalize one audit entry; null input → undefined. */
export function toMerchantAuditRow(e: unknown): MerchantAuditEntry | undefined {
  if (e == null || typeof e !== "object") return undefined;
  const obj = e as Record<string, unknown>;

  const id = toText(obj.id);
  if (id === "") return undefined;

  return {
    id,
    actor: toText(obj.actor),
    action: toText(obj.action),
    target: toText(obj.target) || undefined,
    detail: toText(obj.detail) || undefined,
    created_at: toIsoOrNull(obj.created_at) || undefined,
  };
}

/** Normalize the audit entries list; missing/garbage → empty list. */
export function toMerchantAuditList(res: MerchantAuditRes | undefined): MerchantAuditEntry[] {
  const entries = res?.entries;
  if (!Array.isArray(entries)) return [];
  return entries
    .map(toMerchantAuditRow)
    .filter((r): r is MerchantAuditEntry => r !== undefined);
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a merchant self-service action failure to display copy.
 */
export function mapMerchantActionError(err: unknown): string {
  if (err === "cancel") return "";
  if (isApiError(err, 403)) {
    return err.message || "You do not have permission to manage merchant settings.";
  }
  if (isApiError(err, 404)) {
    return "Merchant profile or domain not found.";
  }
  if (isApiError(err, 409)) {
    return err.message || "Conflicting state — refresh and try again.";
  }
  if (isApiError(err, 400)) {
    return err.message || "Invalid request — check the form values.";
  }
  if (isApiError(err, 429)) {
    return "Too many attempts — wait a moment and try again.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — verify the state before retrying.";
  }
  if (isApiError(err)) return err.message || "Action failed";
  return "Something went wrong";
}
