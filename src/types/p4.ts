import type { Game } from "@/types/api";

export type P4BadgeKind = "new" | "top10" | "popular" | "demo" | "editorial";

export type P4BadgeTone = "accent" | "success" | "warning" | "neutral";

export interface P4GameBadge {
  kind: P4BadgeKind;
  label: string;
  tone: P4BadgeTone;
  rank?: number;
  source: "catalog" | "mock-editorial";
}

export interface P4GamePresentation {
  game_id: string;
  poster_url?: string;
  backdrop_url?: string;
  tagline?: string;
  synopsis?: string;
  badges?: P4GameBadge[];
  related_game_ids?: string[];
}

export type P4ShelfType = "top10" | "demo" | "category" | "vendor" | "editorial";

export interface P4Shelf {
  id: string;
  title: string;
  icon: string;
  type: P4ShelfType;
  category?: string;
  vendor_id?: string;
  limit: number;
}

export interface P4Promo {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_action: "register" | "deposit" | "lucky-pick";
  tone: "rose" | "cyan" | "gold";
  image_url?: string;
}

export interface P4FeatureConfig {
  id: "spinner" | "lucky-pick";
  title: string;
  description: string;
  action_label: string;
  image_url: string;
  enabled: boolean;
}

export interface P4Theme {
  name: string;
  background: string;
  surface: string;
  accent: string;
  accent_soft: string;
}

export interface P4LobbyConfig {
  hero_game_ids: string[];
  shelves: P4Shelf[];
  promos: P4Promo[];
  features: {
    spinner: P4FeatureConfig;
    lucky_pick: P4FeatureConfig;
  };
  theme: P4Theme;
}

export interface P4MockData {
  games: Game[];
  presentations: Record<string, P4GamePresentation>;
  vendors: Array<{
    id: string;
    name: string;
    status: string;
    enabled: boolean;
  }>;
  lobby: P4LobbyConfig;
}
