"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useBrandStore } from "@/stores/brand";
import { useSessionStore } from "@/stores/session";
import { useAuthModalStore } from "@/stores/auth-modal";
import { setAuthFailureHandler } from "@/lib/api/client";
import { markSessionExpired } from "@/lib/auth-redirect";
import PortalHeader from "@/components/portal/PortalHeader";
import PortalFooter from "@/components/portal/PortalFooter";
import AuthModals from "@/components/auth/AuthModals";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const fetchBrand = useBrandStore((s) => s.fetchBrand);
  const hydrate = useSessionStore((s) => s.hydrate);
  const clear = useSessionStore((s) => s.clear);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const pathname = usePathname();

  // Auth screens are full-bleed — they skip the 1400px centered shell so their
  // background covers the whole viewport instead of leaving gutters. The lobby
  // is full-bleed too so the Netflix billboard can run edge to edge.
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isP4Lobby = pathname === "/lobby";
  const isFlushRoute = isAuthRoute || pathname === "/lobby";

  useEffect(() => {
    hydrate();
    fetchBrand();
  }, [hydrate, fetchBrand]);

  // A dead session must be handled HERE too, not only in the player layout. The session record
  // lives in localStorage (origin-wide since 2026-08-28), while the server kills a session after
  // 30 minutes idle — so a returning player lands on a public page still "logged in" locally.
  // Without a handler the first authed call (the header balance pill) 401s with INVALID_SESSION,
  // nothing clears the stale record, and the header keeps claiming they are signed in.
  // Public pages are browsable signed-out, so we clear and prompt in place rather than redirect:
  // the login modal returns them to the page they were already on.
  useEffect(() => {
    setAuthFailureHandler(() => {
      markSessionExpired();
      clear();
      // Never hand /login or /register back as the return path — that lands the
      // player back on the auth screen instead of where they were.
      openLogin({ next: isAuthRoute ? null : pathname });
    });
  }, [clear, openLogin, pathname, isAuthRoute]);

  return (
    <div className={`portal${isP4Lobby ? " p4-public-shell" : ""}`}>
      <PortalHeader />
      <main className={isFlushRoute ? "portal-main portal-main-flush" : "portal-main"}>
        {children}
      </main>
      <PortalFooter />
      <AuthModals />
    </div>
  );
}
