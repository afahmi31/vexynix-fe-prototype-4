#!/usr/bin/env python3
"""Import Dragoon Soft's game icons into public/assets/games/ds + emit the catalog SQL.

DS's art pack is a **public Google Drive folder** (titled "Zebra Game" — DS's studio brand),
one folder per game named `<gameID>_<English title>_<Chinese title>`, each holding
BACKGROUND / CHARACTERS / GAME LOGO / SCREENSHOT. The lobby tile we want is

    <gameID>_<title>/GAME LOGO/<lang>/<gameID>_<lang>_web_512.png

a 512x512 RGBA PNG of the game's key art with the English (or Chinese) logotype baked in —
the same square shape the pgsoft / sg / pt / pp packs use. `en` is preferred over `hk`.

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-ds-icons.py \
        ../backend/services/simles/migrations/000026_ds_catalog.up.sql \
        --sql ../backend/services/simles/migrations/000047_ds_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-ds-icons.py ../backend/services/simles/migrations/000026_ds_catalog.up.sql \
        --manifest /tmp/ds-manifest.json --dry-run

The catalog argument accepts either a psql row dump

    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('game_code',game_code,
        'name',name)) from vendor_games where vendor_id='ds'" > ds-catalog.json

or — with no DB to hand — migration `000026_ds_catalog.up.sql` itself, the committed snapshot of
the same 122 rows. Pass `--all` to take every game the Drive pack has instead.

What this encodes:

  * **The Drive API is unusable here.** `files.list` is blocked for the web client's API key
    (`API_KEY_SERVICE_BLOCKED`) and we have no OAuth to DS's account. The folder tree is walked
    through `drive.google.com/embeddedfolderview?id=…`, the anonymous HTML listing, and files
    come down via `uc?export=download&id=…`. Both are unauthenticated, so nothing here needs a
    credential — but both are also HTML surfaces Google can restyle, hence the parse guards.
  * **Skip the `0000_psd` folder — it is all zips.** `0000_psd/{01.Fishing,03.Slot,04.Arcade}`
    holds the layered masters batched as `3001~3010.zip` etc. The per-game `GAME LOGO` PNGs are
    the flattened deliverable and are what we mirror; nothing here unpacks an archive.
  * ⭐ **The pack misfiles one icon**: `1005_Fish Feeder_开心养鱼/GAME LOGO/en/` contains
    `3073_en_web_512.png` (Mahjong Win's tile) and no 1005 tile of its own. Every candidate is
    therefore required to carry its OWN folder's game id as the file-name prefix — matching on
    "the 512 in this folder" would have given Fish Feeder a mahjong tile. 3073's own folder has
    its correct file, so the stray is a duplicate, not a rescue.
  * ⭐ **The pack mislabels sizes as well**: `3059_en_web_512.png` (Rich Ox) is a 200x200
    image. So the fallback order en_512 -> en_472 -> hk_512 -> hk_472 is only a PREFERENCE —
    each candidate is downloaded and measured with sips, and accepted only at >= MIN_SHORT.
    Four games end up on a fallback: 1005, 3071 Halloween Win and 3074 Golf2 have no `en` 512
    at all, and 3059's is the mislabelled one; all four land on the 472px English tile. 472px
    English beats 512px Chinese here because the logotype is baked into the art and our lobby
    lists the English titles. Nothing is upscaled — `.game-card-image img` is
    `object-fit: cover`, so 472 -> 512 would only soften it.
  * **The pack is 125 games; the catalog is 122.** 3022 Alice, 3028 Fruits Bar and 3097 Zeus
    Party have art but are not in DS's `get_game_info_state_list` for our UAT channel, so they
    are skipped (reported, not silently dropped). Every one of the 122 catalog rows resolves.
  * **The SQL keys on `game_code`**, like AFB's: DS's catalog ships in migrations 000022/000026
    with literal `ds-<id>` ids, and game_code is the vendor's own stable key.
  * **Safe against a resync**: `ds.CatalogUpsertSQL` refreshes only game_code/name/category/
    status/metadata ON CONFLICT, so it never clears image_url. A game DS adds LATER lands with
    image_url NULL and the UI falls back to its initial-letter placeholder.

Requires cwebp (brew install webp); sips is used only for the (currently unreachable) downscale.
"""
import argparse, concurrent.futures, html, json, os, re, subprocess, sys, tempfile, time
import urllib.error, urllib.request

