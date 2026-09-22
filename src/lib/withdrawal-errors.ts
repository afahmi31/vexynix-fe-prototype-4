import { isApiError, NETWORK_ERROR_CODE } from "@/lib/api/client";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

export function mapWithdrawalError(err: unknown): string {
  if (isApiError(err, 401, "STEP_UP_REQUIRED")) return "";
  if (isApiError(err, 403, "DEST_COOLDOWN")) return "This destination is still cooling down";
  if (isApiError(err, 403)) return "This destination is not available";
  if (isApiError(err, 429)) return RATE_LIMIT_MESSAGE;
  if (isApiError(err, 0, NETWORK_ERROR_CODE)) return "Connection problem — check status before retrying";
  if (isApiError(err)) return err.message || "Withdrawal failed";
  return "Something went wrong";
}
