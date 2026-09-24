"use client";

import { useEffect } from "react";
import type { Game } from "@/types/api";
import type { P4GamePresentation } from "@/types/p4";

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    slot: "Slot",
    live: "Live Casino",
    table: "Table Games",
    fish: "Tembak Ikan",
    sports: "Sports",
    arcade: "Arcade",
  };
  return labels[category.toLowerCase()] ?? category;
}

export function GameDetailModal({
  game,
  vendorName,
  presentation,
  relatedGames,
  onClose,
  onLaunch,
  onLaunchDemo,
  onInfo,
  launching,
}: {
  game: Game;
  vendorName: string;
  presentation?: P4GamePresentation;
  relatedGames: Game[];
  onClose: () => void;
  onLaunch: (id: string) => void;
  onLaunchDemo?: (id: string) => void;
  onInfo: (game: Game) => void;
  launching: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const backdrop = presentation?.backdrop_url ?? presentation?.poster_url ?? game.image_url;
  const poster = presentation?.poster_url ?? game.image_url;
  const canDemo = Boolean(game.demo_supported && onLaunchDemo);
  const badges = presentation?.badges ?? [];

  return (
    <div
      className="game-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-label={"Detail " + game.name}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="game-detail-dialog">
        <button
          type="button"
          className="game-detail-close"
          onClick={onClose}
          aria-label="Tutup detail game"
        >
          <i className="fa fa-xmark" />
        </button>

        <div className="game-detail-hero">
          {backdrop && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdrop} alt="" aria-hidden="true" />
          )}
          <div className="game-detail-hero-shade" />
          <div className="game-detail-hero-copy">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="game-detail-poster" src={poster} alt={game.name} />
            )}
            <div>
              <div className="game-detail-kicker">
                <span>{categoryLabel(game.category)}</span>
                <span>{vendorName}</span>
              </div>
              <h2>{game.name}</h2>
              {presentation?.tagline && <p>{presentation.tagline}</p>}
            </div>
          </div>
        </div>

        <div className="game-detail-body">
          <div className="game-detail-actions">
            <button
              type="button"
              className="game-detail-play"
              onClick={() => onLaunch(game.id)}
              disabled={launching}
            >
              {launching ? (
                <span className="spinner-border spinner-border-sm" role="status" />
              ) : (
                <i className="fa fa-play" />
              )}
              Mainkan Sekarang
            </button>
            {canDemo && (
              <button
                type="button"
                className="game-detail-secondary"
                onClick={() => onLaunchDemo?.(game.id)}
                disabled={launching}
              >
                <i className="fa fa-circle-play" />
                Coba Demo Gratis
              </button>
            )}
          </div>

          <div className="game-detail-meta" aria-label="Informasi game">
            {badges.map((badge) => (
              <span
                key={badge.kind + (badge.rank ?? "")}
                className={"game-detail-badge tone-" + badge.tone}
              >
                {badge.label}
              </span>
            ))}
            {game.rtp !== undefined && (
              <span>
                RTP <strong>{(game.rtp * 100).toFixed(1)}%</strong>
              </span>
            )}
            <span>Mulai {formatIDR(game.min_bet)}</span>
            <span>Sampai {formatIDR(game.max_bet)}</span>
          </div>

          <p className="game-detail-synopsis">
            {presentation?.synopsis ??
              game.description ??
              "Jelajahi " + game.name + " bersama " + vendorName + "."}
          </p>

          {relatedGames.length > 0 && (
            <section className="game-detail-related">
              <div className="game-detail-section-heading">
                <h3>Game Serupa</h3>
                <span>Masih dalam kategori yang sama</span>
              </div>
              <div className="game-detail-related-grid">
                {relatedGames.map((relatedGame) => {
                  return (
                    <button
                      type="button"
                      className="game-detail-related-card"
                      key={relatedGame.id}
                      onClick={() => onInfo(relatedGame)}
                    >
                      {relatedGame.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={relatedGame.image_url} alt="" />
                      ) : (
                        <span>{relatedGame.name.charAt(0)}</span>
                      )}
                      <span>{relatedGame.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
