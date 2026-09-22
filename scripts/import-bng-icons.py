#!/usr/bin/env python3
"""Import the BNG (Booongo) catalog + game art from the stage lobby page.

BNG sent five config lines and no protocol document (game-docs/13r §0), so unlike every other
provider here there is no catalog API to sync from. What there IS — found by probing the gate on
2026-09-07 — is the operator LOBBY page, which embeds the whole entitled portfolio as a JSON blob:

    https://gate.stage1.bng.games/op/<PROJECT_NAME>/lobby.html

⭐ The blob is the tail of the page: everything between `})(window, ` and `, null);`. It is the
launcher's own app_config, so it carries exactly what the lobby needs — numeric game id, the
`name` code, per-locale titles + banner URLs, release date, sort index and HOT/NEW label — plus
ready-made demo/real launcher URLs. It is UNGATED (no token, no IP allow-list, the Naga
/client/game situation) and PROJECT-SCOPED: another project name 404s, so what comes back is our
entitlement list and not BNG's whole studio.

    # everything, straight off the live lobby
    python3 scripts/import-bng-icons.py \
        --catalog-sql ../backend/services/simles/migrations/000081_bng.up.sql \
        --sql         ../backend/services/simles/migrations/000082_bng_game_icons.up.sql

    # see what is reachable before writing anything
    python3 scripts/import-bng-icons.py --dry-run

    # from a saved page (game-docs/13r-game-provider-bng/vendor/)
    python3 scripts/import-bng-icons.py lobby.html --dry-run

What this encodes:

  * **game_code is the NUMERIC id**, not the `pink_clovers_xxxl_bng` slug — the launch API
    measured on the gate takes `game=1067`
    (`GET /op/<project>/game/url?game=<id>&token=<playerToken>&…`). Same shape as Dragoon Soft
    (`ds-1001`), so ids are `bng-<numeric>` and the slug is kept in metadata.code.

  * ⚠️ **The art is a 328x192 LANDSCAPE banner and the lobby card is 3/4 PORTRAIT** with
    object-fit: cover. A straight mirror would centre-crop away 56% of the width — which is most
    of the logotype, since BNG centres it. So each banner is PADDED onto a 3:4 canvas on black
    (sips --padToHeightWidth) rather than cropped: the whole banner survives, letterboxed, and
    the tile still fills the card. Habanero ships proper 344x550 portrait tiles, so BNG probably
    has a portrait pack too — ask for it and this padding goes away (13r sheet §5 Q14).

  * **No upscale.** The source is 328 wide; SIZE is a short-side CEILING like every other pack.

  * **Mirror, do not hot-link.** ⛔ The whole `bng.games` zone is DNS-blocked in Indonesia —
    `dig static.bng.games` returns `internetpositif.id` / 36.86.63.185 on an Indonesian ISP. A
    hot-linked banner is fetched by the PLAYER's browser and would fail for every Indonesian
    player. (The same block hits the GAME CLIENT, which we cannot mirror — see 13r/TECHNICAL.md.)

  * ⚠️ **The art is ENGLISH.** BNG publishes en/ja/ko/th/zh/zh-hant and NO `id` locale;
    `?lang=id` is accepted by the lobby shell but every game falls back to English. The CQ9
    situation again.

  * The catalog SQL is idempotent (ON CONFLICT DO UPDATE on the BNG-sourced columns only, never
    image_url), so a later re-run picks up new releases without clearing art.

Requires cwebp (brew install webp); sips does the pad.
"""
import argparse, concurrent.futures, json, os, re, subprocess, sys, tempfile
import urllib.error, urllib.request

LOBBY_URL = "https://gate.stage1.bng.games/op/horizon88-stage/lobby.html"
VENDOR_ID = "bng"
QUALITY = 82
ASPECT_W, ASPECT_H = 3, 4          # the .game-card ratio the padded tile must match
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", VENDOR_ID)
URL_PREFIX = "/assets/games/" + VENDOR_ID
TIMEOUT = 30
WORKERS = 12
UA = "game-web-icon-import/1.0"

# Fleet placeholders — BNG publishes no bet limits (13r §0.2 Q2: no currency, no scale either).
MIN_BET, MAX_BET = 1000, 100000000


def fetch(url, binary=True):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def load_lobby(src):
    """Return the parsed app_config from a lobby.html URL or file."""
    html = fetch(src, binary=False) if src.startswith("http") else open(src, encoding="utf-8").read()
    head = "})(window, "
    try:
        i = html.index(head)
        j = html.rindex(", null);")
    except ValueError:
        sys.exit("could not find the app_config blob — is this a BNG lobby.html?")
    return json.loads(html[i + len(head):j])


