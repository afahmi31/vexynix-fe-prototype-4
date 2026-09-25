"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, useVendors } from "@/hooks/useCatalog";
import { useActivityFeeds } from "@/hooks/useActivityFeeds";
import { useLaunchGame } from "@/hooks/useLaunchGame";
import { useActionDisabled } from "@/hooks/useTransactionLock";
import { useAuthModalStore } from "@/stores/auth-modal";
import { MOCK_CATALOG, MOCK_VENDORS } from "@/mocks/p4";
import type { ActivityFeedsRes, Game, Vendor } from "@/types/api";
import { NEXT_PARAM, safeNextPath } from "@/lib/auth-redirect";
import { P4GameCard } from "@/components/game/p4/P4GameCard";

const HERO_BACKDROP = "/assets/prototype-4/hero/neon-racer-sunset.png";

const CTA_ARTWORK = {
  discover: "/assets/prototype-4/cta/discover-games.png",
  random: "/assets/prototype-4/cta/random-game.png",
  catalog: "/assets/prototype-4/cta/new-games-banner.png",
} as const;

const CATALOG_HERO_ART = "/assets/prototype-4/hero/neon-racer-catalog.png";

const HERO_SLIDES = [
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
    backdrop: "/assets/p4/heroes/solar-riches-backdrop.png",
    meta: "Slot  ·  PG Soft  ·  Gratis Demo",
    description: "Temukan kuil emas dan nikmati putaran bertema matahari.",
  },
  {
    gameId: "velvet-roulette",
    title: "Velvet Roulette",
    backdrop: "/assets/p4/heroes/velvet-roulette-backdrop.png",
    meta: "Live Casino  ·  Evolution  ·  Live Play",
    description: "Nikmati suasana meja malam yang elegan.",
  },
  {
    gameId: "deep-sea-odyssey",
    title: "Deep Sea Odyssey",
    backdrop: "/assets/p4/heroes/deep-sea-odyssey-backdrop.png",
    meta: "Tembak Ikan  ·  Naga Games  ·  Gratis Demo",
    description: "Mulai petualangan di kedalaman yang penuh warna.",
  },
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

type P4ProviderFeature = (typeof PROVIDER_FEATURES)[number] & {
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

function activityRowsFor(
  tab: ActivityTab,
  feeds?: ActivityFeedsRes
): ActivityDisplayRow[] {
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
    primary: row.game,
    player: row.player,
    metric: `${row.multiplier.toFixed(2)}x`,
    result: formatSignedIdr(row.win),
  }));
}

type CatalogSort = "popular" | "newest" | "az";
type CatalogQuickPick = "popular" | "newest" | "live";

const CATALOG_SORT_OPTIONS: { id: CatalogSort; label: string }[] = [
  { id: "popular", label: "Terpopuler" },
  { id: "newest", label: "Terbaru" },
  { id: "az", label: "A-Z" },
];

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

type RailDirection = "previous" | "next";

function useP4HorizontalRail(itemCount: number) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

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

