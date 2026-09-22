"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Game } from "@/types/api";
import type { Prototype3GamePresentation } from "@/types/prototype-3";

const SLIDE_MS = 7000;

// Category → gradient fallback when a game has no artwork.
const categoryGradients: Record<string, string> = {
  slot: "linear-gradient(135deg, #667eea, #764ba2)",
  live: "linear-gradient(135deg, #f5576c, #f093fb)",
  table: "linear-gradient(135deg, #4facfe, #00f2fe)",
  fish: "linear-gradient(135deg, #43e97b, #38f9d7)",
};

const categoryLabels: Record<string, string> = {
  slot: "Slot",
  live: "Live Casino",
  table: "Table",
  fish: "Tembak Ikan",
};

function catKey(category?: string): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("slot")) return "slot";
  if (c.includes("live")) return "live";
  if (c.includes("fish")) return "fish";
  if (c.includes("table")) return "table";
  return "";
}

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface BillboardProps {
  games: Game[];
  vendorName: (id: string) => string;
  onLaunch: (id: string) => void;
  onInfo: (game: Game) => void;
  presentationFor?: (game: Game) => Prototype3GamePresentation | undefined;
  launching: boolean;
  disabled: boolean;
}

/**
 * Floating Netflix-style hero for rotating featured games. Auto-rotates every
 * 7s and pauses while hovered or focused.
 */
export function Billboard({
  games,
  vendorName,
  onLaunch,
  onInfo,
  presentationFor,
  launching,
  disabled,
}: BillboardProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isInViewport, setIsInViewport] = useState(true);
  const billboardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = billboardRef.current;
    if (!element || !("IntersectionObserver" in window)) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry?.isIntersecting ?? false);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !isInViewport || games.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % games.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [games.length, isInViewport, paused]);

  // Keep the index valid when the featured set shrinks (e.g. catalog refetch).
  useEffect(() => {
    if (index >= games.length) setIndex(0);
  }, [games.length, index]);

  if (games.length === 0) return null;

  const game = games[Math.min(index, games.length - 1)]!;
  const presentation = presentationFor?.(game);
  const key = catKey(game.category);
  const gradient = categoryGradients[key] ?? "linear-gradient(135deg, #6366f1, #d946ef)";
  const catLabel = categoryLabels[key] ?? game.category ?? "Game";
  const isLaunching = launching && !disabled;

  return (
    <section
      ref={billboardRef}
      className="billboard"
      aria-roledescription="carousel"
      aria-label="Game unggulan"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Backdrop slides (crossfading, blurred artwork) */}
      <div className="billboard-slides">
        {games.map((g, i) => (
          <div
            key={g.id}
            className={`billboard-slide ${i === index ? "active" : ""}`}
            aria-hidden={i !== index}
          >
            <div
              className="billboard-backdrop"
              style={
                (presentationFor?.(g)?.backdrop_url ?? g.image_url)
                  ? undefined
                  : { background: gradient }
              }
            >
              {(presentationFor?.(g)?.backdrop_url ?? g.image_url) &&
                ((presentationFor?.(g)?.backdrop_url ?? g.image_url)!.startsWith("/") ? (
                  <Image
                    src={presentationFor?.(g)?.backdrop_url ?? g.image_url ?? ""}
                    alt=""
                    aria-hidden="true"
                    fill
                    loading={i === 0 ? undefined : "lazy"}
                    priority={i === 0}
                    sizes="100vw"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={presentationFor?.(g)?.backdrop_url ?? g.image_url}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="billboard-shade" />
      <div className="billboard-bottom-fade" />

      <div className="billboard-inner">
        {/* Text content — remounts per slide for the fade-up animation */}
        <div className="billboard-content" key={`${game.id}-content`}>
          <div className="billboard-meta-top">
            <i className="fa-solid fa-gamepad" aria-hidden="true" />
            <span className="billboard-eyebrow">GAME UNGGULAN</span>
          </div>

          <h1 className="billboard-title">{game.name}</h1>

          <div className="billboard-meta">
            <span className="billboard-chip">{catLabel}</span>
            {game.rtp && (
              <span className="billboard-chip chip-rtp">RTP {(game.rtp * 100).toFixed(1)}%</span>
            )}
            {game.min_bet !== undefined && game.min_bet > 0 && (
              <span className="billboard-chip">Mulai {formatIDR(game.min_bet)}</span>
            )}
          </div>

          <p className="billboard-desc">
            {presentation?.tagline ??
              game.description ??
              "Mainkan " + game.name + " dari " + vendorName(game.vendor_id) + "."}
          </p>

          <div className="billboard-actions">
            <button
              className="billboard-play"
              onClick={() => !disabled && !isLaunching && onLaunch(game.id)}
              disabled={disabled || isLaunching}
            >
              {isLaunching ? (
                <span className="spinner-border spinner-border-sm" role="status" />
              ) : (
                <i className="fa fa-play" />
              )}
              Mainkan Sekarang
            </button>
            <button
              className="billboard-info"
              aria-label={`Lihat detail ${game.name}`}
              onClick={() => onInfo(game)}
            >
              <i className="fa fa-circle-info" />
              <span>Lihat Detail</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide indicators */}
      {games.length > 1 && (
        <div className="billboard-dots">
          {games.map((g, i) => (
            <button
              key={g.id}
              className={i === index ? "active" : ""}
              onClick={() => setIndex(i)}
              aria-label={`Game unggulan ${i + 1}: ${g.name}`}
              aria-current={i === index}
            />
          ))}
        </div>
      )}
    </section>
  );
}
