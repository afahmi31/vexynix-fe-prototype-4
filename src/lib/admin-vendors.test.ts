import { describe, it, expect } from "vitest";
import { toVendorList, toVendorRow, validateToggleVendorInput } from "./admin-vendors";
import type { VendorsRes, Vendor } from "@/types/api";

const mockVendors: VendorsRes = {
  vendors: [
    { id: "pgsoft", name: "PG Soft", status: "active", enabled: true },
    { id: "pragmatic", name: "Pragmatic Play", status: "active", enabled: false },
    { id: "invalid", name: "", status: "active", enabled: true },
  ],
};

describe("toVendorList", () => {
  it("normalizes the vendors list", () => {
    const view = toVendorList(mockVendors);
    expect(view.rows.length).toBe(3);
    expect(view.rows[0]?.id).toBe("pgsoft");
    expect(view.rows[0]?.name).toBe("PG Soft");
    expect(view.rows[0]?.enabled).toBe(true);
    expect(view.rows[1]?.id).toBe("pragmatic");
    expect(view.rows[1]?.enabled).toBe(false);
    expect(view.total).toBe(3);
  });

  it("handles malformed entries gracefully", () => {
    const bad: Vendor = {
      id: "bad",
      name: "",
      status: "inactive",
      enabled: false,
    };
    const res = toVendorList({ vendors: [bad] });
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]?.id).toBe("bad");
    expect(res.rows[0]?.name).toBe("");
  });

  it("returns empty for undefined", () => {
    const view = toVendorList(undefined);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });

  it("returns empty for empty response", () => {
    const view = toVendorList({ vendors: [] });
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });
});

describe("toVendorRow", () => {
  it("normalizes a valid vendor row", () => {
    const row = toVendorRow({
      id: "pgsoft",
      name: "PG Soft",
      status: "active",
      enabled: true,
    });
    expect(row).toBeDefined();
    expect(row?.id).toBe("pgsoft");
    expect(row?.name).toBe("PG Soft");
    expect(row?.enabled).toBe(true);
  });

  it("returns undefined for null/undefined", () => {
    expect(toVendorRow(null)).toBeUndefined();
    expect(toVendorRow(undefined)).toBeUndefined();
  });

  it("returns undefined for missing ID", () => {
    const row = toVendorRow({ name: "No ID", status: "active", enabled: true });
    expect(row).toBeUndefined();
  });
});

describe("validateToggleVendorInput", () => {
  it("validates valid input", () => {
    const result = validateToggleVendorInput({
      vendor_id: "pgsoft",
      enabled: true,
    });
    expect(result.error).toBeNull();
    expect(result.req).toBeDefined();
    expect(result.req?.vendor_id).toBe("pgsoft");
    expect(result.req?.enabled).toBe(true);
  });

  it("rejects empty vendor ID", () => {
    const result = validateToggleVendorInput({
      vendor_id: "",
      enabled: true,
    });
    expect(result.error).toBeDefined();
    expect(result.error).toContain("required");
    expect(result.req).toBeNull();
  });

  it("rejects whitespace-only vendor ID", () => {
    const result = validateToggleVendorInput({
      vendor_id: "   ",
      enabled: true,
    });
    expect(result.error).toBeDefined();
    expect(result.req).toBeNull();
  });
});
