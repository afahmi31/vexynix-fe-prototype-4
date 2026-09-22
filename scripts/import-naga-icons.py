#!/usr/bin/env python3
"""Import Naga Games' game icons into public/assets/games/naga + emit the catalog SQL.

Naga is the AFB-class easy pack: `GET /client/game` (NAGA-PLATFORM-API §1) already carries a
`preview` URL on every one of the 63 rows, and it is a SQUARE key-art tile with the game's
logotype baked in — the same shape pgsoft/ds/pp use. There is no title matching and no
OVERRIDES table, because the catalog row and the art come from the same response.

    # 1. straight off the live catalog (no DB, no credentials — /client/game is ungated)
    curl -s "https://api.stg.game.topplatform.asia/client/game?groupCode=oooo&brandCode=hohi" \
        > naga-catalog.json
    python3 scripts/import-naga-icons.py naga-catalog.json \
        --sql ../backend/services/simles/migrations/000053_naga_game_icons.up.sql

    # …or off the DB, once migration 000052 has seeded the rows (preview lives in metadata)
    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('game_code',game_code,
        'name',name,'preview',metadata->>'preview')) from vendor_games where vendor_id='naga'" \
        > naga-catalog.json

    # see what is reachable before writing anything
    python3 scripts/import-naga-icons.py naga-catalog.json --dry-run

Either shape is accepted: the raw vendor gameList array or a psql row dump.

What this encodes:

  * ⭐ **Naga serves preview art off TWO different CDNs**, split roughly half and half across the
    catalog: `imagedelivery.net/<account>/<uuid>.png/public` (Cloudflare Images, 768x768) and
    `gamifystaging.blob.core.windows.net/staging/common/<uuid>.png` (Azure blob, 800x800). Both
    are square, both carry the logotype. Nothing here depends on which one a game uses.
  * ⚠️ **`imagedelivery.net` answers 403 to a bare `Python-urllib/3.x` user-agent** while curl
    gets 200 — a UA sniff, not an auth gate. `fetch()` therefore always sets a UA. Without it
    exactly the 40 Cloudflare-hosted games fail and the 23 Azure ones succeed, which reads like
    a partial pack rather than a header problem.
  * **Mirror, do not hot-link.** `gamifystaging...` is Naga's STAGING blob store by its own name,
    and the Cloudflare account id is theirs. A hot-linked URL is fetched by the PLAYER's browser
    (where vendor-host trouble is least visible) and dies the day Naga rotates either host — the
    PP CDN-block lesson, one integration later.
  * ⚠️ **The art is English, and asking for Indonesian does not change that.** Measured
    2026-08-25: `locale: id` returns byte-identical preview URLs and names to the default, while
    `locale: th` and `locale: cn` return 63 different previews and ~60 different names. So Naga
    HAS localised art — just not for `id`, which silently falls back rather than erroring. The
    marketing Drive pack has per-language logo files but no Indonesian icon set either. Worth
    asking Naga for; until then this is the CQ9 situation (English tiles in an ID-facing lobby).
  * **Sources are 768/800 square, downscaled to a 512 short side** (sips), matching sg/pt/pp/ds.
    `.game-card` is aspect-ratio 3/4 + object-fit: cover, so a square tile crops cleanly.
  * **The SQL keys on `game_code`** — Naga's own slug (`lucky-zhu`), the stable handle its docs
    name and a clean path segment as-is. That keeps this migration independent of the
    `naga-<code>` row-id scheme 000052 uses.
  * **Safe against a resync**: `naga.CatalogUpsertSQL` refreshes only game_code/name/category/
    status/metadata ON CONFLICT, and the background RefreshOnce writes only metadata+status, so
    neither ever clears image_url. A game Naga adds LATER lands with image_url NULL and the UI
    falls back to its initial-letter placeholder.

Requires cwebp (brew install webp); sips does the downscale.
"""
import argparse, concurrent.futures, json, os, re, subprocess, sys, tempfile
import urllib.error, urllib.request

SIZE, QUALITY = 512, 82           # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "naga")
URL_PREFIX = "/assets/games/naga"
TIMEOUT = 30
WORKERS = 12
# ⚠️ NOT cosmetic: imagedelivery.net 403s the default Python-urllib UA. See the module docstring.
UA = "game-web-icon-import/1.0"


def load_catalog(path):
    """Accept either the raw /client/game array or a psql row dump -> [{game_code, preview, …}]."""
    blob = json.load(open(path))
    rows = blob if isinstance(blob, list) else blob.get("data") or blob.get("games") or []
    if not rows:
        sys.exit(f"{path}: no rows — expected the /client/game array or a psql json_agg dump")
    out = []
    for r in rows:
        code = r.get("game_code") or r.get("code")
        preview = r.get("preview")
        if not code:
            sys.exit(f"row without a game code: {r!r}")
        if not preview:
            print(f"  NO PREVIEW in catalog: {code}", file=sys.stderr)
            continue
        out.append({"game_code": code, "preview": preview, "name": r.get("name", code)})
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"user-agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read()


