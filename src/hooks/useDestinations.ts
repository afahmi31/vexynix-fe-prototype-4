import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api/wallet";

export function useDestinations() {
  return useQuery({
    queryKey: ["destinations"],
    queryFn: () => walletApi.destinations(),
    retry: false,
  });
}
