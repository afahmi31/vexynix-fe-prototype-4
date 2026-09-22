import { describe, it, expect } from "vitest";
import {
  toMerchantProfile,
  toMerchantDomainList,
  toMerchantDomainRow,
  validateChangePasswordForm,
  toMerchantAuditList,
} from "./admin-merchant";
import type { MerchantProfileRes, MerchantAuditRes } from "@/types/api";

const mockProfile: MerchantProfileRes = {
  merchant_id: 123,
  name: "Test Merchant",
  logo_url: "https://example.com/logo.png",
  theme: {
    primary_color: "#FF0000",
    secondary_color: "#00FF00",
  },
  created_at: "2026-08-09T10:00:00Z",
  updated_at: "2026-08-09T11:00:00Z",
};

const mockDomains = [
  {
    id: "1",
    domain: "example.com",
    status: "verified" as const,
    dns_txt_record: "abc123",
    created_at: "2026-08-09T10:00:00Z",
    verified_at: "2026-08-09T11:00:00Z",
  },
  {
    id: "2",
    domain: "test.com",
    status: "pending" as const,
    dns_txt_record: "xyz789",
    created_at: "2026-08-09T12:00:00Z",
  },
];

const mockAudit: MerchantAuditRes = {
  entries: [
    {
      id: "1",
      actor: "admin",
      action: "update_profile",
      target: "merchant:123",
      detail: "Updated brand name",
      created_at: "2026-08-09T10:00:00Z",
    },
    {
      id: "2",
      actor: "admin",
      action: "add_domain",
      target: "domain:example.com",
      created_at: "2026-08-09T11:00:00Z",
    },
  ],
};

describe("toMerchantProfile", () => {
  it("normalizes the profile", () => {
    const view = toMerchantProfile(mockProfile);
    expect(view.merchantId).toBe(123);
    expect(view.name).toBe("Test Merchant");
    expect(view.logoUrl).toBe("https://example.com/logo.png");
    expect(view.theme.primaryColor).toBe("#FF0000");
    expect(view.theme.secondaryColor).toBe("#00FF00");
    expect(view.createdAt).toBe("2026-08-09T10:00:00Z");
    expect(view.updatedAt).toBe("2026-08-09T11:00:00Z");
  });

  it("handles missing fields gracefully", () => {
    const partial: MerchantProfileRes = {
      merchant_id: 456,
      name: "Partial",
      logo_url: "",
      theme: {},
    };
    const view = toMerchantProfile(partial);
    expect(view.merchantId).toBe(456);
    expect(view.name).toBe("Partial");
    expect(view.theme.primaryColor).toBeNull();
  });

  it("returns defaults for undefined", () => {
    const view = toMerchantProfile(undefined);
    expect(view.merchantId).toBeNull();
    expect(view.name).toBe("");
    expect(view.theme.primaryColor).toBeNull();
  });
});

describe("toMerchantDomainList", () => {
  it("normalizes the domains list", () => {
    const view = toMerchantDomainList(mockDomains);
    expect(view.length).toBe(2);
    expect(view[0]?.id).toBe("1");
    expect(view[0]?.domain).toBe("example.com");
    expect(view[0]?.status).toBe("verified");
    expect(view[0]?.dnsTxtRecord).toBe("abc123");
    expect(view[1]?.id).toBe("2");
    expect(view[1]?.status).toBe("pending");
  });

  it("returns empty for undefined", () => {
    const view = toMerchantDomainList(undefined);
    expect(view).toEqual([]);
  });
});

describe("toMerchantDomainRow", () => {
  it("normalizes a valid domain row", () => {
    const row = toMerchantDomainRow({
      id: "1",
      domain: "example.com",
      status: "verified",
      dns_txt_record: "abc123",
    });
    expect(row).toBeDefined();
    expect(row?.id).toBe("1");
    expect(row?.domain).toBe("example.com");
    expect(row?.status).toBe("verified");
  });

  it("returns undefined for null/undefined", () => {
    expect(toMerchantDomainRow(null)).toBeUndefined();
    expect(toMerchantDomainRow(undefined)).toBeUndefined();
  });

  it("returns undefined for missing ID", () => {
    const row = toMerchantDomainRow({ domain: "example.com", status: "pending" });
    expect(row).toBeUndefined();
  });
});

describe("validateChangePasswordForm", () => {
  it("validates valid input", () => {
    const result = validateChangePasswordForm({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "newpass456",
    });
    expect(result.error).toBeNull();
    expect(result.req).toBeDefined();
    expect(result.req?.current_password).toBe("oldpass123");
    expect(result.req?.new_password).toBe("newpass456");
    expect(result.req?.confirm_password).toBe("newpass456");
  });

  it("rejects empty current password", () => {
    const result = validateChangePasswordForm({
      currentPassword: "",
      newPassword: "newpass456",
      confirmPassword: "newpass456",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("required");
  });

  it("rejects short new password", () => {
    const result = validateChangePasswordForm({
      currentPassword: "oldpass123",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("at least 8 characters");
  });

  it("rejects mismatched new passwords", () => {
    const result = validateChangePasswordForm({
      currentPassword: "oldpass123",
      newPassword: "newpass456",
      confirmPassword: "different",
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("do not match");
  });
});

describe("toMerchantAuditList", () => {
  it("normalizes the audit list", () => {
    const view = toMerchantAuditList(mockAudit);
    expect(view.length).toBe(2);
    expect(view[0]?.id).toBe("1");
    expect(view[0]?.actor).toBe("admin");
    expect(view[0]?.action).toBe("update_profile");
    expect(view[1]?.id).toBe("2");
    expect(view[1]?.action).toBe("add_domain");
  });

  it("returns empty for undefined", () => {
    const view = toMerchantAuditList(undefined);
    expect(view).toEqual([]);
  });
});
