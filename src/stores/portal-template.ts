/**
 * Portal template preview store.
 *
 * The live template comes from the tenant's branding JSON. This store holds an
 * optional *local* override so a template (and accent preset) can be previewed
 * without touching the tenant record — used by the preview dock and by
 * ?template=/?preset= deep links when sharing a look with someone.
 *
 * The override lives in sessionStorage: it survives client-side navigation and
 * a refresh, and disappears when the tab closes. It never leaves the browser.
 */
import { create } from "zustand";
import { LOBBY_TEMPLATES } from "@/lib/lobby-templates";
import { THEME_PRESETS } from "@/lib/theme-presets";

const TEMPLATE_STORAGE_KEY = "portal-preview-template";
const PRESET_STORAGE_KEY = "portal-preview-preset";
const PREVIEW_STORAGE_KEY = "portal-preview-on";

/** sessionStorage throws in private-mode Safari — never let that break boot. */
function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore — the override is a convenience, not state we must keep.
  }
}

interface PortalTemplateState {
  /** null = follow the tenant's branding. */
  templateOverride: string | null;
  presetOverride: string | null;
  /**
   * This tab asked for a preview at least once (?template= / ?preset=). It is
   * what reveals the preview dock outside development — no server env needed,
   * which matters because the deployed container only gets *runtime* env and a
   * browser bundle cannot read that.
   */
  previewEnabled: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setTemplateOverride: (key: string | null) => void;
  setPresetOverride: (key: string | null) => void;
}

export const usePortalTemplateStore = create<PortalTemplateState>((set) => ({
  templateOverride: null,
  presetOverride: null,
  previewEnabled: false,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    // A URL parameter wins over — and replaces — whatever the tab remembered.
    const fromUrl = (param: string, valid: Record<string, unknown>) => {
      const value = params.get(param);
      return value && value in valid ? value : null;
    };

    const urlTemplate = fromUrl("template", LOBBY_TEMPLATES);
    const urlPreset = fromUrl("preset", THEME_PRESETS);

    if (urlTemplate) writeStored(TEMPLATE_STORAGE_KEY, urlTemplate);
    if (urlPreset) writeStored(PRESET_STORAGE_KEY, urlPreset);

    // The marker outlives a Reset, so clearing the overrides does not also take
    // the dock away mid-comparison.
    if (urlTemplate || urlPreset) writeStored(PREVIEW_STORAGE_KEY, "1");

    set({
      templateOverride: urlTemplate ?? readStored(TEMPLATE_STORAGE_KEY),
      presetOverride: urlPreset ?? readStored(PRESET_STORAGE_KEY),
      previewEnabled:
        Boolean(urlTemplate || urlPreset) ||
        readStored(PREVIEW_STORAGE_KEY) === "1",
      hydrated: true,
    });
  },

  setTemplateOverride: (key) => {
    writeStored(TEMPLATE_STORAGE_KEY, key);
    set({ templateOverride: key });
  },

  setPresetOverride: (key) => {
    writeStored(PRESET_STORAGE_KEY, key);
    set({ presetOverride: key });
  },
}));
