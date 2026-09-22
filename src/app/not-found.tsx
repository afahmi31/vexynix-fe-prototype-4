import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card text-center">
        <div className="auth-card-header">
          <div className="auth-brand">
            <div>
              <div className="auth-brand-name">404</div>
              <div className="auth-brand-sub">Halaman tidak ditemukan</div>
            </div>
          </div>
        </div>
        <div className="auth-card-body">
          <p className="text-muted mb-3">
            Halaman yang Anda cari tidak tersedia.
          </p>
          <Link href="/lobby" className="auth-submit btn btn-theme d-block">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
