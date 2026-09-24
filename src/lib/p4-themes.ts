export type P4ThemeMode = "dark" | "light";

export interface P4ThemeDefinition {
  id: string;
  label: string;
  mode: P4ThemeMode;
  description: string;
  swatch: string;
}

export const P4_THEMES: readonly P4ThemeDefinition[] = [
  {
    id: "vexynix-aurora",
    label: "Vexynix Aurora",
    mode: "light",
    description: "Tema owner saat ini",
    swatch: "linear-gradient(135deg, #cdbff6, #ffdeda)",
  },
  {
    id: "midnight-neon",
    label: "Midnight Neon",
    mode: "dark",
    description: "Malam dengan aksen neon",
    swatch: "linear-gradient(135deg, #ec4cff, #00b0fc)",
  },
  {
    id: "ocean-blue-dream",
    label: "Ocean Blue Dream",
    mode: "dark",
    description: "Biru laut yang dalam dan modern",
    swatch: "linear-gradient(135deg, #035cc2, #76d5fe)",
  },
  {
    id: "forest-adventure",
    label: "Forest Adventure",
    mode: "light",
    description: "Hijau natural dengan surface terang",
    swatch: "linear-gradient(135deg, #339989, #7de2d1)",
  },
  {
    id: "sunset-bloom",
    label: "Sunset Bloom",
    mode: "light",
    description: "Lavender hangat dengan aksen coral",
    swatch: "linear-gradient(135deg, #b34bd3, #f06b9a)",
  },
] as const;

export const DEFAULT_P4_THEME_ID = "vexynix-aurora";

export function resolveP4ThemeId(value: string | null | undefined): string {
  const theme = P4_THEMES.find((item) => item.id === value);
  return theme?.id ?? DEFAULT_P4_THEME_ID;
}

export function getP4Theme(value: string | null | undefined): P4ThemeDefinition {
  const themeId = resolveP4ThemeId(value);
  const theme = P4_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`Unknown P4 theme: ${themeId}`);
  return theme;
}
