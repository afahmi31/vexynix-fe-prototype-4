import { describe, it, expect } from "vitest";
import { mapWithdrawalError } from "./withdrawal-errors";
import { NETWORK_ERROR_CODE } from "@/lib/api/client";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

describe("mapWithdrawalError", () => {
  it("returns empty string for STEP_UP_REQUIRED", () => {
    const err = { status: 401, code: "STEP_UP_REQUIRED", message: "" };
    expect(mapWithdrawalError(err)).toBe("");
  });

  it("returns cooldown message for DEST_COOLDOWN", () => {
    const err = { status: 403, code: "DEST_COOLDOWN", message: "" };
    expect(mapWithdrawalError(err)).toBe("This destination is still cooling down");
  });

  it("returns not available for generic 403", () => {
    const err = { status: 403, code: "OTHER", message: "" };
    expect(mapWithdrawalError(err)).toBe("This destination is not available");
  });

  it("returns shared rate limit message for 429", () => {
    const err = { status: 429, code: "RATE_LIMITED", message: "" };
    expect(mapWithdrawalError(err)).toBe(RATE_LIMIT_MESSAGE);
  });

  it("returns network error message", () => {
    const err = { status: 0, code: NETWORK_ERROR_CODE, message: "Network error" };
    expect(mapWithdrawalError(err)).toBe("Connection problem — check status before retrying");
  });

  it("returns error message for generic ApiError", () => {
    const err = { status: 500, code: "SERVER_ERROR", message: "Server failed" };
    expect(mapWithdrawalError(err)).toBe("Server failed");
  });

  it("returns fallback for non-ApiError", () => {
    expect(mapWithdrawalError("some string")).toBe("Something went wrong");
  });

  it("returns fallback for null", () => {
    expect(mapWithdrawalError(null)).toBe("Something went wrong");
  });
});
