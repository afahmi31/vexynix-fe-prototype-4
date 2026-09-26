"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthRouteLoading from "@/components/auth/AuthRouteLoading";

/**
 * /register is now a deep-link shim. It redirects to the lobby and signals the
 * auth modal to open in register mode (see lobby/page.tsx). The actual form
 * lives in <AuthRegisterModal/>.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/lobby?auth=register");
  }, [router]);

  return <AuthRouteLoading mode="register" />;
}
