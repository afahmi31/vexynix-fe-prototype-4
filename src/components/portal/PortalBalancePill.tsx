"use client";

import { useEffect, useRef } from "react";
import { useBalance } from "@/hooks/useBalance";
import { useSessionStore } from "@/stores/session";

/**
 * Portal-styled balance pill — gold-tinted badge for the dark portal header.
 * Wraps the shared useBalance hook with `.portal-header-balance` styling.
 */
export default function PortalBalancePill() {
  const { data, isLoading, isError } = useBalance();
  const currency = useSessionStore((s) => s.currency);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const available = data?.balance?.available ?? null;
  const held = data?.balance?.held ?? 0;

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el || held <= 0) return;
    // Bootstrap JS is loaded globally in root layout
    const bs = (
      window as unknown as {
        bootstrap?: { Tooltip: new (el: Element) => { dispose: () => void } };
      }
    ).bootstrap;
    if (!bs) return;
    const tip = new bs.Tooltip(el);
    return () => tip.dispose();
  }, [held]);

  if (isLoading) {
    return (
      <span
        className="portal-header-balance placeholder-glow"
        aria-hidden="true"
      >
        <i className="fa-solid fa-coins" />
        <span className="placeholder" style={{ width: "4rem" }} />
      </span>
    );
  }

  if (isError || available === null) {
    return (
      <span className="portal-header-balance">
        <i className="fa-solid fa-coins" />
        <span>—</span>
      </span>
    );
  }

  const formatted = new Intl.NumberFormat("id-ID", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(available);

  return (
    <span className="portal-header-balance">
      <i className="fa-solid fa-coins" />
      <span>
        {currency} {formatted}
      </span>
      {held > 0 && (
        <span
          ref={tooltipRef}
          className="badge bg-warning ms-1"
          data-bs-toggle="tooltip"
          data-bs-placement="bottom"
          title={`Ditahan: ${new Intl.NumberFormat("id-ID").format(held)}`}
        >
          {new Intl.NumberFormat("id-ID", { notation: "compact" }).format(
            held,
          )}
        </span>
      )}
    </span>
  );
}
