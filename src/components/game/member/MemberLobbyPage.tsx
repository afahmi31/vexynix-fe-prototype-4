"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, useVendors } from "@/hooks/useCatalog";
import { useActivityFeeds } from "@/hooks/useActivityFeeds";
import { useLaunchGame } from "@/hooks/useLaunchGame";
import { useActionDisabled } from "@/hooks/useTransactionLock";
import { useAuthModalStore } from "@/stores/auth-modal";
import { MOCK_CATALOG, MOCK_VENDORS } from "@/mocks/member";
import type { ActivityFeedsRes, Game, Vendor } from "@/types/api";
import { NEXT_PARAM, safeNextPath } from "@/lib/auth-redirect";
import { MemberGameCard } from "@/components/game/member/MemberGameCard";
import { MemberHoverPreviewProvider, useMemberHoverPreview } from "@/components/game/member/MemberHoverPreview";

const HERO_BACKDROP = "/assets/member/heroes/neon-racer-sunset.png";

const CTA_ARTWORK = {
  discover: "/assets/member/promotions/discover-games.png",
  random: "/assets/member/promotions/random-game.png",
  catalog: "/assets/member/promotions/new-games-banner.png",
} as const;

const HERO_FALLBACK_SLIDES = [
  {
    gameId: "neon-racer",
    title: "Neon Racer",
    backdrop: HERO_BACKDROP,
    meta: "Arcade  ·  Habanero  ·  Gratis Demo",
    description: "Kejar ritme kota dan taklukkan setiap tikungan.",
  },
  {
    gameId: "solar-riches",
    title: "Solar Riches",
    backdrop: "/assets/member/heroes/solar-riches-backdrop.png",
    meta: "Slot  ·  PG Soft  ·  Gratis Demo",
    description: "Temukan kuil emas dan nikmati putaran bertema matahari.",
  },
  {
    gameId: "velvet-roulette",
    title: "Velvet Roulette",
    backdrop: "/assets/member/heroes/velvet-roulette-backdrop.png",
    meta: "Live Casino  ·  Evolution  ·  Live Play",
    description: "Nikmati suasana meja malam yang elegan.",
  },
  {
    gameId: "deep-sea-odyssey",
    title: "Deep Sea Odyssey",
    backdrop: "/assets/member/heroes/deep-sea-odyssey-backdrop.png",
    meta: "Tembak Ikan  ·  Naga Games  ·  Gratis Demo",
    description: "Mulai petualangan di kedalaman yang penuh warna.",
  },
] as const;

const FREE_GAME_PRIORITY_IDS = [
  "pp-1301",
  "bng-1027",
  "ds-1001",
  "fuma-1",
  "habanero-acesandeights100hand",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: "Semua Game",
  slot: "Slot",
  live: "Live Casino",
  table: "Table Games",
  "table-game": "Table Game",
  fish: "Tembak Ikan",
  sports: "Sports",
  arcade: "Arcade",
  crash: "Crash",
  bingo: "Bingo",
  casino: "Casino",
  card: "Card Games",
  animal: "Animal",
  lobby: "Lobby",
  baccarat: "Baccarat",
};

const PROVIDER_FEATURES = [
  {
    id: "pragmaticplay",
    name: "PRAGMATIC PLAY",
    description: "Game populer untuk dimainkan kapan saja.",
    icon: "fa-solid fa-sun",
    featured: true,
    imageGameId: "neon-racer",
  },
  {
    id: "evolution",
    name: "Evolution",
    description: "Pilihan permainan live yang selalu menarik.",
    icon: "fa-solid fa-dice-d20",
    featured: true,
    imageGameId: "velvet-roulette",
  },
  {
    id: "pgsoft",
    name: "PG Soft",
    description: "Game kreatif dengan pengalaman seru.",
    icon: "fa-solid fa-puzzle-piece",
    featured: false,
    imageGameId: "solar-riches",
  },
  {
    id: "habanero",
    name: "Habanero",
    description: "Ragam game yang selalu seru dimainkan.",
    icon: "fa-solid fa-fire-flame-curved",
    featured: false,
    imageGameId: "lucky-fortune-cat",
  },
  {
    id: "naga",
    name: "Naga Games",
    description: "Pilihan game berkualitas untuk semua.",
    icon: "fa-solid fa-dragon",
    featured: false,
    imageGameId: "deep-sea-odyssey",
  },
] as const;

type MemberProviderFeature = (typeof PROVIDER_FEATURES)[number] & {
  image?: string;
};

const ACTIVITY_SETS = {
  latest: [
    ["Velvet Roulette", "Raka88", "1.42x", "+IDR 458.20"],
    ["Neon Racer", "MawarSakti", "1.20x", "+IDR 214.03"],
    ["Solar Riches", "OceanHunter", "0.00x", "-IDR 13,513.51"],
    ["Deep Sea Odyssey", "LautBiru", "1.78x", "+IDR 329.80"],
    ["Sugar Rush 1000", "BungaMalam", "1.34x", "+IDR 742.16"],
    ["Lightning Roulette", "NonaMalam", "0.00x", "-IDR 6,248.90"],
    ["Gates of Olympus", "Jackpot88", "1.92x", "+IDR 1,250.00"],
    ["Starlight Princess", "Bintang777", "0.00x", "-IDR 4,120.40"],
    ["Fortune Ox", "SultanMuda", "1.16x", "+IDR 86.40"],
    ["Lucky Fortune Cat", "KucingEmas", "0.00x", "-IDR 9,980.00"],
    ["Phoenix Rises", "Phoenix88", "1.74x", "+IDR 514.75"],
    ["Mystic Potions", "MysticGirl", "0.00x", "-IDR 1,790.16"],
    ["Reel Royale", "ReelMaster", "1.23x", "+IDR 388.40"],
    ["Candy Superwin", "CandyKing", "1.61x", "+IDR 620.55"],
    ["Fortune of Giza", "GizaHunter", "0.00x", "-IDR 3,580.33"],
    ["Mahjong Ways 2", "Tiles88", "1.45x", "+IDR 910.20"],
    ["Sweet Bonanza", "Bonanza77", "0.00x", "-IDR 7,159.89"],
    ["Wanted Dead or a Wild", "WildWest99", "1.28x", "+IDR 175.00"],
  ],
  bigWins: [
    ["Gates of Olympus", "Jackpot88", "1.92x", "+IDR 1,250.00"],
    ["Sugar Rush 1000", "BungaMalam", "1.34x", "+IDR 742.16"],
    ["Phoenix Rises", "Phoenix88", "1.74x", "+IDR 514.75"],
    ["Velvet Roulette", "Raka88", "1.42x", "+IDR 458.20"],
    ["Deep Sea Odyssey", "LautBiru", "1.78x", "+IDR 329.80"],
  ],
  leaderboard: [
    ["Solar Riches", "OceanHunter", "Peringkat 1", "Menang"],
    ["Neon Racer", "MawarSakti", "Peringkat 2", "Menang"],
    ["Velvet Roulette", "Raka88", "Peringkat 3", "Menang"],
    ["Gates of Olympus", "Jackpot88", "Peringkat 4", "Menang"],
    ["Starlight Princess", "Bintang777", "Peringkat 5", "Menang"],
    ["Deep Sea Odyssey", "LautBiru", "Peringkat 6", "Menang"],
    ["Sugar Rush 1000", "BungaMalam", "Peringkat 7", "Menang"],
    ["Lightning Roulette", "NonaMalam", "Peringkat 8", "Menang"],
    ["Fortune Ox", "SultanMuda", "Peringkat 9", "Menang"],
    ["Lucky Fortune Cat", "KucingEmas", "Peringkat 10", "Menang"],
    ["Phoenix Rises", "Phoenix88", "Peringkat 11", "Menang"],
    ["Mystic Potions", "MysticGirl", "Peringkat 12", "Menang"],
    ["Reel Royale", "ReelMaster", "Peringkat 13", "Menang"],
    ["Candy Superwin", "CandyKing", "Peringkat 14", "Menang"],
    ["Fortune of Giza", "GizaHunter", "Peringkat 15", "Menang"],
    ["Mahjong Ways 2", "Tiles88", "Peringkat 16", "Menang"],
    ["Sweet Bonanza", "Bonanza77", "Peringkat 17", "Menang"],
    ["Wanted Dead or a Wild", "WildWest99", "Peringkat 18", "Menang"],
  ],
} as const;

