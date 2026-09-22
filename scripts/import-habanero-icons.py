#!/usr/bin/env python3
"""Import Habanero's game icons into public/assets/games/habanero + emit the vendor_games SQL.

Habanero publishes art through the **Partner Portal**, not an API and not a Drive/Dropbox share:
https://partnerportal.habanerosystems.com/admin/client-assets — a "CapsuleClientPack" file tree
(25,891 files) behind a login. Unlike every previous vendor, that pack CANNOT be fetched by this
script: the portal mints a **JWT that expires after 10 minutes**, so there is no credential worth
putting in a Makefile. The pack is therefore harvested once from the browser and this script runs
against the extracted directory.

    # 1. harvest (browser, logged in to the portal) — see "Harvesting" below
    # 2. convert + emit SQL
    python3 scripts/import-habanero-icons.py ~/habanero-pack \
        --sql ../backend/services/simles/migrations/000066_habanero_game_icons.up.sql

    # see what would happen first
    python3 scripts/import-habanero-icons.py ~/habanero-pack --dry-run

The pack directory is flat: `<GameCode>.png` (game_code verbatim, as vendor_games stores it)
plus a `_manifest.json` recording which pack path each file came from. `_manifest.json` is
optional — the *.png names alone are sufficient — but it is what makes a re-harvest auditable.

Harvesting (why it is a browser job, and what to select)
-------------------------------------------------------
The portal's own REST surface is clean and worth knowing, since a re-harvest means re-walking it:

  GET /api/client-assets/tree                 -> the ENTIRE tree in one response (~9 MB), and
  GET /api/client-assets/children?path=<rel>  -> one level, and
  GET /api/client-assets/download?path=<rel>  -> the file bytes.

All three want `Authorization: Bearer <localStorage.token>`; cookies alone give 401. The token
lasts 10 minutes and the SPA silently rotates it, so read it fresh per request rather than
capturing it once.

  * ⭐ **The pack is split `Logo/` vs `Logos/` — 104 games vs 99** — with byte-identical layouts
    underneath. Matching only the singular silently loses ~half the catalog, which reads like a
    partial pack rather than a naming bug. Both spellings are accepted here.
  * ⭐ **Slots ship a real PORTRAIT tile: `Rectangle (portrait)/<GameCode>.png`, 344x550**, full
    bleed with the logotype baked in, and it exists for all 203 slot folders. `.game-card` is
    `aspect-ratio: 3/4` + `object-fit: cover`, so this is the best shape any vendor has shipped —
    it needs essentially no crop. Preferred over everything else.
  * **`SquareSolid` (700x700) is the fallback**, and the only option for table games / video
    poker, which have no portrait cut. Squares crop cleanly to 3:4; this is the pgsoft/pp shape.
  * ⛔ **`Circle`, `CircleFlat`, `Oval`, `OvalFlat` are rounded stickers on TRANSPARENCY**, not
    tiles — cover-cropping one shows the card's gradient down both sides. `Rectangle` (landscape,
    550x344) is worse: cover-cropping a landscape into 3:4 eats the logotype. Never selected.
    Same trap as CQ9's `角標` badges and AWC's `*_circular_*`.
  * **Take the bare `<GameCode>.png`.** Siblings are localisation and branding variants:
    `_zh-CN` / `-CN` / `-cn` (Chinese logotype) and `-hb` / `-HB` (Habanero-branded). The bare
    name is the English, unbranded cut and covers 202/203 slot folders. There is no Indonesian
    art in the pack at all — worth asking Habanero for, as with CQ9 and Naga.
  * ⭐ **Video poker is keyed with a hyphen the catalog does not have**:
    `AllAmericanPoker/Square/AllAmericanPoker-100hand.png` vs our `AllAmericanPoker100Hand`.
    Matching on a normalised stem (lowercase, strip non-alphanumerics) is what recovers those 5.
  * ⭐ **The catalog misspells "Deuces" as "Dueces"** (`DuecesWild5Hand`, `BonusDuecesWild1Hand`)
    while the pack spells it correctly. 10 rows; both spellings must be tried.
  * ⭐ **Two slots have no portrait file under their own name**: `SGShaolinFortunes243` lives in
    a folder named `SGShaolinFortunes` whose portrait is `SGShaolinFortunes.png` (the 100- and
    243-payline variants share art), and `SGTootyFruityFruits`'s portrait is misnamed
    `SGTootyFruityFruitsLogos.png`. Falling back to "any English portrait inside this game's own
    folder" recovers both — the DS lesson, inverted: there the folder id had to be trusted over
    the file name, here the folder is the only trustworthy handle.

Result: **264/264 games** — 201 slots at 344x550 portrait, 63 table/video-poker at 700x700.

  * **Sources downscale to a 512 short side** (sips), matching sg/pt/pp/ds/naga. The portrait
    tiles are 344 on the short side, so they are left alone — nothing is ever upscaled.
  * **Asset name is the game_code LOWERCASED** (`sg12zodiacs.webp`). Habanero's codes are the
    only mixed-case ones in the fleet, and the assets are served off a case-sensitive filesystem
    in the container; lowercasing removes a whole class of 404. Verified collision-free.
  * **The SQL keys on `game_code` verbatim** (mixed case), not the `habanero-<code lowercased>`
    row id.
  * **Safe against a resync**: the habanero catalog upsert refreshes only name/category/status/
    metadata ON CONFLICT, so it never clears image_url. A game added later lands NULL and the UI
    falls back to its initial-letter placeholder.

Requires cwebp (brew install webp); sips does the downscale.
"""
import argparse, concurrent.futures, json, os, re, subprocess, sys, tempfile

