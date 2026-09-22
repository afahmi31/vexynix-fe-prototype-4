"use client";

import type { Game } from "@/types/api";
import type { Prototype3GameBadge } from "@/types/prototype-3";
import Image from "next/image";
import { useEffect, useRef } from "react";

interface GameCardProps {
  game: Game;
  vendorName?: string;
  onLaunch: (id: string) => void;
  /**
   * Free-play launch. Omitted by callers that have no demo path (e.g. a logged-out teaser);
   * the button only renders when this is supplied AND the game is flagged demo-capable.
   */
  onLaunchDemo?: (id: string) => void;
  onInfo?: (game: Game) => void;
  badges?: Prototype3GameBadge[];
  top10Rank?: number;
  /**
   * Makes FREE PLAY the card's primary action — the whole tile and the round button open the
   * demo, and the secondary pill becomes "Mainkan dengan Saldo". Used by the "Coba Gratis" shelf,
   * where a tile that quietly spent real money would be a genuine trap. Ignored unless the
   * game is demo-capable.
   */
  demoFirst?: boolean;
  disabled?: boolean;
  launching?: boolean;
  onHoverPreviewEnter?: (card: HTMLDivElement) => void;
  onHoverPreviewLeave?: () => void;
}

// Map game category → CSS class suffix for gradient backgrounds.
const categoryClassMap: Record<string, string> = {
  slot: "game-card-slot",
  live: "game-card-live",
  "live casino": "game-card-live",
  table: "game-card-table",
  "table games": "game-card-table",
  fish: "game-card-fish",
  "fish hunter": "game-card-fish",
  lottery: "game-card-lottery",
  sports: "game-card-sports",
  arcade: "game-card-arcade",
};

// Category badge display labels.
const categoryLabelMap: Record<string, string> = {
  slot: "Slot",
  live: "Live",
  "live casino": "Live",
  table: "Table",
  "table games": "Table",
  fish: "Fish",
  "fish hunter": "Fish",
  lottery: "Lottery",
  sports: "Sports",
  arcade: "Arcade",
};

