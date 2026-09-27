"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Game } from "@/types/api";

const ASSET_ROOT = "/assets/member/spinner";
const SPINNER_GAME_IDS = [
  "neon-racer",
  "solar-riches",
  "velvet-roulette",
  "deep-sea-odyssey",
  "sweet-bonanza",
  "gates-of-olympus",
  "mahjong-ways-2",
  "lucky-fortune-cat",
] as const;
const SEGMENT_ANGLE = 360 / SPINNER_GAME_IDS.length;
const POINTER_ANGLE = -90;
const FULL_ROTATIONS = 5;
const SPIN_DURATION = 4800;

type SpinnerState = "idle" | "spinning" | "win";

interface MemberGameSpinnerProps {
  games: Game[];
  onSelect: (game: Game) => void;
}

interface AvailableSegment {
  game: Game;
  index: number;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function targetRotationFor(currentRotation: number, selectedIndex: number): number {
  const selectedCenterAngle = POINTER_ANGLE + selectedIndex * SEGMENT_ANGLE;
  const desiredRotation = POINTER_ANGLE - selectedCenterAngle;
  const remainder = normalizeAngle(desiredRotation - normalizeAngle(currentRotation));

  return currentRotation + FULL_ROTATIONS * 360 + remainder;
}

function SpinnerLayer({
  fileName,
  className,
  alt = "",
  priority = false,
}: {
  fileName: string;
  className: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <div className={`member-game-spinner__layer ${className}`} aria-hidden={!alt}>
      <Image
        src={`${ASSET_ROOT}/${fileName}`}
        alt={alt}
        fill
        sizes="(max-width: 760px) 92vw, (max-width: 1100px) 44vw, 520px"
        priority={priority}
      />
    </div>
  );
}

export function MemberGameSpinner({ games, onSelect }: MemberGameSpinnerProps) {
  const selectorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const rotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [spinnerState, setSpinnerState] = useState<SpinnerState>("idle");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Tekan putar untuk menemukan game berikutnya.");

  const availableSegments = useMemo<AvailableSegment[]>(
    () =>
      SPINNER_GAME_IDS.flatMap((gameId, index) => {
        const game = games.find((item) => item.id === gameId);
        return game ? [{ game, index }] : [];
      }),
    [games]
  );
  const selectedGame = selectedGameId
    ? games.find((game) => game.id === selectedGameId)
    : undefined;

  useEffect(() => {
    return () => {
      animationRef.current?.cancel();
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const spin = useCallback(() => {
    if (spinnerState === "spinning" || !availableSegments.length) return;

    const picked = availableSegments[Math.floor(Math.random() * availableSegments.length)];
    if (!picked) return;

    const selector = selectorRef.current;
    const currentRotation = rotationRef.current;
    const targetRotation = targetRotationFor(currentRotation, picked.index);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 1 : SPIN_DURATION;

    setSpinnerState("spinning");
    setSelectedGameId(null);
    setAnnouncement("Memutar selector untuk memilih game...");

    if (!selector) {
      rotationRef.current = targetRotation;
      setRotation(targetRotation);
      setSelectedGameId(picked.game.id);
      setSpinnerState("win");
      setAnnouncement(`Pilihanmu: ${picked.game.name}.`);
      return;
    }

    animationRef.current?.cancel();
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
    }
    let animation: Animation | null = null;
    const completeSpin = () => {
      if (animation && animationRef.current !== animation) return;

      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
      selector.style.transform = `rotate(${targetRotation}deg)`;
      animation?.cancel();
      animationRef.current = null;
      rotationRef.current = targetRotation;
      setRotation(targetRotation);
      setSelectedGameId(picked.game.id);
      setSpinnerState("win");
      setAnnouncement(`Pilihanmu: ${picked.game.name}.`);
    };

    try {
      animation = selector.animate(
        [
          { transform: `rotate(${currentRotation}deg)` },
          {
            transform: `rotate(${currentRotation + 24}deg)`,
            offset: 0.06,
          },
          {
            transform: `rotate(${currentRotation - 12}deg)`,
            offset: 0.12,
          },
          {
            transform: `rotate(${targetRotation - 22}deg)`,
            offset: 0.78,
          },
          {
            transform: `rotate(${targetRotation + 5}deg)`,
            offset: 0.94,
          },
          { transform: `rotate(${targetRotation}deg)` },
        ],
        {
          duration,
          easing: "cubic-bezier(0.12, 0.68, 0.18, 1)",
          fill: "forwards",
        }
      );
      animationRef.current = animation;
      animation.addEventListener("finish", completeSpin, { once: true });
    } catch {
      completeSpin();
      return;
    }

    completionTimeoutRef.current = window.setTimeout(completeSpin, duration + 180);
  }, [availableSegments, spinnerState]);

  const handleResultSelect = () => {
    if (selectedGame) onSelect(selectedGame);
  };

  return (
    <section
      className={`member-game-spinner member-game-spinner--${spinnerState}`}
      aria-labelledby="member-game-spinner-title"
      aria-busy={spinnerState === "spinning"}
    >
      <div className="member-game-spinner__copy">
        <span className="member-game-spinner__eyebrow">
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
          Temukan game
        </span>
        <h2 id="member-game-spinner-title">Putar untuk menemukan game baru</h2>
        <p>
          Biarkan selector memilih satu game untukmu. Setiap putaran membawa kejutan baru dari
          koleksi Vexynix.
        </p>
        <div className="member-game-spinner__result" aria-live="polite">
          <span>{selectedGame ? "Game terpilih" : "Siap dimainkan"}</span>
          <strong>{selectedGame?.name ?? "Pilih satu secara acak"}</strong>
        </div>
        <div className="member-game-spinner__actions">
          {selectedGame ? (
            <button
              type="button"
              className="member-game-spinner__result-button"
              onClick={handleResultSelect}
            >
              Lihat Game <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          ) : null}
          <span className="member-game-spinner__hint">{availableSegments.length} game tersedia</span>
        </div>
        <span className="visually-hidden" role="status">
          {announcement}
        </span>
      </div>

      <div className="member-game-spinner__stage-wrap">
        <div className="member-game-spinner__stage" aria-label="Spinner pemilih game">
          <SpinnerLayer fileName="spinner-shadow.png" className="member-game-spinner__shadow" />
          <SpinnerLayer fileName="spinner-glow.png" className="member-game-spinner__glow" />
          <SpinnerLayer
            fileName="spinner-frame.png"
            className="member-game-spinner__frame"
            priority
          />
          <div
            ref={selectorRef}
            className="member-game-spinner__layer member-game-spinner__selector"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <Image
              src={`${ASSET_ROOT}/spinner-selector.png`}
              alt=""
              fill
              sizes="(max-width: 760px) 92vw, (max-width: 1100px) 44vw, 520px"
              priority
            />
          </div>
          {spinnerState === "win" ? (
            <SpinnerLayer
              fileName="spinner-win-glow.png"
              className="member-game-spinner__win-glow"
            />
          ) : null}
          <SpinnerLayer fileName="spinner-pointer.png" className="member-game-spinner__pointer" />
          <SpinnerLayer
            fileName="spinner-particles.png"
            className="member-game-spinner__particles"
          />
          <div className="member-game-spinner__control">
            <button
              type="button"
              className="member-game-spinner__action"
              aria-label={selectedGame ? "Putar lagi" : "Putar game"}
              disabled={spinnerState === "spinning" || !availableSegments.length}
              onClick={spin}
            >
              <span className="visually-hidden">
                {spinnerState === "spinning" ? "Sedang memutar" : "Putar"}
              </span>
            </button>
            <SpinnerLayer fileName="spinner-button.png" className="member-game-spinner__button" />
          </div>
        </div>
      </div>
    </section>
  );
}
