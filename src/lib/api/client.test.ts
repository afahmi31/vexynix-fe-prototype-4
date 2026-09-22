import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, isApiError, setBffOrigin, setTokenGetter, NETWORK_ERROR_CODE } from "./client";

describe("apiFetch", () => {
  beforeEach(() => {
    setBffOrigin("http://localhost:18080");
    setTokenGetter(() => null);
    vi.restoreAllMocks();
  });

  it("parses a successful JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const result = await apiFetch<{ ok: boolean }>("/test");
    expect(result).toEqual({ ok: true });
  });

  it("returns undefined for 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const result = await apiFetch("/test");
    expect(result).toBeUndefined();
  });

  it("throws ApiError with generic code for non-JSON error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );
    try {
      await apiFetch("/test");
      expect.fail("should have thrown");
    } catch (err) {
      expect(isApiError(err, 500)).toBe(true);
      expect((err as { code: string }).code).toBe("HTTP_500");
    }
  });

  it("throws network error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    try {
      await apiFetch("/test");
      expect.fail("should have thrown");
    } catch (err) {
      expect(isApiError(err, 0, NETWORK_ERROR_CODE)).toBe(true);
    }
  });

  it("attaches Authorization header when token getter returns a token", async () => {
    setTokenGetter(() => "test-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    await apiFetch("/test");
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
  });
});
