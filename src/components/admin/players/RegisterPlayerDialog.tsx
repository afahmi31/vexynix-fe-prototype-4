"use client";

/**
 * P7.3 — manual player registration dialog (from the directory page).
 * POST /api/spg/v1/admin/players with the documented register contract:
 * { username, phone_number, password, currency } (docs/02-API-CONTRACTS.md §2.1).
 * On success the directory query refreshes and the new player's id is shown.
 */
import { useState } from "react";
import Link from "next/link";
import { useRegisterPlayer } from "@/hooks/useAdminPlayers";
import {
  validateRegisterInput,
  mapPlayerActionError,
} from "@/lib/admin-players";

export default function RegisterPlayerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const register = useRegisterPlayer();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [formError, setFormError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setUsername("");
    setPhone("");
    setPassword("");
    setCurrency("IDR");
    setFormError(null);
    register.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setFormError(null);
    const result = validateRegisterInput({ username, phone, password, currency });
    if (result.error || !result.values) {
      setFormError(result.error || "Invalid registration data.");
      return;
    }
    register.mutate(result.values, {
      onError: (err) => setFormError(mapPlayerActionError(err) || "Registration failed."),
    });
  };

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Register Player</h5>
          </div>
          <div className="modal-body">
            {register.isSuccess ? (
              <div className="text-center py-3">
                <i className="fa fa-circle-check fa-2x text-success mb-2 d-block" />
                <p className="mb-1">
                  Player <strong>{register.data.username}</strong> created
                  (ID {register.data.user_id}).
                </p>
                <p className="text-muted small mb-3">
                  Status: {register.data.status}. The account activates on first
                  deposit.
                </p>
                <Link
                  href={`/admin/merchant/players/${register.data.user_id}`}
                  className="btn btn-theme btn-sm"
                  onClick={close}
                >
                  Open profile
                </Link>
              </div>
            ) : (
              <>
                {formError && <div className="alert alert-danger py-2">{formError}</div>}
                <div className="mb-3">
                  <label htmlFor="reg-username" className="form-label">
                    Username
                  </label>
                  <input
                    id="reg-username"
                    className="form-control"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="reg-phone" className="form-label">
                    Phone number
                  </label>
                  <input
                    id="reg-phone"
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812..."
                    autoComplete="off"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="reg-password" className="form-label">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <div className="form-text">Minimum 8 characters.</div>
                </div>
                <div className="mb-1">
                  <label htmlFor="reg-currency" className="form-label">
                    Currency
                  </label>
                  <input
                    id="reg-currency"
                    className="form-control"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={close}
              disabled={register.isPending}
            >
              {register.isSuccess ? "Close" : "Cancel"}
            </button>
            {!register.isSuccess && (
              <button
                type="button"
                className="btn btn-success"
                onClick={submit}
                disabled={register.isPending}
              >
                {register.isPending ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    />
                    Registering...
                  </>
                ) : (
                  "Register"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
