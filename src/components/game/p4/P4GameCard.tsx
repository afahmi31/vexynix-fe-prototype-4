"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import type { Game } from "@/types/api";

type P4GameCardProps = {
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
  game,
  vendorName,
  onSelect,
  variant = "portrait",
  rank,
}: P4GameCardProps) {
  const image = game.image_url;

  return (
    <div
      className={`p4-game-card p4-game-card--${variant}`}
      onClick={() => onSelect(game)}
      onKeyDown={(event) => handleKeyDown(event, () => onSelect(game))}
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
