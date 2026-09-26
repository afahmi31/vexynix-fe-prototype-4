import type { ReactElement } from "react";

interface AuthRouteLoadingProps {
  mode: "login" | "register";
}

export default function AuthRouteLoading({ mode }: AuthRouteLoadingProps): ReactElement {
  const label = mode === "login" ? "Menyiapkan formulir masuk" : "Menyiapkan formulir daftar";

  return (
    <div
      className="auth-route-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${label}...`}
    >
      <div className="auth-route-loading-card" aria-hidden="true">
        <span className="auth-route-loading-mark" />
        <span className="auth-route-loading-line auth-route-loading-line--title" />
        <span className="auth-route-loading-line" />
        <span className="auth-route-loading-line auth-route-loading-line--short" />
        <span className="auth-route-loading-spinner" />
      </div>
    </div>
  );
}
