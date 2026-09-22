import { describe, it, expect } from "vitest";
import {
  toPayoutMismatchesList,
  toProviderBalanceList,
  toDepositTransactionsList,
  toPaymentsReport,
} from "./admin-recon";
import type {
  PayoutMismatchesRes,
  ProviderBalanceRes,
  DepositTransactionsRes,
  PaymentsReportRes,
} from "@/types/api";

const mockMismatches: PayoutMismatchesRes = {
  mismatches: [
    {
      id: "1",
      transaction_id: "txn123",
      player_username: "player1",
      amount: 100000,
      currency: "IDR",
      reason: "Vendor confirms but our records show incomplete",
      created_at: "2026-08-09T10:00:00Z",
    },
    {
      id: "2",
      transaction_id: "txn124",
      amount: 50000,
      reason: "Amount mismatch",
      created_at: "2026-08-09T11:00:00Z",
    },
  ],
};

const mockProviderBalance: ProviderBalanceRes = {
  providers: [
    {
      provider_id: "pgsoft",
      balance: 5000000,
      currency: "IDR",
      status: "healthy",
    },
    {
      provider_id: "pragmatic",
      balance: 1000000,
      currency: "IDR",
      status: "low",
    },
  ],
};

const mockDeposits: DepositTransactionsRes = {
  transactions: [
    {
      id: "dep1",
      player_username: "player1",
      amount: 100000,
      currency: "IDR",
      status: "PAID",
      method: "qris",
      created_at: "2026-08-09T10:00:00Z",
      completed_at: "2026-08-09T10:05:00Z",
    },
    {
      id: "dep2",
      player_username: "player2",
      amount: 50000,
      status: "PENDING",
      created_at: "2026-08-09T11:00:00Z",
    },
  ],
};

const mockPaymentsReport: PaymentsReportRes = {
  summary: {
    period: "2026-08-09",
    total_deposits: 150000,
    total_withdrawals: 50000,
    total_fees: 5000,
    net_revenue: 95000,
    currency: "IDR",
  },
  by_method: [
    {
      method: "qris",
      count: 10,
      total_amount: 100000,
    },
    {
      method: "va",
      count: 5,
      total_amount: 50000,
    },
  ],
};

describe("toPayoutMismatchesList", () => {
  it("normalizes the mismatches list", () => {
    const view = toPayoutMismatchesList(mockMismatches);
    expect(view.length).toBe(2);
    expect(view[0]?.id).toBe("1");
    expect(view[0]?.transactionId).toBe("txn123");
    expect(view[0]?.playerUsername).toBe("player1");
    expect(view[0]?.amount).toBe(100000);
    expect(view[0]?.reason).toContain("Vendor confirms");
    expect(view[1]?.id).toBe("2");
    expect(view[1]?.playerUsername).toBe("Unknown");
  });

  it("returns empty for undefined", () => {
    const view = toPayoutMismatchesList(undefined);
    expect(view).toEqual([]);
  });
});

describe("toProviderBalanceList", () => {
  it("normalizes the provider balance list", () => {
    const view = toProviderBalanceList(mockProviderBalance);
    expect(view.length).toBe(2);
    expect(view[0]?.providerId).toBe("pgsoft");
    expect(view[0]?.balance).toBe(5000000);
    expect(view[0]?.status).toBe("healthy");
    expect(view[1]?.providerId).toBe("pragmatic");
    expect(view[1]?.status).toBe("low");
  });

  it("returns empty for undefined", () => {
    const view = toProviderBalanceList(undefined);
    expect(view).toEqual([]);
  });
});

describe("toDepositTransactionsList", () => {
  it("normalizes the transactions list", () => {
    const view = toDepositTransactionsList(mockDeposits);
    expect(view.transactions.length).toBe(2);
    expect(view.transactions[0]?.id).toBe("dep1");
    expect(view.transactions[0]?.playerUsername).toBe("player1");
    expect(view.transactions[0]?.status).toBe("PAID");
    expect(view.transactions[1]?.status).toBe("PENDING");
    expect(view.total).toBe(2);
  });

  it("returns empty for undefined", () => {
    const view = toDepositTransactionsList(undefined);
    expect(view.transactions).toEqual([]);
    expect(view.total).toBe(0);
  });
});

describe("toPaymentsReport", () => {
  it("normalizes the payments report", () => {
    const view = toPaymentsReport(mockPaymentsReport);
    expect(view.summary.period).toBe("2026-08-09");
    expect(view.summary.totalDeposits).toBe(150000);
    expect(view.summary.totalWithdrawals).toBe(50000);
    expect(view.summary.netRevenue).toBe(95000);
    expect(view.byMethod).toBeDefined();
    expect(view.byMethod?.length).toBe(2);
    expect(view.byMethod?.[0]?.method).toBe("qris");
  });

  it("returns defaults for undefined", () => {
    const view = toPaymentsReport(undefined);
    expect(view.summary.period).toBe("");
    expect(view.summary.totalDeposits).toBe(0);
    expect(view.summary.netRevenue).toBe(0);
  });
});
