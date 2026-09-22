"use client";

/**
 * 403 page for the merchant admin role gate (P7.1). Rendered in place (no
 * redirect loop) when the session role is not merchant_admin; links back to
 * the player lobby.
 */
import Link from "next/link";

export default function AdminForbidden() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center py-5 my-5">
      <div className="display-1 fw-bold text-theme mb-2">403</div>
      <h2 className="mb-2">Access denied</h2>
      <p className="text-muted mb-4 col-md-6 col-lg-4">
        This area is restricted to merchant administrators. If you believe this
        is a mistake, sign in again with a merchant admin account.
      </p>
      <Link href="/lobby" className="btn btn-theme px-4">
        Back to Lobby
      </Link>
    </div>
  );
}
