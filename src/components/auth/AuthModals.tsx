"use client";

/**
 * Auth modal host. Mounted once in the public layout. Renders whichever auth
 * modal the store has open (so each form's state is fresh on open), and toggles
 * Bootstrap's `modal-open` body class to lock background scroll while open.
 */
import { useEffect } from "react";
import { useAuthModalStore } from "@/stores/auth-modal";
import AuthLoginModal from "./AuthLoginModal";
import AuthRegisterModal from "./AuthRegisterModal";

export default function AuthModals() {
  const mode = useAuthModalStore((s) => s.mode);

  useEffect(() => {
    if (mode === null) return;
    document.body.classList.add("modal-open");
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [mode]);

  return (
    <>
      {mode === "login" && <AuthLoginModal />}
      {mode === "register" && <AuthRegisterModal />}
    </>
  );
}
