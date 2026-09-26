"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NEXT_PARAM, safeNextPath } from "@/lib/auth-redirect";
import AuthRouteLoading from "@/components/auth/AuthRouteLoading";

/**
 * /login is now a deep-link shim. It redirects to the lobby and signals the
 * auth modal to open in login mode (see lobby/page.tsx). The actual form lives
 * in <AuthLoginModal/>. The ?registered=1 flag (set after a successful
 * register) and ?next=... (session-expired return path from auth-redirect)
 * are forwarded so the modal can act on them.
 */
function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const next = safeNextPath(searchParams.get(NEXT_PARAM));

  useEffect(() => {
    const params = new URLSearchParams({ auth: "login" });
    if (registered) params.set("registered", "1");
    if (next) params.set(NEXT_PARAM, next);
    router.replace(`/lobby?${params.toString()}`);
  }, [router, registered, next]);

  return <AuthRouteLoading mode="login" />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthRouteLoading mode="login" />}>
      <LoginRedirect />
    </Suspense>
  );
}
