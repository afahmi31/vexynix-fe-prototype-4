import { apiFetch } from "./client";
import type { CatalogRes, VendorsRes, LaunchReq, LaunchRes } from "@/types/api";

export const gamesApi = {
  catalog: () => apiFetch<CatalogRes>("/api/games/catalog"),
  vendors: () => apiFetch<VendorsRes>("/api/vendors"),
  launch: (req: LaunchReq) =>
    apiFetch<LaunchRes>("/api/games/launch", {
      method: "POST",
      body: JSON.stringify(req),
    }),
};
