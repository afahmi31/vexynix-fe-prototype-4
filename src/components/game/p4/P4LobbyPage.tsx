"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog, useVendors } from "@/hooks/useCatalog";
import { useLaunchGame } from "@/hooks/useLaunchGame";
import { useActionDisabled } from "@/hooks/useTransactionLock";
import { useAuthModalStore } from "@/stores/auth-modal";
import { MOCK_CATALOG, MOCK_VENDORS } from "@/mocks/prototype-3";
import type { Game, Vendor } from "@/types/api";
import { NEXT_PARAM, safeNextPath } from "@/lib/auth-redirect";
import { P4GameCard } from "@/components/game/p4/P4GameCard";

const HERO_BACKDROP = "/assets/prototype-4/hero/neon-racer-sunset.png";

const CTA_ARTWORK = {
  discover: "/assets/prototype-4/cta/discover-games.png",
  random: "/assets/prototype-4/cta/random-game.png",
} as const;

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
    backdrop: "/assets/prototype-3/heroes/solar-riches-backdrop.png",
    meta: "Slot  ·  PG Soft  ·  Gratis Demo",
    description: "Temukan kuil emas dan nikmati putaran bertema matahari.",
  },
  {
    gameId: "velvet-roulette",
    title: "Velvet Roulette",
    backdrop: "/assets/prototype-3/heroes/velvet-roulette-backdrop.png",
    meta: "Live Casino  ·  Evolution  ·  Live Play",
    description: "Nikmati suasana meja malam yang elegan.",
  },
  {
    gameId: "deep-sea-odyssey",
    title: "Deep Sea Odyssey",
    backdrop: "/assets/prototype-3/heroes/deep-sea-odyssey-backdrop.png",
    meta: "Tembak Ikan  ·  Naga Games  ·  Gratis Demo",
    description: "Mulai petualangan di kedalaman yang penuh warna.",
  },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: "Semua Game",
  slot: "Slot",
  live: "Live Casino",
  table: "Table Games",
  fish: "Tembak Ikan",
  sports: "Sports",
  arcade: "Arcade",
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
    ["Velvet Roulette", "Raka88", "Baru saja", "Menang"],
    ["Neon Racer", "MawarSakti", "2 menit lalu", "Menang"],
    ["Solar Riches", "OceanHunter", "4 menit lalu", "Kalah"],
    ["Deep Sea Odyssey", "LautBiru", "6 menit lalu", "Menang"],
    ["Sugar Rush 1000", "BungaMalam", "7 menit lalu", "Menang"],
    ["Lightning Roulette", "NonaMalam", "8 menit lalu", "Menang"],
    ["Gates of Olympus", "Jackpot88", "10 menit lalu", "Menang"],
    ["Starlight Princess", "Bintang777", "12 menit lalu", "Kalah"],
    ["Fortune Ox", "SultanMuda", "14 menit lalu", "Menang"],
    ["Lucky Fortune Cat", "KucingEmas", "16 menit lalu", "Menang"],
    ["Phoenix Rises", "Phoenix88", "18 menit lalu", "Menang"],
    ["Mystic Potions", "MysticGirl", "20 menit lalu", "Menang"],
    ["Reel Royale", "ReelMaster", "22 menit lalu", "Kalah"],
    ["Candy Superwin", "CandyKing", "24 menit lalu", "Menang"],
    ["Fortune of Giza", "GizaHunter", "26 menit lalu", "Menang"],
    ["Mahjong Ways 2", "Tiles88", "28 menit lalu", "Menang"],
    ["Sweet Bonanza", "Bonanza77", "30 menit lalu", "Kalah"],
    ["Wanted Dead or a Wild", "WildWest99", "32 menit lalu", "Menang"],
  ],
  active: [
    ["Deep Sea Odyssey", "LautBiru", "Sedang bermain", "Aktif"],
    ["Sugar Rush", "BungaMalam", "Sedang bermain", "Aktif"],
    ["Velvet Roulette", "Raka88", "Sedang bermain", "Aktif"],
    ["Neon Racer", "MawarSakti", "Sedang bermain", "Aktif"],
    ["Solar Riches", "OceanHunter", "Sedang bermain", "Aktif"],
    ["Starlight Princess", "Bintang777", "Sedang bermain", "Aktif"],
    ["Gates of Olympus", "Jackpot88", "Sedang bermain", "Aktif"],
    ["Lightning Roulette", "NonaMalam", "Sedang bermain", "Aktif"],
    ["Deep Sea Odyssey", "Samudra88", "Sedang bermain", "Aktif"],
    ["Sugar Rush 1000", "BungaMalam", "Sedang bermain", "Aktif"],
    ["Phoenix Rises", "Phoenix88", "Sedang bermain", "Aktif"],
    ["Mystic Potions", "MysticGirl", "Sedang bermain", "Aktif"],
    ["Reel Royale", "ReelMaster", "Sedang bermain", "Aktif"],
    ["Candy Superwin", "CandyKing", "Sedang bermain", "Aktif"],
    ["Fortune of Giza", "GizaHunter", "Sedang bermain", "Aktif"],
    ["Mahjong Ways 2", "Tiles88", "Sedang bermain", "Aktif"],
    ["Sweet Bonanza", "Bonanza77", "Sedang bermain", "Aktif"],
    ["Wanted Dead or a Wild", "WildWest99", "Sedang bermain", "Aktif"],
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

const PROVIDER_GAME_LIMIT = 18;

function activeGamesFrom(data: { games?: Game[] } | undefined): Game[] {
  const source = data?.games?.length ? data.games : MOCK_CATALOG;
  return source.filter((game) => game.status === "active");
}

function vendorsFrom(data: { vendors?: Vendor[] } | undefined): Vendor[] {
  return data?.vendors?.length ? data.vendors : MOCK_VENDORS;
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
  const { launch, launchDemo, launching, error: launchError, clearError } = useLaunchGame();
  const actionDisabled = useActionDisabled();
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const openRegister = useAuthModalStore((state) => state.openRegister);

  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("pragmaticplay");
  const [activityTab, setActivityTab] = useState<ActivityTab>("latest");
  const [catalogSearch, setCatalogSearch] = useState("");
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

  const category = searchParams.get("category") ?? "home";
  const categoryLabel = CATEGORY_LABELS[category] ?? "Semua Game";
  const isCatalogView = category !== "home";

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
  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return activeGames
      .filter((game) => category === "all" || game.category.toLowerCase().includes(category))
      .filter((game) => !query || game.name.toLowerCase().includes(query));
  }, [activeGames, catalogSearch, category]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHeroLaunch = () => {
    if (!heroGame || actionDisabled) return;
    if (heroGame.demo_supported) void launchDemo(heroGame.id);
    else void launch(heroGame.id);
  };

  return (
    <div className="p4-lobby">
      {isCatalogView ? (
        <P4CatalogView
          categoryLabel={categoryLabel}
          games={filteredCatalog}
          search={catalogSearch}
          vendorName={vendorName}
          onSearch={setCatalogSearch}
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
  activeTab,
  onTabChange,
  onViewAll,
}: {
  games: Game[];
  activeTab: ActivityTab;
  onTabChange: (tab: ActivityTab) => void;
  onViewAll: () => void;
}) {
  const labels: Record<ActivityTab, string> = {
    latest: "Aktivitas Terbaru",
    active: "Pemain Aktif",
    leaderboard: "Papan Peringkat",
  };
  const rows = ACTIVITY_SETS[activeTab];
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
      <div className="p4-activity-table" role="table" aria-label={labels[activeTab]}>
        <div className="p4-activity-row p4-activity-row--head" role="row">
          <span>Game</span>
          <span>Pemain</span>
          <span>Waktu</span>
          <span>Hasil</span>
        </div>
        {rows.map(([game, player, time, result]) => {
          const image = gameImage(game);
          return (
            <div className="p4-activity-row" role="row" key={`${game}-${player}`}>
              <span className="p4-activity-game">
                <span className="p4-activity-icon" aria-hidden="true">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    game.charAt(0)
                  )}
                </span>
                <strong>{game}</strong>
              </span>
              <span>{player}</span>
              <span>{time}</span>
              <em className={result === "Kalah" ? "is-loss" : result === "Aktif" ? "is-live" : ""}>
                {result}
              </em>
            </div>
          );
        })}
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
      <div className="p4-provider-grid">
        {providers.map((provider) => (
          <button
            type="button"
            key={provider.id}
            className={`p4-provider-card ${provider.featured ? "is-featured" : ""} ${
              selectedProvider === provider.id ? "is-selected" : ""
            }`}
            onClick={() => onSelectProvider(provider.id)}
          >
            {provider.image ? (
              <span className="p4-provider-art" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={provider.image} alt="" loading="lazy" decoding="async" />
              </span>
            ) : null}
            <span className="p4-provider-mark" aria-hidden="true">
              <i className={provider.icon} />
            </span>
            <span className="p4-provider-copy">
              <strong>{provider.name}</strong>
              <small>{provider.description}</small>
            </span>
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
  search,
  vendorName,
  onSearch,
  onSelect,
}: {
  categoryLabel: string;
  games: Game[];
  search: string;
  vendorName: (id: string) => string;
  onSearch: (value: string) => void;
  onSelect: (game: Game) => void;
}) {
  return (
    <section className="p4-catalog" id="p4-catalog" aria-labelledby="p4-catalog-title">
      <div className="p4-catalog-heading">
        <div>
          <h1 id="p4-catalog-title">{categoryLabel}</h1>
          <p>{games.length} game tersedia untuk kamu.</p>
        </div>
        <label className="p4-catalog-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <span className="visually-hidden">Cari game</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Cari game..."
            type="search"
          />
        </label>
      </div>
      {games.length ? (
        <div className="p4-catalog-grid">
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
      ) : (
        <div className="p4-empty-state">Belum ada game yang sesuai dengan pencarianmu.</div>
      )}
    </section>
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