type ActivityTab = keyof typeof ACTIVITY_SETS;

interface ActivityDisplayRow {
  primary: string;
  player: string;
  metric: string;
  result: string;
}

const ACTIVITY_COLUMN_LABELS: Record<ActivityTab, readonly [string, string, string, string]> = {
  latest: ["Game", "Player", "Multiplier", "Profit"],
  bigWins: ["Game", "Player", "Multiplier", "Profit"],
  leaderboard: ["Peringkat", "Player", "Total Taruhan", "Profit"],
};

const ACTIVITY_FALLBACK_ROWS: Record<ActivityTab, ActivityDisplayRow[]> = {
  latest: ACTIVITY_SETS.latest.map(([primary, player, metric, result]) => ({
    primary,
    player,
    metric,
    result,
  })),
  bigWins: ACTIVITY_SETS.bigWins.map(([primary, player, metric, result]) => ({
    primary,
    player,
    metric,
    result,
  })),
  leaderboard: ACTIVITY_SETS.leaderboard.map(([primary, player, metric, result]) => ({
    primary,
    player,
    metric,
    result,
  })),
};

const IDR_NUMBER_FORMATTER = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function formatIdr(value: number): string {
  return `Rp ${IDR_NUMBER_FORMATTER.format(Math.abs(value))}`;
}