export default function P4LobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: catalogData } = useCatalog();
  const { data: vendorsData } = useVendors();
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
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("popular");
  const [isCatalogFilterOpen, setIsCatalogFilterOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const topFeatureGridRef = useRef<HTMLElement>(null);

  const activeGames = useMemo(() => activeGamesFrom(catalogData), [catalogData]);
  const vendors = useMemo(() => vendorsFrom(vendorsData), [vendorsData]);
  const vendorName = (id: string) => vendors.find((vendor) => vendor.id === id)?.name ?? id;
  const providerFeatures = useMemo<P4ProviderFeature[]>(
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
    if (isCatalogView || HERO_SLIDES.length < 2) return;

    const timer = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isCatalogView]);

  useEffect(() => {
    if (isCatalogView) return;

    const topFeatureGrid = topFeatureGridRef.current;
    const topFiveGrid = topFeatureGrid?.querySelector<HTMLElement>(".p4-top-five-grid");
    if (!topFeatureGrid || !topFiveGrid) return;

    let frame = 0;
    const syncPosterHeight = () => {
      topFeatureGrid.style.removeProperty("--p4-poster-height");
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const topFiveCard = topFiveGrid.querySelector<HTMLElement>(".p4-game-card-art");
        if (!topFiveCard) return;

        topFeatureGrid.style.setProperty(
          "--p4-poster-height",
          `${topFiveCard.getBoundingClientRect().height}px`
        );
      });
    };

    syncPosterHeight();
    window.addEventListener("resize", syncPosterHeight);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPosterHeight);
      topFeatureGrid.style.removeProperty("--p4-poster-height");
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

  const heroSlide = HERO_SLIDES[heroSlideIndex] ?? HERO_SLIDES[0];
  const heroGame = useMemo(
    () => activeGames.find((game) => game.id === heroSlide.gameId) ?? activeGames[0],
    [activeGames, heroSlide.gameId]
  );
  const topFive = useMemo(
    () =>
      gamesByIds(
        activeGames,
        [
          "gates-of-olympus",
          "sweet-bonanza",
          "wanted-dead-or-a-wild",
          "mahjong-ways-2",
          "solar-riches",
        ],
        5
      ),
    [activeGames]
  );
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
  const trendingGames = useMemo(
    () =>
      gamesByIds(
        activeGames,
        [
          "solar-riches",
          "velvet-roulette",
          "deep-sea-odyssey",
          "sugar-rush",
          "neon-racer",
          "fortune-of-giza",
          "phoenix-rises",
          "reel-royale",
          "candy-superwin",
          "fortune-ox",
        ],
        10
      ),
    [activeGames]
  );
  const hotGames = useMemo(
    () =>
      gamesByIds(
        activeGames,
        [
          "hot-shot",
          "fire-hot-100",
          "wolf-gold",
          "safari-king",
          "irish-charms",
          "candy-burst",
          "moonshower",
          "mahjong-wins",
          "dragon-tiger-luck",
          "fortune-mouse",
        ],
        10
      ),
    [activeGames]
  );
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
      ? CATEGORY_LABELS.all ?? "Semua Game"
      : catalogCategoryOptions.find((option) => option.id === category)?.label ??
        catalogCategoryLabel(category);
  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    const providerIds = new Set(selectedCatalogProviders);
    const indexedGames = activeGames
      .filter(
        (game) => category === "all" || normalizeCatalogCategory(game.category) === category
      )
      .filter((game) => providerIds.size === 0 || providerIds.has(game.vendor_id))
      .filter((game) => !query || game.name.toLowerCase().includes(query));
    return indexedGames
      .map((game, index) => ({ game, index }))
      .sort((a, b) => {
        if (catalogSort === "az") return a.game.name.localeCompare(b.game.name, "id");
        if (catalogSort === "newest") {
          return Number(b.game.is_new) - Number(a.game.is_new) || a.index - b.index;
        }
        return (
          Number(b.game.is_popular) - Number(a.game.is_popular) ||
          Number(b.game.is_featured) - Number(a.game.is_featured) ||
          a.index - b.index
        );
      })
      .map(({ game }) => game);
  }, [activeGames, catalogSearch, catalogSort, category, selectedCatalogProviders]);
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
  }, [category, catalogSearch, catalogSort, selectedCatalogProviders]);

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
      document.getElementById("p4-catalog")?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  const handleCatalogCategoryChange = (nextCategory: string) => {
    router.push(`/lobby?category=${nextCategory}#p4-catalog`);
  };

  const handleCatalogProviderToggle = (providerId: string) => {
    setSelectedCatalogProviders((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    );
  };

  const handleCatalogQuickPick = (quickPick: CatalogQuickPick) => {
    if (quickPick === "live") {
      handleCatalogCategoryChange("live");
      return;
    }
    setCatalogSort(quickPick);
  };

  const handleCatalogReset = () => {
    setCatalogSearch("");
    setSelectedCatalogProviders([]);
    setCatalogSort("popular");
    if (category !== "all") handleCatalogCategoryChange("all");
  };

  const handleLeaderboardCta = () => {
    setActivityTab("leaderboard");
    window.requestAnimationFrame(() => scrollTo("p4-activity-title"));
  };

  const handleHeroLaunch = () => {
    if (!heroGame || actionDisabled) return;
    if (heroGame.demo_supported) void launchDemo(heroGame.id);
    else void launch(heroGame.id);
  };

  const catalogHeroGame = useMemo(
    () => activeGames.find((game) => game.id === "neon-racer") ?? activeGames[0],
    [activeGames]
  );

  const handleCatalogHeroLaunch = () => {
    if (!catalogHeroGame || actionDisabled) return;
    if (catalogHeroGame.demo_supported) void launchDemo(catalogHeroGame.id);
    else void launch(catalogHeroGame.id);
  };

  return (
    <div className="p4-lobby">
      {isCatalogView ? (
        <P4CatalogView
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
          sort={catalogSort}
          activityGames={activeGames}
          heroGame={catalogHeroGame}
          vendorName={vendorName}
          onSearch={setCatalogSearch}
          onCategoryChange={handleCatalogCategoryChange}
          onToggleProvider={handleCatalogProviderToggle}
          onSortChange={setCatalogSort}
          onReset={handleCatalogReset}
          isFilterOpen={isCatalogFilterOpen}
          onToggleFilter={() => setIsCatalogFilterOpen((isOpen) => !isOpen)}
          onCloseFilter={() => setIsCatalogFilterOpen(false)}
          onQuickPick={handleCatalogQuickPick}
          onHeroLaunch={handleCatalogHeroLaunch}
          onBrowse={() => scrollTo("p4-catalog-grid")}
          onViewActivity={() => scrollTo("p4-catalog-activity")}
          onPageChange={handleCatalogPageChange}
          activityFeeds={activityFeeds}
          onSelect={setDetailGame}
        />
      ) : (
        <>
          <section className="p4-hero" aria-labelledby="p4-hero-title">
            <Image
              key={`hero-image-${heroSlide.gameId}`}
              src={heroSlide.backdrop}
              alt={heroSlide.title}
              fill
              priority
              sizes="100vw"
              className="p4-hero-image"
            />
            <div className="p4-hero-overlay" aria-hidden="true" />
            <div
              className="p4-hero-content"
              key={`hero-content-${heroSlide.gameId}`}
              aria-live="polite"
            >
              <h1 id="p4-hero-title">{heroSlide.title}</h1>
              <p className="p4-hero-meta">{heroSlide.meta}</p>
              <p className="p4-hero-description">{heroSlide.description}</p>
              <div className="p4-hero-actions">
                <button
                  type="button"
                  className="p4-button p4-button--primary"
                  onClick={handleHeroLaunch}
                >
                  <i className="fa-solid fa-play" aria-hidden="true" />
                  Mainkan Sekarang
                </button>
                <button
                  type="button"
                  className="p4-button p4-button--secondary"
                  onClick={() => heroGame && setDetailGame(heroGame)}
                >
                  Lihat Detail
                </button>
              </div>
            </div>
            <div className="p4-hero-dots" role="tablist" aria-label="Pilihan hero">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  key={slide.gameId}
                  type="button"
                  role="tab"
                  aria-label={`Tampilkan ${slide.title}`}
                  aria-selected={heroSlideIndex === index}
                  className={heroSlideIndex === index ? "is-active" : undefined}
                  onClick={() => setHeroSlideIndex(index)}
                />
              ))}
            </div>
          </section>

          <div className="p4-primary-sections">
            <section
              ref={topFeatureGridRef}
              className="p4-top-feature-grid"
              aria-label="Game pilihan utama"
            >
              <P4TopFiveSection games={topFive} vendorName={vendorName} onSelect={setDetailGame} />
              <P4FeaturedSection
                games={featuredGames}
                vendorName={vendorName}
                onSelect={setDetailGame}
                onViewAll={() => router.push("/lobby?category=all#p4-catalog")}
              />
            </section>

            <section className="p4-activity-band" aria-label="Sedang ramai dimainkan dan aktivitas">
              <P4TrendingSection
                games={trendingGames}
                hotGames={hotGames}
                vendorName={vendorName}
                onSelect={setDetailGame}
                onViewAll={() => router.push("/lobby?category=all#p4-catalog")}
              />
              <P4ActivityCard
                games={activeGames}
                feeds={activityFeeds}
                activeTab={activityTab}
                onTabChange={setActivityTab}
                onViewAll={() => router.push("/lobby?category=all#p4-catalog")}
              />
            </section>

            <P4CtaSection
              onExplore={() => router.push("/lobby?category=all#p4-catalog")}
              onRandomPick={() => {
                if (!activeGames.length) return;
                const randomIndex = Math.floor(Math.random() * activeGames.length);
                const game = activeGames[randomIndex];
                if (game) setDetailGame(game);
              }}
            />

            <P4ProviderSection
              providers={providerFeatures}
              selectedProvider={selectedProvider}
              providerGames={providerGames}
              providerGameCount={providerCatalog.length}
              vendorName={vendorName}
              onSelectProvider={(providerId) => {
                setSelectedProvider(providerId);
                window.requestAnimationFrame(() => scrollTo("p4-provider-games"));
              }}
              onSelectGame={setDetailGame}
              onViewAll={() => router.push("/lobby?category=all#p4-catalog")}
            />

            <P4LeaderboardCta onViewRanking={handleLeaderboardCta} />
          </div>
        </>
      )}

      {launchError ? (
        <div className="p4-launch-feedback" role="status">
          <span>{launchError}</span>
          <button type="button" onClick={clearError} aria-label="Tutup pesan">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {detailGame ? (
        <P4GameDetail
          game={detailGame}
          vendorName={vendorName(detailGame.vendor_id)}
          launching={launching === detailGame.id}
          onClose={() => setDetailGame(null)}
          onLaunch={(game) => void launch(game.id)}
          onLaunchDemo={(game) => void launchDemo(game.id)}
        />
      ) : null}
    </div>
  );
}

