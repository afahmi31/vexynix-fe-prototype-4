"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_P4_THEME_ID, getP4Theme, P4_THEMES, resolveP4ThemeId } from "@/lib/p4-themes";

const STORAGE_KEY = "p4-theme";

function applyTheme(themeId: string): void {
  document.documentElement.dataset.p4Theme = themeId;
}

function readStoredTheme(): string | null {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStoredTheme(themeId: string): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, themeId);
  } catch {
    // Theme switching remains usable when browser storage is unavailable.
  }
}

export default function P4ThemeSwitcher() {
  const [activeThemeId, setActiveThemeId] = useState(DEFAULT_P4_THEME_ID);
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const themeId = resolveP4ThemeId(readStoredTheme());

    setActiveThemeId(themeId);
    applyTheme(themeId);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeTheme = getP4Theme(activeThemeId);

  const selectTheme = (themeId: string) => {
    const resolvedThemeId = resolveP4ThemeId(themeId);

    setActiveThemeId(resolvedThemeId);
    applyTheme(resolvedThemeId);
    writeStoredTheme(resolvedThemeId);
    setOpen(false);
  };

  return (
    <div className="p4-theme-switcher" ref={switcherRef}>
      <button
        type="button"
        className="p4-theme-switcher-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={"Tema aktif: " + activeTheme.label}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="fa-solid fa-palette" aria-hidden="true" />
        <span className="p4-theme-switcher-label">{activeTheme.label}</span>
        <i className={"fa-solid fa-chevron-" + (open ? "up" : "down")} aria-hidden="true" />
      </button>

      {open && (
        <div className="p4-theme-switcher-menu" role="menu" aria-label="Pilih tema">
          <div className="p4-theme-switcher-heading">
            <strong>Pilih tema</strong>
            <span>5 pilihan visual</span>
          </div>
          {P4_THEMES.map((theme) => (
            <button
              type="button"
              key={theme.id}
              className={
                "p4-theme-switcher-option" + (theme.id === activeThemeId ? " is-active" : "")
              }
              role="menuitemradio"
              aria-checked={theme.id === activeThemeId}
              onClick={() => selectTheme(theme.id)}
            >
              <span
                className="p4-theme-switcher-swatch"
                style={{ background: theme.swatch }}
                aria-hidden="true"
              />
              <span className="p4-theme-switcher-copy">
                <strong>{theme.label}</strong>
                <small>{theme.description}</small>
              </span>
              <span className="p4-theme-switcher-mode">{theme.mode}</span>
              {theme.id === activeThemeId && <i className="fa-solid fa-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
