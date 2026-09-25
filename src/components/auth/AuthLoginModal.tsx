"use client";

/**
 * Login modal. Mounted conditionally by <AuthModals/> when the auth-modal
 * store mode === "login". Form logic mirrors the former /login page:
 * identifier + password, rate-limit handling, and post-login redirect
 * (must_change_password -> /account, pending -> /wallet/deposit, else /lobby).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api/auth";
import { getDeviceId } from "@/lib/session";
import { useSessionStore } from "@/stores/session";
import { isApiError } from "@/lib/api/client";
import { takeSessionExpired } from "@/lib/auth-redirect";
import RateLimitMessage from "@/components/shared/RateLimitMessage";
import { useAuthModalStore } from "@/stores/auth-modal";
import { useBrandStore } from "@/stores/brand";
import PasswordField from "@/components/auth/PasswordField";

const loginSchema = z.object({
  identifier: z.string().min(1, "Username atau No. HP wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AuthLoginModal() {
  const router = useRouter();
  const registered = useAuthModalStore((s) => s.registered);
  const nextPath = useAuthModalStore((s) => s.nextPath);
  const close = useAuthModalStore((s) => s.close);
  const openRegister = useAuthModalStore((s) => s.openRegister);
  const setSession = useSessionStore((s) => s.setSession);
  const brand = useBrandStore((s) => s.brand);

  const brandLabel = brand.found && brand.label ? brand.label : "VEXYNIX";

  const [formError, setFormError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);

  // Read after mount — the flag lives in sessionStorage, which the server
  // render cannot see.
  useEffect(() => {
    if (takeSessionExpired()) setExpired(true);
  }, []);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setRateLimited(false);
    setSubmitting(true);
    try {
      const login = await authApi.login({
        identifier: data.identifier,
        password: data.password,
        device_id: getDeviceId(),
      });
      setSession(login);
      close();
      if (login.must_change_password) {
        router.push("/account");
      } else if (login.status === "pending") {
        router.push("/wallet/deposit");
      } else {
        // Back to whatever the expired session interrupted, if any.
        router.push(nextPath ?? "/lobby");
      }
    } catch (err) {
      if (isApiError(err, 401)) {
        setFormError("Kredensial tidak valid");
      } else if (isApiError(err, 403)) {
        setFormError("Akun dinonaktifkan — hubungi support");
      } else if (isApiError(err, 429)) {
        setRateLimited(true);
      } else {
        setFormError("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div
      className="modal d-block auth-modal"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Masuk"
    >
      <div className="modal-dialog modal-dialog-centered auth-modal-dialog">
        <div className="modal-content auth-modal-content">
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-modal-header">
              <button
                type="button"
                className="auth-back-button"
                aria-label="Kembali"
                onClick={close}
                disabled={submitting}
              >
                <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              </button>
              <h5 className="modal-title auth-modal-title">Masuk dengan {brandLabel}</h5>
            </div>
            <div className="auth-modal-body">
              <div className="auth-divider" />
              <div className="auth-brand-lockup" aria-label={brandLabel}>
                <strong>{brandLabel}</strong>
                <small>GAME PORTAL</small>
              </div>
              <div className="auth-switch-copy">
                <span>Belum punya akun?</span>
                <button type="button" onClick={openRegister}>
                  Buat Akun
                </button>
              </div>

              {registered && (
                <div className="auth-success">
                  Akun berhasil dibuat! Silakan masuk untuk melanjutkan.
                </div>
              )}
              {expired && (
                <div className="auth-notice">
                  Sesi Anda telah berakhir — silakan masuk kembali untuk melanjutkan.
                </div>
              )}
              {rateLimited && <RateLimitMessage />}
              {formError && <div className="auth-error">{formError}</div>}

              <div className="auth-field auth-field--floating">
                <label htmlFor="login-identifier">Username atau No. HP</label>
                <input
                  id="login-identifier"
                  type="text"
                  className="form-control"
                  placeholder="Username atau No. HP"
                  autoComplete="username"
                  aria-label="Username atau No. HP"
                  {...registerField("identifier")}
                />
                {errors.identifier && (
                  <div className="text-danger small mt-1">{errors.identifier.message}</div>
                )}
              </div>

              <PasswordField
                id="login-password"
                label="Password"
                placeholder="Password"
                autoComplete="current-password"
                aria-label="Password"
                hideLabel
                error={errors.password?.message}
                {...registerField("password")}
              />

              <div className="auth-form-options">
                <label className="auth-checkbox">
                  <input type="checkbox" />
                  <span>Ingat saya</span>
                </label>
                <span className="auth-inline-note">Lupa Password?</span>
              </div>
            </div>
            <div className="auth-modal-footer">
              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Sedang masuk...
                  </>
                ) : (
                  "Masuk"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div
        className="modal-backdrop show"
        onClick={() => {
          if (!submitting) close();
        }}
      />
    </div>
  );
}