function formatSignedIdr(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatIdr(value)}`;
}

function activityRowsFor(tab: ActivityTab, feeds?: ActivityFeedsRes): ActivityDisplayRow[] {
  if (!feeds) return ACTIVITY_FALLBACK_ROWS[tab];

  if (tab === "leaderboard") {
    return feeds.leaderboard.rows.map((row) => ({
      primary: `Peringkat ${row.rank}`,
      player: row.player,
      metric: formatIdr(row.wager),
      result: formatSignedIdr(row.win),
    }));
  }

  const feed = tab === "latest" ? feeds.latestBets : feeds.bigWins;
  return feed.rows.map((row) => ({
    primary: row.game ?? "Game tidak tersedia",
    player: row.player,
    metric: `${row.multiplier.toFixed(2)}x`,
    result: formatSignedIdr(row.win),
  }));
}

type CatalogProviderOption = {
  id: string;
  name: string;
  count: number;
};

type CatalogCategoryOption = {
  id: string;
  label: string;
};

const PROVIDER_GAME_LIMIT = 18;
const CATALOG_PAGE_SIZE = 25;

function activeGamesFrom(data: { games?: Game[] } | undefined): Game[] {
  const source = data?.games?.length ? data.games : MOCK_CATALOG;
  return source.filter((game) => game.status === "active");
}

function vendorsFrom(data: { vendors?: Vendor[] } | undefined): Vendor[] {
  return data?.vendors?.length ? data.vendors : MOCK_VENDORS;
}

function normalizeCatalogCategory(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function catalogCategoryLabel(value: string): string {
  const categoryId = normalizeCatalogCategory(value);
  const knownLabel = CATEGORY_LABELS[categoryId];
  if (knownLabel) return knownLabel;

  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function gamesByIds(games: Game[], ids: string[], fallbackCount: number): Game[] {
  const byId = new Map(games.map((game) => [game.id, game]));
  const picked = ids.map((id) => byId.get(id)).filter((game): game is Game => Boolean(game));
  const pickedIds = new Set(picked.map((game) => game.id));
  const fallback = games.filter((game) => !pickedIds.has(game.id));
  return [...picked, ...fallback].slice(0, fallbackCount);
}

function gamesByStagingPopularOrder(games: Game[], vendors: Vendor[], limit: number): Game[] {
  const popularGames = games.filter((game) => game.is_popular);
  if (popularGames.length >= limit) return popularGames.slice(0, limit);

  const gamesWithImages = games.filter((game) => game.image_url);
  const sourceGames = gamesWithImages.length >= limit ? gamesWithImages : games;
  const gamesByVendor = new Map<string, Game[]>();

  sourceGames.forEach((game) => {
    const vendorGames = gamesByVendor.get(game.vendor_id) ?? [];
    vendorGames.push(game);
    gamesByVendor.set(game.vendor_id, vendorGames);
  });

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const vendorGroups = [...gamesByVendor.entries()].sort(([vendorA], [vendorB]) => {
    const detailsA = vendorById.get(vendorA);
    const detailsB = vendorById.get(vendorB);
    const orderA = detailsA?.sort_order ?? 100;
    const orderB = detailsB?.sort_order ?? 100;

    return orderA - orderB || (detailsA?.name ?? vendorA).localeCompare(detailsB?.name ?? vendorB);
  });

  const selectedGames: Game[] = [];
  for (let index = 0; selectedGames.length < limit; index += 1) {
    let addedGame = false;

    for (const [, vendorGames] of vendorGroups) {
      const game = vendorGames[index];
      if (!game) continue;

      selectedGames.push(game);
      addedGame = true;
      if (selectedGames.length >= limit) break;
    }

    if (!addedGame) break;
  }

  return selectedGames;
}

type RailDirection = "previous" | "next";

interface MemberRailArrowProps {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}

function MemberRailArrow({ direction, label, onClick }: MemberRailArrowProps) {
  const hoverPreview = useMemberHoverPreview();
  const dismissHoverPreview = () => hoverPreview?.dismissPreview();

  return (
    <button
      type="button"
      className={`member-rail-arrow member-rail-${direction}`}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerEnter={dismissHoverPreview}
      onPointerDown={(event) => {
        event.stopPropagation();
        dismissHoverPreview();
      }}
    >
      <i
        className={`fa-solid fa-chevron-${direction === "prev" ? "left" : "right"}`}
        aria-hidden="true"
      />
    </button>
  );
}

function useMemberHorizontalRail(itemCount: number) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    rail.scrollLeft = 0;

    let frame = 0;
    const updateScrollControls = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
        const scrollLeft = rail.scrollLeft;
        setCanScrollPrev(scrollLeft > 2);
        setCanScrollNext(maxScrollLeft - scrollLeft > 2);
      });
    };

    updateScrollControls();
    rail.addEventListener("scroll", updateScrollControls, { passive: true });
    window.addEventListener("resize", updateScrollControls);

    const resizeObserver = new ResizeObserver(updateScrollControls);
    resizeObserver.observe(rail);

    return () => {
      window.cancelAnimationFrame(frame);
      rail.removeEventListener("scroll", updateScrollControls);
      window.removeEventListener("resize", updateScrollControls);
      resizeObserver.disconnect();
    };
  }, [itemCount]);

  const scrollRail = (direction: RailDirection) => {
    const rail = railRef.current;
    if (!rail) return;

    const distance = Math.max(180, rail.clientWidth * 0.72);
    rail.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
  };

  return { railRef, canScrollPrev, canScrollNext, scrollRail };
}

const TOP_FIVE_VENDOR_OVERRIDES: Record<string, string> = {
  "wanted-dead-or-a-wild": "Hacksaw Gaming",
};

export default function MemberLobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const catalogQuery = useCatalog();
  const vendorsQuery = useVendors();
  const { data: catalogData } = catalogQuery;
  const { data: vendorsData } = vendorsQuery;
  const { data: activityFeeds } = useActivityFeeds();
  const { launch, launchDemo, launching, error: launchError, clearError } = useLaunchGame();
  const actionDisabled = useActionDisabled();
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const openRegister = useAuthModalStore((state) => state.openRegister);

  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("pragmaticplay");
  const [activityTab, setActivityTab] = useState<ActivityTab>("latest");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogProviders, setSelectedCatalogProviders] = useState<string[]>([]);
  const [isCatalogFilterOpen, setIsCatalogFilterOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const topFeatureGridRef = useRef<HTMLElement>(null);
  const isExternalMode = process.env.NEXT_PUBLIC_PROTOTYPE_MODE === "external";
  const isExternalDataReady = catalogQuery.isSuccess && vendorsQuery.isSuccess;
  const hasExternalDataError = catalogQuery.isError || vendorsQuery.isError;

  const activeGames = useMemo(() => activeGamesFrom(catalogData), [catalogData]);
  const vendors = useMemo(() => vendorsFrom(vendorsData), [vendorsData]);
  const hasLiveCatalog = Boolean(catalogData?.games?.length);
  const stagingPopularGames = useMemo(
    () => gamesByStagingPopularOrder(activeGames, vendors, 10),
    [activeGames, vendors]
  );
  const vendorName = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? id;
  const heroGames = useMemo(() => {
    if (hasLiveCatalog) return stagingPopularGames.slice(0, 5);

    return HERO_FALLBACK_SLIDES.map((slide) =>
      activeGames.find((game) => game.id === slide.gameId)
    ).filter((game): game is Game => Boolean(game));
  }, [activeGames, hasLiveCatalog, stagingPopularGames]);
  const providerFeatures = useMemo<MemberProviderFeature[]>(
    () =>
      PROVIDER_FEATURES.map((provider) => ({
        ...provider,
        image:
          activeGames.find((game) => game.id === provider.imageGameId)?.image_url ??
          MOCK_CATALOG.find((game) => game.id === provider.imageGameId)?.image_url,
      })),
    [activeGames]
  );

  const requestedCategory = searchParams.get("category") ?? "home";
  const category = normalizeCatalogCategory(requestedCategory);
  const isCatalogView = requestedCategory !== "home";

  useEffect(() => {
    if (isCatalogView || heroGames.length < 2) return;

    const timer = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroGames.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [heroGames.length, isCatalogView]);

  useEffect(() => {
    if (heroSlideIndex < heroGames.length) return;
    setHeroSlideIndex(0);
  }, [heroGames.length, heroSlideIndex]);

  useEffect(() => {
    if (isCatalogView) return;

    const topFeatureGrid = topFeatureGridRef.current;
    const topFiveGrid = topFeatureGrid?.querySelector<HTMLElement>(".member-top-five-grid");
    if (!topFeatureGrid || !topFiveGrid) return;

    let frame = 0;
    const syncPosterHeight = () => {
      topFeatureGrid.style.removeProperty("--member-poster-height");
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const topFiveCard = topFiveGrid.querySelector<HTMLElement>(".member-game-card-art");
        if (!topFiveCard) return;

        topFeatureGrid.style.setProperty(
          "--member-poster-height",
          `${topFiveCard.getBoundingClientRect().height}px`
        );
      });
    };

    syncPosterHeight();
    window.addEventListener("resize", syncPosterHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPosterHeight);
      topFeatureGrid.style.removeProperty("--member-poster-height");
    };
  }, [isCatalogView, activeGames.length]);

  useEffect(() => {
    if (!isCatalogFilterOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCatalogFilterOpen]);

  useEffect(() => {
    if (!isCatalogView) setIsCatalogFilterOpen(false);
  }, [isCatalogView]);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (!auth) return;

    if (auth === "login") {
      openLogin({
        registered: searchParams.get("registered") === "1",
        next: safeNextPath(searchParams.get(NEXT_PARAM)),
      });
    }
    if (auth === "register") openRegister();
    window.history.replaceState({}, "", "/lobby");
  }, [openLogin, openRegister, searchParams]);

  useEffect(() => {
    if (!detailGame) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailGame(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailGame]);

  const heroGame = heroGames[heroSlideIndex] ?? heroGames[0];
  const fallbackHeroSlide =
    HERO_FALLBACK_SLIDES.find((slide) => slide.gameId === heroGame?.id) ?? HERO_FALLBACK_SLIDES[0];
  const heroSlide =
    hasLiveCatalog && heroGame
      ? {
          gameId: heroGame.id,
          title: heroGame.name,
          backdrop: heroGame.image_url ?? fallbackHeroSlide.backdrop,
          meta: `${catalogCategoryLabel(heroGame.category)}  ·  ${vendorName(
            heroGame.vendor_id
          )}  ·  ${heroGame.demo_supported ? "Gratis Demo" : "Main Sekarang"}`,
          description:
            heroGame.description ??
            `Mainkan ${heroGame.name} dari ${vendorName(heroGame.vendor_id)}.`,
        }
      : fallbackHeroSlide;
  const heroPreviewGame =
    heroGames.length > 1 ? heroGames[(heroSlideIndex + 1) % heroGames.length] : undefined;
  const topFive = useMemo(() => {
    if (!hasLiveCatalog) {
      return gamesByIds(
        activeGames,
        [
          "gates-of-olympus",
          "sweet-bonanza",
          "wanted-dead-or-a-wild",
          "mahjong-ways-2",
          "solar-riches",
        ],
        5
      );
    }

    return stagingPopularGames.slice(0, 5);
  }, [activeGames, hasLiveCatalog, stagingPopularGames]);
  const featuredGames = useMemo(
    () =>
      gamesByIds(
        activeGames,
        [
          "lightning-roulette",
          "starlight-princess",
          "sugar-rush",
          "lucky-fortune-cat",
          "reel-royale",
          "fortune-of-giza",
          "phoenix-rises",
          "mystic-potions",
          "fortune-ox",
          "candy-superwin",
        ],
        10
      ),
    [activeGames]
  );
  const freeGames = useMemo(() => {
    const demoGames = activeGames.filter((game) => game.demo_supported);
    return gamesByIds(demoGames, [...FREE_GAME_PRIORITY_IDS], 20);
  }, [activeGames]);
  const providerCatalog = useMemo(() => {
    const providerGames = activeGames.filter((game) => game.vendor_id === selectedProvider);
    return providerGames.length ? providerGames : activeGames;
  }, [activeGames, selectedProvider]);
  const providerGames = useMemo(
    () => providerCatalog.slice(0, PROVIDER_GAME_LIMIT),
    [providerCatalog]
  );
  const catalogProviderOptions = useMemo<CatalogProviderOption[]>(() => {
    const counts = new Map<string, number>();
    activeGames.forEach((game) =>
      counts.set(game.vendor_id, (counts.get(game.vendor_id) ?? 0) + 1)
    );
    const preferredOrder: Record<string, number> = Object.fromEntries(
      PROVIDER_FEATURES.map((provider, index) => [provider.id, index])
    );

    return vendors
      .filter((vendor) => (counts.get(vendor.id) ?? 0) > 0)
      .sort(
        (a, b) =>
          (preferredOrder[a.id] ?? Number.MAX_SAFE_INTEGER) -
            (preferredOrder[b.id] ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
      )
      .map((vendor) => ({ id: vendor.id, name: vendor.name, count: counts.get(vendor.id) ?? 0 }));
  }, [activeGames, vendors]);
  const catalogCategoryOptions = useMemo<CatalogCategoryOption[]>(() => {
    const labels = new Map<string, string>();
    activeGames.forEach((game) => {
      const categoryId = normalizeCatalogCategory(game.category);
      if (categoryId && !labels.has(categoryId)) {
        labels.set(categoryId, catalogCategoryLabel(game.category));
      }
    });

    return [
      { id: "all", label: "Semua" },
      ...Array.from(labels.entries())
        .sort(([, firstLabel], [, secondLabel]) => firstLabel.localeCompare(secondLabel, "id"))
        .map(([id, label]) => ({ id, label })),
    ];
  }, [activeGames]);
  const categoryLabel =
    category === "all"
      ? (CATEGORY_LABELS.all ?? "Semua Game")
      : (catalogCategoryOptions.find((option) => option.id === category)?.label ??
        catalogCategoryLabel(category));
  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    const providerIds = new Set(selectedCatalogProviders);
    const indexedGames = activeGames
      .filter((game) => category === "all" || normalizeCatalogCategory(game.category) === category)
      .filter((game) => providerIds.size === 0 || providerIds.has(game.vendor_id))
      .filter((game) => !query || game.name.toLowerCase().includes(query));
    return indexedGames
      .map((game, index) => ({ game, index }))
      .sort((a, b) => {
        return (
          Number(b.game.is_popular) - Number(a.game.is_popular) ||
          Number(b.game.is_featured) - Number(a.game.is_featured) ||
          a.index - b.index
        );
      })
      .map(({ game }) => game);
  }, [activeGames, catalogSearch, category, selectedCatalogProviders]);
  const catalogPageCount = Math.max(1, Math.ceil(filteredCatalog.length / CATALOG_PAGE_SIZE));
  const visibleCatalogPage = Math.min(catalogPage, catalogPageCount);
  const paginatedCatalog = useMemo(
    () =>
      filteredCatalog.slice(
        (visibleCatalogPage - 1) * CATALOG_PAGE_SIZE,
        visibleCatalogPage * CATALOG_PAGE_SIZE
      ),
    [filteredCatalog, visibleCatalogPage]
  );

  useEffect(() => {
    setCatalogPage(1);
  }, [category, catalogSearch, selectedCatalogProviders]);

  useEffect(() => {
    setCatalogPage((currentPage) => Math.min(currentPage, catalogPageCount));
  }, [catalogPageCount]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCatalogPageChange = (nextPage: number) => {
    const page = Math.max(1, Math.min(nextPage, catalogPageCount));
    setCatalogPage(page);
    window.requestAnimationFrame(() => {
      document.getElementById("member-catalog")?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  const handleCatalogCategoryChange = (nextCategory: string) => {
    router.push(`/lobby?category=${nextCategory}#member-catalog`);
  };

  const handleCatalogProviderToggle = (providerId: string) => {
    setSelectedCatalogProviders((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    );
  };

  const handleCatalogReset = () => {
    setCatalogSearch("");
    setSelectedCatalogProviders([]);
    if (category !== "all") handleCatalogCategoryChange("all");
  };

  const handleLeaderboardCta = () => {
    setActivityTab("leaderboard");
    window.requestAnimationFrame(() => scrollTo("member-activity-title"));
  };

  const handleHeroLaunch = () => {
    if (!heroGame || actionDisabled) return;
    if (heroGame.demo_supported) void launchDemo(heroGame.id);
    else void launch(heroGame.id);
  };

  if (isExternalMode && !isExternalDataReady) {
    return (
      <>
        {hasExternalDataError ? (
          <div className="member-lobby">
            <div className="member-data-state" role="alert">
              Data game staging belum dapat dimuat.
            </div>
          </div>
        ) : (
          <MemberLobbySkeleton />
        )}
      </>
    );
  }

  return (
    <MemberHoverPreviewProvider
      disabled={actionDisabled}
      launching={launching}
      onInfo={setDetailGame}
      onLaunch={(id) => void launch(id)}
      onLaunchDemo={(id) => void launchDemo(id)}
      vendorName={vendorName}
    >
      <div className="member-lobby">
        {isCatalogView ? (
          <MemberCatalogView
            categoryLabel={categoryLabel}
            games={paginatedCatalog}
            totalGameCount={filteredCatalog.length}
            page={visibleCatalogPage}
            pageCount={catalogPageCount}
            search={catalogSearch}
            category={category}
            categoryOptions={catalogCategoryOptions}
            providerOptions={catalogProviderOptions}
            selectedProviders={selectedCatalogProviders}
            activityGames={activeGames}
            vendorName={vendorName}
            onSearch={setCatalogSearch}
            onCategoryChange={handleCatalogCategoryChange}
            onToggleProvider={handleCatalogProviderToggle}
            onReset={handleCatalogReset}
            isFilterOpen={isCatalogFilterOpen}
            onToggleFilter={() => setIsCatalogFilterOpen((isOpen) => !isOpen)}
            onCloseFilter={() => setIsCatalogFilterOpen(false)}
            onBrowse={() => scrollTo("member-catalog-grid")}
            onViewActivity={() => scrollTo("member-catalog-activity")}
            onPageChange={handleCatalogPageChange}
            activityFeeds={activityFeeds}
            onSelect={setDetailGame}
          />
        ) : (
          <>
            <section className="member-hero" aria-labelledby="member-hero-title">
              {heroSlide.backdrop.startsWith("/") ? (
                <Image
                  key={`hero-image-${heroSlide.gameId}`}
                  src={heroSlide.backdrop}
                  alt={heroSlide.title}
                  fill
                  priority
                  sizes="100vw"
                  className="member-hero-image"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`hero-image-${heroSlide.gameId}`}
                  src={heroSlide.backdrop}
                  alt={heroSlide.title}
                  className="member-hero-image"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    objectPosition: "right center",
                  }}
                />
              )}
              <div className="member-hero-overlay" aria-hidden="true" />
              <div
                className="member-hero-content"
                key={`hero-content-${heroSlide.gameId}`}
                aria-live="polite"
              >
                <h1 id="member-hero-title">{heroSlide.title}</h1>
                <p className="member-hero-meta">{heroSlide.meta}</p>
                <p className="member-hero-description">{heroSlide.description}</p>
                <div className="member-hero-actions">
                  <button
                    type="button"
                    className="member-button member-button--primary"
                    onClick={handleHeroLaunch}
                  >
                    <i className="fa-solid fa-play" aria-hidden="true" />
                    Mainkan Sekarang
                  </button>
                </div>
              </div>
              {heroPreviewGame?.image_url ? (
                <button
                  type="button"
                  className="member-hero-preview"
                  aria-label={`Tampilkan ${heroPreviewGame.name}`}
                  onClick={() => setHeroSlideIndex((current) => (current + 1) % heroGames.length)}
                >
                  <span className="member-hero-preview-label" aria-hidden="true">
                    Berikutnya
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroPreviewGame.image_url}
                    alt=""
                    className="member-hero-preview-image"
                    decoding="async"
                  />
                  <span className="member-hero-preview-copy" aria-hidden="true">
                    <strong>{heroPreviewGame.name}</strong>
                    <small>{vendorName(heroPreviewGame.vendor_id)}</small>
                  </span>
                </button>
              ) : null}
              <div className="member-hero-dots" role="tablist" aria-label="Pilihan hero">
                {heroGames.map((game, index) => (
                  <button
                    key={game.id}
                    type="button"
                    role="tab"
                    aria-label={`Tampilkan ${game.name}`}
                    aria-selected={heroSlideIndex === index}
                    className={heroSlideIndex === index ? "is-active" : undefined}
                    onClick={() => setHeroSlideIndex(index)}
                  />
                ))}
              </div>
            </section>

            <div className="member-primary-sections">
              <section
                ref={topFeatureGridRef}
                className="member-top-feature-grid"
                aria-label="Game pilihan utama"
              >
                <MemberTopFiveSection
                  games={topFive}
                  vendorName={vendorName}
                  onSelect={setDetailGame}
                />
                <MemberFeaturedSection
                  games={featuredGames}
                  vendorName={vendorName}
                  onSelect={setDetailGame}
                  onViewAll={() => router.push("/lobby?category=all#member-catalog")}
                />
              </section>

              <section className="member-activity-band" aria-label="Coba gratis dan aktivitas">
                <MemberTrendingSection
                  games={freeGames}
                  vendorName={vendorName}
                  onSelect={setDetailGame}
                  onViewAll={() => router.push("/lobby?category=all#member-catalog")}
                />
                <MemberActivityCard
                  games={activeGames}
                  feeds={activityFeeds}
                  activeTab={activityTab}
                  onTabChange={setActivityTab}
                  onViewAll={() => router.push("/lobby?category=all#member-catalog")}
                />
              </section>

              <MemberCtaSection
                onExplore={() => router.push("/lobby?category=all#member-catalog")}
                onRandomPick={() => {
                  if (!activeGames.length) return;
                  const randomIndex = Math.floor(Math.random() * activeGames.length);
                  const game = activeGames[randomIndex];
                  if (game) setDetailGame(game);
                }}
              />

              <MemberProviderSection
                providers={providerFeatures}
                selectedProvider={selectedProvider}
                providerGames={providerGames}
                providerGameCount={providerCatalog.length}
                vendorName={vendorName}
                onSelectProvider={(providerId) => {
                  setSelectedProvider(providerId);
                  window.requestAnimationFrame(() => scrollTo("member-provider-games"));
                }}
                onSelectGame={setDetailGame}
                onViewAll={() => router.push("/lobby?category=all#member-catalog")}
              />

              <MemberLeaderboardCta onViewRanking={handleLeaderboardCta} />
            </div>
          </>
        )}

        {launchError ? (
          <div className="member-launch-feedback" role="status">
            <span>{launchError}</span>
            <button type="button" onClick={clearError} aria-label="Tutup pesan">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {detailGame ? (
          <MemberGameDetail
            game={detailGame}
            vendorName={vendorName(detailGame.vendor_id)}
            launching={launching === detailGame.id}
            onClose={() => setDetailGame(null)}
            onLaunch={(game) => void launch(game.id)}
            onLaunchDemo={(game) => void launchDemo(game.id)}
          />
        ) : null}
      </div>
    </MemberHoverPreviewProvider>
  );
}

