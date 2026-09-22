import { describe, it, expect } from "vitest";
import {
  toEarningsView,
  toPayoutHistory,
  toPayoutDetail,
  isProposer,
  payoutStatusBadgeClass,
  validateProposeForm,
  validateCallbackForm,
  mapPayoutActionError,
  isInsufficientBalanceError,
  type PayoutRow,
} from "./admin-payouts";
import type {
  OperatorEarningsRes,
  OperatorPayoutRow,
  OperatorPayoutDetailRes,
} from "@/types/api";

const fullEarnings: OperatorEarningsRes = {
  currency: "IDR",
  available_balance: 150_000_000,
  pnl_ytd: 25_000_000,
  withdrawals_this_month: 12_500_000,
  effective_date: "2026-08-09",
};

describe("toEarningsView", () => {
  it("maps wire fields to view model", () => {
    const view = toEarningsView(fullEarnings);
    expect(view.currency).toBe("IDR");
    expect(view.availableBalance).toBe(150_000_000);
    expect(view.pnlYtd).toBe(25_000_000);
    expect(view.withdrawalsThisMonth).toBe(12_500_000);
    expect(view.effectiveDate).toBe("2026-08-09");
    expect(view.balanceState).toBe("healthy");
  });

  it("marks balance as critical when negative", () => {
    const view = toEarningsView({ ...fullEarnings, available_balance: -1000 });
    expect(view.balanceState).toBe("critical");
  });

  it("marks balance as low between 0 and threshold", () => {
    const view = toEarningsView({ ...fullEarnings, available_balance: 5_000_000 });
    expect(view.balanceState).toBe("low");
  });

  it("coerces undefined/malformed to zeros", () => {
    const view = toEarningsView(undefined);
    expect(view.availableBalance).toBe(0);
    expect(view.currency).toBe("IDR");
    expect(view.balanceState).toBe("healthy");
  });
});

describe("isProposer (four-eyes checker)", () => {
  const mockPayout: PayoutRow = {
    id: "payout-1",
    userId: 123,
    username: "player-a",
    amount: 100000,
    currency: "IDR",
    status: "PENDING",
    method: "bank_transfer",
    proposedBy: "alice-operator",
    proposedAt: "2026-08-09T10:00:00Z",
    approvedBy: null,
    approvedAt: null,
    result: null,
    referenceNo: null,
    callbackAt: null,
  };

  it("returns true when session username matches proposer (case-insensitive)", () => {
    expect(isProposer(mockPayout, "alice-operator")).toBe(true);
    expect(isProposer(mockPayout, "ALICE-OPERATOR")).toBe(true);
    expect(isProposer(mockPayout, "Alice-Operator")).toBe(true);
  });

  it("returns false when usernames differ", () => {
    expect(isProposer(mockPayout, "bob-operator")).toBe(false);
    expect(isProposer(mockPayout, "alice-admin")).toBe(false);
  });

  it("returns false when proposer is empty", () => {
    expect(isProposer({ ...mockPayout, proposedBy: "" }, "alice-operator")).toBe(false);
  });
});

describe("payoutStatusBadgeClass", () => {
  it("renders correct classes for known states", () => {
    expect(payoutStatusBadgeClass("PENDING")).toBe("bg-warning text-dark");
    expect(payoutStatusBadgeClass("APPROVED")).toBe("bg-success");
    expect(payoutStatusBadgeClass("PAID")).toBe("bg-success");
    expect(payoutStatusBadgeClass("REJECTED")).toBe("bg-danger");
    expect(payoutStatusBadgeClass("FAILED")).toBe("bg-danger");
  });

  it("defaults to secondary for unknown states", () => {
    expect(payoutStatusBadgeClass("UNKNOWN")).toBe("bg-secondary");
    expect(payoutStatusBadgeClass("")).toBe("bg-secondary");
  });
});

describe("validateProposeForm", () => {
  const baseInput = {
    amount: "1000000",
    method: "bank_transfer",
    destination: "BCA-123456",
  };

  it("validates positive integer amount", () => {
    const res = validateProposeForm({ ...baseInput, amount: "1000" }, "uuid-123");
    expect(res.error).toBeNull();
    expect(res.req?.amount).toBe(1000);
    expect(res.req?.client_ref).toBe("uuid-123");
  });

  it("rejects non-integer amounts", () => {
    const res = validateProposeForm({ ...baseInput, amount: "1000.50" }, "uuid-123");
    expect(res.error).toContain("positive whole number");
  });

  it("rejects zero or negative amounts", () => {
    expect(validateProposeForm({ ...baseInput, amount: "0" }, "uuid-123").error).toBeTruthy();
    expect(validateProposeForm({ ...baseInput, amount: "-1000" }, "uuid-123").error).toBeTruthy();
  });

  it("requires method", () => {
    expect(validateProposeForm({ ...baseInput, method: "" }, "uuid-123").error).toBeTruthy();
  });

  it("requires destination", () => {
    expect(validateProposeForm({ ...baseInput, destination: "" }, "uuid-123").error).toBeTruthy();
  });

  it("requires non-empty amount", () => {
    expect(validateProposeForm({ ...baseInput, amount: "" }, "uuid-123").error).toBe("Amount is required.");
  });
});

