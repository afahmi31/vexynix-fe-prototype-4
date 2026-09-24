"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactPortal,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Game } from "@/types/api";
import type { P4GameBadge } from "@/types/p4";

interface GameHoverPreviewProps {
  game: Game;
  vendorName?: string;
  badges?: P4GameBadge[];
  anchor: HTMLElement;
  isOpen: boolean;
  demoFirst?: boolean;
  disabled: boolean;
  launching: boolean;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  onInfo: (game: Game) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

interface PreviewPosition {
  left: number;
  top: number;
  width: number;
}

const VIEWPORT_GUTTER = 12;
const PREVIEW_MIN_WIDTH = 280;
const PREVIEW_MAX_WIDTH = 372;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPreviewWidth(cardWidth: number): number {
  const viewportWidth = window.innerWidth - VIEWPORT_GUTTER * 2;
  const preferredWidth = Math.max(PREVIEW_MIN_WIDTH, cardWidth * 1.5);

  return Math.min(viewportWidth, Math.min(PREVIEW_MAX_WIDTH, preferredWidth));
}

export function GameHoverPreview({
  game,
  vendorName,
  badges,
  anchor,
  isOpen,
  demoFirst,
  disabled,
  launching,
  onLaunch,
  onLaunchDemo,
  onInfo,
  onPointerEnter,
  onPointerLeave,
}: GameHoverPreviewProps): ReactPortal | null {
  const previewRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  const category = game.category || "Game";
  const canDemo = Boolean(game.demo_supported);
  const demoIsPrimary = canDemo && demoFirst === true;
  const initial = game.name.charAt(0).toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && previewRef.current?.contains(target)) return;

      onPointerLeave();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [mounted, onPointerLeave]);

  useLayoutEffect(() => {
    if (!mounted) return undefined;

    let frameId: number | null = null;

    const updatePosition = () => {
      if (frameId !== null) return;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;

        const preview = previewRef.current;
        if (!preview || !anchor.isConnected) return;

        const anchorRect = anchor.getBoundingClientRect();
        const width = getPreviewWidth(anchorRect.width);
        const height = preview.offsetHeight;
        if (height === 0) return;

        const desiredLeft = anchorRect.left + (anchorRect.width - width) / 2;
        const desiredTop = anchorRect.top + (anchorRect.height - height) / 2;
        const maxLeft = window.innerWidth - width - VIEWPORT_GUTTER;
        const maxTop = window.innerHeight - height - VIEWPORT_GUTTER;
        const nextPosition = {
          left: clamp(desiredLeft, VIEWPORT_GUTTER, maxLeft),
          top: clamp(desiredTop, VIEWPORT_GUTTER, maxTop),
          width,
        };

        setPosition((current) => {
          if (
            current &&
            current.left === nextPosition.left &&
            current.top === nextPosition.top &&
            current.width === nextPosition.width
          ) {
            return current;
          }

          return nextPosition;
        });
      });
    };

    const track = anchor.closest<HTMLElement>(".nf-row-track");
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    track?.addEventListener("scroll", updatePosition, { passive: true });

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      track?.removeEventListener("scroll", updatePosition);
    };
  }, [anchor, game.id, isOpen, mounted]);

  if (!mounted) return null;

  const fallbackWidth = Math.min(
    PREVIEW_MAX_WIDTH,
    Math.max(PREVIEW_MIN_WIDTH, anchor.getBoundingClientRect().width * 1.5)
  );
  const style: CSSProperties = position
    ? {
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: `${position.width}px`,
      }
    : { width: `${fallbackWidth}px`, visibility: "hidden" };

  const launchPrimary = () => {
    if (disabled || launching) return;
    if (demoIsPrimary) onLaunchDemo(game.id);
    else onLaunch(game.id);
  };

  const launchSecondary = () => {
    if (disabled || launching || !canDemo) return;
    if (demoIsPrimary) onLaunch(game.id);
    else onLaunchDemo(game.id);
  };

  return createPortal(
    <article
      ref={previewRef}
      aria-label={`Preview ${game.name}`}
      className={`game-hover-preview ${isOpen && position ? "is-open" : ""}`}
      role="group"
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="game-hover-preview-media">
        {game.image_url ? (
          game.image_url.startsWith("/") ? (
            <Image src={game.image_url} alt="" fill sizes="(max-width: 767px) 86vw, 372px" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" decoding="async" src={game.image_url} />
          )
        ) : (
          <span className="game-hover-preview-initial">{initial}</span>
        )}
        <div className="game-hover-preview-badges">
          <span>{category}</span>
          {badges?.slice(0, 2).map((badge) => (
            <span key={badge.kind + (badge.rank ?? "")}>{badge.label}</span>
          ))}
        </div>
      </div>

      <div className="game-hover-preview-content">
        <div className="game-hover-preview-actions">
          <button
            aria-label={demoIsPrimary ? `Coba ${game.name} gratis` : `Mainkan ${game.name}`}
            className="game-hover-preview-play"
            disabled={disabled || launching}
            onClick={launchPrimary}
            type="button"
          >
            <i className={launching ? "fa fa-spinner fa-spin" : "fa fa-play"} />
          </button>
          {canDemo && (
            <button
              className="game-hover-preview-secondary"
              disabled={disabled || launching}
              onClick={launchSecondary}
              type="button"
            >
              {demoIsPrimary ? "Mainkan dengan Saldo" : "Coba Gratis"}
            </button>
          )}
          <button
            aria-label={`Lihat detail ${game.name}`}
            className="game-hover-preview-info"
            disabled={disabled || launching}
            onClick={() => onInfo(game)}
            type="button"
          >
            <i className="fa fa-circle-info" />
          </button>
        </div>
        <div className="game-hover-preview-meta">
          {game.rtp ? <span>RTP {(game.rtp * 100).toFixed(1)}%</span> : null}
          {game.min_bet && game.min_bet > 0 ? (
            <span>Mulai {formatCurrency(game.min_bet)}</span>
          ) : null}
        </div>
        <h4>{game.name}</h4>
        {vendorName ? <p>{vendorName}</p> : null}
      </div>
    </article>,
    document.body
  );
}
