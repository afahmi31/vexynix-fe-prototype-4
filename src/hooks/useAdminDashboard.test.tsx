import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAdminDashboard } from "./useAdminDashboard";
import { useAdminDashboardSeries } from "./useAdminDashboardSeries";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session";
import type { AdminDashboardRes, DashboardSeriesRes } from "@/types/api";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiFetch: vi.fn() };
});

const dashboardFixture: AdminDashboardRes = {
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

const seriesFixture: DashboardSeriesRes = {
  currency: "IDR",
  days: 2,
  points: [
    { date: "2026-08-08", deposits: 100, withdrawals: 40, net: 60 },
    { date: "2026-08-09", deposits: 200, withdrawals: 90, net: 110 },
  ],
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useAdminDashboard", () => {
  beforeEach(() => {
    act(() => useSessionStore.setState({ token: "test-token" }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    act(() => useSessionStore.setState({ token: null }));
  });

  it("fetches the admin dashboard endpoint when a token exists", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(dashboardFixture);

    const { result } = renderHook(() => useAdminDashboard(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith("/api/spg/v1/admin/dashboard");
    expect(result.current.data).toEqual(dashboardFixture);
  });

  it("stays disabled without a token (no request fired)", async () => {
    act(() => useSessionStore.setState({ token: null }));

    const { result } = renderHook(() => useAdminDashboard(), {
      wrapper: makeWrapper(),
    });

    // Disabled queries never leave pending/idle state and never call the API.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("surfaces API errors after retries are exhausted", async () => {
    const err = { status: 500, code: "HTTP_500", message: "boom" };
    vi.mocked(apiFetch).mockRejectedValue(err);

    const { result } = renderHook(() => useAdminDashboard(), {
      wrapper: makeWrapper(),
    });

    // Hook sets retry: 2 → default backoff is ~1s + ~2s before isError.
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 10000,
    });
    expect(result.current.error).toEqual(err);
  });
});

describe("useAdminDashboardSeries", () => {
  beforeEach(() => {
    act(() => useSessionStore.setState({ token: "test-token" }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    act(() => useSessionStore.setState({ token: null }));
  });

  it("fetches the dashboard-series endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(seriesFixture);

    const { result } = renderHook(() => useAdminDashboardSeries(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/spg/v1/admin/reports/dashboard-series"
    );
    expect(result.current.data?.points).toHaveLength(2);
  });
});
