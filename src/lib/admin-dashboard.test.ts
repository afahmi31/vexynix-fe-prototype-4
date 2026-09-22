import { describe, it, expect } from "vitest";
import {
  buildKpiCards,
  toSeriesPoints,
  formatMoney,
  formatCount,
} from "./admin-dashboard";
import type { AdminDashboardRes, DashboardSeriesRes } from "@/types/api";

const fullDashboard: AdminDashboardRes = {
  currency: "IDR",
  players_total: 1250,
  players_active_today: 87,
  deposits_today_count: 42,
  deposits_today_amount: 15_000_000,
  withdrawals_today_count: 9,
  withdrawals_today_amount: 4_250_000,
  withdrawals_pending_count: 3,
  house_pnl_today: 1_750_000,
};

describe("formatMoney", () => {
  it("formats integer minor units with currency prefix", () => {
    expect(formatMoney(15_000_000, "IDR")).toBe("IDR 15.000.000");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "IDR")).toBe("IDR 0");
  });

  it("keeps the sign for negative amounts", () => {
    expect(formatMoney(-2500, "IDR")).toBe("IDR -2.500");
  });
});

describe("formatCount", () => {
  it("formats with grouping", () => {
    expect(formatCount(1250)).toBe("1.250");
  });
});

describe("buildKpiCards", () => {
  it("returns six cards in a stable order", () => {
    const cards = buildKpiCards(fullDashboard);
    expect(cards.map((c) => c.key)).toEqual([
      "deposits_today",
      "withdrawals_today",
      "pending_approvals",
      "active_players",
      "total_players",
      "house_pnl",
    ]);
  });

  it("maps wire fields to formatted values", () => {
    const cards = buildKpiCards(fullDashboard);
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));

    expect(byKey.deposits_today?.value).toBe("IDR 15.000.000");
    expect(byKey.deposits_today?.desc).toBe("42 transactions");
    expect(byKey.withdrawals_today?.value).toBe("IDR 4.250.000");
    expect(byKey.pending_approvals?.value).toBe("3");
    expect(byKey.active_players?.value).toBe("87");
    expect(byKey.total_players?.value).toBe("1.250");
    expect(byKey.house_pnl?.value).toBe("IDR 1.750.000");
  });

  it("renders zeros (not errors) for an empty tenant / undefined response", () => {
    const cards = buildKpiCards(undefined);
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.value === "0" || card.value === "IDR 0").toBe(true);
    }
    const deposits = cards.find((c) => c.key === "deposits_today");
    expect(deposits?.desc).toBe("0 transactions");
  });

  it("coerces malformed numeric fields to zero", () => {
    const cards = buildKpiCards({
      ...fullDashboard,
      deposits_today_amount: Number.NaN,
      withdrawals_pending_count: Number.POSITIVE_INFINITY,
      players_total: -5,
    });
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.deposits_today?.value).toBe("IDR 0");
    expect(byKey.pending_approvals?.value).toBe("0");
    expect(byKey.total_players?.value).toBe("0");
  });

  it("marks negative house PnL red and positive green", () => {
    const up = buildKpiCards(fullDashboard).find((c) => c.key === "house_pnl");
    expect(up?.color).toBe("bg-green");
    expect(up?.desc).toBe("house is up");

    const down = buildKpiCards({ ...fullDashboard, house_pnl_today: -100 }).find(
      (c) => c.key === "house_pnl"
    );
    expect(down?.color).toBe("bg-red");
    expect(down?.desc).toBe("house is down");
    expect(down?.value).toBe("IDR -100");
  });

  it("falls back to IDR when currency is missing", () => {
    const cards = buildKpiCards({ ...fullDashboard, currency: "" });
    expect(cards.find((c) => c.key === "deposits_today")?.value).toContain("IDR");
  });
});

describe("toSeriesPoints", () => {
  it("returns [] for undefined", () => {
    expect(toSeriesPoints(undefined)).toEqual([]);
  });

  it("returns [] for an empty tenant series", () => {
    const res: DashboardSeriesRes = { currency: "IDR", days: 30, points: [] };
    expect(toSeriesPoints(res)).toEqual([]);
  });

  it("sorts points ascending by date and coerces numbers", () => {
    const res: DashboardSeriesRes = {
      currency: "IDR",
      days: 3,
      points: [
        { date: "2026-08-09", deposits: 300, withdrawals: 100, net: 200 },
        { date: "2026-08-07", deposits: 100, withdrawals: 0, net: 100 },
        { date: "2026-08-08", deposits: 200, withdrawals: 50, net: 150 },
      ],
    };
    const points = toSeriesPoints(res);
    expect(points.map((p) => p.date)).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
    expect(points[0]).toEqual({
      date: "2026-08-07",
      deposits: 100,
      withdrawals: 0,
      net: 100,
    });
  });

  it("drops malformed points and coerces bad amounts to zero", () => {
    const res = {
      currency: "IDR",
      days: 2,
      points: [
        { date: "2026-08-08", deposits: Number.NaN, withdrawals: 10, net: 5 },
        { date: "", deposits: 1, withdrawals: 1, net: 0 },
        null,
      ],
    } as unknown as DashboardSeriesRes;
    expect(toSeriesPoints(res)).toEqual([
      { date: "2026-08-08", deposits: 0, withdrawals: 10, net: 5 },
    ]);
  });
});