export function GameCard({
  game,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  badges,
  top10Rank,
  demoFirst,
  disabled,
  launching,
  onHoverPreviewEnter,
  onHoverPreviewLeave,
}: GameCardProps) {
  const catKey = game.category?.toLowerCase() ?? "";
  const catClass = categoryClassMap[catKey] ?? "game-card-default";
  const catLabel = categoryLabelMap[catKey] ?? game.category ?? "Game";
  const initial = game.name.charAt(0).toUpperCase();
  const isLaunching = launching && !disabled;
  // Both conditions matter: the catalog flag says the vendor supports free play for this game,
  // and the callback says this surface has somewhere to send it.
  const canDemo = Boolean(game.demo_supported && onLaunchDemo);
  const demoIsPrimary = canDemo && demoFirst === true;
  const supportsHoverPreview = Boolean(onHoverPreviewEnter && onHoverPreviewLeave);
  const touchInteractionRef = useRef(false);
  const touchPreviewTimer = useRef<number | null>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

  const cancelTouchPreview = () => {
    if (touchPreviewTimer.current !== null) {
      window.clearTimeout(touchPreviewTimer.current);
      touchPreviewTimer.current = null;
    }
  };

  useEffect(() => cancelTouchPreview, []);
  const visibleBadges = badges?.length
    ? badges.slice(0, 3)
    : [
        ...(top10Rank
          ? [
              {
                kind: "top10" as const,
                label: "Top 10",
                tone: "accent" as const,
                rank: top10Rank,
                source: "mock-editorial" as const,
              },
            ]
          : []),
        ...(game.is_new
          ? [
              {
                kind: "new" as const,
                label: "Baru",
                tone: "success" as const,
                source: "catalog" as const,
              },
            ]
          : []),
        ...(game.is_popular && !top10Rank
          ? [
              {
                kind: "popular" as const,
                label: "Populer",
                tone: "warning" as const,
                source: "catalog" as const,
              },
            ]
          : []),
        ...(game.is_featured && !top10Rank
          ? [
              {
                kind: "editorial" as const,
                label: "Pilihan",
                tone: "neutral" as const,
                source: "mock-editorial" as const,
              },
            ]
          : []),
        ...(canDemo
          ? [
              {
                kind: "demo" as const,
                label: "Gratis",
                tone: "neutral" as const,
                source: "catalog" as const,
              },
            ]
          : []),
      ].slice(0, 3);
  // One definition of "what the tile does", used by the click handler, the keyboard handler
  // and the round button alike — so the three can never drift apart into a tile that plays
  // free and a button that plays for money.
  const primary = () => {
    if (disabled || isLaunching) return;
    if (demoIsPrimary) onLaunchDemo?.(game.id);
    else onLaunch(game.id);
  };
  const secondary = () => {
    if (disabled || isLaunching) return;
    if (demoIsPrimary) onLaunch(game.id);
    else onLaunchDemo?.(game.id);
  };

  return (
    <div
      className={`game-card ${catClass} ${supportsHoverPreview ? "game-card--hover-preview" : ""}`}
      onClick={() => {
        if (touchInteractionRef.current) {
          touchInteractionRef.current = false;
          return;
        }
        primary();
      }}
      role="button"
      tabIndex={0}
      onPointerDown={(event) => {
        const target = event.target;
        const isButton = target instanceof HTMLElement && target.closest("button");

        if (event.pointerType !== "mouse" && !isButton) {
          const card = event.currentTarget;
          touchInteractionRef.current = true;
          touchMovedRef.current = false;
          touchStartPoint.current = { x: event.clientX, y: event.clientY };
          cancelTouchPreview();
          touchPreviewTimer.current = window.setTimeout(() => {
            touchPreviewTimer.current = null;
            if (!touchMovedRef.current) onHoverPreviewEnter?.(card);
          }, 200);
        }
      }}
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" || !touchStartPoint.current) return;

        const distance = Math.hypot(
          event.clientX - touchStartPoint.current.x,
          event.clientY - touchStartPoint.current.y
        );
        if (distance > 8) {
          touchMovedRef.current = true;
          cancelTouchPreview();
        }
      }}
      onPointerUp={(event) => {
        if (event.pointerType !== "mouse") touchStartPoint.current = null;
      }}
      onPointerCancel={(event) => {
        if (event.pointerType !== "mouse") {
          touchStartPoint.current = null;
          touchMovedRef.current = true;
          cancelTouchPreview();
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          onHoverPreviewEnter?.(event.currentTarget);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onHoverPreviewLeave?.();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") primary();
      }}
    >
      {/* Background image / gradient placeholder */}
      <div className="game-card-image">
        {game.image_url ? (
          game.image_url.startsWith("/") ? (
            <Image
              src={game.image_url}
              alt={game.name}
              fill
              loading="lazy"
              sizes="(max-width: 767px) 25vw, (max-width: 1199px) 17vw, 260px"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.image_url} alt={game.name} decoding="async" loading="lazy" />
          )
        ) : (
          <span>{initial}</span>
        )}
      </div>

      {/* Top badges: category + tags */}
      <div className="game-card-badges">
        <span className="game-card-badge-cat">{catLabel}</span>
        <div className="game-card-badge-tags">
          {visibleBadges.map((badge) => (
            <span
              key={badge.kind + (badge.rank ?? "")}
              className={"game-card-tag tag-" + badge.kind}
            >
              {badge.kind === "demo" ? "Gratis" : badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* Hover overlay with Play button */}
      <div className="game-card-overlay">
        <button
          className={`game-card-play-btn ${isLaunching ? "loading" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            primary();
          }}
          disabled={disabled || isLaunching}
          aria-label={demoIsPrimary ? `Coba ${game.name} gratis` : `Mainkan ${game.name}`}
        >
          {isLaunching ? (
            <span className="spinner-border spinner-border-sm" role="status" />
          ) : (
            <i className="fa fa-play" />
          )}
        </button>
        {canDemo && (
          <button
            className="game-card-demo-btn"
            onClick={(e) => {
              // The tile has its own launch on click, so this must not bubble — a swallowed
              // stopPropagation here would fire BOTH, and one of them spends real money.
              e.stopPropagation();
              secondary();
            }}
            disabled={disabled || isLaunching}
            aria-label={
              demoIsPrimary ? `Mainkan ${game.name} dengan saldo` : `Coba ${game.name} gratis`
            }
          >
            {demoIsPrimary ? "Mainkan dengan Saldo" : "Coba Gratis"}
          </button>
        )}
        {onInfo && (
          <button
            className="game-card-detail-btn"
            onClick={(e) => {
              e.stopPropagation();
              onInfo(game);
            }}
          >
            <i className="fa fa-circle-info me-1" />
            Lihat Detail
          </button>
        )}
        {game.rtp && <div className="game-card-rtp">RTP {(game.rtp * 100).toFixed(1)}%</div>}
        {game.min_bet !== undefined && game.max_bet !== undefined && game.min_bet > 0 && (
          <div className="game-card-rtp" style={{ color: "rgba(255,255,255,0.7)" }}>
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(game.min_bet)}
            {" – "}
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(game.max_bet)}
          </div>
        )}
        <div className="game-card-overlay-info">
          <div className="game-card-name">{game.name}</div>
          {vendorName && <div className="game-card-vendor">{vendorName}</div>}
        </div>
      </div>

      {/* Bottom info bar (always visible) */}
      <div className="game-card-info">
        <div className="game-card-name">{game.name}</div>
        {vendorName && <div className="game-card-vendor">{vendorName}</div>}
      </div>
    </div>
  );
}