def short_side(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout
    dims = [int(m) for m in re.findall(r"pixel(?:Width|Height):\s*(\d+)", out)]
    return min(dims) if len(dims) == 2 else 0


def convert(src, dest):
    """PNG -> WebP, downscaling only if the source is bigger than SIZE on its short side."""
    if short_side(src) > SIZE:
        subprocess.run(["sips", "-Z", str(SIZE), src, "--out", src],
                       check=True, capture_output=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), src, "-o", dest],
                   check=True, capture_output=True)


def grab(game):
    """Download + convert one icon -> (game, bytes-on-disk) or (game, None)."""
    try:
        blob = fetch(game["preview"])
    except urllib.error.HTTPError as e:
        print(f"  ! {game['game_code']}: HTTP {e.code}", file=sys.stderr)
        return game, None
    except Exception as e:
        print(f"  ! {game['game_code']}: {e}", file=sys.stderr)
        return game, None
    # Cloudflare Images ends the path in a VARIANT ("/public"), so splitext on the URL yields
    # "" there and ".png" on the Azure side — either way the bytes decide, and cwebp sniffs.
    ext = os.path.splitext(game["preview"].split("/public")[0])[1] or ".png"
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "src" + ext)
        dst = os.path.join(tmp, "out.webp")
        with open(src, "wb") as fh:
            fh.write(blob)
        try:
            convert(src, dst)
        except subprocess.CalledProcessError as e:
            print(f"  ! {game['game_code']}: convert failed: "
                  f"{e.stderr.decode(errors='replace').strip()}", file=sys.stderr)
            return game, None
        return game, open(dst, "rb").read()


def render_sql(rows):
    return ("-- Naga Games artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: the `preview` URL GET /client/game publishes on every row\n"
            "-- (NAGA-PLATFORM-API §1) — the same field migration 000052 stored in\n"
            "-- vendor_games.metadata. Square key art with the logotype baked in, mirrored into\n"
            "-- client-facing/public/assets/games/naga/<game_code>.webp and committed.\n"
            "-- Generated by client-facing/scripts/import-naga-icons.py.\n"
            "--\n"
            "-- ⭐ Naga splits that art across TWO CDNs — imagedelivery.net (Cloudflare Images,\n"
            "-- 768x768, served from the `/public` variant) and gamifystaging.blob.core.windows.net\n"
            "-- (Azure, 800x800). Both are STAGING hosts by their own names, so both are mirrored\n"
            "-- rather than hot-linked: a hot-linked URL is fetched by the PLAYER's browser and dies\n"
            "-- the day Naga rotates either host (the PP CDN-block lesson).\n"
            "--\n"
            "-- ⚠️ The art is ENGLISH. Measured 2026-08-25: `locale: id` returns byte-identical\n"
            "-- previews and names to the default, while `locale: th` / `cn` return 63 different\n"
            "-- previews — Naga has localised art, just not for Indonesian, and falls back silently.\n"
            "-- Ask Naga for an ID set; until then this is the CQ9 situation.\n"
            "--\n"
            "-- Downscaled to a 512 short side (sips) like sg/pt/pp/ds. `.game-card` is\n"
            "-- aspect-ratio 3/4 + object-fit: cover, so a square tile crops cleanly.\n"
            "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) /\n"
            "-- pt (000042) / pp (000044) / afb (000045) / ds (000047) / cq9 (000049): the icons are\n"
            "-- served by the client-facing Next.js app, so it stays correct across every tenant\n"
            "-- domain.\n"
            "--\n"
            "-- Keyed on game_code — Naga's own slug, the stable handle its docs name — so this\n"
            "-- migration is independent of the `naga-<code>` row-id scheme 000052 uses.\n"
            "--\n"
            "-- Safe against a resync: naga.CatalogUpsertSQL refreshes only game_code/name/category/\n"
            "-- status/metadata ON CONFLICT and the background RefreshOnce writes only metadata +\n"
            "-- status, so neither ever clears image_url. A game Naga adds LATER lands with\n"
            "-- image_url NULL and the UI falls back to its initial-letter placeholder.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'naga'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="naga-catalog.json (/client/game array or a psql dump)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="download + convert, write nothing")
    args = ap.parse_args()

    catalog = load_catalog(args.catalog)
    bad = [g for g in catalog if not re.fullmatch(r"[A-Za-z0-9_-]+", g["game_code"])]
    if bad:
        sys.exit(f"game_code is not a usable path segment for: {[g['game_code'] for g in bad]}")

    print(f"catalog {len(catalog)} games")
    rows, missing, total = [], [], 0
    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for game, blob in pool.map(grab, catalog):
            if blob is None:
                missing.append(game)
                continue
            code = game["game_code"]
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, code + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append(f"  ('{code}', '{URL_PREFIX}/{code}.webp')")

    for g in missing:
        print(f"  NO ICON: {g['game_code']} {g['name']!r}")
    verb = "would write" if args.dry_run else "wrote"
    print(f"{verb} {len(rows)} icons -> {OUT_DIR}  ({total/1024/1024:.1f} MB), "
          f"{len(missing)} missing")

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(sorted(rows)))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
