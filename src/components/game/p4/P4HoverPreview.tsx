"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Game } from "@/types/api";
import { GameHoverPreview } from "@/components/game/GameHoverPreview";

interface ActiveP4Preview {
  anchor: HTMLDivElement;
  demoFirst: boolean;
  game: Game;
}

interface P4HoverPreviewContextValue {
  closePreview: () => void;
  dismissPreview: () => void;
  openPreview: (game: Game, anchor: HTMLDivElement, demoFirst?: boolean) => void;
}

interface P4HoverPreviewProviderProps {
  children: ReactNode;
  disabled: boolean;
  launching: string | null;
  onInfo: (game: Game) => void;
  onLaunch: (id: string) => void;
  onLaunchDemo: (id: string) => void;
  vendorName: (id: string) => string;
}

const P4HoverPreviewContext = createContext<P4HoverPreviewContextValue | null>(null);

export function useP4HoverPreview(): P4HoverPreviewContextValue | null {
  return useContext(P4HoverPreviewContext);
}

export function P4HoverPreviewProvider({
  children,
  disabled,
  launching,
  onInfo,
  onLaunch,
  onLaunchDemo,
  vendorName,
}: P4HoverPreviewProviderProps): ReactElement {
  const [activePreview, setActivePreview] = useState<ActiveP4Preview | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const queuedPreview = useRef<ActiveP4Preview | null>(null);
  const previewInstance = useRef({});

  const clearPreviewTimers = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    closeTimer.current = null;
    unmountTimer.current = null;
    frame.current = null;
  }, []);

  const dismissPreview = useCallback(() => {
    clearPreviewTimers();
    queuedPreview.current = null;
    setIsPreviewOpen(false);
    setActivePreview(null);
  }, [clearPreviewTimers]);

  useEffect(() => {
    const closeOtherPreview = (event: Event) => {
      const source = (event as CustomEvent<object>).detail;
      if (source === previewInstance.current) return;

      dismissPreview();
    };

    window.addEventListener("vexynix:preview-open", closeOtherPreview);
    return () => {
      window.removeEventListener("vexynix:preview-open", closeOtherPreview);
      dismissPreview();
    };
  }, [dismissPreview]);

  useEffect(() => {
    if (!activePreview) return undefined;

    const observer = new MutationObserver(() => {
      if (!activePreview.anchor.isConnected) dismissPreview();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [activePreview, dismissPreview]);

  const openPreview = useCallback(
    (game: Game, anchor: HTMLDivElement, demoFirst = false) => {
      window.dispatchEvent(
        new CustomEvent("vexynix:preview-open", { detail: previewInstance.current })
      );

      const nextPreview = { anchor, demoFirst, game };
      if (activePreview?.game.id === game.id && activePreview.anchor === anchor) {
        clearPreviewTimers();
        setIsPreviewOpen(true);
        return;
      }

      if (activePreview) {
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
        queuedPreview.current = nextPreview;
        setIsPreviewOpen(false);

        if (unmountTimer.current === null) {
          unmountTimer.current = window.setTimeout(() => {
            const queued = queuedPreview.current;
            queuedPreview.current = null;
            unmountTimer.current = null;

            if (!queued) {
              setActivePreview(null);
              return;
            }

            setActivePreview(queued);
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
      setActivePreview(nextPreview);
      frame.current = window.requestAnimationFrame(() => {
        setIsPreviewOpen(true);
        frame.current = null;
      });
    },
    [activePreview, clearPreviewTimers]
  );

  const closePreview = useCallback(() => {
    queuedPreview.current = null;
    if (closeTimer.current !== null || unmountTimer.current !== null || !activePreview) {
      return;
    }

    closeTimer.current = window.setTimeout(() => {
      setIsPreviewOpen(false);
      closeTimer.current = null;
      unmountTimer.current = window.setTimeout(() => {
        setActivePreview(null);
        unmountTimer.current = null;
      }, 280);
    }, 110);
  }, [activePreview]);

  const contextValue = useMemo(
    () => ({ closePreview, dismissPreview, openPreview }),
    [closePreview, dismissPreview, openPreview]
  );

  return (
    <P4HoverPreviewContext.Provider value={contextValue}>
      {children}
      {activePreview ? (
        <GameHoverPreview
          anchor={activePreview.anchor}
          demoFirst={activePreview.demoFirst}
          disabled={disabled || launching !== null}
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
      ) : null}
    </P4HoverPreviewContext.Provider>
  );
}
