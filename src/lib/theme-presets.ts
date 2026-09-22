/**
 * Portal theme presets — named accent palettes a merchant can pick in the BO
 * (admin-fe profile page keeps a mirror of this list for its picker; keep the
 * preset keys in sync). The selected key rides in branding theme JSON as
 * `{ "preset": "<key>" }` and is served to the portal via GET /api/brand.
 *
 * A preset only moves the four --portal-accent-* custom properties declared in
 * styles/portal/_base.scss; dark surfaces stay constant across presets.
 */

export interface ThemePreset {
  /** Human label for pickers/debugging. */
  label: string;
  /** Gradient start — also the flat accent (--portal-accent-start / --bs-primary). */
  accentStart: string;
  /** Gradient end (--portal-accent-end). */
  accentEnd: string;
  /** rgb triplet of accentStart, consumed by rgba(var(--portal-accent-rgb), a). */
  accentRgb: string;
  /** Text color ON accent surfaces — dark for light accents, white for deep ones. */
  accentText: string;
}

const GOLD: ThemePreset = {
  label: "Gold",
  accentStart: "#ffd700",
  accentEnd: "#ff9500",
  accentRgb: "255, 215, 0",
  accentText: "#14110a",
};

export const THEME_PRESETS: Record<string, ThemePreset> = {
  gold: GOLD,
  emerald: {
    label: "Emerald",
    accentStart: "#00e07f",
    accentEnd: "#00a35c",
    accentRgb: "0, 224, 127",
    accentText: "#06130c",
  },
  sapphire: {
    label: "Sapphire",
    accentStart: "#5aa9ff",
    accentEnd: "#2f6bff",
    accentRgb: "90, 169, 255",
    accentText: "#081326",
  },
  ruby: {
    label: "Ruby",
    accentStart: "#ff6b6b",
    accentEnd: "#e03131",
    accentRgb: "255, 107, 107",
    accentText: "#2b0808",
  },
  amethyst: {
    label: "Amethyst",
    accentStart: "#c084fc",
    accentEnd: "#8b5cf6",
    accentRgb: "192, 132, 252",
    accentText: "#170b2b",
  },
};

export const DEFAULT_PRESET_KEY = "gold";

/** Unknown/absent keys fall back to gold so a bad JSON value can never blank the UI. */
export function resolvePreset(key: string | undefined): ThemePreset {
  return (key !== undefined ? THEME_PRESETS[key] : undefined) ?? GOLD;
}