function MemberCtaSection({
  onExplore,
  onRandomPick,
}: {
  onExplore: () => void;
  onRandomPick: () => void;
}) {
  return (
    <section id="member-cta" className="member-cta-grid" aria-label="Pilihan permainan">
      <article className="member-action-card member-action-card--discover">
        <div className="member-action-card-art" aria-hidden="true">
          <Image src={CTA_ARTWORK.discover} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <div className="member-action-card-copy">
          <h2>Temukan game baru hari ini</h2>
          <p>Jelajahi pilihan game yang dibuat untuk menemani waktumu.</p>
          <button type="button" className="member-button member-button--secondary" onClick={onExplore}>
            Jelajahi Game
          </button>
        </div>
      </article>

      <article className="member-action-card member-action-card--random">
        <div className="member-action-card-art" aria-hidden="true">
          <Image src={CTA_ARTWORK.random} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <div className="member-action-card-copy">
          <h2>Putar Pilihan</h2>
          <p>Belum tahu mau pilih yang mana? Kami pilihkan satu untukmu.</p>
          <button type="button" className="member-button member-button--secondary" onClick={onRandomPick}>
            Pilih Satu Game
          </button>
        </div>
      </article>
    </section>
  );
}

function MemberLeaderboardCta({ onViewRanking }: { onViewRanking: () => void }) {
  return (
    <section className="member-leaderboard-cta" aria-label="Papan peringkat">
      <div className="member-leaderboard-cta-art" aria-hidden="true">
        <Image
          src="/assets/member/promotions/leaderboard-banner.png"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 1580px"
        />
      </div>
      <div className="member-leaderboard-cta-copy">
        <span className="member-leaderboard-cta-icon" aria-hidden="true">
          <i className="fa-solid fa-trophy" />
        </span>
        <div>
          <h2>Papan Peringkat</h2>
          <p>Lihat pilihan game yang sedang ramai minggu ini.</p>
        </div>
      </div>
      <button type="button" className="member-button member-button--dark" onClick={onViewRanking}>
        Lihat Peringkat
      </button>
    </section>
  );
}

