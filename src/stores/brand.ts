/**
 * Brand store — fetches merchant branding from /api/brand once,
 * caches it module-level so all pages share the same data.
 */
import { create } from "zustand";
import { authApi } from "@/lib/api/auth";
import type { BrandRes } from "@/types/api";

const defaultBrand: BrandRes = {
  found: false,
  label: "Game Portal",
  logo_url: "",
  theme: {},
};

interface BrandState {
  brand: BrandRes;
  loaded: boolean;
  fetchBrand: () => Promise<void>;
}

export const useBrandStore = create<BrandState>((set, get) => ({
  brand: defaultBrand,
  loaded: false,
  fetchBrand: async () => {
    if (get().loaded) return;
    try {
      const brand = await authApi.brand();
      // found:false means no tenant matched this host — the backend still
      // returns a placeholder label, but it is not authoritative. Keep the
      // frontend default so the UI does not flash a confusing brand name.
      if (!brand.found) {
        set({ brand: defaultBrand, loaded: true });
        document.title = defaultBrand.label;
        return;
      }
      set({ brand, loaded: true });
      if (brand.label) {
        document.title = `${brand.label}`;
      }
    } catch {
      set({ brand: defaultBrand, loaded: true });
    }
  },
}));
