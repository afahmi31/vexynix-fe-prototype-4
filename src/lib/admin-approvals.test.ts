import { describe, it, expect } from "vitest";
import {
  parseQueueStatus,
  toWithdrawalRow,
  toWithdrawalQueue,
  mapApprovalActionError,
  isAlreadyProcessedError,
} from "./admin-approvals";
import type { AdminWithdrawalListRes, AdminWithdrawal } from "@/types/api";

describe("parseQueueStatus", () => {
  it("returns PENDING_APPROVAL by default", () => {
    expect(parseQueueStatus(null)).toBe("PENDING_APPROVAL");
    expect(parseQueueStatus("")).toBe("PENDING_APPROVAL");
  });

  it("accepts known status values", () => {
    expect(parseQueueStatus("PENDING_APPROVAL")).toBe("PENDING_APPROVAL");
    expect(parseQueueStatus("AML_HOLD")).toBe("AML_HOLD");
  });

  it("rejects invalid status (defaults to first tab)", () => {
    expect(parseQueueStatus("HACKED")).toBe("PENDING_APPROVAL");
  });
});

describe("toWithdrawalRow", () => {
  it("normalizes a wire withdrawal to camelCase display row", () => {
    const w: AdminWithdrawal = {
      id: "uuid-123",
      user_id: 999,
      username: "playerx",
      amount: 50000,
      currency: "IDR",
      status: "PENDING_APPROVAL",
      destination: "BCA ****5678",
      destination_id: "dest-uuid",
      requested_at: "2026-08-09T12:00:00Z",
      client_ref: "ref-456",
    };
    const r = toWithdrawalRow(w);
    expect(r.id).toBe("uuid-123");
    expect(r.userId).toBe(999);
    expect(r.username).toBe("playerx");
    expect(r.amount).toBe(50000);
    expect(r.currency).toBe("IDR");
    expect(r.requestedAt).toBe("2026-08-09T12:00:00Z");
    expect(r.clientRef).toBe("ref-456");
  });

  it("coerces missing fields to safe defaults", () => {
    const r = toWithdrawalRow({ id: "", user_id: 1, amount: 0, currency: "IDR", status: "unknown" });
    expect(r.id).toBe(""); // filtered downstream
    expect(r.username).toBe("#1"); // fallback to #userId
    expect(r.destination).toBe("");
    expect(r.amlFlags).toEqual([]);
    expect(r.requestedAt).toBeNull();
  });

  it("maps null AML flags to empty array", () => {
    const r = toWithdrawalRow({ id: "x", user_id: 1, amount: 0, currency: "IDR", status: "PAID", aml_flags: undefined });
    expect(r.amlFlags).toEqual([]);
  });
});

describe("toWithdrawalQueue", () => {
  it("normalizes queue response to rows + total", () => {
    const res: AdminWithdrawalListRes = {
      withdrawals: [
        { id: "a", user_id: 1, amount: 10000, currency: "IDR", status: "PENDING_APPROVAL" },
        { id: "b", user_id: 2, amount: 20000, currency: "IDR", status: "AML_HOLD" },
      ],
      total: 10,
    };
    const q = toWithdrawalQueue(res);
    expect(q.rows).toHaveLength(2);
    expect(q.total).toBe(10);
  });

  it("returns empty for undefined input", () => {
    expect(toWithdrawalQueue(undefined)).toEqual({ rows: [], total: 0 });
  });

  it("drops rows without ID (e.g., empty IDs)", () => {
    const res: AdminWithdrawalListRes = {
      withdrawals: [
        { id: "valid", user_id: 1, amount: 10000, currency: "IDR", status: "PENDING_APPROVAL" },
        { id: "", user_id: 2, amount: 20000, currency: "IDR", status: "PENDING_APPROVAL" }, // dropped
      ],
    };
    const q = toWithdrawalQueue(res);
    expect(q.rows).toHaveLength(1);
  });

  it("falls back to row count if no total provided", () => {
    const res: AdminWithdrawalListRes = {
      withdrawals: [{ id: "x", user_id: 1, amount: 10000, currency: "IDR", status: "PENDING_APPROVAL" }],
    };
    const q = toWithdrawalQueue(res);
    expect(q.total).toBe(1);
  });
});

describe("mapApprovalActionError", () => {
  it("returns empty string for cancel", () => {
    expect(mapApprovalActionError("cancel")).toBe("");
  });

  it("maps CAS refusal to 'already processed'", () => {
    expect(mapApprovalActionError({ status: 409, code: "X", message: "" }))
      .toContain("already processed");
    expect(mapApprovalActionError({ status: 400, code: "X", message: "" }))
      .toContain("already processed");
    expect(mapApprovalActionError({ status: 404, code: "X", message: "" }))
      .toContain("already processed");
  });

  it("maps 403 to permission error", () => {
    const msg = mapApprovalActionError({ status: 403, code: "X", message: "Forbidden" });
    expect(msg).toBe("Forbidden"); // uses actual API message
  });

  it("maps network error", () => {
    expect(mapApprovalActionError({ status: 0, code: "NETWORK", message: "" }))
      .toContain("Connection problem");
  });

  it("falls back for other errors", () => {
    expect(mapApprovalActionError({ status: 500, code: "X", message: "Server error" }))
      .toBe("Server error");
  });

  it("handles unknown errors", () => {
    expect(mapApprovalActionError(new Error("boom"))).toBe("Something went wrong");
  });
});

describe("isAlreadyProcessedError", () => {
  it("identifies CAS refusals (409/400/404)", () => {
    expect(isAlreadyProcessedError({ status: 409, code: "X", message: "" })).toBe(true);
    expect(isAlreadyProcessedError({ status: 400, code: "X", message: "" })).toBe(true);
    expect(isAlreadyProcessedError({ status: 404, code: "X", message: "" })).toBe(true);
  });

  it("rejects other statuses", () => {
    expect(isAlreadyProcessedError({ status: 403, code: "X", message: "" })).toBe(false);
    expect(isAlreadyProcessedError({ status: 429, code: "X", message: "" })).toBe(false);
    expect(isAlreadyProcessedError({ status: 500, code: "X", message: "" })).toBe(false);
  });
});
