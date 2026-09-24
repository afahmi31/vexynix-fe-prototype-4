"use client";

import { useEffect, useRef, useState } from "react";
import type { Game } from "@/types/api";
import type { P4GamePresentation } from "@/types/p4";
import { MOCK_P4_TOP10_RANKS } from "@/mocks/p4";
import { GameCard } from "@/components/game/GameCard";
import { GameHoverPreview } from "@/components/game/GameHoverPreview";

interface LobbyRailProps {
  title: string;
  description?: string;
  icon: string;
  games: Game[];
  vendorName: (id: string) => string;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  onInfo: (game: Game) => void;
  presentationFor: (game: Game) => P4GamePresentation | undefined;
  demoFirst?: boolean;
  limit?: number;
  launching: string | null;
  disabled: boolean;
}

interface ActiveHoverPreview {
  anchor: HTMLDivElement;
  game: Game;
}

function useRailScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    const firstItem = element?.querySelector<HTMLElement>(".nf-row-item");
    if (!element || !firstItem) return;

    const leadingMargin = Number.parseFloat(getComputedStyle(firstItem).marginLeft);
    if (leadingMargin < 0) element.scrollLeft = Math.abs(leadingMargin);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const element = scrollRef.current;
    if (!element) return;

    const amount = element.clientWidth * 0.82;
    element.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return { scrollRef, scroll };
}

function useHoverPreview() {
  const [activePreview, setActivePreview] = useState<ActiveHoverPreview | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const queuedPreview = useRef<ActiveHoverPreview | null>(null);
  const previewInstance = useRef({});

  const clearPreviewTimers = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    closeTimer.current = null;
    unmountTimer.current = null;
    frame.current = null;
  };

  useEffect(() => {
    const closeOtherPreview = (event: Event) => {
      const source = (event as CustomEvent<object>).detail;
      if (source === previewInstance.current) return;

      clearPreviewTimers();
      queuedPreview.current = null;
      setIsPreviewOpen(false);
      setActivePreview(null);
    };

    window.addEventListener("vexynix:preview-open", closeOtherPreview);
    return () => {
      window.removeEventListener("vexynix:preview-open", closeOtherPreview);
      clearPreviewTimers();
    };
  }, []);

  const openPreview = (game: Game, anchor: HTMLDivElement) => {
    window.dispatchEvent(
      new CustomEvent("vexynix:preview-open", { detail: previewInstance.current })
    );

    if (activePreview?.game.id === game.id && activePreview.anchor === anchor) {
      clearPreviewTimers();
      setIsPreviewOpen(true);
      return;
    }

    if (activePreview) {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
      queuedPreview.current = { game, anchor };
      setIsPreviewOpen(false);

      if (unmountTimer.current === null) {
        unmountTimer.current = window.setTimeout(() => {
          const nextPreview = queuedPreview.current;
          queuedPreview.current = null;
          unmountTimer.current = null;

          if (!nextPreview) {
            setActivePreview(null);
            return;
          }

          setActivePreview(nextPreview);
          frame.current = window.requestAnimationFrame(() => {
            setIsPreviewOpen(true);
            frame.current = null;
          });
        }, 280);
      }
      return;
    }

    clearPreviewTimers();
    setIsPreviewOpen(false);
    setActivePreview({ game, anchor });
    frame.current = window.requestAnimationFrame(() => {
      setIsPreviewOpen(true);
      frame.current = null;
    });
  };

  const closePreview = () => {
    queuedPreview.current = null;
    if (closeTimer.current !== null || unmountTimer.current !== null || !activePreview) return;

    closeTimer.current = window.setTimeout(() => {
      setIsPreviewOpen(false);
      closeTimer.current = null;
      unmountTimer.current = window.setTimeout(() => {
        setActivePreview(null);
        unmountTimer.current = null;
      }, 280);
    }, 110);
  };

  const dismissPreview = () => {
    clearPreviewTimers();
    queuedPreview.current = null;
    setIsPreviewOpen(false);
    setActivePreview(null);
  };

  return {
    activePreview,
    clearPreviewTimers,
    closePreview,
    dismissPreview,
    isPreviewOpen,
    openPreview,
  };
}

