"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import Script from "next/script";
import { createClientErrorReporter, ConsoleTelemetrySink } from "@/lib/observability";
import { useSessionStore } from "@/stores/session";

const LOAD_RUNTIME_ENV_SCRIPT = process.env.NODE_ENV === "production";

type Metric = {
  id: string;
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
};

interface PerformanceEntry {
  renderTime?: number;
  loadTime?: number;
  processingStart?: number;
  startTime?: number;
  hadRecentInput?: boolean;
  value?: number;
}

function useReportWebVitals(): void {
  useEffect(() => {
    // Initialize error reporter
    const sink = new ConsoleTelemetrySink();
    const reporter = createClientErrorReporter(sink);
    reporter.attach();

    // Web Vitals tracking via PerformanceObserver
    const trackVital = (metric: Metric): void => {
      const logLine = {
        type: "vital",
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(logLine));

      // Send beacon to /api/vitals
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const payload = JSON.stringify(logLine);
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/vitals", blob);
      }
    };

    // Observe web vitals using PerformanceObserver API
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      try {
        // LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry;
          if (lastEntry) {
            const value = lastEntry.renderTime ?? lastEntry.loadTime ?? 0;
            trackVital({
              id: "LCP",
              name: "LCP",
              value,
              rating: value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor",
              delta: 0,
            });
          }
        });
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

        // FID (First Input Delay) - replaced by INP in newer browsers
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries() as PerformanceEntry[];
          entries.forEach((entry) => {
            const value = (entry.processingStart ?? 0) - (entry.startTime ?? 0);
            trackVital({
              id: "FID",
              name: "INP",
              value,
              rating: value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor",
              delta: 0,
            });
          });
        });
        fidObserver.observe({ entryTypes: ["first-input"] });

        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        let clsObserver: PerformanceObserver | null = null;
        try {
          clsObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries() as PerformanceEntry[];
            entries.forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value ?? 0;
              }
            });
          });
          // Some browsers don't support layout-shift entryType
          clsObserver.observe({ type: "layout-shift", buffered: true });
        } catch {
          // Fallback for older browsers
          try {
            clsObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries() as PerformanceEntry[];
              entries.forEach((entry) => {
                if (!entry.hadRecentInput) {
                  clsValue += entry.value ?? 0;
                }
              });
            });
            clsObserver.observe({ entryTypes: ["layout-shift"] });
          } catch {
            // CLS not supported — skip silently
          }
        }

        // Report CLS on page hide
        const reportCLS = () => {
          trackVital({
            id: "CLS",
            name: "CLS",
            value: clsValue,
            rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor",
            delta: 0,
          });
        };
        window.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") {
            reportCLS();
          }
        });

        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver?.disconnect();
          reporter.detach();
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("[Observability] PerformanceObserver not supported:", errorMessage);
      }
    }

    return () => {
      reporter.detach();
    };
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const [_sessionHydrated] = useState(useSessionStore((s) => s.hydrated));

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useReportWebVitals();

  return (
    <QueryClientProvider client={client}>
      {LOAD_RUNTIME_ENV_SCRIPT ? <Script src="/__ENV.js" strategy="lazyOnload" /> : null}
      {children}
    </QueryClientProvider>
  );
}
