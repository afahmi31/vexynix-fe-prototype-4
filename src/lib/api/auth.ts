import { apiFetch } from "./client";
import { resolveBffAssetUrl } from "./assets";
import type {
  RegisterReq,
  RegisterRes,
  LoginReq,
  LoginRes,
  BrandRes,
} from "@/types/api";

export const authApi = {
  register: (req: RegisterReq) =>
    apiFetch<RegisterRes>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  login: (req: LoginReq) =>
    apiFetch<LoginRes>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  stepUp: (password: string) =>
    apiFetch<{ status: string }>("/api/auth/step-up", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  brand: async (): Promise<BrandRes> => {
    const brand = await apiFetch<BrandRes>("/api/brand");
    return {
      ...brand,
      logo_url: resolveBffAssetUrl(brand.logo_url) ?? "",
    };
  },
};
