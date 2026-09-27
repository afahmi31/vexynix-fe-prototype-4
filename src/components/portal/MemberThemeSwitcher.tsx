"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_MEMBER_THEME_ID,
  getMemberTheme,
  MEMBER_THEMES,
  resolveMemberThemeId,
} from "@/lib/member-themes";

const STORAGE_KEY = "member-theme";

function applyTheme(themeId: string): void {
  document.documentElement.dataset.memberTheme = themeId;
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

export default function MemberThemeSwitcher() {
  const [activeThemeId, setActiveThemeId] = useState(DEFAULT_MEMBER_THEME_ID);
  const [open, setOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const themeId = resolveMemberThemeId(readStoredTheme());

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

  const activeTheme = getMemberTheme(activeThemeId);

  const selectTheme = (themeId: string) => {
    const resolvedThemeId = resolveMemberThemeId(themeId);

    setActiveThemeId(resolvedThemeId);
    applyTheme(resolvedThemeId);
    writeStoredTheme(resolvedThemeId);
    setOpen(false);
  };

  return (
    <div className="member-theme-switcher" ref={switcherRef}>
      <button
        type="button"
        className="member-theme-switcher-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={"Tema aktif: " + activeTheme.label}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="fa-solid fa-palette" aria-hidden="true" />
        <span className="member-theme-switcher-label">{activeTheme.label}</span>
        <i className={"fa-solid fa-chevron-" + (open ? "up" : "down")} aria-hidden="true" />
      </button>

      {open && (
        <div className="member-theme-switcher-menu" role="menu" aria-label="Pilih tema">
          <div className="member-theme-switcher-heading">
            <strong>Pilih tema</strong>
            <span>5 pilihan visual</span>
          </div>
          {MEMBER_THEMES.map((theme) => (
            <button
              type="button"
              key={theme.id}
              className={
                "member-theme-switcher-option" + (theme.id === activeThemeId ? " is-active" : "")
              }
              role="menuitemradio"
              aria-checked={theme.id === activeThemeId}
              onClick={() => selectTheme(theme.id)}
            >
              <span
                className="member-theme-switcher-swatch"
                style={{ background: theme.swatch }}
                aria-hidden="true"
              />
              <span className="member-theme-switcher-copy">
                <strong>{theme.label}</strong>
                <small>{theme.description}</small>
              </span>
              <span className="member-theme-switcher-mode">{theme.mode}</span>
              {theme.id === activeThemeId && <i className="fa-solid fa-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