# The public share DS handed over. Kept as the default so a re-run needs no arguments; pass
# --folder if they ever reissue the link.
DEFAULT_FOLDER = "1wf7_ES5GgzDhnMeJ7O1IiFoJTDkyfJdw"

SIZE, QUALITY = 512, 82           # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "ds")
URL_PREFIX = "/assets/games/ds"
TIMEOUT = 60
WORKERS = 8                       # Drive throttles the anonymous listing; 8 is comfortable
UA = "game-web-icon-import/1.0"

# Preference order for the lobby tile, most wanted first. `%s` is the game id.
VARIANTS = ("%s_en_web_512.png", "%s_en_web_472.png",
            "%s_hk_web_512.png", "%s_hk_web_472.png")

# A tile is only accepted once sips confirms it is at least this wide — the pack contains a
# 512-NAMED file that is really 200x200 (3059), so the file name is a preference, not a fact.
MIN_SHORT = 400

# Finder/Explorer litter Drive lists alongside the real language folders. Descending into one
# just yields an empty listing, so skip it by name rather than treating it as a folder.
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$", re.I)


# ---------------------------------------------------------------- Drive (anonymous surfaces)

def _get(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"user-agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read(), r.headers.get("content-type", "")
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def listdir(folder_id, strict=False):
    """One folder -> [{id, name}] via the anonymous embedded folder view.

    strict=True only where an empty answer must mean "Google changed the HTML" — anywhere else
    a folder really can come back empty (Drive lists a stray `.DS_Store` as an entry with no
    children of its own).
    """
    body, _ = _get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id)
    page = body.decode("utf-8", "replace")
    out = []
    for chunk in page.split('<div class="flip-entry"')[1:]:
        fid = re.search(r'id="entry-([^"]+)"', chunk)
        name = re.search(r'flip-entry-title">([^<]*)<', chunk)
        if fid and name:
            out.append({"id": fid.group(1), "name": html.unescape(name.group(1))})
    if strict and not out:
        raise RuntimeError("no entries parsed for %s — Drive's listing HTML may have changed"
                           % folder_id)
    return out


def download(file_id):
    blob, ctype = _get("https://drive.google.com/uc?export=download&id=%s" % file_id)
    if "html" in ctype.lower():
        # The big-file virus-scan interstitial, or a permission page. Never a PNG.
        raise RuntimeError("got HTML, not an image (interstitial or access denied)")
    return blob


def crawl(folder_id):
    """Walk the pack -> {game_code: {file_id, file_name, lang, folder}} for every game."""
    top = listdir(folder_id, strict=True)
    games = [e for e in top
             if re.match(r"^\d{4}_", e["name"]) and not e["name"].startswith("0000_")]
    print("pack has %d game folders (of %d entries)" % (len(games), len(top)))

    def one(entry):
        try:
            return _resolve(entry)
        except Exception as e:                       # one bad folder must not kill the crawl
            return entry["name"].split("_")[0], {"error": str(e), "folder": entry["name"]}

    def _resolve(entry):
        code = entry["name"].split("_")[0]
        logos = [e for e in listdir(entry["id"], strict=True) if "LOGO" in e["name"].upper()]
        if not logos:
            return code, {"error": "no GAME LOGO folder", "folder": entry["name"]}
        # GAME LOGO holds per-language subfolders (en/hk), occasionally loose files.
        by_name = {}
        for sub in listdir(logos[0]["id"], strict=True):
            if re.search(r"\.(png|jpe?g|webp)$", sub["name"], re.I):
                by_name.setdefault(sub["name"], sub)
                continue
            if IGNORE.match(sub["name"]):            # .DS_Store / Thumbs.db, not a language dir
                continue
            for f in listdir(sub["id"]):
                by_name.setdefault(f["name"], f)
        # ⭐ the prefix MUST be this folder's own id — see the 1005/3073 misfile above.
        # Every variant is kept, in preference order: the name alone does not settle it,
        # because the pack mislabels sizes too (3059_en_web_512.png is a 200x200 image).
        variants = [{"file_id": by_name[v % code]["id"], "file_name": v % code}
                    for v in VARIANTS if (v % code) in by_name]
        if not variants:
            return code, {"error": "no %s tile" % "/".join(v % code for v in VARIANTS),
                          "folder": entry["name"]}
        return code, {"variants": variants, "folder": entry["name"]}

    found = {}
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for code, rec in pool.map(one, games):
            found[code] = rec
    return found


