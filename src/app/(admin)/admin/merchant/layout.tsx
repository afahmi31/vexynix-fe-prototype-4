"use client";

/**
 * Merchant admin role gate (P7.1).
 *
 * Session role must be "merchant_admin" (set from the login response). Anyone
 * else gets an in-place 403 page — no redirect loop, just a link back to the
 * lobby. The parent (app) layout has already hydrated the session and verified
 * a token exists before children render, so `role` is resolved by the time
 * this layout renders.
 *
 * Note (per spec): a stale role after a server-side change is corrected on
 * next login — there is intentionally no runtime role refresh.
 */
import { useSessionStore } from "@/stores/session";
import AdminForbidden from "@/components/admin/AdminForbidden";

export default function MerchantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hydrated = useSessionStore((s) => s.hydrated);
  const role = useSessionStore((s) => s.role);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);

  // Parent layout normally guarantees hydration; stay defensive anyway.
  if (!hydrated) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5 my-5">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (role !== "merchant_admin") {
    return <AdminForbidden />;
  }

  // Force password change before accessing merchant console (mirror P5.3)
  if (mustChangePassword) {
    // Redirect to account page
    if (typeof window !== "undefined") {
      window.location.href = "/admin/merchant/account";
    }
    return (
      <div className="d-flex justify-content-center align-items-center py-5 my-5">
        <div className="spinner-border text-theme" role="status">
          <span className="visually-hidden">Redirecting...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
