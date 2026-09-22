"use client";

/**
 * Hook to fetch merchant dashboard time-series data (P7.2).
 * Uses query key ["admin", "dashboard-series"], retry: 2 as per shared patterns,
 * and enables on token availability (merchant_admin session).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session";
import type { DashboardSeriesRes } from "@/types/api";

export function useAdminDashboardSeries() {
  const token = useSessionStore((s) => s.token);

  return useQuery<DashboardSeriesRes>({
    queryKey: ["admin", "dashboard-series"],
    queryFn: () => apiFetch<DashboardSeriesRes>("/api/spg/v1/admin/reports/dashboard-series"),
    enabled: !!token,
    refetchOnWindowFocus: false, // manual refetch after money actions, if needed
    retry: 2,
  });
}