# ---------------------------------------------------------------- catalog

def load_catalog(path, drive_codes):
    """game codes we are allowed to write: a psql dump, migration 000026, or the pack itself."""
    if path is None:
        return {c: c for c in sorted(drive_codes)}
    text = open(path, encoding="utf-8").read()
    if path.endswith(".sql"):
        rows = re.findall(r"\('ds-\d+',\s*'ds',\s*'(\d+)',\s*'((?:[^']|'')*)'", text)
        if not rows:
            sys.exit("no ('ds-NNNN', 'ds', 'NNNN', 'Name') rows found in %s" % path)
        return {code: name.replace("''", "'") for code, name in rows}
    blob = json.loads(text)
    rows = blob["games"] if isinstance(blob, dict) and "games" in blob else blob
    out = {}
    for r in rows:
        code = str(r.get("game_code") or r.get("code") or "")
        if not code:
            sys.exit("row without a game code: %r" % (r,))
        out[code] = r.get("name", code)
    return out


# ---------------------------------------------------------------- convert

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
    # -alpha_q keeps the transparent cut-out crisp: DS ships these on alpha, not on a plate.
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   check=True, capture_output=True)


def grab(job):
    """Take the best variant that MEASURES big enough -> (job, webp bytes) or (job, None).

    The preference order is walked in order, but a candidate is only accepted once sips has
    confirmed its real short side: `3059_en_web_512.png` is a 200x200 image, and trusting the
    name would have shipped Rich Ox a tile a quarter the size of every other game's. If nothing
    clears MIN_SHORT, the largest thing that downloaded is used rather than nothing at all.
    """
    code = job["game_code"]
    best = None                                   # (short_side, file_name, webp bytes)
    for variant in job["variants"]:
        try:
            blob = download(variant["file_id"])
        except Exception as e:
            print("  ! %s %s: %s" % (code, variant["file_name"], e), file=sys.stderr)
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.png")
            dst = os.path.join(tmp, "out.webp")
            with open(src, "wb") as fh:
                fh.write(blob)
            side = short_side(src)
            try:
                convert(src, dst)
            except subprocess.CalledProcessError as e:
                print("  ! %s %s: convert failed: %s"
                      % (code, variant["file_name"], e.stderr.decode(errors="replace").strip()),
                      file=sys.stderr)
                continue
            got = (min(side, SIZE), variant["file_name"], open(dst, "rb").read())
        if got[0] >= MIN_SHORT:
            job["chosen"] = variant["file_name"]
            job["short_side"] = got[0]
            return job, got[2]
        if best is None or got[0] > best[0]:
            best = got
    if best is None:
        return job, None
    job["chosen"], job["short_side"] = best[1], best[0]
    return job, best[2]


# ---------------------------------------------------------------- SQL

