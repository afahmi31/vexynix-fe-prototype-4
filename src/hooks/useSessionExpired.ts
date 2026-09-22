"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session";
import { loginHref, markSessionExpired } from "@/lib/auth-redirect";

/**
 * Send the user to /login because their session is gone.
 *
 * Clears local session state first, so the layout guard does not bounce them
 * somewhere else mid-redirect, and records the current page as ?next= so they
 * resume where they left off. Uses replace() — the dead page should not stay
 * in history behind the login screen.
 */
export function useSessionExpired(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const clear = useSessionStore((s) => s.clear);

  return useCallback(() => {
    markSessionExpired();
    clear();
    router.replace(loginHref(pathname));
  }, [clear, router, pathname]);
}
