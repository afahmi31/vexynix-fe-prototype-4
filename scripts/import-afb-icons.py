#!/usr/bin/env python3
"""Import AFB's game icons into public/assets/games/afb + emit the catalog SQL.

AFB is the easiest of the icon packs: `gameList` (AFB-INTEGRATION-API.md §6) already carries a
`picture` URL on every one of the 142 rows, and that URL's file name IS the `game_code`:

    https://tapi.vip88b.net/icons/308x218/<gameCode>.png

So there is no title matching and no OVERRIDES table here — the same "code IS the file name"
shortcut import-pp-icons.py gets, without PP's variant probing.

    # 1. the catalog, as the DB has it (picture comes out of the seeded metadata)
    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name,'picture',metadata->>'picture'))
        from vendor_games where vendor_id='afb'" > afb-catalog.json
    python3 scripts/import-afb-icons.py afb-catalog.json \
        --sql ../backend/services/simles/migrations/000045_afb_game_icons.up.sql

    # …or, with no DB to hand, straight off the committed gameList snapshot — the same 142 rows
    # migration 000023 was generated from:
    python3 scripts/import-afb-icons.py \
        ../game-docs/13j-game-provider-afb/vendor/gamelist-id-2026-08-02.json --sql ...

    # see what is reachable before writing anything
    python3 scripts/import-afb-icons.py afb-catalog.json --dry-run

Either shape is accepted: a `{"status":…, "game_list":[…]}` vendor snapshot or a DB row dump.

What this encodes:

  * **Mirror, do not hot-link.** `tapi.vip88b.net` is AFB's *staging* CDN — not the
    `games.luckyinc.net` their PDF names, and neither host is in the contract. Migration 000023's
    own header says to self-host the art before go-live; this is that. A hot-linked staging URL
    would be fetched by the PLAYER's browser and dies the day AFB rotates the host.
  * **The source is 308x218, so nothing is upscaled.** The sibling packs normalise to a 512 short
    side; AFB simply has no art that big. `.game-card-image img` is `object-fit: cover`, so a 308px
    tile crops cleanly — stretching it to 512 would only soften it. Anything that ever does arrive
    larger than 512 is downscaled (sips), aspect preserved.
  * **The SQL keys on `game_code`, not `id`.** Unlike PP/PT — whose catalogs are probe-synced with
    DB-side ids — AFB's catalog ships *in* migration 000023 with literal ids, and game_code is the
    vendor's own stable key. Keying on it makes this migration independent of the id scheme.
  * **Safe against a resync**: `afb.CatalogUpsertSQL` refreshes only name/category/status/metadata
    ON CONFLICT, so it never clears image_url. A game AFB adds LATER lands with image_url NULL and
    the UI falls back to its initial-letter placeholder.

Requires cwebp (brew install webp); sips is used only for the (currently unreachable) downscale.
"""
import argparse, concurrent.futures, json, os, re, subprocess, sys, tempfile
import urllib.error, urllib.request

SIZE, QUALITY = 512, 82           # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "afb")
URL_PREFIX = "/assets/games/afb"
TIMEOUT = 30
WORKERS = 16


def load_catalog(path):
    """Accept either the vendor gameList snapshot or a psql row dump -> [{game_code, picture, …}]."""
    blob = json.load(open(path))
    rows = blob["game_list"] if isinstance(blob, dict) and "game_list" in blob else blob
    out = []
    for r in rows:
        code = r.get("game_code") or r.get("code")
        pic = r.get("picture")
        if not code:
            sys.exit(f"row without a game code: {r!r}")
        if not pic:
            print(f"  NO PICTURE in catalog: {code}", file=sys.stderr)
            continue
        out.append({"game_code": code, "picture": pic, "name": r.get("name", code)})
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"user-agent": "game-web-icon-import/1.0"})
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
        blob = fetch(game["picture"])
    except urllib.error.HTTPError as e:
        print(f"  ! {game['game_code']}: HTTP {e.code}", file=sys.stderr)
        return game, None
    except Exception as e:
        print(f"  ! {game['game_code']}: {e}", file=sys.stderr)
        return game, None
    ext = os.path.splitext(game["picture"])[1] or ".png"
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
    return ("-- AFB game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: the `picture` URL `gameList` publishes on every row\n"
            "-- (AFB-INTEGRATION-API.md §6) — https://tapi.vip88b.net/icons/308x218/<gameCode>.png,\n"
            "-- the same field already stored in vendor_games.metadata by the 000023 seed.\n"
            "-- Mirrored verbatim into client-facing/public/assets/games/afb/<gameCode>.webp and\n"
            "-- committed. Generated by client-facing/scripts/import-afb-icons.py.\n"
            "--\n"
            "-- Mirrored rather than hot-linked on purpose: tapi.vip88b.net is AFB's STAGING CDN,\n"
            "-- not the games.luckyinc.net their PDF names, and neither host is a contract — 000023's\n"
            "-- own header says to self-host the art before go-live. A hot-linked URL would also be\n"
            "-- fetched by the PLAYER's browser, which is where vendor-host trouble is least visible.\n"
            "--\n"
            "-- Art is 308x218 as AFB ships it — not upscaled to the 512 short side the sg/pt/pp packs\n"
            "-- use, because AFB has no larger source. `.game-card-image img` is object-fit: cover.\n"
            "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042)\n"
            "-- / pp (000044): the icons are served by the client-facing Next.js app, so it stays\n"
            "-- correct across every host/tenant domain.\n"
            "--\n"
            "-- Keyed on game_code, not id: AFB's catalog ships in migration 000023 with literal ids,\n"
            "-- and game_code is the vendor's own stable key.\n"
            "--\n"
            "-- Safe against a resync: afb.CatalogUpsertSQL refreshes only name/category/status/\n"
            "-- metadata ON CONFLICT, so it never clears image_url. A game AFB adds LATER lands with\n"
            "-- image_url NULL and the UI falls back to its initial-letter placeholder.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'afb'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="afb-catalog.json (psql dump) or a gameList snapshot")
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
