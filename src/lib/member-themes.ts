export type MemberThemeMode = "dark" | "light";

export interface MemberThemeDefinition {
  id: string;
  label: string;
  mode: MemberThemeMode;
  description: string;
  swatch: string;
}

export const MEMBER_THEMES: readonly MemberThemeDefinition[] = [
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

export const DEFAULT_MEMBER_THEME_ID = "vexynix-aurora";

export function resolveMemberThemeId(value: string | null | undefined): string {
  const theme = MEMBER_THEMES.find((item) => item.id === value);
  return theme?.id ?? DEFAULT_MEMBER_THEME_ID;
}

export function getMemberTheme(value: string | null | undefined): MemberThemeDefinition {
  const themeId = resolveMemberThemeId(value);
  const theme = MEMBER_THEMES.find((item) => item.id === themeId);
  if (!theme) throw new Error(`Unknown member theme: ${themeId}`);
  return theme;
}
