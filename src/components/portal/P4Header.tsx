"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBrandStore } from "@/stores/brand";
import { useAuthModalStore } from "@/stores/auth-modal";
import { useSessionStore } from "@/stores/session";
import P4ThemeSwitcher from "./P4ThemeSwitcher";

const NAV_LINKS = [
  { href: "/lobby", label: "Beranda", activeKey: "home" },
  { href: "/lobby?category=all", label: "Semua Game", activeKey: "all" },
  { href: "/lobby?category=slot", label: "Slot", activeKey: "slot" },
  { href: "/lobby?category=live", label: "Live Casino", activeKey: "live" },
  { href: "/lobby#p4-providers", label: "Provider", activeKey: "provider" },
  { href: "/lobby#p4-cta", label: "Promosi", activeKey: "promotions" },
] as const;

export default function P4Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");
  const brand = useBrandStore((state) => state.brand);
  const brandLoaded = useBrandStore((state) => state.loaded);
  const token = useSessionStore((state) => state.token);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const openRegister = useAuthModalStore((state) => state.openRegister);
  const brandLabel = brand.found && brand.label ? brand.label : "Game Portal";

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const category = searchParams.get("category") ?? "home";
  const activeKey =
    pathname !== "/lobby"
      ? ""
      : hash === "#p4-providers"
        ? "provider"
        : hash === "#p4-cta"
          ? "promotions"
          : category;

  return (
    <header className="p4-header">
      <div className="p4-header-inner">
        <Link
          href="/lobby"
          className="p4-header-brand"
          aria-label={brandLoaded ? `${brandLabel} Beranda` : "Memuat brand"}
        >
          {brandLoaded ? brandLabel : <span className="p4-brand-skeleton" aria-hidden="true" />}
        </Link>
        <nav className="p4-header-nav" aria-label="Navigasi utama">
          {NAV_LINKS.map((link) => (
            <Link
              href={link.href}
              key={link.label}
              className={link.activeKey === activeKey ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p4-header-actions">
          <P4ThemeSwitcher />
          {token ? (
            <Link href="/account" className="p4-header-login">
              Akun
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="p4-header-login"
                onClick={(event) => {
                  event.preventDefault();
                  openLogin();
                }}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="p4-header-register"
                onClick={(event) => {
                  event.preventDefault();
                  openRegister();
                }}
              >
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
