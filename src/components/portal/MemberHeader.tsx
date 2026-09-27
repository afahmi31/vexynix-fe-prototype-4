"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useBrandStore } from "@/stores/brand";
import { useAuthModalStore } from "@/stores/auth-modal";
import { useSessionStore } from "@/stores/session";
import MemberThemeSwitcher from "./MemberThemeSwitcher";

const NAV_LINKS = [
  { href: "/lobby", label: "Beranda", activeKey: "home" },
  { href: "/lobby?category=all", label: "Semua Game", activeKey: "all" },
  { href: "/lobby?category=slot", label: "Slot", activeKey: "slot" },
  { href: "/lobby?category=live", label: "Live Casino", activeKey: "live" },
  { href: "/lobby#member-providers", label: "Provider", activeKey: "provider" },
  { href: "/lobby#member-cta", label: "Promosi", activeKey: "promotions" },
] as const;

export default function MemberHeader() {
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
      : hash === "#member-providers"
        ? "provider"
        : hash === "#member-cta"
          ? "promotions"
          : category;

  return (
    <header className="member-header">
      <div className="member-header-inner">
        <Link
          href="/lobby"
          className="member-header-brand"
          aria-label={brandLoaded ? `${brandLabel} Beranda` : "Memuat brand"}
        >
          {brandLoaded ? brandLabel : <span className="member-brand-skeleton" aria-hidden="true" />}
        </Link>
        <nav className="member-header-nav" aria-label="Navigasi utama">
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
        <div className="member-header-actions">
          <MemberThemeSwitcher />
          {token ? (
            <Link href="/account" className="member-header-login">
              Akun
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="member-header-login"
                onClick={(event) => {
                  event.preventDefault();
                  openLogin();
                }}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="member-header-register"
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
