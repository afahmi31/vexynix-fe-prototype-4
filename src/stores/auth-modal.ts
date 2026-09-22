/**
 * Auth modal store — controls which auth modal (login/register) is open.
 * Mounted once via <AuthModals/> in the public layout. Triggered by the
 * Masuk/Daftar buttons in PortalHeader, or by deep-link redirect from
 * /login and /register.
 */
import { create } from "zustand";

export type AuthModalMode = "login" | "register";

interface AuthModalState {
  mode: AuthModalMode | null;
  /** Show the "account created" banner in the login modal after register. */
  registered: boolean;
  /**
   * Return path after login when the trip here was caused by an expired
   * session (auth-redirect). Applied to the default post-login route only.
   */
  nextPath: string | null;
  openLogin: (opts?: { registered?: boolean; next?: string | null }) => void;
  openRegister: () => void;
  close: () => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  mode: null,
  registered: false,
  nextPath: null,

  openLogin: (opts) =>
    set({
      mode: "login",
      registered: opts?.registered ?? false,
      nextPath: opts?.next ?? null,
    }),
  openRegister: () => set({ mode: "register", registered: false }),
  close: () => set({ mode: null, registered: false, nextPath: null }),
}));