def render_sql(rows, fallbacks):
    note = ""
    if fallbacks:
        note = ("-- These games fall back to the next tile down the preference order — either\n"
                "-- the pack has no `en` 512 for them at all, or the file NAMED 512 is really\n"
                "-- 200x200 (3059 Rich Ox), caught by measuring rather than trusting the name.\n"
                "-- 472px English beats 512px Chinese: the logotype is baked into the art:\n"
                + "".join("--   %s\n" % f for f in sorted(fallbacks))
                + "--\n")
    return ("-- Dragoon Soft game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: DS's public Google Drive art pack (folder \"Zebra Game\"), one folder per\n"
            "-- game holding BACKGROUND / CHARACTERS / GAME LOGO / SCREENSHOT. The lobby tile is\n"
            "-- `<gameID>_<title>/GAME LOGO/en/<gameID>_en_web_512.png` — 512x512 RGBA key art with\n"
            "-- the English logotype baked in, the same square shape as the pgsoft/sg/pt/pp packs.\n"
            "-- Mirrored into client-facing/public/assets/games/ds/<game_code>.webp and committed.\n"
            "-- Generated by client-facing/scripts/import-ds-icons.py.\n"
            "--\n"
            "-- The pack's `0000_psd/` folder is IGNORED: it is the layered masters batched into\n"
            "-- `3001~3010.zip`-style archives. The per-game GAME LOGO PNGs are the flattened\n"
            "-- deliverable, so no archive is unpacked anywhere in this pipeline.\n"
            "--\n"
            + note +
            "-- The pack ships 125 games against the 122 in migration 000026's UAT snapshot; 3022,\n"
            "-- 3028 and 3097 have art but are not in our channel's game list, so they are skipped.\n"
            "-- Every one of the 122 catalog rows below has real art.\n"
            "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) /\n"
            "-- pt (000042) / pp (000044) / afb (000045) / evolution (000046): the icons are served\n"
            "-- by the client-facing Next.js app, so it stays correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on game_code, not id: DS's catalog ships in 000022/000026 with literal\n"
            "-- `ds-<id>` ids, and game_code is the vendor's own stable key.\n"
            "--\n"
            "-- Safe against a resync: ds.CatalogUpsertSQL refreshes only game_code/name/category/\n"
            "-- status/metadata ON CONFLICT, so it never clears image_url. A game DS adds LATER\n"
            "-- lands with image_url NULL and the UI falls back to its initial-letter placeholder.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'ds'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", nargs="?",
                    help="ds-catalog.json (psql dump) or 000026_ds_catalog.up.sql; "
                         "omit with --all to take every game in the pack")
    ap.add_argument("--all", action="store_true", help="ignore the catalog, import every game")
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="Drive folder id of the art pack")
    ap.add_argument("--manifest", help="cache the crawl here (reused on the next run)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="resolve + download, write no assets")
    args = ap.parse_args()
    if not args.catalog and not args.all:
        ap.error("give a catalog file, or --all to take the whole pack")

    if args.manifest and os.path.exists(args.manifest):
        found = json.load(open(args.manifest))
        print("manifest %s: %d games (delete it to re-crawl)" % (args.manifest, len(found)))
    else:
        found = crawl(args.folder)
        if args.manifest:
            json.dump(found, open(args.manifest, "w"), ensure_ascii=False, indent=1)

    broken = {c: r for c, r in found.items() if "error" in r}
    for code, rec in sorted(broken.items()):
        print("  NO TILE: %s %s — %s" % (code, rec["folder"], rec["error"]))

    catalog = load_catalog(None if args.all else args.catalog, set(found) - set(broken))
    bad = [c for c in catalog if not re.fullmatch(r"[A-Za-z0-9_-]+", c)]
    if bad:
        sys.exit("game_code is not a usable path segment for: %s" % bad)

    extra = sorted(set(found) - set(broken) - set(catalog))
    if extra:
        print("pack has art for %d games outside the catalog (skipped): %s"
              % (len(extra), ", ".join(extra)))
    absent = sorted(c for c in catalog if c not in found or c in broken)
    if absent:
        print("catalog games with NO art in the pack: %s" % ", ".join(absent))

    jobs = [dict(found[c], game_code=c, name=catalog[c])
            for c in sorted(catalog) if c in found and c not in broken]
    print("importing %d/%d catalog games" % (len(jobs), len(catalog)))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    rows, missing, fallbacks, total = [], [], [], 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for job, blob in pool.map(grab, jobs):
            if blob is None:
                missing.append(job)
                continue
            code = job["game_code"]
            if job["chosen"] != "%s_en_web_512.png" % code:
                fallbacks.append("%s (%s, %dpx)" % (code, job["chosen"], job["short_side"]))
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, code + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append("  ('%s', '%s/%s.webp')" % (code, URL_PREFIX, code))

    for job in missing:
        print("  FAILED: %s %r" % (job["game_code"], job["name"]))
    if fallbacks:
        print("fallback tiles used: %s" % ", ".join(sorted(fallbacks)))
    verb = "would write" if args.dry_run else "wrote"
    print("%s %d icons -> %s  (%.1f MB), %d failed"
          % (verb, len(rows), OUT_DIR, total / 1024 / 1024, len(missing)))

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(sorted(rows), fallbacks))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
