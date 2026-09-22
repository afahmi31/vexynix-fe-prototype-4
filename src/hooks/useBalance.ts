import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useSessionStore } from "@/stores/session";
import type { BalanceRes } from "@/types/api";

export function useBalance() {
  const token = useSessionStore((s) => s.token);

  return useQuery({
    queryKey: ["balance"],
    queryFn: () => apiFetch<BalanceRes>("/api/spg/v1/me/balance"),
    enabled: !!token,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        error.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
