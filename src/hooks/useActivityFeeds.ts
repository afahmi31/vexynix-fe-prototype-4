import { useQuery } from "@tanstack/react-query";
import { gamesApi } from "@/lib/api/games";

export function useActivityFeeds() {
  return useQuery({
    queryKey: ["activity-feeds"],
    queryFn: () => gamesApi.activityFeeds(),
    staleTime: 30_000,
    retry: 1,
  });
}
