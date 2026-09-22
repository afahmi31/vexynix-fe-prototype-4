import { describe, it, expect, beforeEach } from "vitest";
import {
  loginHref,
  safeNextPath,
  markSessionExpired,
  takeSessionExpired,
  isSessionExpiredError,
} from "./auth-redirect";

describe("safeNextPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeNextPath("/wallet/deposit")).toBe("/wallet/deposit");
  });

  it("rejects anything that could leave the origin", () => {
    expect(safeNextPath("//evil.example.com")).toBeNull();
    expect(safeNextPath("/\\evil.example.com")).toBeNull();
    expect(safeNextPath("https://evil.example.com")).toBeNull();
    expect(safeNextPath("wallet/deposit")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

describe("loginHref", () => {
  it("carries the return path", () => {
    expect(loginHref("/wallet/deposit")).toBe("/login?next=%2Fwallet%2Fdeposit");
  });

  it("drops auth pages and unsafe paths", () => {
    expect(loginHref("/login")).toBe("/login");
    expect(loginHref("/register")).toBe("/login");
    expect(loginHref("//evil.example.com")).toBe("/login");
    expect(loginHref()).toBe("/login");
  });
});

describe("session-expired flag", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("is read once and then cleared", () => {
    markSessionExpired();
    expect(takeSessionExpired()).toBe(true);
    expect(takeSessionExpired()).toBe(false);
  });

  it("is false when nothing set it", () => {
    expect(takeSessionExpired()).toBe(false);
  });
});

describe("isSessionExpiredError", () => {
  it("matches a plain 401", () => {
    expect(
      isSessionExpiredError({ status: 401, code: "invalid or expired jwt", message: "x" })
    ).toBe(true);
  });

  it("ignores step-up challenges — the dialog handles those", () => {
    expect(
      isSessionExpiredError({ status: 401, code: "STEP_UP_REQUIRED", message: "x" })
    ).toBe(false);
  });

  it("ignores other statuses and non-errors", () => {
    expect(isSessionExpiredError({ status: 403, code: "ACCOUNT_FROZEN", message: "x" })).toBe(false);
    expect(isSessionExpiredError(new Error("boom"))).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });
});
