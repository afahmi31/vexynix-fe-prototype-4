"use client";

/**
 * Applies the tenant's visual theme to the document root.
 *
 * Two independent axes, both delivered in the brand's theme JSON:
 *   theme.preset   -> accent hue     -> --portal-accent-* custom properties
 *   theme.template -> visual skin    -> <html data-portal-template="...">
 *
 * The preview store may override either one locally (preview dock / ?template=
 * deep link); an override always wins over the tenant value.
 *
 * Accent properties are only written when a preset is actually configured.
 * With none, they are cleared so the active template's own default accent
 * (declared in styles/portal/templates/_<key>.scss) shows through instead of
 * an inline style pinning every skin to gold.
 *
 * Renders nothing.
 */
import { useEffect } from "react";
import { useBrandStore } from "@/stores/brand";
import { usePortalTemplateStore } from "@/stores/portal-template";
import { THEME_PRESETS } from "@/lib/theme-presets";
import { resolveTemplateKey } from "@/lib/lobby-templates";

const ACCENT_PROPS = [
  "--portal-accent-start",
  "--portal-accent-end",
  "--portal-accent-rgb",
  "--portal-accent-text",
] as const;

/** Reads a string field out of the loosely-typed brand theme JSON. */
function themeKey(
  theme: Record<string, string | undefined> | undefined,
  field: string,
): string | undefined {
  const value = theme?.[field];
  return typeof value === "string" ? value : undefined;
}

export function ThemeApplier(): null {
  const brand = useBrandStore((s) => s.brand);
  const loaded = useBrandStore((s) => s.loaded);
  const hydrate = usePortalTemplateStore((s) => s.hydrate);
  const hydrated = usePortalTemplateStore((s) => s.hydrated);
  const templateOverride = usePortalTemplateStore((s) => s.templateOverride);
  const presetOverride = usePortalTemplateStore((s) => s.presetOverride);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!loaded || !hydrated) return;

    const templateKey = resolveTemplateKey(
      templateOverride ?? themeKey(brand.theme, "template"),
    );
    document.documentElement.dataset.portalTemplate = templateKey;

    const presetKey = presetOverride ?? themeKey(brand.theme, "preset");
    const preset = presetKey ? THEME_PRESETS[presetKey] : undefined;
    const root = document.documentElement.style;

    if (!preset) {
      for (const prop of ACCENT_PROPS) root.removeProperty(prop);
      return;
    }

    root.setProperty("--portal-accent-start", preset.accentStart);
    root.setProperty("--portal-accent-end", preset.accentEnd);
    root.setProperty("--portal-accent-rgb", preset.accentRgb);
    root.setProperty("--portal-accent-text", preset.accentText);
  }, [loaded, hydrated, brand, templateOverride, presetOverride]);

  return null;
}
