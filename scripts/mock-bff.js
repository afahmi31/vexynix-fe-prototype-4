#!/usr/bin/env node
/**
 * Mock BFF — preview the player portal without the Go backend.
 *
 * Serves /api/games/catalog and /api/vendors with the wire shapes from
 * src/types/api.ts, pointing image_url at the real local artwork under
 * public/assets/games/. Auth, wallet, and launch endpoints are NOT mocked,
 * so login/deposit/game-launch will fail — this is UI preview only.
 *
 * Usage:  pnpm mock-bff        (port 18080, matches NEXT_PUBLIC_BFF_ORIGIN default)
 * Then:   pnpm dev             (in another terminal)
 */
const http = require("http");

const PORT = process.env.MOCK_BFF_PORT || 18080;

const pgsoft = [
  "alchemy-gold", "alibaba-cave", "anubis-wrath", "asgardian-rs",
  "baccarat-deluxe", "bakery-bonanza", "bali-vacation", "battleground",
].map((code, i) => ({
  id: `pgsoft-${code}`,
  vendor_id: "pgsoft",
  game_code: code,
  name: code.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  category: "slot",
  min_bet: 1000,
  max_bet: 2000000,
  status: "active",
  image_url: `/assets/games/pgsoft/${code}.webp`,
  rtp: 0.945 + i * 0.005,
  is_popular: i < 2,
}));

const pp = ["1301", "1320", "ar10plinko", "ar1chickrush"].map((code, i) => ({
  id: `pp-${code}`,
  vendor_id: "pragmaticplay",
  game_code: code,
  name: `Pragmatic ${code}`,
  category: "slot",
  min_bet: 500,
  max_bet: 1000000,
  status: "active",
  image_url: `/assets/games/pragmaticplay/${code}.webp`,
  rtp: 0.96,
  is_new: i === 0,
}));

const evo = ["baccarat-sicbo", "blackjack", "game-shows", "poker"].map((code, i) => ({
  id: `evo-${code}`,
  vendor_id: "evolution",
  game_code: code,
  name: code.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  category: "live casino",
  min_bet: 5000,
  max_bet: 5000000,
  status: "active",
  image_url: `/assets/games/evolution/${code}.webp`,
  rtp: 0.99,
  is_featured: i === 0,
}));

const sg = ["a-sc01", "f-ah01", "f-fl01", "f-sf01"].map((code, i) => ({
  id: `sg-${code}`,
  vendor_id: "sg",
  game_code: code,
  name: `Spadegaming ${code.toUpperCase()}`,
  category: i === 3 ? "fish hunter" : "slot",
  min_bet: 200,
  max_bet: 500000,
  status: "active",
  image_url: `/assets/games/sg/${code}.webp`,
  rtp: 0.95,
}));

const noArt = [0, 1, 2].map((i) => ({
  id: `afb-88fortunes-${i}`,
  vendor_id: "afb",
  game_code: `88fortunes-${i}`,
  name: `88 Fortunes ${i + 1}`,
  category: "slot",
  min_bet: 1000,
  max_bet: 800000,
  status: "active",
  rtp: 0.96,
}));

const games = [...pgsoft, ...pp, ...evo, ...sg, ...noArt];

const vendors = [
  { id: "pgsoft", name: "PG Soft", status: "active", enabled: true },
  { id: "pragmaticplay", name: "Pragmatic Play", status: "active", enabled: true },
  { id: "evolution", name: "Evolution", status: "active", enabled: true },
  { id: "sg", name: "Spadegaming", status: "active", enabled: true },
  { id: "afb", name: "AFB", status: "active", enabled: true },
];

http
  .createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url.startsWith("/api/games/catalog")) {
      res.end(JSON.stringify({ games }));
    } else if (req.url.startsWith("/api/vendors")) {
      res.end(JSON.stringify({ vendors }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not found" }));
    }
  })
  .listen(PORT, () => console.log(`mock BFF on :${PORT}`));
