import { create } from "zustand";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

interface StepUpState {
  pending: boolean;
  resolve: ((value: void) => void) | null;
  reject: ((reason?: string) => void) | null;
  password: string;
  error: string | null;
  submitting: boolean;
  setPassword: (p: string) => void;
  requestStepUp: () => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => void;
}

export const useStepUpStore = create<StepUpState>((set, get) => ({
  pending: false,
  resolve: null,
  reject: null,
  password: "",
  error: null,
  submitting: false,

  setPassword: (password) => set({ password, error: null }),

  requestStepUp: () => {
    return new Promise<void>((resolve, reject) => {
      // If already pending, chain onto the existing step-up
      if (get().pending) {
        const timer = setInterval(() => {
          if (!get().pending) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
        return;
      }
      set({ pending: true, resolve, reject, password: "", error: null, submitting: false });
    });
  },

  confirm: async () => {
    const { password } = get();
    set({ submitting: true, error: null });
    try {
      await authApi.stepUp(password);
      get().resolve?.();
      set({ pending: false, resolve: null, reject: null, submitting: false });
    } catch (err) {
      if (isApiError(err, 429)) {
        set({ error: RATE_LIMIT_MESSAGE, submitting: false });
        return;
      }
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "INVALID_CREDENTIALS") {
          set({ error: "Invalid password", submitting: false });
          return;
        }
      }
      set({ error: "Step-up failed. Please try again.", submitting: false });
    }
  },

  cancel: () => {
    get().reject?.("cancel");
    set({ pending: false, resolve: null, reject: null, password: "", error: null, submitting: false });
  },
}));
