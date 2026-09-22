"use client";

export default function PlayerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="portal-panel">
      <div className="portal-panel-header">Something went wrong</div>
      <div className="portal-panel-body">
        <div className="alert alert-danger" role="alert">
          {error?.message || "An unexpected error occurred."}
        </div>
        <button type="button" className="btn btn-theme" onClick={reset}>
          <i className="fa fa-redo me-2" />
          Try again
        </button>
      </div>
    </div>
  );
}
