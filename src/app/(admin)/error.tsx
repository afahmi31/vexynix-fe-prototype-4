"use client";

import { Panel, PanelHeader, PanelBody } from "@/components/panel/panel";

/**
 * Route-group error boundary for all (app) pages (P5.5).
 * Renders the error with a retry button. 401s are not special-cased here:
 * the API client already triggers the auth redirect before the error
 * reaches this boundary, so we simply render whatever arrives.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <h1 className="page-header">Something went wrong</h1>
      <Panel>
        <PanelHeader noButton>Error</PanelHeader>
        <PanelBody>
          <div className="alert alert-danger" role="alert">
            {error?.message || "An unexpected error occurred."}
          </div>
          <button type="button" className="btn btn-theme" onClick={reset}>
            <i className="fa fa-redo me-2" />
            Try again
          </button>
        </PanelBody>
      </Panel>
    </>
  );
}
