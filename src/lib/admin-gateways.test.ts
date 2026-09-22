import { describe, it, expect } from "vitest";
import {
  toGatewayList,
  toGatewayRow,
  validateConfigJson,
  validateGatewayForm,
  isCredentialRef,
  isDevCredentialRef,
  mapGatewayActionError,
} from "./admin-gateways";
import type { ProvidersListRes } from "@/types/api";

const mockProviders: ProvidersListRes = {
  providers: [
    {
      id: "prov-1",
      adapter: "mock",
      config: {
        merchant_uuid: "uuid-123",
        client_name: "Test Merchant",
        endpoints: { deposit: "https://api.example.com/deposit" },
        api_key: "env:MOCK_API_KEY",
      },
      status: "active",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-09T10:00:00Z",
    },
    {
      id: "prov-2",
      adapter: "otomatis",
      config: {
        merchant_uuid: "uuid-456",
        client_name: "Otomatis Corp",
        credentials: { secret: "dev:local-secret" },
      },
      status: "disabled",
      created_at: "2026-08-05T10:00:00Z",
      updated_at: "2026-08-05T10:00:00Z",
    },
  ],
  total: 2,
};

describe("isCredentialRef", () => {
  it("accepts valid env refs", () => {
    expect(isCredentialRef("env:API_KEY")).toBe(true);
    expect(isCredentialRef("env:MOCK_API_KEY")).toBe(true);
  });

  it("accepts valid file refs", () => {
    expect(isCredentialRef("file:/path/to/secret")).toBe(true);
    expect(isCredentialRef("file:./config/creds.json")).toBe(true);
  });

  it("accepts valid vault refs", () => {
    expect(isCredentialRef("vault:secret/data/key")).toBe(true);
  });

  it("accepts valid dev refs", () => {
    expect(isCredentialRef("dev:local-secret")).toBe(true);
  });

  it("rejects invalid refs", () => {
    expect(isCredentialRef("API_KEY")).toBe(false);
    expect(isCredentialRef("env:")).toBe(false);
    expect(isCredentialRef(":API_KEY")).toBe(false);
    expect(isCredentialRef("unknown:API_KEY")).toBe(false);
    expect(isCredentialRef(null)).toBe(false);
    expect(isCredentialRef(undefined)).toBe(false);
  });
});

describe("isDevCredentialRef", () => {
  it("returns true for dev: refs", () => {
    expect(isDevCredentialRef("dev:local-secret")).toBe(true);
  });

  it("returns false for other refs", () => {
    expect(isDevCredentialRef("env:API_KEY")).toBe(false);
    expect(isDevCredentialRef("vault:secret")).toBe(false);
  });
});

describe("toGatewayRow", () => {
  it("normalizes a provider row", () => {
    const row = toGatewayRow(mockProviders.providers[0]);
    expect(row).not.toBeUndefined();
    expect(row?.id).toBe("prov-1");
    expect(row?.adapter).toBe("mock");
    expect(row?.merchantUuid).toBe("uuid-123");
    expect(row?.clientName).toBe("Test Merchant");
    expect(row?.hasDevRef).toBe(false);
  });

  it("detects dev: credential refs", () => {
    const row = toGatewayRow(mockProviders.providers[1]);
    expect(row?.hasDevRef).toBe(true);
  });

  it("handles missing config gracefully", () => {
    const row = toGatewayRow({ id: "prov-3", adapter: "mock", config: null as unknown as Record<string, unknown>, status: "active" });
    expect(row?.configPreview).toBe("{}");
  });
});

describe("toGatewayList", () => {
  it("normalizes the list", () => {
    const view = toGatewayList(mockProviders);
    expect(view.rows.length).toBe(2);
    expect(view.total).toBe(2);
  });

  it("returns empty for undefined", () => {
    const view = toGatewayList(undefined);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });
});

describe("validateConfigJson", () => {
  it("accepts valid JSON objects", () => {
    const res = validateConfigJson('{"merchant_uuid":"123","client_name":"Test"}');
    expect(res.error).toBeNull();
    expect(res.config?.merchant_uuid).toBe("123");
  });

  it("rejects empty input", () => {
    expect(validateConfigJson("").error).toBe("Config JSON is required.");
  });

  it("rejects invalid JSON", () => {
    const res = validateConfigJson("{invalid}");
    expect(res.error).toContain("Invalid JSON");
  });

  it("rejects non-object JSON", () => {
    const res = validateConfigJson('["array"]');
    expect(res.error).toContain("must be a valid JSON object");
  });

  it("accepts nested objects", () => {
    const res = validateConfigJson('{"endpoints":{"deposit":"https://x.com"},"api_key":"env:KEY"}');
    expect(res.error).toBeNull();
  });
});

describe("validateGatewayForm", () => {
  const baseInput = {
    adapter: "mock",
    configJson: '{"merchant_uuid":"123"}',
    status: "active",
  };

  it("accepts valid input", () => {
    const res = validateGatewayForm(baseInput);
    expect(res.error).toBeNull();
    expect(res.createReq?.adapter).toBe("mock");
    expect(res.createReq?.status).toBe("active");
  });

  it("rejects unknown adapter", () => {
    const res = validateGatewayForm({ ...baseInput, adapter: "unknown" });
    expect(res.error).toContain("Adapter must be one of");
  });

  it("rejects invalid config JSON", () => {
    const res = validateGatewayForm({ ...baseInput, configJson: "{bad}" });
    expect(res.error).toContain("Invalid JSON");
  });

  it("rejects invalid status", () => {
    const res = validateGatewayForm({ ...baseInput, status: "unknown" });
    expect(res.error).toBe("Status must be 'active' or 'disabled'.");
  });
});

describe("mapGatewayActionError", () => {
  it("returns '' for cancel", () => {
    expect(mapGatewayActionError("cancel")).toBe("");
  });

  it("handles 403", () => {
    const err = { status: 403, code: "FORBIDDEN", message: "Forbidden" };
    expect(mapGatewayActionError(err)).toBe("Forbidden");
  });

  it("handles network error", () => {
    const err = { status: 0, code: "NETWORK", message: "Network error" };
    expect(mapGatewayActionError(err)).toBe("Connection problem — verify the gateway state before retrying.");
  });
});
