"use client";

import { useStepUpStore } from "@/stores/stepup";

export default function StepUpDialog() {
  const pending = useStepUpStore((s) => s.pending);
  const password = useStepUpStore((s) => s.password);
  const error = useStepUpStore((s) => s.error);
  const submitting = useStepUpStore((s) => s.submitting);
  const setPassword = useStepUpStore((s) => s.setPassword);
  const confirm = useStepUpStore((s) => s.confirm);
  const cancel = useStepUpStore((s) => s.cancel);

  if (!pending) return null;

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Konfirmasi Password</h5>
          </div>
          <div className="modal-body">
            <p className="text-muted">
              Demi keamanan, masukkan kembali password Anda untuk melanjutkan.
            </p>
            {error && (
              <div className="alert alert-danger py-2">{error}</div>
            )}
            <div className="mb-3">
              <label htmlFor="stepup-password" className="form-label">
                Password
              </label>
              <input
                id="stepup-password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) confirm();
                }}
                disabled={submitting}
                autoFocus
                autoComplete="current-password"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancel}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-theme"
              onClick={confirm}
              disabled={submitting || !password}
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  />
                  Memverifikasi...
                </>
              ) : (
                "Konfirmasi"
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
