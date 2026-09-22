import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api/wallet";

const TERMINAL_STATUSES = ["PAID", "FAILED", "EXPIRED", "CANCELLED"];

export function useDepositStatus(depositId: string | null) {
  return useQuery({
    queryKey: ["deposit", depositId],
    queryFn: () => walletApi.getDeposit(depositId!),
    enabled: !!depositId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return 5000;
    },
    retry: 2,
  });
}
