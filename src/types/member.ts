import type { Game } from "@/types/api";

export type MemberBadgeKind = "new" | "top10" | "popular" | "demo" | "editorial";

export type MemberBadgeTone = "accent" | "success" | "warning" | "neutral";

export interface MemberGameBadge {
  kind: MemberBadgeKind;
  label: string;
  tone: MemberBadgeTone;
  rank?: number;
  source: "catalog" | "mock-editorial";
}

export interface MemberGamePresentation {
  game_id: string;
  poster_url?: string;
  backdrop_url?: string;
  tagline?: string;
  synopsis?: string;
  badges?: MemberGameBadge[];
  related_game_ids?: string[];
}

export type MemberShelfType = "top10" | "demo" | "category" | "vendor" | "editorial";

export interface MemberShelf {
  id: string;
  title: string;
  icon: string;
  type: MemberShelfType;
  category?: string;
  vendor_id?: string;
  limit: number;
}

export interface MemberPromo {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_action: "register" | "deposit" | "lucky-pick";
  tone: "rose" | "cyan" | "gold";
  image_url?: string;
}

export interface MemberFeatureConfig {
  id: "spinner" | "lucky-pick";
  title: string;
  description: string;
  action_label: string;
  image_url: string;
  enabled: boolean;
}

export interface MemberTheme {
  name: string;
  background: string;
  surface: string;
  accent: string;
  accent_soft: string;
}

export interface MemberLobbyConfig {
  hero_game_ids: string[];
  shelves: MemberShelf[];
  promos: MemberPromo[];
  features: {
    spinner: MemberFeatureConfig;
    lucky_pick: MemberFeatureConfig;
  };
  theme: MemberTheme;
}

export interface MemberMockData {
  games: Game[];
  presentations: Record<string, MemberGamePresentation>;
  vendors: Array<{
    id: string;
    name: string;
    status: string;
    enabled: boolean;
  }>;
  lobby: MemberLobbyConfig;
}