SIZE, QUALITY = 512, 82           # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "habanero")
URL_PREFIX = "/assets/games/habanero"
WORKERS = 8
VENDOR = "habanero"


def load_pack(pack_dir):
    """-> [{game_code, path, src}] for every <GameCode>.png in the harvested pack."""
    if not os.path.isdir(pack_dir):
        sys.exit(f"{pack_dir}: not a directory — point this at the harvested portal pack")
    srcs = {}
    manifest = os.path.join(pack_dir, "_manifest.json")
    if os.path.exists(manifest):
        for row in json.load(open(manifest)):
            srcs[row["code"]] = row.get("src", "")
    else:
        print("  (no _manifest.json — provenance will not be recorded)", file=sys.stderr)

    out = []
    for name in sorted(os.listdir(pack_dir)):
        if not name.lower().endswith(".png"):
            continue
        code = name[:-4]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", code):
            sys.exit(f"game_code is not a usable path segment: {code!r}")
        out.append({"game_code": code, "path": os.path.join(pack_dir, name),
                    "src": srcs.get(code, "")})
    if not out:
        sys.exit(f"{pack_dir}: no *.png — expected a flat <GameCode>.png pack")

    lowered = {}
    for g in out:                       # the lowercased asset name must stay 1:1 with the code
        lowered.setdefault(g["game_code"].lower(), []).append(g["game_code"])
    clashes = {k: v for k, v in lowered.items() if len(v) > 1}
    if clashes:
        sys.exit(f"game codes collide when lowercased: {clashes}")
    return out


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
    """Convert one pack PNG -> (game, webp bytes) or (game, None)."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.png")            # copied: sips -Z rewrites in place
            dst = os.path.join(tmp, "out.webp")
            with open(game["path"], "rb") as fh:
                blob = fh.read()
            if not blob:
                print(f"  ! {game['game_code']}: empty file", file=sys.stderr)
                return game, None
            with open(src, "wb") as fh:
                fh.write(blob)
            convert(src, dst)
            with open(dst, "rb") as fh:
                return game, fh.read()
    except subprocess.CalledProcessError as e:
        print(f"  ! {game['game_code']}: {e.stderr.decode(errors='replace').strip()}",
              file=sys.stderr)
        return game, None
    except Exception as e:
        print(f"  ! {game['game_code']}: {e}", file=sys.stderr)
        return game, None


def render_sql(rows):
    return ("-- Habanero game icons.\n"
            "--\n"
            "-- Mirrored from the Habanero Partner Portal's CapsuleClientPack\n"
            "-- (partnerportal.habanerosystems.com/admin/client-assets) by\n"
            "-- client-facing/scripts/import-habanero-icons.py. Slots use the pack's PORTRAIT cut\n"
            "-- (Rectangle (portrait), 344x550, full-bleed with the logotype baked in); table\n"
            "-- games and video poker have no portrait cut and use SquareSolid/Square 700x700.\n"
            "-- Both crop cleanly under .game-card's aspect-ratio 3/4 + object-fit: cover.\n"
            "--\n"
            "-- image_url is ROOT-RELATIVE: the bytes are served by the client-facing Next.js app,\n"
            "-- so the path stays correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on game_code VERBATIM (Habanero's mixed-case code, e.g. SG12Zodiacs), not the\n"
            "-- `habanero-<code lowercased>` row id. The asset FILE name is lowercased, because\n"
            "-- Habanero ships the fleet's only mixed-case codes and the assets are served off a\n"
            "-- case-sensitive filesystem in the container.\n"
            "--\n"
            "-- Safe against a resync: the habanero catalog upsert refreshes only name/category/\n"
            "-- status/metadata ON CONFLICT, so it never clears image_url. A game Habanero adds\n"
            "-- LATER lands with image_url NULL and the UI falls back to its letter placeholder.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n"
              f" WHERE g.vendor_id = '{VENDOR}'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", help="harvested portal pack dir (flat <GameCode>.png + _manifest.json)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="convert, write nothing")
    args = ap.parse_args()

    pack = load_pack(args.pack)
    print(f"pack {len(pack)} games")

    rows, missing, total = [], [], 0
    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for game, blob in pool.map(grab, pack):
            if blob is None:
                missing.append(game)
                continue
            asset = game["game_code"].lower()
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, asset + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append(f"  ('{game['game_code']}', '{URL_PREFIX}/{asset}.webp')")

    for g in missing:
        print(f"  NO ICON: {g['game_code']}")
    verb = "would write" if args.dry_run else "wrote"
    print(f"{verb} {len(rows)} icons -> {OUT_DIR}  ({total/1024/1024:.1f} MB), "
          f"{len(missing)} missing")

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(sorted(rows)))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
