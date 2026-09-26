"use client";

/**
 * Register modal. Mounted conditionally by <AuthModals/> when the auth-modal
 * store mode === "register". Mirrors the former /register page. On success it
 * closes itself and opens the login modal with the "account created" banner
 * (replicates the old /login?registered=1 flow without a full navigation).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { useAuthModalStore } from "@/stores/auth-modal";
import { useBrandStore } from "@/stores/brand";
import PasswordField from "@/components/auth/PasswordField";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(50, "Username maksimal 50 karakter")
      .regex(/^[a-zA-Z0-9_]+$/, "Hanya huruf, angka, dan underscore"),
    phone_number: z
      .string()
      .min(8, "No. HP minimal 8 digit")
      .max(15, "No. HP maksimal 15 digit")
      .regex(/^\d+$/, "No. HP hanya angka"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
    currency: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthRegisterModal() {
  const close = useAuthModalStore((s) => s.close);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const brand = useBrandStore((s) => s.brand);

  const brandLabel = brand.found && brand.label ? brand.label : "Game Portal";

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      phone_number: "",
      password: "",
      confirmPassword: "",
      currency: "IDR",
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await authApi.register({
        username: data.username,
        phone_number: data.phone_number,
        password: data.password,
        currency: data.currency,
      });
      close();
      openLogin({ registered: true });
    } catch (err) {
      if (isApiError(err, 409)) {
        setFormError("Username atau No. HP sudah terdaftar");
      } else {
        setFormError("Pendaftaran gagal. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <>
      <div
        className="modal-backdrop show auth-modal-backdrop"
        onClick={() => {
          if (!submitting) close();
        }}
      />
      <div
        className="modal d-block auth-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Daftar"
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
                <h5 className="modal-title auth-modal-title">Buat Akun dengan {brandLabel}</h5>
              </div>
              <div className="auth-modal-body">
                <div className="auth-divider" />
                <div className="auth-brand-lockup" aria-label={brandLabel}>
                  <strong>{brandLabel}</strong>
                  <small>GAME PORTAL</small>
                </div>
                <div className="auth-switch-copy">
                  <span>Sudah punya akun?</span>
                  <button type="button" onClick={() => openLogin()}>
                    Masuk
                  </button>
                </div>

                {formError && <div className="auth-error">{formError}</div>}

                <div className="auth-field">
                  <label htmlFor="register-username" className="visually-hidden">
                    Username
                  </label>
                  <input
                    id="register-username"
                    type="text"
                    className="form-control"
                    placeholder="Username"
                    autoComplete="username"
                    aria-label="Username"
                    {...registerField("username")}
                  />
                  {errors.username && (
                    <div className="text-danger small mt-1">{errors.username.message}</div>
                  )}
                </div>

                <div className="auth-field">
                  <label htmlFor="register-phone" className="visually-hidden">
                    No. HP
                  </label>
                  <input
                    id="register-phone"
                    type="tel"
                    className="form-control"
                    placeholder="No. HP"
                    autoComplete="tel"
                    aria-label="No. HP"
                    {...registerField("phone_number")}
                  />
                  {errors.phone_number && (
                    <div className="text-danger small mt-1">{errors.phone_number.message}</div>
                  )}
                </div>

                <PasswordField
                  id="register-password"
                  label="Password"
                  placeholder="Password"
                  autoComplete="new-password"
                  aria-label="Password"
                  hideLabel
                  error={errors.password?.message}
                  {...registerField("password")}
                />

                <PasswordField
                  id="register-confirm"
                  label="Konfirmasi Password"
                  placeholder="Konfirmasi Password"
                  autoComplete="new-password"
                  aria-label="Konfirmasi Password"
                  hideLabel
                  error={errors.confirmPassword?.message}
                  {...registerField("confirmPassword")}
                />

                <input type="hidden" {...registerField("currency")} />
                <p className="auth-terms-note">
                  Dengan melanjutkan, kamu menyetujui Syarat &amp; Ketentuan dan Kebijakan Privasi
                  {brandLabel}.
                </p>
              </div>
              <div className="auth-modal-footer">
                <button type="submit" className="auth-submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Membuat akun...
                    </>
                  ) : (
                    "Buat Akun"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