export function MemberLobbySkeleton() {
  return (
    <div
      className="member-lobby member-lobby-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Memuat data game staging"
    >
      <section className="member-skeleton-hero" aria-hidden="true">
        <div className="member-skeleton-hero-art" />
        <div className="member-skeleton-hero-copy">
          <span className="member-skeleton-block member-skeleton-block--eyebrow" />
          <span className="member-skeleton-block member-skeleton-block--title" />
          <span className="member-skeleton-block member-skeleton-block--title-short" />
          <span className="member-skeleton-block member-skeleton-block--meta" />
          <span className="member-skeleton-block member-skeleton-block--description" />
          <span className="member-skeleton-block member-skeleton-block--button" />
        </div>
        <div className="member-skeleton-dots">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className="member-skeleton-dot" />
          ))}
        </div>
      </section>

      <section className="member-skeleton-primary" aria-hidden="true">
        <MemberSkeletonRail cardCount={5} isRanked showIcon />
        <MemberSkeletonRail cardCount={4} showViewAll />
      </section>

      <section className="member-skeleton-activity-band" aria-hidden="true">
        <MemberSkeletonRail cardCount={4} showViewAll className="member-skeleton-activity-rail" />
        <MemberSkeletonActivity />
      </section>
    </div>
  );
}

function MemberSkeletonRail({
  cardCount,
  className,
  isRanked = false,
  showIcon = false,
  showViewAll = false,
}: {
  cardCount: number;
  className?: string;
  isRanked?: boolean;
  showIcon?: boolean;
  showViewAll?: boolean;
}) {
  const cards = Array.from({ length: cardCount }, (_, index) => index);

  return (
    <section
      className={`member-skeleton-section${isRanked ? " member-skeleton-section--ranked" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="member-skeleton-heading">
        {showIcon ? <span className="member-skeleton-heading-icon" /> : null}
        <div className="member-skeleton-heading-copy">
          <span className="member-skeleton-block member-skeleton-block--heading" />
          <span className="member-skeleton-block member-skeleton-block--subheading" />
        </div>
        {showViewAll ? <span className="member-skeleton-block member-skeleton-block--view-all" /> : null}
      </div>
      <div className={`member-skeleton-rail member-skeleton-rail--${cardCount}`}>
        {cards.map((card) => (
          <div className="member-skeleton-card" key={card}>
            <span className="member-skeleton-block" />
            {isRanked ? <span className="member-skeleton-rank" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function MemberSkeletonActivity() {
  return (
    <aside className="member-skeleton-activity-card">
      <div className="member-skeleton-activity-heading">
        <span className="member-skeleton-block member-skeleton-block--activity-title" />
        <span className="member-skeleton-block member-skeleton-block--activity-link" />
      </div>
      <div className="member-skeleton-tabs">
        {Array.from({ length: 3 }, (_, index) => (
          <span
            key={index}
            className={`member-skeleton-block member-skeleton-tab${index === 0 ? " is-active" : ""}`}
          />
        ))}
      </div>
      <div className="member-skeleton-table">
        <div className="member-skeleton-table-row member-skeleton-table-row--heading">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="member-skeleton-block" />
          ))}
        </div>
        {Array.from({ length: 3 }, (_, row) => (
          <div className="member-skeleton-table-row" key={row}>
            {Array.from({ length: 4 }, (_, column) => (
              <span key={column} className="member-skeleton-block" />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function MemberTopFiveSection({
  games,
  vendorName,
  onSelect,
}: {
  games: Game[];
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
}) {
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useMemberHorizontalRail(games.length);

  return (
    <section className="member-top-five" aria-labelledby="member-top-five-title">
      <div className="member-section-heading member-top-five-heading">
        <span className="member-top-five-mark" aria-hidden="true">
          <i className="fa-solid fa-ranking-star" />
        </span>
        <div>
          <h2 id="member-top-five-title">Top 5 Minggu Ini</h2>
          <p>Game yang paling sering dimainkan.</p>
        </div>
      </div>
      <div
        className={`member-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <MemberRailArrow
            direction="prev"
            label="Lihat peringkat sebelumnya"
            onClick={() => scrollRail("previous")}
          />
        ) : null}
        <div ref={railRef} className="member-top-five-grid" tabIndex={0} aria-label="Top 5 minggu ini">
          {games.map((game, index) => (
            <MemberGameCard
              key={game.id}
              game={game}
              rank={index + 1}
              variant="ranked"
              vendorName={TOP_FIVE_VENDOR_OVERRIDES[game.id] ?? vendorName(game.vendor_id)}
              onSelect={onSelect}
            />
          ))}
        </div>
        {canScrollNext ? (
          <MemberRailArrow
            direction="next"
            label="Lihat peringkat berikutnya"
            onClick={() => scrollRail("next")}
          />
        ) : null}
      </div>
    </section>
  );
}