def games_of(cfg):
    out = []
    for g in cfg["lobby"]["games"]:
        en = g["locales"].get("en") or next(iter(g["locales"].values()))
        banner = en["banner_path"]
        if banner.startswith("//"):
            banner = "https:" + banner
        out.append({
            "id": g["id"],                                  # numeric, the launch symbol
            "code": g["name"],                              # pink_clovers_xxxl_bng
            "title": en["title"],
            "banner": banner,
            "label": g.get("label") or "",
            "release_date": (g.get("release_date") or "")[:10],
            "sort_index": g.get("sort_index", 0),
            "titles": {k: v["title"] for k, v in g["locales"].items()},
        })
    return sorted(out, key=lambda x: int(x["id"]))


# ---- art ----

def convert(game, dry=False):
    """Download one banner, pad it onto a 3:4 canvas on black, write webp. -> (id, ok, note)."""
    try:
        raw = fetch(game["banner"])
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        return game["id"], False, f"fetch failed: {e}"
    if dry:
        return game["id"], True, f"{len(raw) // 1024}K"

    os.makedirs(OUT_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "src")
        with open(src, "wb") as fh:
            fh.write(raw)
        try:
            dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", src],
                                  capture_output=True, text=True, check=True).stdout
            w = int(re.search(r"pixelWidth: (\d+)", dims).group(1))
            h = int(re.search(r"pixelHeight: (\d+)", dims).group(1))
        except (subprocess.CalledProcessError, AttributeError) as e:
            return game["id"], False, f"unreadable image: {e}"

        # Pad (never crop, never upscale) to the card's 3:4. A source already >= 3:4 tall keeps
        # its own height; anything wider gets black bars top and bottom.
        target_h = max(h, (w * ASPECT_H + ASPECT_W - 1) // ASPECT_W)
        target_w = max(w, (target_h * ASPECT_W + ASPECT_H - 1) // ASPECT_H)
        padded = os.path.join(tmp, "padded.png")
        r = subprocess.run(["sips", "--padToHeightWidth", str(target_h), str(target_w),
                            "--padColor", "000000", src, "--out", padded],
                           capture_output=True, text=True)
        if r.returncode != 0:
            return game["id"], False, "sips pad failed: " + r.stderr.strip()[:80]

        dst = os.path.join(OUT_DIR, game["id"] + ".webp")
        r = subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), padded, "-o", dst],
                           capture_output=True, text=True)
        if r.returncode != 0:
            return game["id"], False, "cwebp failed: " + r.stderr.strip()[:80]
    return game["id"], True, f"{w}x{h} -> {target_w}x{target_h}"


# ---- SQL ----

