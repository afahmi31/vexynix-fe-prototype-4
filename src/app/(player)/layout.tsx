"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session";
import { useBrandStore } from "@/stores/brand";
import { setAuthFailureHandler } from "@/lib/api/client";
import { loginHref, markSessionExpired } from "@/lib/auth-redirect";
import PortalHeader from "@/components/portal/PortalHeader";
import PortalFooter from "@/components/portal/PortalFooter";
import StepUpDialog from "@/components/shared/StepUpDialog";
import LockBanner from "@/components/shared/LockBanner";

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useSessionStore((s) => s.hydrate);
  const clear = useSessionStore((s) => s.clear);
  const hydrated = useSessionStore((s) => s.hydrated);
  const token = useSessionStore((s) => s.token);
  const fetchBrand = useBrandStore((s) => s.fetchBrand);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-registered on navigation so the ?next= carries the page the user was
  // actually on when the 401 came back.
  useEffect(() => {
    setAuthFailureHandler(() => {
      markSessionExpired();
      clear();
      router.replace(loginHref(pathname));
    });
  }, [clear, router, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace(loginHref(pathname));
      return;
    }
    setReady(true);
  }, [hydrated, token, router, pathname]);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  // Loading / redirecting — show portal shell with spinner
  if (!ready) {
    return (
      <div className="portal">
        <PortalHeader />
        <main className="portal-main">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
            <div className="spinner-border text-theme" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </main>
        <PortalFooter />
      </div>
    );
  }

  return (
    <div className="portal">
      <PortalHeader />
      <main className="portal-main">{children}</main>
      <PortalFooter />
      <LockBanner />
      <StepUpDialog />
    </div>
  );
}
