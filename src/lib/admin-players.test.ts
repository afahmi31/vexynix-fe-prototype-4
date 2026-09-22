import { describe, it, expect } from "vitest";
import {
  parseDirectoryQuery,
  listPlayersParamsFromQuery,
  buildDirectoryQueryString,
  toPlayerRow,
  toPlayerList,
  toPlayerProfile,
  statusBadgeClass,
  validateLimitsInput,
  validateSelfExcludeDays,
  validateRegisterInput,
  mapPlayerActionError,
  PLAYER_PAGE_SIZE,
} from "./admin-players";
import type { AdminPlayerListRes, AdminPlayerProfileRes } from "@/types/api";

describe("parseDirectoryQuery", () => {
  it("parses defaults when params are missing", () => {
    const sp = new URLSearchParams();
    const q = parseDirectoryQuery(sp);
    expect(q.page).toBe(1);
    expect(q.limit).toBe(PLAYER_PAGE_SIZE);
    expect(q.search).toBe("");
    expect(q.status).toBe("");
  });

  it("parses valid page, search, and status", () => {
    const sp = new URLSearchParams("page=3&q=alice&status=active");
    const q = parseDirectoryQuery(sp);
    expect(q.page).toBe(3);
    expect(q.search).toBe("alice");
    expect(q.status).toBe("active");
  });

  it("clamps invalid page to 1", () => {
    expect(parseDirectoryQuery(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseDirectoryQuery(new URLSearchParams("page=-5")).page).toBe(1);
    expect(parseDirectoryQuery(new URLSearchParams("page=abc")).page).toBe(1);
  });

  it("rejects unknown status values", () => {
    const q = parseDirectoryQuery(new URLSearchParams("status=hacked"));
    expect(q.status).toBe("");
  });

  it("trims search whitespace", () => {
    const q = parseDirectoryQuery(new URLSearchParams("q=%20%20bob%20%20"));
    expect(q.search).toBe("bob");
  });
});

describe("listPlayersParamsFromQuery", () => {
  it("returns same shape as parseDirectoryQuery", () => {
    const sp = new URLSearchParams("page=2&q=test&status=pending");
    const params = listPlayersParamsFromQuery(sp);
    expect(params).toEqual({ page: 2, limit: PLAYER_PAGE_SIZE, search: "test", status: "pending" });
  });
});

describe("buildDirectoryQueryString", () => {
  it("omits defaults and empty values", () => {
    expect(buildDirectoryQueryString({ page: 1, limit: 20, search: "", status: "" })).toBe("");
  });

  it("includes non-default values", () => {
    expect(buildDirectoryQueryString({ page: 3, limit: 20, search: "alice", status: "active" }))
      .toBe("?q=alice&status=active&page=3");
  });

  it("omits page 1", () => {
    expect(buildDirectoryQueryString({ page: 1, limit: 20, search: "x", status: "" }))
      .toBe("?q=x");
  });
});

describe("toPlayerRow", () => {
  it("normalizes a complete wire row", () => {
    const row = toPlayerRow({
      user_id: 123,
      username: "alice",
      phone_number: "081234",
      currency: "IDR",
      status: "active",
      total_deposits: 5000000,
      total_withdrawals: 2000000,
      created_at: "2026-01-01T00:00:00Z",
      last_login_at: "2026-08-09T12:00:00Z",
    });
    expect(row.userId).toBe(123);
    expect(row.username).toBe("alice");
    expect(row.status).toBe("active");
    expect(row.totalDeposits).toBe(5000000);
  });

  it("coerces missing fields to safe defaults", () => {
    const row = toPlayerRow({ user_id: 99, username: "", currency: "", status: "" });
    expect(row.userId).toBe(99);
    expect(row.username).toBe("#99"); // fallback to #userId
    expect(row.currency).toBe("IDR");
    expect(row.status).toBe("pending");
    expect(row.totalDeposits).toBe(0);
    expect(row.phone).toBe("");
    expect(row.createdAt).toBeNull();
  });

  it("handles non-numeric totals", () => {
    const row = toPlayerRow({
      user_id: 1,
      username: "x",
      currency: "IDR",
      status: "active",
      total_deposits: NaN,
      total_withdrawals: undefined,
    });
    expect(row.totalDeposits).toBe(0);
    expect(row.totalWithdrawals).toBe(0);
  });
});

describe("toPlayerList", () => {
  it("normalizes a complete list response", () => {
    const res: AdminPlayerListRes = {
      players: [
        { user_id: 1, username: "a", currency: "IDR", status: "active" },
        { user_id: 2, username: "b", currency: "IDR", status: "pending" },
      ],
      total: 50,
      page: 2,
      limit: 20,
    };
    const view = toPlayerList(res);
    expect(view.rows).toHaveLength(2);
    expect(view.total).toBe(50);
    expect(view.page).toBe(2);
    expect(view.limit).toBe(20);
  });

  it("returns empty view for undefined input", () => {
    const view = toPlayerList(undefined);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });

  it("filters out rows without user_id", () => {
    const res = {
      players: [
        { user_id: 1, username: "a", currency: "IDR", status: "active" },
        { user_id: 0, username: "bad", currency: "IDR", status: "active" }, // filtered
      ],
      total: 2,
      page: 1,
      limit: 20,
    };
    const view = toPlayerList(res);
    expect(view.rows).toHaveLength(1);
  });
});

describe("toPlayerProfile", () => {
  it("normalizes a complete profile", () => {
    const res: AdminPlayerProfileRes = {
      user_id: 42,
      username: "bob",
      phone_number: "0812",
      currency: "IDR",
      status: "active",
      balance: { available: 100000, held: 5000 },
      stats: { total_deposits: 500000, total_withdrawals: 200000, total_bets: 1000000, total_wins: 900000, bet_count: 150 },
      compliance: { frozen: false, limits: { daily_deposit_limit: 50000 } },
    };
    const p = toPlayerProfile(res);
    expect(p).not.toBeNull();
    expect(p!.userId).toBe(42);
    expect(p!.balance).toEqual({ available: 100000, held: 5000 });
    expect(p!.stats.totalDeposits).toBe(500000);
    expect(p!.compliance.limits.daily).toBe(50000);
  });

  it("returns null for undefined input", () => {
    expect(toPlayerProfile(undefined)).toBeNull();
  });

  it("handles missing balance gracefully", () => {
    const res: AdminPlayerProfileRes = {
      user_id: 1,
      username: "x",
      currency: "IDR",
      status: "active",
    };
    const p = toPlayerProfile(res);
    expect(p!.balance).toBeNull();
    expect(p!.stats.totalDeposits).toBe(0);
  });
});

describe("statusBadgeClass", () => {
  it("maps known statuses", () => {
    expect(statusBadgeClass("active")).toBe("bg-success");
    expect(statusBadgeClass("pending")).toBe("bg-warning text-dark");
    expect(statusBadgeClass("suspended")).toBe("bg-danger");
    expect(statusBadgeClass("closed")).toBe("bg-secondary");
  });

  it("defaults unknown to secondary", () => {
    expect(statusBadgeClass("unknown")).toBe("bg-secondary");
  });
});

describe("validateLimitsInput", () => {
  it("accepts valid integers", () => {
    const result = validateLimitsInput({ daily: "1000", weekly: "5000", monthly: "20000" });
    expect(result.error).toBeNull();
    expect(result.values).toEqual({
      daily_deposit_limit: 1000,
      weekly_deposit_limit: 5000,
      monthly_deposit_limit: 20000,
    });
  });

  it("treats empty as null (no limit)", () => {
    const result = validateLimitsInput({ daily: "", weekly: "", monthly: "" });
    expect(result.error).toBeNull();
    expect(result.values).toEqual({
      daily_deposit_limit: null,
      weekly_deposit_limit: null,
      monthly_deposit_limit: null,
    });
  });

  it("rejects negative numbers", () => {
    const result = validateLimitsInput({ daily: "-100", weekly: "", monthly: "" });
    expect(result.error).toContain("non-negative");
    expect(result.values).toBeNull();
  });

  it("rejects decimals", () => {
    const result = validateLimitsInput({ daily: "100.5", weekly: "", monthly: "" });
    expect(result.error).toContain("whole number");
    expect(result.values).toBeNull();
  });
});

describe("validateSelfExcludeDays", () => {
  it("accepts valid day counts", () => {
    expect(validateSelfExcludeDays("30").days).toBe(30);
    expect(validateSelfExcludeDays("1").days).toBe(1);
    expect(validateSelfExcludeDays("3650").days).toBe(3650);
  });

  it("rejects out-of-range values", () => {
    expect(validateSelfExcludeDays("0").error).toContain("1–3650");
    expect(validateSelfExcludeDays("3651").error).toContain("1–3650");
    expect(validateSelfExcludeDays("abc").error).toContain("whole number");
  });
});

describe("validateRegisterInput", () => {
  it("accepts valid input", () => {
    const result = validateRegisterInput({
      username: "player1",
      phone: "081234567",
      password: "securepass123",
      currency: "IDR",
    });
    expect(result.error).toBeNull();
    expect(result.values?.username).toBe("player1");
  });

  it("rejects short username", () => {
    const result = validateRegisterInput({ username: "ab", phone: "08123", password: "password", currency: "IDR" });
    expect(result.error).toContain("at least 3 characters");
  });

  it("rejects short password", () => {
    const result = validateRegisterInput({ username: "player1", phone: "081234567", password: "short", currency: "IDR" });
    expect(result.error).toContain("at least 8 characters");
  });

  it("rejects invalid currency code", () => {
    const result = validateRegisterInput({ username: "player1", phone: "081234567", password: "password", currency: "XX" });
    expect(result.error).toContain("3-letter code");
  });

  it("normalizes currency to uppercase", () => {
    const result = validateRegisterInput({ username: "player1", phone: "081234567", password: "password", currency: "idr" });
    expect(result.values?.currency).toBe("IDR");
  });
});

describe("mapPlayerActionError", () => {
  it("returns empty string for cancel", () => {
    expect(mapPlayerActionError("cancel")).toBe("");
  });

  it("maps 403 to permission message", () => {
    expect(mapPlayerActionError({ status: 403, code: "X", message: "Forbidden" }))
      .toBe("Forbidden");
  });

  it("maps 404 to not found", () => {
    expect(mapPlayerActionError({ status: 404, code: "X", message: "" }))
      .toBe("Player not found.");
  });

  it("maps network error", () => {
    expect(mapPlayerActionError({ status: 0, code: "NETWORK", message: "" }))
      .toContain("Connection problem");
  });

  it("falls back to error message for other API errors", () => {
    expect(mapPlayerActionError({ status: 500, code: "X", message: "Server error" }))
      .toBe("Server error");
  });

  it("handles unknown error shape", () => {
    expect(mapPlayerActionError(new Error("boom"))).toBe("Something went wrong");
  });
});
