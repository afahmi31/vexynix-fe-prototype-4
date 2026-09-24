"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MOCK_CATALOG, MOCK_P3_PRESENTATIONS, MOCK_VENDORS } from "@/mocks/prototype-3";

export default function MockGamePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [rounds, setRounds] = useState(0);
  const game = MOCK_CATALOG.find((item) => item.id === params.id);
  const presentation = game ? MOCK_P3_PRESENTATIONS[game.id] : undefined;
  const vendor = game
    ? (MOCK_VENDORS.find((item) => item.id === game.vendor_id)?.name ?? game.vendor_id)
    : "";
  const isDemo = searchParams.get("mode") === "demo";
  const categoryLabel =
    game?.category === "live" ? "Live Casino" : game?.category === "slot" ? "Slot" : game?.category;
  const gameDescription =
    presentation?.synopsis ?? game?.description ?? "Nikmati pengalaman bermain dalam mode demo.";

  if (!game) {
    return (
      <main className="p4-game-page p4-game-page--empty">
        <div className="p4-game-page-inner">
          <div className="p4-game-empty">
            <i className="fa fa-gamepad" aria-hidden="true" />
            <h1>Game tidak ditemukan</h1>
            <p>Pilihan game ini sudah tidak tersedia di katalog.</p>
            <Link href="/lobby" className="p4-game-primary">
              Kembali ke Lobby
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p4-game-page">
      <div className="p4-game-page-inner">
        <div className="p4-game-toolbar">
          <Link href="/lobby" className="p4-game-back">
            <i className="fa fa-arrow-left" aria-hidden="true" /> Kembali ke Lobby
          </Link>
          <span className="p4-game-context">
            <i className="fa fa-gamepad" aria-hidden="true" /> Game Play
          </span>
        </div>

        <section className="p4-game-hero" aria-labelledby="p4-game-title">
          <div className="p4-game-art">
            {(presentation?.backdrop_url ?? game.image_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={presentation?.backdrop_url ?? game.image_url} alt={`${game.name} cover`} />
            )}
            <div className="p4-game-art-shade" />
            <div className="p4-game-art-copy">
              <span className="p4-game-art-badge">
                <i className="fa fa-sparkles" aria-hidden="true" /> Pilihan untukmu
              </span>
              <h1 id="p4-game-title">{game.name}</h1>
              <p>
                {vendor} <span aria-hidden="true">·</span> {categoryLabel}
              </p>
            </div>
          </div>

          <aside className="p4-game-play-panel">
            <div className="p4-game-panel-heading">
              <span className="p4-game-kicker">{isDemo ? "Mode Coba Gratis" : "Mode Bermain"}</span>
              <span className="p4-game-status">
                <i className="fa fa-circle" aria-hidden="true" /> Siap dimainkan
              </span>
            </div>
            <h2>Mulai putaranmu</h2>
            <p>{gameDescription}</p>

            <div className="p4-game-stats" aria-label="Informasi permainan">
              <div>
                <span>Saldo demo</span>
                <strong>Rp 1.000.000</strong>
              </div>
              <div>
                <span>Putaran</span>
                <strong aria-live="polite">{rounds}</strong>
              </div>
            </div>

            <button
              type="button"
              className="p4-game-primary p4-game-spin"
              onClick={() => setRounds((value) => value + 1)}
            >
              <i className="fa fa-play" aria-hidden="true" /> Putar Sekali
            </button>
            <Link href="/lobby?category=all#p4-catalog" className="p4-game-secondary">
              Jelajahi game lainnya <i className="fa fa-arrow-right" aria-hidden="true" />
            </Link>
          </aside>
        </section>

        <section className="p4-game-info-grid" aria-label="Informasi mode demo">
          <article className="p4-game-info-card">
            <span className="p4-game-info-icon" aria-hidden="true">
              <i className="fa fa-gamepad" />
            </span>
            <div>
              <h2>Demo interaktif</h2>
              <p>Coba satu putaran untuk melihat pengalaman game sebelum memilih game lain.</p>
            </div>
          </article>
          <article className="p4-game-info-card">
            <span className="p4-game-info-icon" aria-hidden="true">
              <i className="fa fa-wallet" />
            </span>
            <div>
              <h2>Saldo simulasi</h2>
              <p>Saldo yang tampil hanya untuk kebutuhan prototype dan tidak dapat digunakan.</p>
            </div>
          </article>
          <article className="p4-game-info-card">
            <span className="p4-game-info-icon" aria-hidden="true">
              <i className="fa fa-shield-halved" />
            </span>
            <div>
              <h2>Tanpa transaksi</h2>
              <p>Tidak ada taruhan, transaksi, atau perubahan saldo sungguhan di halaman ini.</p>
            </div>
          </article>
        </section>

        <div className="p4-game-note">
          <i className="fa fa-circle-info" aria-hidden="true" />
          <span>Mode demo aktif — seluruh interaksi di halaman ini bersifat simulasi.</span>
        </div>
      </div>
    </main>
  );
}
