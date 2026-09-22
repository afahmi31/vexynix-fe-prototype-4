"use client";

import { useState } from "react";
import { useChangeMerchantPassword } from "@/hooks/useAdminMerchant";
import { useSessionStore } from "@/stores/session";
import { validateChangePasswordForm } from "@/lib/admin-merchant";

export default function PasswordChangePanel() {
  const changePassword = useChangeMerchantPassword();
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validation = validateChangePasswordForm(form);
    if (validation.error || !validation.req) {
      setError(validation.error);
      return;
    }

    try {
      await changePassword.mutateAsync(validation.req);
      setSuccess("Password changed successfully.");
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      // Note: must_change_password flag should be cleared server-side; we just show success
    } catch {
      setError("Failed to change password. Check your current password and try again.");
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const passwordMismatch = form.newPassword !== "" && form.newPassword !== form.confirmPassword;
  const passwordTooShort = form.newPassword !== "" && form.newPassword.length < 8;

  return (
    <div>
      <h4 className="mb-3">Change Password</h4>

      {mustChangePassword && (
        <div className="alert alert-warning">
          <i className="fa fa-exclamation-triangle me-2" />
          <strong>Password change required.</strong> You must change your password before continuing to use the merchant console.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="current-password">
            Current Password
          </label>
          <input
            id="current-password"
            type="password"
            className="form-control"
            value={form.currentPassword}
            onChange={(e) => handleChange("currentPassword", e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="new-password">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            className={`form-control ${passwordMismatch ? "is-invalid" : ""}`}
            value={form.newPassword}
            onChange={(e) => handleChange("newPassword", e.target.value)}
            autoComplete="new-password"
            required
          />
          {passwordTooShort && (
            <div className="invalid-feedback d-block">
              New password must be at least 8 characters.
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="confirm-password">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type="password"
            className={`form-control ${passwordMismatch ? "is-invalid" : ""}`}
            value={form.confirmPassword}
            onChange={(e) => handleChange("confirmPassword", e.target.value)}
            autoComplete="new-password"
            required
          />
          {passwordMismatch && (
            <div className="invalid-feedback d-block">
              New passwords do not match.
            </div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-theme"
          disabled={changePassword.isPending || passwordMismatch || passwordTooShort}
        >
          {changePassword.isPending ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" />
              Changing...
            </>
          ) : (
            "Change Password"
          )}
        </button>
      </form>
    </div>
  );
}