function MemberFeaturedSection({
  games,
  vendorName,
  onSelect,
  onViewAll,
}: {
  games: Game[];
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
  onViewAll: () => void;
}) {
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useMemberHorizontalRail(games.length);

  return (
    <section className="member-featured" aria-labelledby="member-featured-title">
      <div className="member-section-heading member-section-heading--inline">
        <div>
          <h2 id="member-featured-title">Game Paling Hot</h2>
          <p>Koleksi game favorit untuk semua pemain.</p>
        </div>
        <button type="button" className="member-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`member-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <MemberRailArrow
            direction="prev"
            label="Lihat game paling hot sebelumnya"
            onClick={() => scrollRail("previous")}
          />
        ) : null}
        <div
          ref={railRef}
          className="member-rail member-rail--featured"
          tabIndex={0}
          aria-label="Game paling hot"
        >
          {games.map((game) => (
            <MemberGameCard
              key={game.id}
              game={game}
              variant="portrait"
              vendorName={vendorName(game.vendor_id)}
              onSelect={onSelect}
            />
          ))}
        </div>
        {canScrollNext ? (
          <MemberRailArrow
            direction="next"
            label="Lihat game paling hot berikutnya"
            onClick={() => scrollRail("next")}
          />
        ) : null}
      </div>
    </section>
  );
}

function MemberTrendingSection({
  games,
  vendorName,
  onSelect,
  onViewAll,
}: {
  games: Game[];
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
  onViewAll: () => void;
}) {
  return (
    <div className="member-trending">
      <MemberGameRailSection
        demoFirst
        games={games}
        title="Coba Gratis"
        description="Mainkan game pilihan secara gratis."
        titleId="member-free-title"
        railLabel="Coba gratis"
        vendorName={vendorName}
        onSelect={onSelect}
        onViewAll={onViewAll}
      />
    </div>
  );
}

function MemberGameRailSection({
  games,
  title,
  description,
  titleId,
  railLabel,
  vendorName,
  onSelect,
  onViewAll,
  demoFirst,
}: {
  games: Game[];
  title: string;
  description: string;
  titleId: string;
  railLabel: string;
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
  onViewAll: () => void;
  demoFirst?: boolean;
}) {
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useMemberHorizontalRail(games.length);

  return (
    <section className="member-game-rail-section" aria-labelledby={titleId}>
      <div className="member-section-heading member-section-heading--inline">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="member-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`member-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <MemberRailArrow
            direction="prev"
            label={`Lihat ${title.toLowerCase()} sebelumnya`}
            onClick={() => scrollRail("previous")}
          />
        ) : null}
        <div
          ref={railRef}
          className="member-rail member-rail--featured"
          tabIndex={0}
          aria-label={railLabel}
        >
          {games.map((game) => (
            <MemberGameCard
              key={game.id}
              game={game}
              variant="portrait"
              vendorName={vendorName(game.vendor_id)}
              onSelect={onSelect}
              demoFirst={demoFirst}
            />
          ))}
        </div>
        {canScrollNext ? (
          <MemberRailArrow
            direction="next"
            label={`Lihat ${title.toLowerCase()} berikutnya`}
            onClick={() => scrollRail("next")}
          />
        ) : null}
      </div>
    </section>
  );
}

function MemberActivityCard({
  games,
  feeds,
  activeTab,
  onTabChange,
  onViewAll,
}: {
  games: Game[];
  feeds?: ActivityFeedsRes;
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
  onViewAll: () => void;
}) {
  const labels: Record<ActivityTab, string> = {
    latest: "Taruhan Terbaru",
    bigWins: "Menang Besar",
    leaderboard: "Top Pemain",
  };
  const rows = activityRowsFor(activeTab, feeds);
  const isLeaderboard = activeTab === "leaderboard";
  const [gameColumn, playerColumn, metricColumn, resultColumn] = ACTIVITY_COLUMN_LABELS[activeTab];
  const gameImage = (name: string) => games.find((game) => game.name === name)?.image_url;

  return (
    <section className="member-activity-card" aria-labelledby="member-activity-title">
      <div className="member-activity-heading">
        <h2 id="member-activity-title">Aktivitas</h2>
        <button type="button" className="member-activity-view-all" onClick={onViewAll}>
          <i className="fa-solid fa-circle" aria-hidden="true" /> Lihat Semua
        </button>
      </div>
      <div className="member-activity-tabs" role="tablist" aria-label="Jenis aktivitas">
        {(Object.keys(labels) as ActivityTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : undefined}
            onClick={() => onTabChange(tab)}
          >
            {labels[tab]}
          </button>
        ))}
      </div>
      <div
        className={`member-activity-table member-activity-table--${activeTab}`}
        role="table"
        aria-label={labels[activeTab]}
      >
        <div className="member-activity-row member-activity-row--head" role="row">
          <span className="member-activity-column-game">{gameColumn}</span>
          <span className="member-activity-column-player">{playerColumn}</span>
          <span className="member-activity-column-metric">{metricColumn}</span>
          <span className="member-activity-column-result">{resultColumn}</span>
        </div>
        {rows.length ? (
          rows.map((row) => {
            const image = isLeaderboard ? undefined : gameImage(row.primary);
            const isProfit = row.result.startsWith("+") || row.result.startsWith("-");
            return (
              <div className="member-activity-row" role="row" key={`${row.primary}-${row.player}`}>
                <span className="member-activity-game">
                  <span className="member-activity-icon" aria-hidden="true">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" loading="lazy" decoding="async" />
                    ) : isLeaderboard ? (
                      row.primary.replace("Peringkat ", "#")
                    ) : (
                      row.primary.charAt(0)
                    )}
                  </span>
                  <strong>{row.primary}</strong>
                </span>
                <span className="member-activity-column-player">{row.player}</span>
                <span className="member-activity-column-metric">{row.metric}</span>
                {isProfit ? (
                  <span
                    className={`member-activity-column-result member-activity-profit${
                      row.result.startsWith("-") ? " is-loss" : " is-win"
                    }`}
                  >
                    {row.result}
                  </span>
                ) : (
                  <em className="member-activity-column-result">{row.result}</em>
                )}
              </div>
            );
          })
        ) : (
          <div className="member-activity-row member-activity-empty" role="row">
            Belum ada data untuk aktivitas ini.
          </div>
        )}
      </div>
    </section>
  );
}

