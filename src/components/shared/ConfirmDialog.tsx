"use client";

/**
 * Controlled confirm dialog — Bootstrap modal markup in the same style as
 * StepUpDialog (no bootstrap.js dependency, plain conditional render).
 *
 * Used by P7.3 player actions (freeze/unfreeze/status/self-exclude/limits)
 * and P7.4 approval actions. `variant` styles the confirm button; use
 * variant="danger" for destructive actions like the fraud-kill freeze.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "theme",
  submitting = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "theme" | "danger" | "warning" — maps to btn-theme / btn-danger / btn-warning. */
  variant?: "theme" | "danger" | "warning";
  submitting?: boolean;
  /** Inline error shown inside the dialog (e.g. mapped API error). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const btnClass =
    variant === "danger"
      ? "btn-danger"
      : variant === "warning"
        ? "btn-warning"
        : "btn-theme";

  return (
    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {children}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${btnClass}`}
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                    aria-hidden="true"
                  />
                  Working...
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </div>
  );
}
