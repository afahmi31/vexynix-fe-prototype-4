import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";

export function mapDepositError(err: unknown): string {
  if (isApiError(err, 403, "ACCOUNT_FROZEN")) {
    return "Account frozen — contact support";
  }
  if (isApiError(err, 403)) {
    return "Deposit blocked — please contact support";
  }
  if (isApiError(err, 400)) {
    return "Check the amount and method";
  }
  if (isApiError(err, 503)) {
    return "No payment provider available — please retry";
  }
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) {
    return "Connection problem — your deposit may have been created. Check status before retrying.";
  }
  if (isApiError(err)) {
    return err.message || "Deposit failed";
  }
  return "Something went wrong. Please try again.";
}