def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def catalog_sql(games, source):
    j = lambda o: q(json.dumps(o, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    rows = []
    for g in games:
        meta = {"code": g["code"], "label": g["label"], "release_date": g["release_date"],
                "sort_index": g["sort_index"], "banner": g["banner"], "titles": g["titles"]}
        rows.append("  (%s, 'bng', %s, %s, 'slot', %d, %d, 'active', %s::jsonb)" % (
            q("bng-" + g["id"]), q(g["id"]), q(g["title"]), MIN_BET, MAX_BET, j(meta)))
    body = ",\n".join(rows)
    return f"""-- BNG (Booongo) — provider row + the {len(games)}-game catalog for project horizon88-stage.
--
-- ⚠️ CATALOG ONLY. There is NO internal/bng adapter: BNG has still not sent a protocol document
-- (game-docs/13r-game-provider-bng/TECHNICAL.md §0), so the wallet model, auth scheme, currency
-- and scale are all unknown. These rows make the games VISIBLE in the lobby and nothing else —
-- with no launcher wired, httpapi.launch falls through to its sandbox.invalid descriptor, so a
-- click is a dead end, not a money path. Nothing here can move a balance.
--
-- Source: {source}
--   the operator lobby page embeds its own app_config between `}})(window, ` and `, null);`.
--   Ungated and project-scoped (another project name 404s) = our entitlement list.
--   Regenerate with client-facing/scripts/import-bng-icons.py --catalog-sql <this file>.
--
-- game_code is the NUMERIC id because that is the launch symbol the gate takes
-- (`GET /op/<project>/game/url?game=<id>&token=<playerToken>`) — the ds-1001 shape, not naga's
-- slug. The slug lives in metadata.code. min_bet/max_bet are the fleet placeholders: BNG
-- publishes no bet limits, and §0.2 Q8 (currency AND scale) is still unanswered, so nothing here
-- may be read as a money fact.
--
-- allowed_cidrs seeds BNG's four REQUESTOR_IP_ADDRESS values. ⚠️ Their DIRECTION is unconfirmed
-- (13r §0.1 item 4: BNG's egress, or the sources they expect from us?). Seeded anyway because
-- the failure mode is a loud "source IP not allow-listed" the day an adapter is wired, whereas
-- '{{}}' means no restriction at all. hmac_key_ref stays NULL: secrets.Resolve("") errors, so the
-- generic /vendor/v1/wallet surface fails closed for 'bng' until a real ref is configured.

INSERT INTO vendors (id, name, api_base_url, inbound_auth, hmac_key_ref, allowed_cidrs,
                     settlement_model, play_model, status, metadata)
VALUES ('bng', 'BNG', 'https://gate.stage1.bng.games/op/', 'hmac', NULL,
        '{{54.151.243.48/32,3.0.152.5/32,18.142.75.213/32,13.214.254.26/32}}',
        'seamless', 'per_spin', 'active',
        '{{"project":"horizon88-stage","wl":"prod","catalog_source":"lobby.html","adapter":"not built",
          "wallet_model":"UNCONFIRMED — 13r §0.2 Q2"}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name         = EXCLUDED.name,
    api_base_url = EXCLUDED.api_base_url,
    status       = EXCLUDED.status;

INSERT INTO vendor_games (id, vendor_id, game_code, name, category, min_bet, max_bet, status, metadata) VALUES
{body}
ON CONFLICT (id) DO UPDATE SET
    game_code = EXCLUDED.game_code,
    name      = EXCLUDED.name,
    category  = EXCLUDED.category,
    status    = EXCLUDED.status,
    metadata  = EXCLUDED.metadata;
"""


def icons_sql(ok_ids, games, source):
    by_id = {g["id"]: g for g in games}
    rows = ",\n".join("  (%s, %s)" % (q(i), q(f"{URL_PREFIX}/{i}.webp")) for i in ok_ids)
    return f"""-- BNG artwork: point every catalog row at its local tile.
--
-- Source: the `banner_path` each game carries in the lobby app_config ({source}) — the same
-- field migration 000081 stored in vendor_games.metadata.banner. Mirrored into
-- client-facing/public/assets/games/bng/<game_code>.webp and committed.
-- Generated by client-facing/scripts/import-bng-icons.py.
--
-- ⚠️ MIRRORED, NEVER HOT-LINKED — and here that is not the usual caution. The whole
-- `bng.games` zone is DNS-blocked in Indonesia (`dig static.bng.games` -> internetpositif.id /
-- 36.86.63.185 on an Indonesian ISP), so a hot-linked banner would fail for every player we
-- have. See 13r/TECHNICAL.md; the same block hits the GAME CLIENT, which cannot be mirrored.
--
-- ⚠️ The source is a 328x192 LANDSCAPE banner and .game-card is 3/4 portrait + object-fit:
-- cover — a straight mirror would centre-crop away 56% of the width, i.e. most of the logotype.
-- Each tile is therefore the banner PADDED onto a 3:4 canvas on black, never cropped and never
-- upscaled. Ask BNG for a portrait pack (they publish only the lobby banner); Habanero's
-- 344x550 tiles are what this should eventually look like.
--
-- ⚠️ The art is ENGLISH: BNG publishes en/ja/ko/th/zh/zh-hant and no `id` locale. The CQ9
-- situation — an Indonesian-facing lobby with English tiles.
--
-- ⛔ ORDER OF DEPLOY: these paths 404 until client-facing is rebuilt and deployed with the new
-- assets, and GameCard has no onError fallback — a missing file renders as a BROKEN image, not
-- the letter placeholder (which only appears when image_url is empty). Deploy the assets FIRST,
-- then apply this migration.
--
-- Keyed on game_code (the numeric id), so this stays independent of the `bng-<id>` row-id scheme.

ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE vendor_games g SET image_url = v.url
  FROM (VALUES
{rows}
  ) AS v(code, url)
 WHERE g.vendor_id = 'bng' AND g.game_code = v.code;
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", nargs="?", default=LOBBY_URL, help="lobby.html URL or file")
    ap.add_argument("--catalog-sql", help="write the vendors + vendor_games migration here")
    ap.add_argument("--sql", help="write the image_url migration here")
    ap.add_argument("--dry-run", action="store_true", help="fetch and report, write nothing")
    args = ap.parse_args()

    cfg = load_lobby(args.source)
    games = games_of(cfg)
    print(f"catalog: {len(games)} games "
          f"(ids {games[0]['id']}..{games[-1]['id']}, locales "
          f"{','.join(sorted({l for g in games for l in g['titles']}))})")

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for gid, ok, note in ex.map(lambda g: convert(g, args.dry_run), games):
            results[gid] = (ok, note)
            if not ok:
                print(f"  ⚠️  {gid}: {note}")
    ok_ids = [g["id"] for g in games if results[g["id"]][0]]
    print(f"art: {len(ok_ids)}/{len(games)} ok" + (" (dry run — nothing written)" if args.dry_run else f" -> {OUT_DIR}"))

    if args.dry_run:
        return
    if args.catalog_sql:
        with open(args.catalog_sql, "w", encoding="utf-8") as fh:
            fh.write(catalog_sql(games, args.source))
        print("wrote", args.catalog_sql)
    if args.sql:
        with open(args.sql, "w", encoding="utf-8") as fh:
            fh.write(icons_sql(ok_ids, games, args.source))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
