"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrandStore } from "@/stores/brand";
import { useAuthModalStore } from "@/stores/auth-modal";
import { useSessionStore } from "@/stores/session";

const NAV_LINKS = [
  { href: "/lobby", label: "Beranda" },
  { href: "/lobby?category=all#p4-catalog", label: "Semua Game" },
  { href: "/lobby?category=slot#p4-catalog", label: "Slot" },
  { href: "/lobby?category=live#p4-catalog", label: "Live Casino" },
  { href: "/lobby#p4-providers", label: "Provider" },
  { href: "/lobby#p4-cta", label: "Promosi" },
] as const;

export default function P4Header() {
  const pathname = usePathname();
  const brand = useBrandStore((state) => state.brand);
  const token = useSessionStore((state) => state.token);
  const openLogin = useAuthModalStore((state) => state.openLogin);
  const openRegister = useAuthModalStore((state) => state.openRegister);
  const brandLabel = brand.found && brand.label ? brand.label : "VEXYNIX";

  return (
    <header className="p4-header">
      <div className="p4-header-inner">
        <Link href="/lobby" className="p4-header-brand" aria-label="Vexynix Beranda">
          {brandLabel}
        </Link>
        <nav className="p4-header-nav" aria-label="Navigasi utama">
          {NAV_LINKS.map((link, index) => (
            <Link
              href={link.href}
              key={link.label}
              className={pathname === "/lobby" && index === 0 ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p4-header-actions">
          <Link
            href="/lobby?category=all#p4-catalog"
            className="p4-header-search"
            aria-label="Cari game"
          >
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          </Link>
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
