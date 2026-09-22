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

  if (!game) {
    return (
      <main className="mock-game-shell">
        <div className="mock-game-empty">
          <i className="fa fa-gamepad" />
          <h1>Game tidak ditemukan</h1>
          <p>Pilihan game ini sudah tidak tersedia di mock catalog.</p>
          <Link href="/lobby" className="mock-game-back">
            Kembali ke Lobby
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mock-game-shell">
      <div className="mock-game-toolbar">
        <Link href="/lobby" className="mock-game-back">
          <i className="fa fa-arrow-left" /> Kembali ke Lobby
        </Link>
        <span className="mock-game-label">
          <i className="fa fa-flask" /> Preview lokal P3
        </span>
      </div>

      <section className="mock-game-stage">
        <div className="mock-game-stage-art">
          {(presentation?.backdrop_url ?? game.image_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presentation?.backdrop_url ?? game.image_url} alt="" aria-hidden="true" />
          )}
          <div className="mock-game-stage-shade" />
          <div className="mock-game-stage-content">
            <span className="mock-game-mode">{isDemo ? "Mode Coba Gratis" : "Mode Bermain"}</span>
            <h1>{game.name}</h1>
            <p>
              {vendor} · {game.category}
            </p>
          </div>
        </div>

        <div className="mock-game-console">
          <div>
            <span className="mock-game-console-label">{isDemo ? "Saldo Demo" : "Saldo Mock"}</span>
            <strong>Rp 1.000.000</strong>
          </div>
          <div>
            <span className="mock-game-console-label">Putaran</span>
            <strong>{rounds}</strong>
          </div>
          <button
            type="button"
            className="mock-game-spin"
            onClick={() => setRounds((value) => value + 1)}
          >
            <i className="fa fa-play" /> Putar Sekali
          </button>
        </div>

        <div className="mock-game-note">
          <i className="fa fa-circle-info" />
          Ini hanya simulasi interaksi untuk prototype. Tidak ada taruhan, saldo, atau transaksi
          sungguhan di halaman ini.
        </div>
      </section>
    </main>
  );
}