function P4CtaSection({
  onExplore,
  onRandomPick,
}: {
  onExplore: () => void;
  onRandomPick: () => void;
}) {
  return (
    <section id="p4-cta" className="p4-cta-grid" aria-label="Pilihan permainan">
      <article className="p4-action-card p4-action-card--discover">
        <div className="p4-action-card-art" aria-hidden="true">
          <Image src={CTA_ARTWORK.discover} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <div className="p4-action-card-copy">
          <h2>Temukan game baru hari ini</h2>
          <p>Jelajahi pilihan game yang dibuat untuk menemani waktumu.</p>
          <button type="button" className="p4-button p4-button--secondary" onClick={onExplore}>
            Jelajahi Game
          </button>
        </div>
      </article>

      <article className="p4-action-card p4-action-card--random">
        <div className="p4-action-card-art" aria-hidden="true">
          <Image src={CTA_ARTWORK.random} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <div className="p4-action-card-copy">
          <h2>Putar Pilihan</h2>
          <p>Belum tahu mau pilih yang mana? Kami pilihkan satu untukmu.</p>
          <button type="button" className="p4-button p4-button--secondary" onClick={onRandomPick}>
            Pilih Satu Game
          </button>
        </div>
      </article>
    </section>
  );
}

function P4LeaderboardCta({ onViewRanking }: { onViewRanking: () => void }) {
  return (
    <section className="p4-leaderboard-cta" aria-label="Papan peringkat">
      <div className="p4-leaderboard-cta-art" aria-hidden="true">
        <Image
          src="/assets/prototype-4/cta/leaderboard-banner.png"
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 1580px"
        />
      </div>
      <div className="p4-leaderboard-cta-copy">
        <span className="p4-leaderboard-cta-icon" aria-hidden="true">
          <i className="fa-solid fa-trophy" />
        </span>
        <div>
          <h2>Papan Peringkat</h2>
          <p>Lihat pilihan game yang sedang ramai minggu ini.</p>
        </div>
      </div>
      <button type="button" className="p4-button p4-button--dark" onClick={onViewRanking}>
        Lihat Peringkat
      </button>
    </section>
  );
}