describe("validateCallbackForm", () => {
  const baseInput = {
    result: "PAID",
    reference_no: "REF-123456",
  };

  it("accepts valid input", () => {
    const res = validateCallbackForm(baseInput);
    expect(res.error).toBeNull();
    expect(res.req?.result).toBe("PAID");
    expect(res.req?.reference_no).toBe("REF-123456");
  });

  it("makes reference_no optional", () => {
    const res = validateCallbackForm({ ...baseInput, reference_no: "" });
    expect(res.error).toBeNull();
    expect(res.req?.reference_no).toBeUndefined();
  });

  it("rejects empty result", () => {
    const res = validateCallbackForm({ ...baseInput, result: "" });
    expect(res.error).toBe("Result is required (e.g. PAID, FAILED).");
  });

  it("enforces result length ≤ 32", () => {
    const longResult = "X".repeat(33);
    const res = validateCallbackForm({ result: longResult, reference_no: "" });
    expect(res.error).toContain("32 characters");
  });

  it("enforces reference length ≤ 64", () => {
    const longRef = "X".repeat(65);
    const res = validateCallbackForm({ result: "PAID", reference_no: longRef });
    expect(res.error).toContain("64 characters");
  });
});

describe("mapPayoutActionError", () => {
  it("returns '' for step-up cancel", () => {
    expect(mapPayoutActionError("cancel")).toBe("");
  });

  it("handles network errors", () => {
    expect(mapPayoutActionError({ status: 0, code: "NETWORK", message: "Network error" })).toBe(
      "Connection problem — verify the payout state before retrying."
    );
  });

  it("handles 409 conflicts", () => {
    const err = { status: 409, code: "CONFLICT", message: "Conflict" };
    expect(mapPayoutActionError(err)).toBe("Insufficient house balance or conflicting state — the payout was not approved.");
  });
});

describe("isInsufficientBalanceError", () => {
  it("returns true for insufficient-balance 409", () => {
    const err = { status: 409, code: "INSUFFICIENT_BALANCE", message: "Insufficient balance" };
    expect(isInsufficientBalanceError(err)).toBe(true);
  });

  it("returns true even when code contains insufficient", () => {
    const err = { status: 409, code: "BAD_REQUEST", message: "Insufficient house funds" };
    expect(isInsufficientBalanceError(err)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isInsufficientBalanceError("cancel")).toBe(false);
    expect(isInsufficientBalanceError({ status: 404, code: "NOT_FOUND", message: "Not found" })).toBe(false);
    expect(isInsufficientBalanceError({ status: 403, code: "FORBIDDEN", message: "Forbidden" })).toBe(false);
  });
});

// Wire list fixture
const mockPayoutListRes: { payouts: OperatorPayoutRow[]; total: number } = {
  payouts: [
    {
      id: "payout-1",
      user_id: 123,
      username: "player-a",
      amount: 1000000,
      currency: "IDR",
      status: "PENDING",
      method: "bank_transfer",
      proposed_by: "alice-operator",
      proposed_at: "2026-08-09T10:00:00Z",
      approved_by: null,
      approved_at: null,
      result: null,
      reference_no: null,
      callback_at: null,
    },
  ],
  total: 1,
};

describe("toPayoutHistory", () => {
  it("normalizes payout list to rows", () => {
    const view = toPayoutHistory(mockPayoutListRes);
    expect(view.rows.length).toBe(1);
    expect(view.rows[0]?.id).toBe("payout-1");
    expect(view.rows[0]?.proposedBy).toBe("alice-operator");
    expect(view.total).toBe(1);
  });

  it("returns empty array for undefined response", () => {
    const view = toPayoutHistory(undefined);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
  });
});

describe("toPayoutDetail", () => {
  it("normalizes a single payout detail", () => {
    const detail: OperatorPayoutDetailRes = {
      id: "payout-1",
      user_id: 123,
      username: "player-a",
      amount: 1000000,
      currency: "IDR",
      status: "PENDING",
      method: "bank_transfer",
      proposed_by: "alice-operator",
      proposed_at: "2026-08-09T10:00:00Z",
      approved_by: null,
      approved_at: null,
      result: null,
      reference_no: null,
      callback_at: null,
    };
    const row = toPayoutDetail(detail);
    expect(row).not.toBeNull();
    expect(row?.id).toBe("payout-1");
  });

  it("returns null for undefined/malformed", () => {
    expect(toPayoutDetail(undefined)).toBeNull();
    expect(toPayoutDetail(null as unknown as OperatorPayoutDetailRes)).toBeNull();
  });
});
