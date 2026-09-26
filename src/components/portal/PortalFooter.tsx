"use client";

import { usePathname } from "next/navigation";
import { useBrandStore } from "@/stores/brand";
import P4Footer from "./P4Footer";

/** P4 surfaces and auth deep-link shims share the discovery footer. */
export default function PortalFooter() {
  const brand = useBrandStore((state) => state.brand);
  const pathname = usePathname();
  const brandLabel = brand.label || "VEXYNIX";

  const isP4Surface =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/lobby" ||
    pathname.startsWith("/mock-game/");

  if (isP4Surface) return <P4Footer />;

  return (
    <footer className="portal-footer">
      <small className="text-muted">
        © 2026 {brandLabel}. 18+ Bermain dengan bertanggung jawab.
      </small>
    </footer>
  );
}
