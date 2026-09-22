/**
 * Development-only helpers for completing a deposit on the sandbox gateway.
 *
 * The UI exposes the simulation control only outside production builds and only
 * when the deposit belongs to the sandbox provider. Real payment providers never
 * show this control.
 */
import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";

export const SANDBOX_PROVIDER_ID = "sandbox";

export const canSimulatePayment =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEV_SIMULATE_PAYMENT !== "0";

export function canSettleSandboxDeposit(providerId: string | undefined): boolean {
  return canSimulatePayment && providerId === SANDBOX_PROVIDER_ID;
}

export function describeSimulateError(err: unknown): string {
  if (isApiError(err, 404)) {
    return "Backend refused: either the BFF runs without WEB_ALLOW_SANDBOX_SETTLE, or the deposit reference is unknown.";
  }
  if (isApiError(err, 401)) {
    return "Session rejected — sign in again.";
  }
  if (isApiError(err, 400)) {
    return "Backend rejected the request.";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Could not reach the backend.";
  }
  if (isApiError(err)) {
    return err.message || `Simulation failed (HTTP ${err.status}).`;
  }
  return "Simulation failed.";
}
