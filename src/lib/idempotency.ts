"use client";

import { useRef, useCallback } from "react";

/**
 * useClientRef — mints a UUID on mount, stable across re-renders.
 * reset() mints a new UUID — call only when starting a genuinely new action.
 * Retries (e.g. after network timeout) reuse the same ref — that's the point.
 */
export function useClientRef() {
  const ref = useRef<string | null>(null);

  if (ref.current === null) {
    ref.current = crypto.randomUUID();
  }

  const reset = useCallback(() => {
    ref.current = crypto.randomUUID();
  }, []);

  return { ref: ref.current, reset };
}
