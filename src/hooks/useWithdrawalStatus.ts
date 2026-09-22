import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api/wallet";

const TERMINAL_STATUSES = ["PAID", "REFUNDED"];

export function useWithdrawalStatus(withdrawalId: string | null) {
  const startTime = useRef<number>(Date.now());
  const polledMs = Date.now() - startTime.current;

  return useQuery({
    queryKey: ["withdrawal", withdrawalId],
    queryFn: () => walletApi.getWithdrawal(withdrawalId!),
    enabled: !!withdrawalId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      // Backoff: 5s first minute, then 30s
      return polledMs < 60_000 ? 5_000 : 30_000;
    },
    retry: 2,
  });
}
