"use client";

import Link from "next/link";
import { useBrandStore } from "@/stores/brand";

export default function P4Footer() {
  const brand = useBrandStore((state) => state.brand);
  const brandLabel = brand.found && brand.label ? brand.label : "VEXYNIX";

  return (
    <footer className="p4-footer">
      <div className="p4-footer-inner">
        <div className="p4-footer-brand-block">
          <Link href="/lobby" className="p4-footer-brand">
            {brandLabel}
          </Link>
          <p>Main Lebih Seru Setiap Hari</p>
        </div>
        <div className="p4-footer-links">
          <div>
            <h2>Permainan</h2>
            <Link href="/lobby?category=all">Semua Game</Link>
            <Link href="/lobby?category=slot">Slot</Link>
            <Link href="/lobby?category=live">Live Casino</Link>
            <Link href="/lobby#p4-providers">Provider</Link>
          </div>
          <div>
            <h2>Bantuan</h2>
            <Link href="/lobby#bantuan">Pusat Bantuan</Link>
            <Link href="/lobby#bantuan">Hubungi Kami</Link>
          </div>
          <div>
            <h2>Tentang Vexynix</h2>
            <Link href="/lobby#bantuan">Tentang Kami</Link>
            <Link href="/lobby#bantuan">Karir</Link>
          </div>
          <div>
            <h2>Syarat &amp; Ketentuan</h2>
            <Link href="/lobby#bantuan">Syarat &amp; Ketentuan</Link>
            <Link href="/lobby#bantuan">Privasi</Link>
          </div>
        </div>
        <div className="p4-footer-side">
          <div className="p4-footer-socials" aria-label="Media sosial Vexynix">
            {[
              ["fa-brands fa-facebook", "Facebook"],
              ["fa-brands fa-instagram", "Instagram"],
              ["fa-brands fa-youtube", "YouTube"],
              ["fa-brands fa-x-twitter", "X"],
            ].map(([icon, label]) => (
              <a href="#" key={label} aria-label={label} onClick={(event) => event.preventDefault()}>
                <i className={icon} aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className="p4-footer-bottom">© 2024 Vexynix. Semua Hak Dilindungi.</div>
        </div>
      </div>
    </footer>
  );
}
