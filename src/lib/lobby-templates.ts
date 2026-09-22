/**
 * Portal layout templates — full visual skins for the player-facing portal.
 *
 * A template is a second, independent theming axis next to the accent presets
 * in lib/theme-presets.ts:
 *
 *   preset   -> WHICH hue the accent is (gold, emerald, ...)
 *   template -> HOW the portal looks (shape language, texture, type, glow)
 *
 * Every template restyles the exact same DOM. There is no per-template JSX,
 * so switching one on is a single attribute write:
 *
 *   <html data-portal-template="neon">
 *
 * The active key rides in branding theme JSON as `{ "template": "<key>" }`
 * and is served to the portal via GET /api/brand, exactly like `preset`.
 * Each template ships a default accent (declared in its SCSS partial) that a
 * tenant preset overrides when one is configured.
 */

export interface LobbyTemplate {
  /** Human label for pickers. */
  label: string;
  /** One-line pitch shown in the preview dock. */
  tagline: string;
  /** Preset key that best matches the template's own palette. */
  recommendedPreset: string;
}

export const LOBBY_TEMPLATES: Record<string, LobbyTemplate> = {
  classic: {
    label: "Classic Cinema",
    tagline: "Netflix-style dark lobby — the current production look.",
    recommendedPreset: "gold",
  },
  neon: {
    label: "Neon Arcade",
    tagline: "Cyberpunk night club: magenta-cyan glow, grid horizon, arcade type.",
    recommendedPreset: "amethyst",
  },
  luxe: {
    label: "Velvet Royale",
    tagline: "High-roller lounge: wine velvet, champagne gold, serif display.",
    recommendedPreset: "gold",
  },
  aurora: {
    label: "Aurora Glass",
    tagline: "Frosted glass over drifting aurora light — soft, airy, mobile-first.",
    recommendedPreset: "sapphire",
  },
};

export const DEFAULT_TEMPLATE_KEY = "classic";

/** Unknown/absent keys fall back to classic so bad JSON can never blank the UI. */
export function resolveTemplateKey(key: string | undefined | null): string {
  return key && LOBBY_TEMPLATES[key] ? key : DEFAULT_TEMPLATE_KEY;
}
