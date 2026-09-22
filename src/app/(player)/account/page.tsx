"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session";
import { useBalance } from "@/hooks/useBalance";
import { authApi } from "@/lib/api/auth";

// Player self-service change-password endpoint is NOT confirmed in the
// backend yet (merchant has POST /api/merchant/password; player equivalent
// TBD). UI ships behind this flag, default off — wire to the endpoint once
// confirmed by the backend team.
const CHANGE_PASSWORD_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_CHANGE_PASSWORD === "true";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  const visibleHead = digits.slice(0, 4);
  const visibleTail = digits.length > 6 ? digits.slice(-2) : "";
  const maskedCount = Math.max(digits.length - visibleHead.length - visibleTail.length, 2);
  return `${visibleHead}${"•".repeat(maskedCount)}${visibleTail}`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-success";
    case "pending":
      return "bg-warning";
    case "suspended":
    case "closed":
      return "bg-danger";
    default:
      return "bg-secondary";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Aktif";
    case "pending":
      return "Menunggu";
    case "suspended":
      return "Ditangguhkan";
    case "closed":
      return "Ditutup";
    default:
      return status;
  }
}

function formatIDR(n: number): string {
  if (!n) return "0";
  return n.toLocaleString("id-ID");
}

export default function AccountPage() {
  const router = useRouter();
  const username = useSessionStore((s) => s.username);
  const phoneNumber = useSessionStore((s) => s.phoneNumber);
  const currency = useSessionStore((s) => s.currency);
  const status = useSessionStore((s) => s.status);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const clear = useSessionStore((s) => s.clear);

  const { data: balanceData, isLoading: balanceLoading, isError: balanceError } = useBalance();
  const available = balanceData?.balance?.available ?? 0;
  const held = balanceData?.balance?.held ?? 0;
  const total = available + held;

  const [loggingOut, setLoggingOut] = useState(false);

  // Change-password form state (behind feature flag)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Fire-and-forget — clear locally regardless
    }
    clear();
    router.push("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);

    if (newPassword.length < 8) {
      setPwError("Password baru minimal 8 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Password baru tidak cocok");
      return;
    }

    setPwSubmitting(true);
    try {
      // TODO(P5.3): wire to the player change-password endpoint once the
      // backend confirms it. Until then, show the support notice.
      setPwNotice(
        "Ubah password belum tersedia — silakan hubungi dukungan."
      );
    } finally {
      setPwSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="portal-page-title">Akun</h1>

      {mustChangePassword && (
        <div className="alert alert-warning">
          <strong>Anda harus mengubah password sebelum melanjutkan.</strong>
          {!CHANGE_PASSWORD_ENABLED && (
            <>
              {" "}
              Ubah password mandiri belum tersedia — silakan hubungi dukungan
              untuk reset password.
            </>
          )}
        </div>
      )}

      {/* Profile */}
      <div className="portal-panel">
        <div className="portal-panel-header">Profil</div>
        <div className="portal-panel-body">
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <tbody>
                <tr>
                  <th style={{ width: "40%" }}>Username</th>
                  <td>{username ?? "—"}</td>
                </tr>
                <tr>
                  <th>No. HP</th>
                  <td className="font-monospace">
                    {phoneNumber ? maskPhone(phoneNumber) : "—"}
                  </td>
                </tr>
                <tr>
                  <th>Valuta</th>
                  <td>{currency}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>
                    <span className={`badge ${statusBadgeClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Saldo */}
      <div className="portal-panel mt-3">
        <div className="portal-panel-header">Saldo</div>
        <div className="portal-panel-body">
          {balanceLoading && (
            <div className="text-center py-3">
              <div className="spinner-border spinner-border-sm text-muted" role="status" />
            </div>
          )}
          {!balanceLoading && (
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr>
                    <th style={{ width: "40%" }}>Saldo Tersedia</th>
                    <td className="text-end fw-bold text-success">
                      {balanceError ? "—" : `${currency} ${formatIDR(available)}`}
                    </td>
                  </tr>
                  <tr>
                    <th>Dana Ditahan</th>
                    <td className="text-end text-warning">
                      {balanceError ? "—" : `${currency} ${formatIDR(held)}`}
                    </td>
                  </tr>
                  <tr className="fw-bold">
                    <th>Total Saldo</th>
                    <td className="text-end">
                      {balanceError ? "—" : `${currency} ${formatIDR(total)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Change password — feature flagged, endpoint TBD */}
      {CHANGE_PASSWORD_ENABLED && (
        <div className="portal-panel mt-3">
          <div className="portal-panel-header">Ubah Password</div>
          <div className="portal-panel-body">
            {pwError && <div className="alert alert-danger">{pwError}</div>}
            {pwNotice && <div className="alert alert-info">{pwNotice}</div>}
            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label" htmlFor="current-password">
                  Password Saat Ini
                </label>
                <input
                  id="current-password"
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="new-password">
                  Password Baru
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <small className="text-muted">Minimal 8 karakter</small>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="confirm-password">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-theme"
                disabled={pwSubmitting}
              >
                {pwSubmitting && (
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                )}
                Ubah Password
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="portal-panel mt-3">
        <div className="portal-panel-body">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut && (
              <span className="spinner-border spinner-border-sm me-2" role="status" />
            )}
            {loggingOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </div>
    </>
  );
}
