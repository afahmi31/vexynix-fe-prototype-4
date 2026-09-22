import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

interface Props {
  /** Override copy for a specific context; defaults to the shared 429 copy. */
  message?: string;
  className?: string;
}

/**
 * Shared 429 UX (P5.4): static alert, no auto-retry.
 */
export default function RateLimitMessage({
  message = RATE_LIMIT_MESSAGE,
  className = "",
}: Props) {
  return (
    <div className={`alert alert-warning fs-13px ${className}`} role="alert">
      <i className="fa fa-clock me-2" />
      {message}
    </div>
  );
}
