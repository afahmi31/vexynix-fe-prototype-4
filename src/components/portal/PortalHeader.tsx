"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBrandStore } from "@/stores/brand";
import { useSessionStore } from "@/stores/session";
import { authApi } from "@/lib/api/auth";
import { useAuthModalStore } from "@/stores/auth-modal";
import PortalBalancePill from "./PortalBalancePill";
import P4Header from "./P4Header";

const NAV_LINKS = [
  { href: "/lobby", label: "Game", icon: "fa-solid fa-dice" },
  {
    href: "/wallet/withdraw",
    label: "Tarik",
    icon: "fa-solid fa-money-bill-transfer",
  },
  { href: "/account", label: "Akun", icon: "fa-solid fa-user" },
] as const;

export default function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const brand = useBrandStore((s) => s.brand);
  const token = useSessionStore((s) => s.token);
  const username = useSessionStore((s) => s.username);
  const clear = useSessionStore((s) => s.clear);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const openRegister = useAuthModalStore((s) => s.openRegister);

  const isLoggedIn = !!token;

  // The public lobby and game-play pages share the P4 discovery header.
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isP4Surface = isAuthRoute || pathname === "/lobby" || pathname.startsWith("/mock-game/");
  const isLobby = pathname === "/lobby";
  const showNav = isLoggedIn && !isP4Surface;
  const isVexynix = brand.label.trim().toUpperCase() === "VEXYNIX";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isLobby) {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLobby]);

  if (isP4Surface) {
    return (
      <Suspense fallback={null}>
        <P4Header />
      </Suspense>
    );
  }

  // On the deposit page itself the shortcut links to the route we're already on,
  // so it does nothing visible — the page keeps its state. "Deposit Baru" on the
  // result screen is the control that actually starts another deposit.
  const onDepositPage = pathname.startsWith("/wallet/deposit");

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await authApi.logout();
    } catch {
      // Fire-and-forget — clear locally regardless
    }
    clear();
    router.push("/login");
  };

  return (
    <header
      className={`portal-header ${isLobby ? "portal-header--lobby" : ""} ${
        isLobby && scrolled ? "is-scrolled" : ""
      }`.trim()}
    >
      <div className="portal-header-inner">
        {/* Brand */}
        <Link
          href={isLoggedIn ? "/lobby" : "/login"}
          className={`portal-header-brand ${isVexynix ? "portal-header-brand--vexynix" : ""}`}
        >
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt={brand.label || "Game Portal"}
              className="portal-header-brand-logo-img"
            />
          ) : isVexynix ? (
            <span className="portal-header-brand-mark" aria-hidden="true">
              V
            </span>
          ) : (
            <i className="fa-solid fa-dice-d20 portal-header-brand-icon" />
          )}
          <span className="portal-header-brand-text">{brand.label || "Game Portal"}</span>
        </Link>

        {/* Center navigation — only when logged in */}
        {showNav && (
          <nav className="portal-header-nav">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                  <i className={link.icon} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right section */}
        <div className="portal-header-right">
          <Link href="/lobby#bantuan" className="portal-header-help-btn">
            <i className="fa-solid fa-headset" />
            <span>Bantuan</span>
          </Link>
          {isLoggedIn ? (
            <>
              <PortalBalancePill />

              {!onDepositPage && (
                <Link href="/wallet/deposit" className="portal-header-deposit-btn">
                  <i className="fa-solid fa-bolt" />
                  <span>Deposit</span>
                </Link>
              )}

              {/* Profile dropdown */}
              <div className="dropdown">
                <button
                  type="button"
                  className="portal-header-user"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="fa-solid fa-user" />
                  <span className="d-none d-md-inline">{username || "Tamu"}</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <span className="dropdown-header">{username || "Tamu"}</span>
                  </li>
                  <li>
                    <Link href="/account" className="dropdown-item">
                      <i className="fa-solid fa-user-gear me-2" />
                      Akun
                    </Link>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a href="#" className="dropdown-item" onClick={handleLogout}>
                      <i className="fa-solid fa-right-from-bracket me-2" />
                      Keluar
                    </a>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="portal-header-login-btn"
                onClick={(e) => {
                  e.preventDefault();
                  openLogin();
                }}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="portal-header-deposit-btn"
                onClick={(e) => {
                  e.preventDefault();
                  openRegister();
                }}
              >
                <i className="fa-solid fa-user-plus" />
                <span>Daftar</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
