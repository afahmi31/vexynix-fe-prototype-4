import { describe, it, expect } from "vitest";
import {
  RATE_LIMIT_MESSAGE,
  isRateLimited,
  rateLimitMessage,
} from "./rate-limit";
import { NETWORK_ERROR_CODE } from "@/lib/api/client";

describe("rate-limit mapping", () => {
  it("429 ApiError maps to the shared message", () => {
    const err = { status: 429, code: "RATE_LIMITED", message: "" };
    expect(rateLimitMessage(err)).toBe(RATE_LIMIT_MESSAGE);
    expect(rateLimitMessage(err)).toBe(
      "Terlalu banyak percobaan — mohon tunggu sebentar dan coba lagi."
    );
  });

  it("non-429 ApiError returns null", () => {
    expect(
      rateLimitMessage({ status: 500, code: "SERVER_ERROR", message: "x" })
    ).toBeNull();
    expect(
      rateLimitMessage({ status: 401, code: "STEP_UP_REQUIRED", message: "" })
    ).toBeNull();
  });

  it("non-ApiError returns null", () => {
    expect(rateLimitMessage(new Error("boom"))).toBeNull();
    expect(rateLimitMessage(null)).toBeNull();
    expect(rateLimitMessage("429")).toBeNull();
  });

  it("network error (status 0) is not a rate limit", () => {
    const err = { status: 0, code: NETWORK_ERROR_CODE, message: "Network error" };
    expect(isRateLimited(err)).toBe(false);
    expect(rateLimitMessage(err)).toBeNull();
  });

  it("isRateLimited is true only for 429", () => {
    expect(isRateLimited({ status: 429, code: "X", message: "" })).toBe(true);
    expect(isRateLimited({ status: 403, code: "X", message: "" })).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});
