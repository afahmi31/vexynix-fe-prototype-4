"use client";

import { useState } from "react";
import type { Game } from "@/types/api";
import type { Prototype3FeatureConfig } from "@/types/prototype-3";

export function LobbyFeatureRail({
  spinner,
  luckyPick,
  games,
  onInfo,
}: {
  spinner: Prototype3FeatureConfig;
  luckyPick: Prototype3FeatureConfig;
  games: Game[];
  onInfo: (game: Game) => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const [spinMessage, setSpinMessage] = useState<string | null>(null);
  const [pickedGame, setPickedGame] = useState<Game | null>(null);

  const pickGame = () => {
    const candidates = games.filter((game) => game.demo_supported);
    if (candidates.length === 0) return null;
    const game = candidates[Math.floor(Math.random() * candidates.length)]!;
    setPickedGame(game);
    return game;
  };

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setSpinMessage(null);
    window.setTimeout(() => {
      setSpinning(false);
      const game = pickGame();
      setSpinMessage(
        game
          ? "Pilihanmu siap. Lihat detailnya atau langsung mulai coba gratis."
          : "Belum ada game demo yang tersedia untuk dipilih."
      );
    }, 900);
  };

  if (!spinner.enabled && !luckyPick.enabled) return null;

  const feature = luckyPick.enabled ? luckyPick : spinner;
  const imageUrl = feature.image_url || luckyPick.image_url || spinner.image_url;
  const actionLabel = feature.action_label;

  return (
    <section className="lobby-feature-rail" id="lobby-features">
      <article
        className="lobby-lucky-pick"
        style={
          imageUrl
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(4, 18, 49, 0.96) 0%, rgba(8, 23, 73, 0.78) 39%, rgba(8, 17, 69, 0.35) 72%, rgba(4, 16, 46, 0.72) 100%), url("${imageUrl}")`,
              }
            : undefined
        }
      >
        <div className="lobby-lucky-copy">
          <span className="lobby-feature-eyebrow">Butuh rekomendasi cepat?</span>
          <h2>
            <i
              className={
                feature.id === "lucky-pick"
                  ? "fa-solid fa-clover"
                  : "fa-solid fa-wand-magic-sparkles"
              }
            />{" "}
            {feature.title}
          </h2>
          <p>
            {pickedGame
              ? `Pilihanmu: ${pickedGame.name}. Siap dicoba sekarang?`
              : feature.description}
          </p>
          {spinMessage && <span className="lobby-feature-result">{spinMessage}</span>}
          <button
            type="button"
            onClick={() => {
              if (pickedGame) onInfo(pickedGame);
              else if (spinner.enabled) spin();
              else pickGame();
            }}
            disabled={spinning}
          >
            <i className="fa-solid fa-rotate" />
            {spinning ? "Sedang memilih..." : pickedGame ? "Lihat Pilihan" : actionLabel}
          </button>
        </div>

        <div className={"lobby-lucky-art " + (spinning ? "is-spinning" : "")} aria-hidden="true" />

        <div className="lobby-lucky-rewards" aria-label="Hadiah Lucky Pick">
          <span>Bonus Saldo</span>
          <span>Free Spin</span>
          <span>Hadiah Misteri</span>
          <span>Cashback</span>
        </div>
      </article>
    </section>
  );
}
