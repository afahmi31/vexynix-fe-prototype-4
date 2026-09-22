/**
 * Zustand session store — domain state for the logged-in user.
 * Rehydrated from sessionStorage on first client render.
 */
import { create } from "zustand";
import type { LoginRes, Role, AccountStatus } from "@/types/api";
import { getSession, saveSession, clearSession } from "@/lib/session";

interface SessionState {
  token: string | null;
  userId: number | null;
  username: string | null;
  phoneNumber: string | null;
  currency: string;
  status: AccountStatus;
  role: Role;
  merchantId: number | null;
  mustChangePassword: boolean;
  hydrated: boolean;
  setSession: (login: LoginRes) => void;
  hydrate: () => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  userId: null,
  username: null,
  phoneNumber: null,
  currency: "IDR",
  status: "pending",
  role: "player",
  merchantId: null,
  mustChangePassword: false,
  hydrated: false,

  setSession: (login) => {
    saveSession(login);
    set({
      token: login.token,
      userId: login.user_id,
      username: login.username,
      phoneNumber: login.phone_number ?? null,
      currency: login.currency,
      status: login.status,
      role: login.role,
      merchantId: login.merchant_id,
      mustChangePassword: login.must_change_password,
    });
  },

  hydrate: () => {
    const stored = getSession();
    if (stored) {
      set({
        token: stored.token,
        userId: stored.user_id,
        username: stored.username,
        phoneNumber: stored.phone_number ?? null,
        currency: stored.currency,
        status: stored.status as AccountStatus,
        role: stored.role as Role,
        merchantId: stored.merchant_id,
        mustChangePassword: stored.must_change_password,
        hydrated: true,
      });
    } else {
      set({ hydrated: true });
    }
  },

  clear: () => {
    clearSession();
    set({
      token: null,
      userId: null,
      username: null,
      phoneNumber: null,
      currency: "IDR",
      status: "pending",
      role: "player",
      merchantId: null,
      mustChangePassword: false,
    });
  },
}));