function P4TopFiveSection({
  games,
  vendorName,
  onSelect,
}: {
  games: Game[];
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
}) {
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useP4HorizontalRail(games.length);

  return (
    <section className="p4-top-five" aria-labelledby="p4-top-five-title">
      <div className="p4-section-heading p4-top-five-heading">
        <span className="p4-top-five-mark" aria-hidden="true">
          <i className="fa-solid fa-ranking-star" />
        </span>
        <div>
          <h2 id="p4-top-five-title">Top 5 Minggu Ini</h2>
          <p>Game yang paling sering dimainkan.</p>
        </div>
      </div>
      <div
        className={`p4-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <button
            type="button"
            className="p4-rail-arrow p4-rail-prev"
            aria-label="Lihat peringkat sebelumnya"
            onClick={() => scrollRail("previous")}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
        ) : null}
        <div ref={railRef} className="p4-top-five-grid" tabIndex={0} aria-label="Top 5 minggu ini">
          {games.map((game, index) => (
            <P4GameCard
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
          <button
            type="button"
            className="p4-rail-arrow p4-rail-next"
            aria-label="Lihat peringkat berikutnya"
            onClick={() => scrollRail("next")}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function P4FeaturedSection({
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
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useP4HorizontalRail(games.length);

  return (
    <section className="p4-featured" aria-labelledby="p4-featured-title">
      <div className="p4-section-heading p4-section-heading--inline">
        <div>
          <h2 id="p4-featured-title">Pilihan Teratas</h2>
          <p>Koleksi game favorit untuk semua pemain.</p>
        </div>
        <button type="button" className="p4-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`p4-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <button
            type="button"
            className="p4-rail-arrow p4-rail-prev"
            aria-label="Lihat pilihan teratas sebelumnya"
            onClick={() => scrollRail("previous")}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
        ) : null}
        <div
          ref={railRef}
          className="p4-rail p4-rail--featured"
          tabIndex={0}
          aria-label="Pilihan teratas"
        >
          {games.map((game) => (
            <P4GameCard
              key={game.id}
              game={game}
              variant="portrait"
              vendorName={vendorName(game.vendor_id)}
              onSelect={onSelect}
            />
          ))}
        </div>
        {canScrollNext ? (
          <button
            type="button"
            className="p4-rail-arrow p4-rail-next"
            aria-label="Lihat pilihan teratas berikutnya"
            onClick={() => scrollRail("next")}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function P4TrendingSection({
  games,
  hotGames,
  vendorName,
  onSelect,
  onViewAll,
}: {
  games: Game[];
  hotGames: Game[];
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
  onViewAll: () => void;
}) {
  return (
    <div className="p4-trending">
      <P4GameRailSection
        games={games}
        title="Sedang Ramai Dimainkan"
        description="Game yang sedang banyak dimainkan."
        titleId="p4-trending-title"
        railLabel="Sedang ramai dimainkan"
        vendorName={vendorName}
        onSelect={onSelect}
        onViewAll={onViewAll}
      />
      <P4GameRailSection
        games={hotGames}
        title="Game Paling Hot"
        description="Game yang sedang paling diminati pemain."
        titleId="p4-hot-title"
        railLabel="Game paling hot"
        vendorName={vendorName}
        onSelect={onSelect}
        onViewAll={onViewAll}
      />
    </div>
  );
}

function P4GameRailSection({
  games,
  title,
  description,
  titleId,
  railLabel,
  vendorName,
  onSelect,
  onViewAll,
}: {
  games: Game[];
  title: string;
  description: string;
  titleId: string;
  railLabel: string;
  vendorName: (id: string) => string;
  onSelect: (game: Game) => void;
  onViewAll: () => void;
}) {
  const { railRef, canScrollPrev, canScrollNext, scrollRail } = useP4HorizontalRail(games.length);

  return (
    <section className="p4-game-rail-section" aria-labelledby={titleId}>
      <div className="p4-section-heading p4-section-heading--inline">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <button type="button" className="p4-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`p4-rail-wrap${canScrollPrev ? " has-previous" : ""}${
          canScrollNext ? " has-next" : ""
        }`}
      >
        {canScrollPrev ? (
          <button
            type="button"
            className="p4-rail-arrow p4-rail-prev"
            aria-label={`Lihat ${title.toLowerCase()} sebelumnya`}
            onClick={() => scrollRail("previous")}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
        ) : null}
        <div
          ref={railRef}
          className="p4-rail p4-rail--landscape"
          tabIndex={0}
          aria-label={railLabel}
        >
          {games.map((game) => (
            <P4GameCard
              key={game.id}
              game={game}
              variant="landscape"
              vendorName={vendorName(game.vendor_id)}
              onSelect={onSelect}
            />
          ))}
        </div>
        {canScrollNext ? (
          <button
            type="button"
            className="p4-rail-arrow p4-rail-next"
            aria-label={`Lihat ${title.toLowerCase()} berikutnya`}
            onClick={() => scrollRail("next")}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function P4ActivityCard({
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
    <section className="p4-activity-card" aria-labelledby="p4-activity-title">
      <div className="p4-activity-heading">
        <h2 id="p4-activity-title">Aktivitas</h2>
        <button type="button" className="p4-activity-view-all" onClick={onViewAll}>
          <i className="fa-solid fa-circle" aria-hidden="true" /> Lihat Semua
        </button>
      </div>
      <div className="p4-activity-tabs" role="tablist" aria-label="Jenis aktivitas">
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
        className={`p4-activity-table p4-activity-table--${activeTab}`}
        role="table"
        aria-label={labels[activeTab]}
      >
        <div className="p4-activity-row p4-activity-row--head" role="row">
          <span className="p4-activity-column-game">{gameColumn}</span>
          <span className="p4-activity-column-player">{playerColumn}</span>
          <span className="p4-activity-column-metric">{metricColumn}</span>
          <span className="p4-activity-column-result">{resultColumn}</span>
        </div>
        {rows.length ? (
          rows.map((row) => {
            const image = isLeaderboard ? undefined : gameImage(row.primary);
            const isProfit = row.result.startsWith("+") || row.result.startsWith("-");
            return (
              <div className="p4-activity-row" role="row" key={`${row.primary}-${row.player}`}>
                <span className="p4-activity-game">
                  <span className="p4-activity-icon" aria-hidden="true">
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
                <span className="p4-activity-column-player">{row.player}</span>
                <span className="p4-activity-column-metric">{row.metric}</span>
                {isProfit ? (
                  <span
                    className={`p4-activity-column-result p4-activity-profit${
                      row.result.startsWith("-") ? " is-loss" : " is-win"
                    }`}
                  >
                    {row.result}
                  </span>
                ) : (
                  <em className="p4-activity-column-result">{row.result}</em>
                )}
              </div>
            );
          })
        ) : (
          <div className="p4-activity-row p4-activity-empty" role="row">
            Belum ada data untuk aktivitas ini.
          </div>
        )}
      </div>
    </section>
  );
}

function P4ProviderSection({
  providers,
  selectedProvider,
  providerGames,
  providerGameCount,
  vendorName,
  onSelectProvider,
  onSelectGame,
  onViewAll,
}: {
  providers: readonly P4ProviderFeature[];
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
    <section className="p4-provider-section" id="p4-providers" aria-labelledby="p4-provider-title">
      <div className="p4-section-heading p4-section-heading--inline">
        <div>
          <h2 id="p4-provider-title">Provider Pilihan</h2>
          <p>Pilih provider favorit untuk melihat koleksi gamenya.</p>
        </div>
        <button type="button" className="p4-text-link" onClick={onViewAll}>
          Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div className="p4-provider-selector">
        {providers.map((provider) => (
          <button
            type="button"
            key={provider.id}
            aria-label={`${provider.name}: ${provider.description}`}
            aria-pressed={selectedProvider === provider.id}
            className={`p4-provider-card ${provider.featured ? "is-featured" : ""} ${
              selectedProvider === provider.id ? "is-selected" : ""
            }`}
            onClick={() => onSelectProvider(provider.id)}
          >
            <span className="p4-provider-mark" aria-hidden="true">
              <i className={provider.icon} />
            </span>
            <span className="p4-provider-copy">
              <strong>{provider.name}</strong>
            </span>
            {selectedProvider === provider.id ? (
              <span className="p4-provider-active-dot" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="p4-provider-games" id="p4-provider-games">
        <div className="p4-provider-games-heading">
          <span className="p4-provider-rule" aria-hidden="true" />
          <strong>
            {providers.find((provider) => provider.id === selectedProvider)?.name ??
              selectedProvider}
          </strong>
          <span className="p4-provider-rule" aria-hidden="true" />
        </div>
        <div className="p4-provider-games-grid-wrap">
          <div className="p4-provider-games-grid">
            {providerGames.map((game, index) => (
              <P4GameCard
                key={`${game.id}-${index}`}
                game={game}
                variant="landscape"
                vendorName={vendorName(game.vendor_id)}
                onSelect={onSelectGame}
              />
            ))}
          </div>
          {hasMoreProviderGames ? (
            <div className="p4-provider-games-overlay">
              <button type="button" className="p4-provider-games-more" onClick={onViewAll}>
                Lihat Semua <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function P4CatalogView({
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
  sort,
  activityGames,
  heroGame,
  vendorName,
  onSearch,
  onCategoryChange,
  onToggleProvider,
  onSortChange,
  onReset,
  isFilterOpen,
  onToggleFilter,
  onCloseFilter,
  onQuickPick,
  onHeroLaunch,
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
  sort: CatalogSort;
  activityGames: Game[];
  heroGame?: Game;
  vendorName: (id: string) => string;
  onSearch: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onToggleProvider: (providerId: string) => void;
  onSortChange: (sort: CatalogSort) => void;
  onReset: () => void;
  isFilterOpen: boolean;
  onToggleFilter: () => void;
  onCloseFilter: () => void;
  onQuickPick: (quickPick: CatalogQuickPick) => void;
  onHeroLaunch: () => void;
  onBrowse: () => void;
  onViewActivity: () => void;
  onPageChange: (page: number) => void;
  activityFeeds?: ActivityFeedsRes;
  onSelect: (game: Game) => void;
}) {
  const activeFilterCount =
    (category !== "all" ? 1 : 0) + selectedProviders.length + (sort !== "popular" ? 1 : 0);

  return (
    <section className="p4-catalog" id="p4-catalog" aria-labelledby="p4-catalog-title">
      <div className="p4-catalog-heading">
        <div>
          <h1 id="p4-catalog-title">{categoryLabel}</h1>
          <p>{totalGameCount} game tersedia untuk kamu.</p>
        </div>
        <label className="p4-catalog-search">
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
      <P4CatalogHero heroGame={heroGame} onLaunch={onHeroLaunch} onQuickPick={onQuickPick} />
      <div className="p4-catalog-body">
        <div className="p4-catalog-filter-shell">
          <button
            type="button"
            className="p4-catalog-filter-trigger"
            aria-controls="p4-catalog-filter-dialog"
            aria-expanded={isFilterOpen}
            onClick={onToggleFilter}
          >
            <span className="p4-catalog-filter-trigger-label">
              <i className="fa-solid fa-filter" aria-hidden="true" /> Filter Game
            </span>
            <span className="p4-catalog-filter-trigger-meta">
              {activeFilterCount ? `${activeFilterCount} filter aktif` : "Semua game"}
            </span>
            <i className="fa-solid fa-chevron-down" aria-hidden="true" />
          </button>
          <div
            id="p4-catalog-filter-dialog"
            className={`p4-catalog-filter-popover${isFilterOpen ? " is-open" : ""}`}
            role={isFilterOpen ? "dialog" : undefined}
            aria-modal={isFilterOpen ? true : undefined}
            aria-labelledby="p4-catalog-filter-title"
          >
            <button
              type="button"
              className="p4-catalog-filter-backdrop"
              aria-label="Tutup filter"
              onClick={onCloseFilter}
            />
            <div className="p4-catalog-filter-sheet">
              <P4CatalogFilter
                category={category}
                categoryOptions={categoryOptions}
                providerOptions={providerOptions}
                selectedProviders={selectedProviders}
                sort={sort}
                onCategoryChange={onCategoryChange}
                onToggleProvider={onToggleProvider}
                onSortChange={onSortChange}
                onReset={onReset}
                onClose={onCloseFilter}
              />
            </div>
          </div>
        </div>
        <div className="p4-catalog-main">
          <div className="p4-catalog-results-heading">
            <span>
              Menampilkan <strong>{totalGameCount}</strong> game
            </span>
            {selectedProviders.length ? (
              <span className="p4-catalog-filter-note">
                {selectedProviders.length} provider dipilih
              </span>
            ) : null}
          </div>
          {games.length ? (
            <>
              <div className="p4-catalog-grid" id="p4-catalog-grid">
                {games.map((game) => (
                  <P4GameCard
                    key={game.id}
                    game={game}
                    variant="landscape"
                    vendorName={vendorName(game.vendor_id)}
                    onSelect={onSelect}
                  />
                ))}
              </div>
              <P4CatalogPagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
            </>
          ) : (
            <div className="p4-empty-state">
              Belum ada game yang sesuai dengan filter pilihanmu.
            </div>
          )}
        </div>
      </div>
      <P4CatalogCta onExplore={onBrowse} />
      <P4CatalogActivity
        feeds={activityFeeds}
        games={activityGames}
        onSelect={onSelect}
        onViewAll={onViewActivity}
      />
    </section>
  );
}

function P4CatalogHero({
  heroGame,
  onLaunch,
  onQuickPick,
}: {
  heroGame?: Game;
  onLaunch: () => void;
  onQuickPick: (quickPick: CatalogQuickPick) => void;
}) {
  return (
    <section className="p4-catalog-hero" aria-labelledby="p4-catalog-hero-title">
      <div className="p4-catalog-hero-feature">
        <Image
          src={CATALOG_HERO_ART}
          alt="Neon Racer"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 72vw"
          className="p4-catalog-hero-image"
        />
        <div className="p4-catalog-hero-copy">
          <span className="p4-catalog-hero-badge">Game Pilihan</span>
          <h2 id="p4-catalog-hero-title">Neon Racer</h2>
          <p className="p4-catalog-hero-meta">Arcade · Habanero · Gratis Demo</p>
          <p>Kejar ritme kota dan taklukkan setiap tikungan.</p>
          <button
            type="button"
            className="p4-button p4-button--primary"
            disabled={!heroGame}
            onClick={onLaunch}
          >
            Mainkan Sekarang <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </div>
      <aside className="p4-catalog-quick-picks" aria-labelledby="p4-catalog-quick-title">
        <div className="p4-catalog-quick-heading">
          <div>
            <h2 id="p4-catalog-quick-title">Pilihan cepat</h2>
            <p>Temukan game sesuai seleramu.</p>
          </div>
        </div>
        <button
          type="button"
          className="p4-catalog-quick-pick"
          onClick={() => onQuickPick("popular")}
        >
          <span className="p4-catalog-quick-icon p4-catalog-quick-icon--hot" aria-hidden="true">
            <i className="fa-solid fa-fire" />
          </span>
          <span>
            <strong>Terpopuler</strong>
            <small>Game favorit pemain</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="p4-catalog-quick-pick"
          onClick={() => onQuickPick("newest")}
        >
          <span className="p4-catalog-quick-icon p4-catalog-quick-icon--new" aria-hidden="true">
            <i className="fa-solid fa-sun" />
          </span>
          <span>
            <strong>Game Baru</strong>
            <small>Rilis terbaru minggu ini</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
        <button type="button" className="p4-catalog-quick-pick" onClick={() => onQuickPick("live")}>
          <span className="p4-catalog-quick-icon p4-catalog-quick-icon--live" aria-hidden="true">
            <i className="fa-solid fa-circle-play" />
          </span>
          <span>
            <strong>Live Casino</strong>
            <small>Rasakan dealer langsung</small>
          </span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      </aside>
    </section>
  );
}

function P4CatalogFilter({
  category,
  categoryOptions,
  providerOptions,
  selectedProviders,
  sort,
  onCategoryChange,
  onToggleProvider,
  onSortChange,
  onReset,
  onClose,
}: {
  category: string;
  categoryOptions: CatalogCategoryOption[];
  providerOptions: CatalogProviderOption[];
  selectedProviders: string[];
  sort: CatalogSort;
  onCategoryChange: (category: string) => void;
  onToggleProvider: (providerId: string) => void;
  onSortChange: (sort: CatalogSort) => void;
  onReset: () => void;
  onClose?: () => void;
}) {
  return (
    <aside className="p4-catalog-filter" aria-labelledby="p4-catalog-filter-title">
      <div className="p4-catalog-filter-heading">
        <h2 id="p4-catalog-filter-title">
          <i className="fa-solid fa-filter" aria-hidden="true" /> Filter Game
        </h2>
        {onClose ? (
          <button type="button" className="p4-catalog-filter-close" onClick={onClose}>
            Tutup <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <fieldset className="p4-catalog-filter-group">
        <legend>Kategori Game</legend>
        <div className="p4-catalog-filter-pills">
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
      <fieldset className="p4-catalog-filter-group">
        <legend>Provider</legend>
        <div className="p4-catalog-provider-list">
          {providerOptions.map((provider) => (
            <label className="p4-catalog-provider-option" key={provider.id}>
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
      <fieldset className="p4-catalog-filter-group p4-catalog-sort-group">
        <legend>Urutkan</legend>
        <div className="p4-catalog-sort-list">
          {CATALOG_SORT_OPTIONS.map((option) => (
            <label className="p4-catalog-sort-option" key={option.id}>
              <input
                type="radio"
                name="catalog-sort"
                value={option.id}
                checked={sort === option.id}
                onChange={() => onSortChange(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" className="p4-catalog-filter-reset" onClick={onReset}>
        <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reset filter
      </button>
    </aside>
  );
}

function P4CatalogCta({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="p4-catalog-cta" aria-label="Temukan game baru">
      <Image
        src={CTA_ARTWORK.catalog}
        alt=""
        fill
        sizes="(max-width: 900px) 100vw, 1580px"
        className="p4-catalog-cta-image"
      />
      <div className="p4-catalog-cta-copy">
        <h2>Temukan game baru hari ini</h2>
        <p>Jelajahi pilihan game yang dibuat untuk menemani waktumu.</p>
        <button type="button" className="p4-button p4-button--primary" onClick={onExplore}>
          Jelajahi Game <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function P4CatalogActivity({
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
      className="p4-catalog-activity"
      id="p4-catalog-activity"
      aria-labelledby="p4-catalog-activity-title"
    >
      <div className="p4-catalog-activity-heading">
        <div className="p4-catalog-activity-title">
          <span className="p4-catalog-activity-icon" aria-hidden="true">
            <i className="fa-solid fa-gamepad" />
          </span>
          <div>
            <h2 id="p4-catalog-activity-title">Aktivitas &amp; Peringkat</h2>
            <p>Lihat game terbaru yang dimainkan dan pemain dengan skor tertinggi.</p>
          </div>
        </div>
        <button type="button" className="p4-text-link" onClick={onViewAll}>
          Lihat semua aktivitas <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div className="p4-catalog-activity-grid">
        <article className="p4-catalog-activity-panel">
          <div className="p4-catalog-activity-panel-heading">
            <h3>
              <i className="fa-regular fa-clock" aria-hidden="true" /> Game terbaru
            </h3>
          </div>
          <div className="p4-catalog-latest-table" role="table" aria-label="Game terbaru">
            <div className="p4-catalog-latest-header" role="row">
              <span>Game</span>
              <span>Player</span>
              <span>Multiplier</span>
              <span>Profit</span>
            </div>
            <div className="p4-catalog-latest-list">
              {latestRows.map((row) => {
                const game = gameByName(row.primary);
                return (
                  <button
                    type="button"
                    className="p4-catalog-latest-row"
                    key={`${row.primary}-${row.player}`}
                    onClick={() => game && onSelect(game)}
                    disabled={!game}
                  >
                    <span className="p4-catalog-latest-game">
                      <span className="p4-catalog-latest-art" aria-hidden="true">
                        {game?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={game.image_url} alt="" loading="lazy" decoding="async" />
                        ) : (
                          row.primary.charAt(0)
                        )}
                      </span>
                      <strong>{row.primary}</strong>
                    </span>
                    <span className="p4-catalog-latest-player">{row.player}</span>
                    <span className="p4-catalog-latest-multiplier">{row.metric}</span>
                    <span
                      className={`p4-catalog-latest-profit${
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
        <article className="p4-catalog-activity-panel">
          <div className="p4-catalog-activity-panel-heading">
            <h3>
              <i className="fa-solid fa-trophy" aria-hidden="true" /> Papan peringkat
            </h3>
            <button type="button" className="p4-text-link" onClick={onViewAll}>
              Lihat papan peringkat <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          </div>
          <div className="p4-catalog-ranking-list">
            {rankingRows.map((row) => {
              const gameName = feeds ? "" : row.primary;
              const game = gameName ? gameByName(gameName) : undefined;
              const rankLabel = feeds ? row.primary : row.metric;
              const rankNumber = rankLabel.replace("Peringkat ", "");
              return (
                <button
                  type="button"
                  className="p4-catalog-ranking-row"
                  key={`${row.primary}-${row.player}`}
                  onClick={() => game && onSelect(game)}
                  disabled={!game}
                >
                  <span className="p4-catalog-ranking-medal" aria-hidden="true">
                    <i className="fa-solid fa-crown" />
                  </span>
                  <span className="p4-catalog-ranking-avatar" aria-hidden="true">
                    {row.player.charAt(0)}
                  </span>
                  <span className="p4-catalog-ranking-copy">
                    <strong>{row.player}</strong>
                    <small>{feeds ? "Top pemain" : gameName}</small>
                  </span>
                  <span className="p4-catalog-ranking-score">{rankNumber}</span>
                </button>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

function getP4PaginationItems(page: number, pageCount: number): Array<number | "ellipsis"> {
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

function P4CatalogPagination({
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
    <nav className="p4-pagination" aria-label="Navigasi halaman game">
      <button
        type="button"
        className="p4-pagination-button p4-pagination-button--arrow"
        aria-label="Halaman sebelumnya"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
      </button>
      <div className="p4-pagination-pages">
        {getP4PaginationItems(page, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="p4-pagination-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={item}
              className={`p4-pagination-button${item === page ? " is-active" : ""}`}
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
        className="p4-pagination-button p4-pagination-button--arrow"
        aria-label="Halaman berikutnya"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
      <span className="p4-pagination-summary" aria-live="polite">
        Halaman {page} dari {pageCount}
      </span>
    </nav>
  );
}

function P4GameDetail({
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
      className="p4-game-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail ${game.name}`}
    >
      <button
        type="button"
        className="p4-game-modal-backdrop"
        onClick={onClose}
        aria-label="Tutup detail"
      />
      <div className="p4-game-dialog">
        <button
          type="button"
          className="p4-game-modal-close"
          onClick={onClose}
          aria-label="Tutup detail"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
        <div className="p4-game-dialog-art">
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
        <div className="p4-game-dialog-content">
          <span className="p4-dialog-eyebrow">{eyebrow ?? "Pilihan game"}</span>
          <h2>{game.name}</h2>
          <p className="p4-dialog-meta">
            {vendorName} <span aria-hidden="true">·</span> {game.category}
          </p>
          <p>{game.description ?? "Pilihan permainan untuk menemani sesi bermainmu."}</p>
          <div className="p4-dialog-actions">
            <button
              type="button"
              className="p4-button p4-button--primary"
              disabled={launching}
              onClick={() => onLaunch(game)}
            >
              <i className="fa-solid fa-play" aria-hidden="true" />
              {launching ? "Membuka..." : "Mainkan Sekarang"}
            </button>
            {game.demo_supported ? (
              <button
                type="button"
                className="p4-button p4-button--secondary"
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
