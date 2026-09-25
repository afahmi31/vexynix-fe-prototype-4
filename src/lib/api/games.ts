import { apiFetch } from "./client";
import { resolveBffAssetUrl } from "./assets";
import type {
  ActivityBetFeedRes,
  ActivityFeedsRes,
  ActivityLeaderboardFeedRes,
  CatalogRes,
  LaunchReq,
  LaunchRes,
  VendorsRes,
} from "@/types/api";

function normalizeCatalog(response: CatalogRes): CatalogRes {
  return {
    ...response,
    games: response.games.map((game) => ({
      ...game,
      image_url: resolveBffAssetUrl(game.image_url),
    })),
  };
}

export const gamesApi = {
  catalog: async (): Promise<CatalogRes> =>
    normalizeCatalog(await apiFetch<CatalogRes>("/api/games/catalog")),
  vendors: () => apiFetch<VendorsRes>("/api/vendors"),
  activityFeeds: async (): Promise<ActivityFeedsRes> => {
    const query = "?limit=18&window=7d";
    const [latestBets, bigWins, leaderboard] = await Promise.all([
      apiFetch<ActivityBetFeedRes>(`/api/feed/latest-bets${query}`),
      apiFetch<ActivityBetFeedRes>(`/api/feed/big-wins${query}`),
      apiFetch<ActivityLeaderboardFeedRes>(`/api/feed/leaderboard${query}`),
    ]);

    return { latestBets, bigWins, leaderboard };
  },
  launch: (req: LaunchReq) =>
    apiFetch<LaunchRes>("/api/games/launch", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
