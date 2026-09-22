"use client";

/**
 * Hook to fetch merchant dashboard KPIs (P7.2).
 * Uses query key ["admin", "dashboard"], retry: 2 as per shared patterns,
 * and enables on token availability (merchant_admin session).
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session";
import type { AdminDashboardRes } from "@/types/api";

export function useAdminDashboard() {
  const token = useSessionStore((s) => s.token);

  return useQuery<AdminDashboardRes>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiFetch<AdminDashboardRes>("/api/spg/v1/admin/dashboard"),
    enabled: !!token,
    refetchOnWindowFocus: false, // manual refetch after money actions, if needed
    retry: 2,
  });
}
