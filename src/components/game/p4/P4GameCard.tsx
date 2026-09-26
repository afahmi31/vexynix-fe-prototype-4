"use client";

import Image from "next/image";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Game } from "@/types/api";
import { useP4HoverPreview } from "@/components/game/p4/P4HoverPreview";

type P4GameCardProps = {
  demoFirst?: boolean;
  game: Game;
  vendorName: string;
  onSelect: (game: Game) => void;
  variant?: "portrait" | "landscape" | "ranked";
  rank?: number;
};

function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, onSelect: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onSelect();
  }
}

export function P4GameCard({
  demoFirst,
  game,
  vendorName,
  onSelect,
  variant = "portrait",
  rank,
}: P4GameCardProps) {
  const image = game.image_url;
  const hoverPreview = useP4HoverPreview();
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

  useEffect(() => {
    return () => cancelTouchPreview();
  }, []);

  const selectGame = () => {
    hoverPreview?.dismissPreview();
    onSelect(game);
  };

  return (
    <div
      className={`p4-game-card p4-game-card--${variant}`}
      onClick={() => {
        if (touchInteractionRef.current) {
          touchInteractionRef.current = false;
          return;
        }
        selectGame();
      }}
      onKeyDown={(event) => handleKeyDown(event, selectGame)}
      onPointerCancel={(event) => {
        if (event.pointerType !== "mouse") {
          touchStartPoint.current = null;
          touchMovedRef.current = true;
          cancelTouchPreview();
        }
      }}
      onPointerDown={(event) => {
        const target = event.target;
        const isButton = target instanceof HTMLElement && target.closest("button");

        if (event.pointerType !== "mouse" && hoverPreview && !isButton) {
          const card = event.currentTarget;
          touchInteractionRef.current = true;
          touchMovedRef.current = false;
          touchStartPoint.current = { x: event.clientX, y: event.clientY };
          cancelTouchPreview();
          touchPreviewTimer.current = window.setTimeout(() => {
            touchPreviewTimer.current = null;
            if (!touchMovedRef.current) {
              hoverPreview.openPreview(game, card, demoFirst);
            }
          }, 200);
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          hoverPreview?.openPreview(game, event.currentTarget, demoFirst);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") hoverPreview?.closePreview();
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
      role="button"
      tabIndex={0}
      aria-label={`Buka detail ${game.name}`}
    >
      {rank ? (
        <span className="p4-game-card-rank" aria-hidden="true">
          {rank === 1 ? <i className="fa-solid fa-crown" /> : null}
          <span>{rank}</span>
        </span>
      ) : null}
      <div className="p4-game-card-art">
        {image?.startsWith("/") ? (
          <Image
            src={image}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 42vw, (max-width: 1024px) 22vw, 180px"
            loading={variant === "ranked" && rank === 1 ? "eager" : "lazy"}
          />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={game.name} loading="lazy" decoding="async" />
        ) : (
          <span aria-hidden="true">{game.name.charAt(0)}</span>
        )}
        <span className="p4-game-card-shade" aria-hidden="true" />
        <span className="p4-game-card-copy">
          <strong>{game.name}</strong>
          <small>{vendorName}</small>
        </span>
      </div>
    </div>
  );
}