interface HoverPreviewLayerProps {
  hoverPreview: ReturnType<typeof useHoverPreview>;
  vendorName: (id: string) => string;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  onInfo: (game: Game) => void;
  presentationFor: (game: Game) => P4GamePresentation | undefined;
  demoFirst?: boolean;
  launching: string | null;
  disabled: boolean;
}

function HoverPreviewLayer({
  hoverPreview,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  presentationFor,
  demoFirst,
  launching,
  disabled,
}: HoverPreviewLayerProps) {
  const { activePreview, dismissPreview, isPreviewOpen, clearPreviewTimers, closePreview } =
    hoverPreview;

  if (!activePreview) return null;

  return (
    <GameHoverPreview
      anchor={activePreview.anchor}
      badges={presentationFor(activePreview.game)?.badges}
      demoFirst={demoFirst}
      disabled={launching !== null || disabled}
      game={activePreview.game}
      isOpen={isPreviewOpen}
      launching={launching === activePreview.game.id}
      onInfo={(game) => {
        dismissPreview();
        onInfo(game);
      }}
      onLaunch={(id) => {
        dismissPreview();
        onLaunch(id);
      }}
      onLaunchDemo={(id) => {
        dismissPreview();
        onLaunchDemo(id);
      }}
      onPointerEnter={clearPreviewTimers}
      onPointerLeave={closePreview}
      vendorName={vendorName(activePreview.game.vendor_id)}
    />
  );
}

export function NetflixRow({
  title,
  icon,
  games,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  presentationFor,
  demoFirst,
  limit,
  launching,
  disabled,
}: LobbyRailProps) {
  const { scrollRef, scroll } = useRailScroll();
  const hoverPreview = useHoverPreview();

  if (games.length === 0) return null;

  return (
    <section className="nf-row">
      <div className="nf-row-head">
        <div>
          <h3>
            {icon && <i className={`${icon} nf-row-icon`} />}
            {title}
          </h3>
        </div>
      </div>
      <div className="nf-row-body">
        <div className="nf-row-track" ref={scrollRef}>
          {games.slice(0, limit ?? 10).map((game) => (
            <div key={game.id} className="nf-row-item">
              <GameCard
                game={game}
                vendorName={vendorName(game.vendor_id)}
                onLaunch={onLaunch}
                onLaunchDemo={onLaunchDemo}
                onInfo={onInfo}
                badges={presentationFor(game)?.badges}
                demoFirst={demoFirst}
                launching={launching === game.id}
                disabled={launching !== null || disabled}
                onHoverPreviewEnter={(anchor) => hoverPreview.openPreview(game, anchor)}
                onHoverPreviewLeave={hoverPreview.closePreview}
              />
            </div>
          ))}
        </div>
        <RailButton direction="left" onClick={() => scroll("left")} />
        <RailButton direction="right" onClick={() => scroll("right")} />
      </div>
      <HoverPreviewLayer
        demoFirst={demoFirst}
        disabled={disabled}
        hoverPreview={hoverPreview}
        launching={launching}
        onInfo={onInfo}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
        presentationFor={presentationFor}
        vendorName={vendorName}
      />
    </section>
  );
}

interface GameGridProps {
  games: Game[];
  vendorName: (id: string) => string;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  onInfo: (game: Game) => void;
  presentationFor: (game: Game) => P4GamePresentation | undefined;
  launching: string | null;
  disabled: boolean;
}

export function GameGrid({
  games,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  presentationFor,
  launching,
  disabled,
}: GameGridProps) {
  const hoverPreview = useHoverPreview();

  return (
    <>
      <div className="game-grid">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            vendorName={vendorName(game.vendor_id)}
            onLaunch={onLaunch}
            onLaunchDemo={onLaunchDemo}
            onInfo={onInfo}
            badges={presentationFor(game)?.badges}
            launching={launching === game.id}
            disabled={launching !== null || disabled}
            onHoverPreviewEnter={(anchor) => hoverPreview.openPreview(game, anchor)}
            onHoverPreviewLeave={hoverPreview.closePreview}
          />
        ))}
      </div>
      <HoverPreviewLayer
        disabled={disabled}
        hoverPreview={hoverPreview}
        launching={launching}
        onInfo={onInfo}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
        presentationFor={presentationFor}
        vendorName={vendorName}
      />
    </>
  );
}

function RailButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const isLeft = direction === "left";

  return (
    <button
      className={`nf-row-chevron ${isLeft ? "left" : "right"}`}
      onClick={onClick}
      aria-label={isLeft ? "Geser ke kiri" : "Geser ke kanan"}
      type="button"
    >
      <i className={`fa fa-angle-${isLeft ? "left" : "right"}`} />
    </button>
  );
}

export function Top10Row({
  title,
  games,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  presentationFor,
  launching,
  disabled,
}: Omit<LobbyRailProps, "icon" | "demoFirst">) {
  const { scrollRef, scroll } = useRailScroll();
  const hoverPreview = useHoverPreview();

  if (games.length === 0) return null;

  return (
    <section className="nf-row top10-row">
      <div className="nf-row-head">
        <div>
          <h3>
            <i className="fa-solid fa-ranking-star nf-row-icon" />
            {title}
          </h3>
        </div>
      </div>
      <div className="nf-row-body">
        <div className="top10-track" ref={scrollRef}>
          {games.slice(0, 10).map((game, index) => {
            const rank = MOCK_P4_TOP10_RANKS[game.id] ?? index + 1;
            const isDoubleDigitRank = rank >= 10;

            return (
              <div
                key={game.id}
                className={`top10-item${isDoubleDigitRank ? " top10-item--double-digit" : ""}`}
              >
                <span className="top10-rank">
                  <span className="top10-rank-text">{rank}</span>
                </span>
                <GameCard
                  game={game}
                  vendorName={vendorName(game.vendor_id)}
                  onLaunch={onLaunch}
                  onLaunchDemo={onLaunchDemo}
                  onInfo={onInfo}
                  badges={presentationFor(game)?.badges}
                  top10Rank={rank}
                  launching={launching === game.id}
                  disabled={launching !== null || disabled}
                  onHoverPreviewEnter={(anchor) => hoverPreview.openPreview(game, anchor)}
                  onHoverPreviewLeave={hoverPreview.closePreview}
                />
              </div>
            );
          })}
        </div>
        <RailButton direction="left" onClick={() => scroll("left")} />
        <RailButton direction="right" onClick={() => scroll("right")} />
      </div>
      <HoverPreviewLayer
        disabled={disabled}
        hoverPreview={hoverPreview}
        launching={launching}
        onInfo={onInfo}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
        presentationFor={presentationFor}
        vendorName={vendorName}
      />
    </section>
  );
}

export function TrendingGrid({
  title,
  games,
  vendorName,
  onLaunch,
  onLaunchDemo,
  onInfo,
  presentationFor,
  launching,
  disabled,
}: Omit<LobbyRailProps, "icon" | "demoFirst">) {
  const { scrollRef, scroll } = useRailScroll();
  const hoverPreview = useHoverPreview();

  if (games.length === 0) return null;

  return (
    <section className="nf-row trending-row">
      <div className="nf-row-head">
        <div>
          <h3>
            <i className="fa-solid fa-fire nf-row-icon" />
            {title}
          </h3>
        </div>
      </div>
      <div className="nf-row-body">
        <div className="nf-row-track" ref={scrollRef}>
          {games.slice(0, 10).map((game) => (
            <div key={game.id} className="nf-row-item">
              <GameCard
                game={game}
                vendorName={vendorName(game.vendor_id)}
                onLaunch={onLaunch}
                onLaunchDemo={onLaunchDemo}
                onInfo={onInfo}
                badges={presentationFor(game)?.badges}
                launching={launching === game.id}
                disabled={launching !== null || disabled}
                onHoverPreviewEnter={(anchor) => hoverPreview.openPreview(game, anchor)}
                onHoverPreviewLeave={hoverPreview.closePreview}
              />
            </div>
          ))}
        </div>
        <RailButton direction="left" onClick={() => scroll("left")} />
        <RailButton direction="right" onClick={() => scroll("right")} />
      </div>
      <HoverPreviewLayer
        disabled={disabled}
        hoverPreview={hoverPreview}
        launching={launching}
        onInfo={onInfo}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
        presentationFor={presentationFor}
        vendorName={vendorName}
      />
    </section>
  );
}
