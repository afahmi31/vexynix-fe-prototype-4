import { useQuery } from "@tanstack/react-query";
import { gamesApi } from "@/lib/api/games";

export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: () => gamesApi.catalog(),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: () => gamesApi.vendors(),
    staleTime: 60_000,
    retry: 2,
  });
}
