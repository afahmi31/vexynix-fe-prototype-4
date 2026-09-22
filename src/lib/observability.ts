/**
 * Observability library for client-side error and metrics reporting.
 * Provides a swappable sink interface for sending telemetry data.
 */

export type VitalsMetric = {
  name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
  value: number;
  unit: "ms" | "second" | "number";
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
};

export type ErrorReport = {
  message: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  stack?: string;
  eventType: "error" | "rejection";
  routePath: string;
  timestamp: string;
  userId?: number; // Always user_id, never token or PII
};

export type TelemetryEvent = VitalsMetric | ErrorReport;

export interface TelemetrySink {
  /** Report web vitals metrics */
  reportVital(metric: VitalsMetric): void;

  /** Report client-side errors */
  reportError(error: ErrorReport): Promise<void>;

  /** Flush any buffered events (if applicable) */
  flush?(): void;
}

/** Rate limiter for error reports (max 5 per minute per session) */
class RateLimiter {
  private counts: Map<string, { count: number; windowStart: number }> = new Map();
  private readonly maxPerMinute = 5;
  private readonly windowMs = 60 * 1000;

  allow(key: string = "default"): boolean {
    const now = Date.now();
    const entry = this.counts.get(key) || { count: 0, windowStart: now };

    if (now - entry.windowStart > this.windowMs) {
      // Reset window
      entry.count = 0;
      entry.windowStart = now;
    }

    if (entry.count >= this.maxPerMinute) {
      return false;
    }

    entry.count += 1;
    this.counts.set(key, entry);
    return true;
  }
}

const rateLimiter = new RateLimiter();

/** Default console-based sink for dev/staging. Can be swapped for real backend. */
export class ConsoleTelemetrySink implements TelemetrySink {
  reportVital(metric: VitalsMetric): void {
    const logLine = {
      type: "vital",
      metric: metric.name,
      value: metric.value,
      unit: metric.unit,
      rating: metric.rating,
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(logLine));
  }

  async reportError(error: ErrorReport): Promise<void> {
    const logLine = {
      type: "error",
      ...error,
    };
    console.error(JSON.stringify(logLine));
  }

  flush?(): void {
    // No-op for console sink
  }
}

/**
 * Client-side error reporter using sendBeacon for fire-and-forget delivery.
 * Uses navigator.sendBeacon to avoid blocking navigation.
 */
export function createClientErrorReporter(sink: TelemetrySink) {
  const trackPath = typeof window !== "undefined" ? window.location.pathname : "/";
  let userIdCache: number | null = null;

  // Async function to get userId from session store
  const getUserId = async (): Promise<number | null> => {
    if (userIdCache !== null) {
      return userIdCache;
    }
    try {
      const sessionStoreModule = await import("@/stores/session");
      const store = sessionStoreModule.useSessionStore.getState();
      if (store.userId) {
        userIdCache = store.userId;
        return store.userId;
      }
    } catch {
      // Session store not available yet
    }
    return null;
  };

  const handleError = async (
    message: string,
    fileName?: string,
    lineNumber?: number,
    columnNumber?: number,
    errorObj?: Error
  ) => {
    const userId = await getUserId();
    const errorReport: ErrorReport = {
      message,
      fileName,
      lineNumber,
      columnNumber,
      stack: errorObj?.stack,
      eventType: "error",
      routePath: trackPath,
      timestamp: new Date().toISOString(),
      ...(userId && { userId }),
    };

    if (rateLimiter.allow(`error_${trackPath}`)) {
      void sink.reportError(errorReport);
    }
  };

  const handleRejection = async (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const userId = await getUserId();
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      eventType: "rejection",
      routePath: trackPath,
      timestamp: new Date().toISOString(),
      ...(userId && { userId }),
    };

    if (rateLimiter.allow(`rejection_${trackPath}`)) {
      void sink.reportError(errorReport);
    }
  };

  const errorListener = (e: ErrorEvent) => {
    void handleError(e.message, e.filename, e.lineno, e.colno, e.error);
  };

  const rejectionListener = (e: PromiseRejectionEvent) => {
    void handleRejection(e);
  };

  return {
    handleError,
    handleRejection,
    attach: () => {
      if (typeof window === "undefined") return;
      window.addEventListener("error", errorListener);
      window.addEventListener("unhandledrejection", rejectionListener);
    },
    detach: () => {
      if (typeof window === "undefined") return;
      window.removeEventListener("error", errorListener);
      window.removeEventListener("unhandledrejection", rejectionListener);
    },
  };
}

/**
 * Send beacon to /api/vitals endpoint
 */
export async function sendVitalViaBeacon(vital: VitalsMetric): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) {
    console.warn("[Observability] sendBeacon not supported");
    return;
  }

  const payload = JSON.stringify({
    type: "vital",
    metric: vital.name,
    value: vital.value,
    unit: vital.unit,
    rating: vital.rating,
    timestamp: new Date().toISOString(),
  });

  const blob = new Blob([payload], { type: "application/json" });
  const success = navigator.sendBeacon("/api/vitals", blob);

  if (!success) {
    console.warn("[Observability] sendBeacon failed");
  }
}

/**
 * Send beacon to /api/vitals with error data
 */
export async function sendErrorViaBeacon(error: ErrorReport): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) {
    console.warn("[Observability] sendBeacon not supported");
    return;
  }

  const payload = JSON.stringify(error);
  const blob = new Blob([payload], { type: "application/json" });
  const success = navigator.sendBeacon("/api/vitals", blob);

  if (!success) {
    console.warn("[Observability] sendBeacon failed");
  }
}