function MemberProviderSection({
  providers,
  selectedProvider,
  providerGames,
  providerGameCount,
  vendorName,
  onSelectProvider,
  onSelectGame,
  onViewAll,
}: {
  providers: readonly MemberProviderFeature[];
  selectedProvider: string;
  providerGames: Game[];
  providerGameCount: number;
  vendorName: (id: string) => string;
  onSelectProvider: (providerId: string) => void;
  onSelectGame: (game: Game) => void;
  onViewAll: () => void;
}) {
  const hasMoreProviderGames = providerGameCount > providerGames.length;

  return (
    <section className="member-provider-section" id="member-providers" aria-labelledby="member-provider-title">
      <div className="member-section-heading member-section-heading--inline">
        <div>
          <h2 id="member-provider-title">Provider Pilihan</h2>
          <p>Pilih provider favorit untuk melihat koleksi gamenya.</p>
        </div>
        <button type="button" className="member-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div className="member-provider-selector">
        {providers.map((provider) => (
          <button
            type="button"
            key={provider.id}
            aria-label={`${provider.name}: ${provider.description}`}
            aria-pressed={selectedProvider === provider.id}
            className={`member-provider-card ${provider.featured ? "is-featured" : ""} ${
              selectedProvider === provider.id ? "is-selected" : ""
            }`}
            onClick={() => onSelectProvider(provider.id)}
          >
            <span className="member-provider-mark" aria-hidden="true">
              <i className={provider.icon} />
            </span>
            <span className="member-provider-copy">
              <strong>{provider.name}</strong>
            </span>
          </button>
        ))}
      </div>
      <div className="member-provider-games" id="member-provider-games">
        <div className="member-provider-games-heading">
          <span className="member-provider-rule" aria-hidden="true" />
          <strong>
            {providers.find((provider) => provider.id === selectedProvider)?.name ??
              selectedProvider}
          </strong>
          <span className="member-provider-rule" aria-hidden="true" />
        </div>
        <div className="member-provider-games-grid-wrap">
          <div className="member-provider-games-grid">
            {providerGames.map((game, index) => (
              <MemberGameCard
                key={`${game.id}-${index}`}
                game={game}
                variant="landscape"
                vendorName={vendorName(game.vendor_id)}
                onSelect={onSelectGame}
              />
            ))}
          </div>
          {hasMoreProviderGames ? (
            <div className="member-provider-games-overlay">
              <button type="button" className="member-provider-games-more" onClick={onViewAll}>
                Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MemberCatalogView({
  categoryLabel,
  games,
  totalGameCount,
  page,
  pageCount,
  search,
  category,
  categoryOptions,
  providerOptions,
  selectedProviders,
  activityGames,
  vendorName,
  onSearch,
  onCategoryChange,
  onToggleProvider,
  onReset,
  isFilterOpen,
  onToggleFilter,
  onCloseFilter,
  onBrowse,
  onViewActivity,
  onPageChange,
  activityFeeds,
  onSelect,
}: {
  categoryLabel: string;
  games: Game[];
  totalGameCount: number;
  page: number;
  pageCount: number;
  search: string;
  category: string;
  categoryOptions: CatalogCategoryOption[];
  providerOptions: CatalogProviderOption[];
  selectedProviders: string[];
  activityGames: Game[];
  vendorName: (id: string) => string;
  onSearch: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onToggleProvider: (providerId: string) => void;
  onReset: () => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  onCloseFilter: () => void;
  onBrowse: () => void;
  onViewActivity: () => void;
  onPageChange: (page: number) => void;
  activityFeeds?: ActivityFeedsRes;
  onSelect: (game: Game) => void;
}) {
  const activeFilterCount = (category !== "all" ? 1 : 0) + selectedProviders.length;

  return (
    <section className="member-catalog" id="member-catalog" aria-labelledby="member-catalog-title">
      <div className="member-catalog-heading">
        <div>
          <h1 id="member-catalog-title">{categoryLabel}</h1>
          <p>{totalGameCount} game tersedia untuk kamu.</p>
        </div>
        <label className="member-catalog-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Cari game..."
            aria-label="Cari game"
            type="search"
          />
        </label>
      </div>
      <div className="member-catalog-body">
        <div className="member-catalog-filter-shell">
          <button
            type="button"
            className="member-catalog-filter-trigger"
            aria-controls="member-catalog-filter-dialog"
            aria-expanded={isFilterOpen}
            onClick={onToggleFilter}
          >
            <span className="member-catalog-filter-trigger-label">
              <i className="fa-solid fa-filter" aria-hidden="true" /> Filter Game
            </span>
            <span className="member-catalog-filter-trigger-meta">
              {activeFilterCount ? `${activeFilterCount} filter aktif` : "Semua game"}
            </span>
            <i className="fa-solid fa-chevron-down" aria-hidden="true" />
          </button>
          <div
            id="member-catalog-filter-dialog"
            className={`member-catalog-filter-popover${isFilterOpen ? " is-open" : ""}`}
            role={isFilterOpen ? "dialog" : undefined}
            aria-modal={isFilterOpen ? true : undefined}
            aria-labelledby="member-catalog-filter-title"
          >
            <button
              type="button"
              className="member-catalog-filter-backdrop"
              aria-label="Tutup filter"
              onClick={onCloseFilter}
            />
            <div className="member-catalog-filter-sheet">
              <MemberCatalogFilter
                category={category}
                categoryOptions={categoryOptions}
                providerOptions={providerOptions}
                selectedProviders={selectedProviders}
                onCategoryChange={onCategoryChange}
                onToggleProvider={onToggleProvider}
                onReset={onReset}
                onClose={onCloseFilter}
              />
            </div>
          </div>
        </div>
        <div className="member-catalog-main">
          <div className="member-catalog-results-heading">
            <span>
              Menampilkan <strong>{totalGameCount}</strong> game
            </span>
            {selectedProviders.length ? (
              <span className="member-catalog-filter-note">
                {selectedProviders.length} provider dipilih
              </span>
            ) : null}
          </div>
          {games.length ? (
            <>
              <div className="member-catalog-grid" id="member-catalog-grid">
                {games.map((game) => (
                  <MemberGameCard
                    key={game.id}
                    game={game}
                    variant="landscape"
                    vendorName={vendorName(game.vendor_id)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
              <MemberCatalogPagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
            </>
          ) : (
            <div className="member-empty-state">
              Belum ada game yang sesuai dengan filter pilihanmu.
            </div>
          )}
        </div>
      </div>
      <MemberCatalogCta onExplore={onBrowse} />
      <MemberCatalogActivity
        feeds={activityFeeds}
        games={activityGames}
        onSelect={onSelect}
        onViewAll={onViewActivity}
      />
    </section>
  );
}

function MemberCatalogFilter({
  category,
  categoryOptions,
  providerOptions,
  selectedProviders,
  onCategoryChange,
  onToggleProvider,
  onReset,
  onClose,
}: {
  category: string;
  categoryOptions: CatalogCategoryOption[];
  providerOptions: CatalogProviderOption[];
  selectedProviders: string[];
  onCategoryChange: (category: string) => void;
  onToggleProvider: (providerId: string) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  return (
    <aside className="member-catalog-filter" aria-labelledby="member-catalog-filter-title">
      <div className="member-catalog-filter-heading">
        <h2 id="member-catalog-filter-title">
          <i className="fa-solid fa-filter" aria-hidden="true" /> Filter Game
        </h2>
        {onClose ? (
          <button type="button" className="member-catalog-filter-close" onClick={onClose}>
            Tutup <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <fieldset className="member-catalog-filter-group">
        <legend>Kategori Game</legend>
        <div className="member-catalog-filter-pills">
          {categoryOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              className={category === option.id ? "is-active" : undefined}
              aria-pressed={category === option.id}
              onClick={() => onCategoryChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="member-catalog-filter-group">
        <legend>Provider</legend>
        <div className="member-catalog-provider-list">
          {providerOptions.map((provider) => (
            <label className="member-catalog-provider-option" key={provider.id}>
              <input
                type="checkbox"
                checked={selectedProviders.includes(provider.id)}
                onChange={() => onToggleProvider(provider.id)}
              />
              <span>{provider.name}</span>
              <small>{provider.count}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" className="member-catalog-filter-reset" onClick={onReset}>
        <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reset filter
      </button>
    </aside>
  );
}

function MemberCatalogCta({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="member-catalog-cta" aria-label="Temukan game baru">
      <Image
        src={CTA_ARTWORK.catalog}
        alt=""
        fill
        sizes="(max-width: 900px) 100vw, 1580px"
        className="member-catalog-cta-image"
      />
      <div className="member-catalog-cta-copy">
        <h2>Temukan game baru hari ini</h2>
        <p>Jelajahi pilihan game yang dibuat untuk menemani waktumu.</p>
        <button type="button" className="member-button member-button--primary" onClick={onExplore}>
          Jelajahi Game <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function MemberCatalogActivity({
  feeds,
  games,
  onSelect,
  onViewAll,
}: {
  feeds?: ActivityFeedsRes;
  games: Game[];
  onSelect: (game: Game) => void;
  onViewAll: () => void;
}) {
  const latestRows = activityRowsFor("latest", feeds).slice(0, 5);
  const rankingRows = activityRowsFor("leaderboard", feeds).slice(0, 3);
  const gameByName = (name: string) => games.find((game) => game.name === name);

  return (
    <section
      className="member-catalog-activity"
      id="member-catalog-activity"
      aria-labelledby="member-catalog-activity-title"
    >
      <div className="member-catalog-activity-heading">
        <div className="member-catalog-activity-title">
          <span className="member-catalog-activity-icon" aria-hidden="true">
            <i className="fa-solid fa-gamepad" />
          </span>
          <div>
            <h2 id="member-catalog-activity-title">Aktivitas &amp; Peringkat</h2>
            <p>Lihat game terbaru yang dimainkan dan pemain dengan skor tertinggi.</p>
          </div>
        </div>
      </div>
      <div className="member-catalog-activity-grid">
        <article className="member-catalog-activity-panel">
          <div className="member-catalog-activity-panel-heading">
            <h3>
              <i className="fa-regular fa-clock" aria-hidden="true" /> Game terbaru
            </h3>
          </div>
          <div className="member-catalog-latest-table" role="table" aria-label="Game terbaru">
            <div className="member-catalog-latest-header" role="row">
              <span>Game</span>
              <span>Player</span>
              <span>Multiplier</span>
              <span>Profit</span>
            </div>
            <div className="member-catalog-latest-list">
              {latestRows.map((row) => {
                const game = gameByName(row.primary);
                return (
                  <button
                    type="button"
                    className="member-catalog-latest-row"
                    key={`${row.primary}-${row.player}`}
                    onClick={() => game && onSelect(game)}
                    disabled={!game}
                  >
                    <span className="member-catalog-latest-game">
                      <span className="member-catalog-latest-art" aria-hidden="true">
                        {game?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={game.image_url} alt="" loading="lazy" decoding="async" />
                        ) : (
                          row.primary.charAt(0)
                        )}
                      </span>
                      <strong>{row.primary}</strong>
                    </span>
                    <span className="member-catalog-latest-player">{row.player}</span>
                    <span className="member-catalog-latest-multiplier">{row.metric}</span>
                    <span
                      className={`member-catalog-latest-profit${
                        row.result.startsWith("-") ? " is-loss" : " is-win"
                      }`}
                    >
                      {row.result}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </article>
        <article className="member-catalog-activity-panel">
          <div className="member-catalog-activity-panel-heading">
            <h3>
              <i className="fa-solid fa-trophy" aria-hidden="true" /> Papan peringkat
            </h3>
            <button type="button" className="member-text-link" onClick={onViewAll}>
              Lihat papan peringkat <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
          <div className="member-catalog-ranking-list">
            {rankingRows.map((row) => {
              const gameName = feeds ? "" : row.primary;
              const game = gameName ? gameByName(gameName) : undefined;
              const rankLabel = feeds ? row.primary : row.metric;
              const rankNumber = rankLabel.replace("Peringkat ", "");
              return (
                <button
                  type="button"
                  className="member-catalog-ranking-row"
                  key={`${row.primary}-${row.player}`}
                  onClick={() => game && onSelect(game)}
                  disabled={!game}
                >
                  <span className="member-catalog-ranking-medal" aria-hidden="true">
                    <i className="fa-solid fa-crown" />
                  </span>
                  <span className="member-catalog-ranking-avatar" aria-hidden="true">
                    {row.player.charAt(0)}
                  </span>
                  <span className="member-catalog-ranking-copy">
                    <strong>{row.player}</strong>
                    <small>{feeds ? "Top pemain" : gameName}</small>
                  </span>
                  <span className="member-catalog-ranking-score">{rankNumber}</span>
                </button>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

function getMemberPaginationItems(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", pageCount];
  }

  if (page >= pageCount - 3) {
    return [1, "ellipsis", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount];
}

function MemberCatalogPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav className="member-pagination" aria-label="Navigasi halaman game">
      <button
        type="button"
        className="member-pagination-button member-pagination-button--arrow"
        aria-label="Halaman sebelumnya"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
      </button>
      <div className="member-pagination-pages">
        {getMemberPaginationItems(page, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="member-pagination-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={item}
              className={`member-pagination-button${item === page ? " is-active" : ""}`}
              aria-label={`Buka halaman ${item}`}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        className="member-pagination-button member-pagination-button--arrow"
        aria-label="Halaman berikutnya"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
      <span className="member-pagination-summary" aria-live="polite">
        Halaman {page} dari {pageCount}
      </span>
    </nav>
  );
}

function MemberGameDetail({
  game,
  vendorName,
  eyebrow,
  launching,
  onClose,
  onLaunch,
  onLaunchDemo,
}: {
  game: Game;
  vendorName: string;
  eyebrow?: string;
  launching: boolean;
  onClose: () => void;
  onLaunch: (game: Game) => void;
  onLaunchDemo: (game: Game) => void;
}) {
  return (
    <div
      className="member-game-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${game.name}`}
    >
      <button
        type="button"
        className="member-game-modal-backdrop"
        onClick={onClose}
        aria-label="Tutup detail"
      />
      <div className="member-game-dialog">
        <button
          type="button"
          className="member-game-modal-close"
          onClick={onClose}
          aria-label="Tutup detail"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
        <div className="member-game-dialog-art">
          {game.image_url?.startsWith("/") ? (
            <Image
              src={game.image_url}
              alt={game.name}
              fill
              sizes="(max-width: 640px) 45vw, 260px"
            />
          ) : game.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.image_url} alt={game.name} decoding="async" />
          ) : null}
        </div>
        <div className="member-game-dialog-content">
          <span className="member-dialog-eyebrow">{eyebrow ?? "Pilihan game"}</span>
          <h2>{game.name}</h2>
          <p className="member-dialog-meta">
            {vendorName} <span aria-hidden="true">·</span> {game.category}
          </p>
          <p>{game.description ?? "Pilihan permainan untuk menemani sesi bermainmu."}</p>
          <div className="member-dialog-actions">
            <button
              type="button"
              className="member-button member-button--primary"
              disabled={launching}
              onClick={() => onLaunch(game)}
            >
              <i className="fa-solid fa-play" aria-hidden="true" />
              {launching ? "Membuka..." : "Mainkan Sekarang"}
            </button>
            {game.demo_supported ? (
              <button
                type="button"
                className="member-button member-button--secondary"
                disabled={launching}
                onClick={() => onLaunchDemo(game)}
              >
                Coba Gratis
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
