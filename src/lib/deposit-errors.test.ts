import { describe, it, expect } from "vitest";
import { mapDepositError } from "./deposit-errors";
import type { ApiError } from "@/lib/api/client";

function apiError(status: number, code: string, message?: string): ApiError {
  return { status, code, message: message ?? code };
}

describe("mapDepositError", () => {
  it("maps ACCOUNT_FROZEN", () => {
    expect(mapDepositError(apiError(403, "ACCOUNT_FROZEN"))).toContain(
      "frozen"
    );
  });

  it("maps generic 403", () => {
    expect(mapDepositError(apiError(403, "SOME_CODE"))).toContain("support");
  });

  it("maps 400", () => {
    expect(mapDepositError(apiError(400, "HTTP_400"))).toContain("amount");
  });

  it("maps 503", () => {
    expect(mapDepositError(apiError(503, "HTTP_503"))).toContain("provider");
  });

  it("maps network error", () => {
    expect(mapDepositError(apiError(0, "NETWORK"))).toContain("Connection");
  });

  it("maps unknown ApiError to its message", () => {
    expect(mapDepositError(apiError(500, "HTTP_500", "Server boom"))).toBe(
      "Server boom"
    );
  });

  it("maps unknown ApiError without message to generic", () => {
    expect(mapDepositError(apiError(500, "HTTP_500"))).toBe("HTTP_500");
  });

  it("maps non-ApiError to generic message", () => {
    expect(mapDepositError(new Error("boom"))).toContain("Something went wrong");
  });
});
