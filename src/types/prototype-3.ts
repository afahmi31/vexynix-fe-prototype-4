import type { Game } from "@/types/api";

export type Prototype3BadgeKind = "new" | "top10" | "popular" | "demo" | "editorial";

export type Prototype3BadgeTone = "accent" | "success" | "warning" | "neutral";

export interface Prototype3GameBadge {
  kind: Prototype3BadgeKind;
  label: string;
  tone: Prototype3BadgeTone;
  rank?: number;
  source: "catalog" | "mock-editorial";
}

export interface Prototype3GamePresentation {
  game_id: string;
  poster_url?: string;
  backdrop_url?: string;
  tagline?: string;
  synopsis?: string;
  badges?: Prototype3GameBadge[];
  related_game_ids?: string[];
}

export type Prototype3ShelfType = "top10" | "demo" | "category" | "vendor" | "editorial";

export interface Prototype3Shelf {
  id: string;
  title: string;
  icon: string;
  type: Prototype3ShelfType;
  category?: string;
  vendor_id?: string;
  limit: number;
}

export interface Prototype3Promo {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta_label: string;
  cta_action: "register" | "deposit" | "lucky-pick";
  tone: "rose" | "cyan" | "gold";
  image_url?: string;
}

export interface Prototype3FeatureConfig {
  id: "spinner" | "lucky-pick";
  title: string;
  description: string;
  action_label: string;
  image_url: string;
  enabled: boolean;
}

export interface Prototype3Theme {
  name: string;
  background: string;
  surface: string;
  accent: string;
  accent_soft: string;
}

export interface Prototype3LobbyConfig {
  hero_game_ids: string[];
  shelves: Prototype3Shelf[];
  promos: Prototype3Promo[];
  features: {
    spinner: Prototype3FeatureConfig;
    lucky_pick: Prototype3FeatureConfig;
  };
  theme: Prototype3Theme;
}

export interface Prototype3MockData {
  games: Game[];
  presentations: Record<string, Prototype3GamePresentation>;
  vendors: Array<{
    id: string;
    name: string;
    status: string;
    enabled: boolean;
  }>;
  lobby: Prototype3LobbyConfig;
}
