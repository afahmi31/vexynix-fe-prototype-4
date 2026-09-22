"use client";

import { useEffect, useRef } from "react";
import { useBalance } from "@/hooks/useBalance";
import { useSessionStore } from "@/stores/session";
import { BalancePillSkeleton } from "@/components/shared/skeletons";

export default function BalancePill() {
  const { data, isLoading, isError } = useBalance();
  const currency = useSessionStore((s) => s.currency);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const available = data?.balance?.available ?? null;
  const held = data?.balance?.held ?? 0;

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el || held <= 0) return;
    // Bootstrap JS is loaded globally in root layout
    const bs = (window as unknown as { bootstrap?: { Tooltip: new (el: Element) => { dispose: () => void } } }).bootstrap;
    if (!bs) return;
    const tip = new bs.Tooltip(el);
    return () => tip.dispose();
  }, [held]);

  if (isLoading) {
    return <BalancePillSkeleton />;
  }

  if (isError || available === null) {
    return (
      <div className="navbar-item d-none d-md-flex">
        <span className="badge bg-secondary fs-6 px-3 py-2">—</span>
      </div>
    );
  }

  const formatted = new Intl.NumberFormat("id-ID", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(available);

  return (
    <div className="navbar-item d-none d-md-flex">
      <span className="badge bg-theme text-dark fs-6 px-3 py-2">
        {currency} {formatted}
      </span>
      {held > 0 && (
        <span
          ref={tooltipRef}
          className="badge bg-warning ms-1"
          data-bs-toggle="tooltip"
          data-bs-placement="bottom"
          title={`Held: ${new Intl.NumberFormat("id-ID").format(held)}`}
        >
          {new Intl.NumberFormat("id-ID", { notation: "compact" }).format(held)}
        </span>
      )}
    </div>
  );
}
