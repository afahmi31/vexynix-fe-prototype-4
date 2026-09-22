#!/usr/bin/env python3
"""Import AWC's NLC game icons into public/assets/games/awc + emit the image_url SQL.

AWC's art pack is a **public Google Drive folder** — one folder per NLC title (plus a handful of
`00_`/`01_` brand folders), each holding `Game Art` / `Game Sheet` / `Thumbnail`, and the
Thumbnail folder split by language (`EN` / `ID` / `SC` / `JP` / `KR`). The lobby tile we want is
the vendor's own **portrait** thumbnail:

    <Game Title>/Thumbnail/<lang>/<game>_thumbnail_318x420_<lang>.png

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-awc-icons.py \
        ../game-docs/13t-game-provider-awc/vendor/awc-nlc-gamelist-2026-08-26.csv \
        --manifest /tmp/awc-manifest.json \
        --sql ../backend/services/simles/migrations/000056_awc_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-awc-icons.py <catalog> --manifest /tmp/awc-manifest.json --dry-run

The catalog argument takes AWC's game-list CSV (the committed snapshot in
game-docs/13t-game-provider-awc/vendor/), migration `000055_awc_catalog.up.sql`, or a psql dump
of `vendor_games` — anything that carries `game_code` + the English `name`, because the pack is
keyed by TITLE and only the catalog knows which `NLC-SLOT-nnn` that is.

What this encodes:

  * **The Drive API is unusable here** (same as the DS and CQ9 packs): `files.list` answers
    `API_KEY_SERVICE_BLOCKED` for the web client's key and we have no OAuth to AWC's account.
    The tree is walked through the anonymous `drive.google.com/embeddedfolderview?id=…` HTML
    listing, files come down via `uc?export=download&id=…`. No credential — but both are HTML
    surfaces Google can restyle, hence the parse guards.
  * ⭐ **`01_Thumbnail Pack/` — the pre-batched folder that looks like the obvious source — is a
    TRAP.** Its `EN/{288x375,300x400,318x420,360x240}` subfolders all list as EMPTY through the
    embedded view (only `550x550` answers, and only for ~83 games). The PER-GAME folders are the
    real source and cover 138 titles, so this crawls those and ignores `01_`/`00_` entirely.
  * ⭐ **PORTRAIT, not square.** `.game-card` is `aspect-ratio: 3/4` + `object-fit: cover`
    (client-facing/src/styles/portal/_game-card.scss), and NLC ships a tile drawn for exactly
    that shape — 318x420 / 300x400 / 288x375, full-bleed art with the logotype baked in. The
    550x550 "square" everyone reaches for first is a **rounded-corner sticker on transparency**,
    so cover-cropping it into a 3/4 card shows the card background down both sides. Square is
    kept only as a last-resort fallback (and pgsoft/sg/pp/ds stay square — those packs ship
    nothing else).
  * ⭐ **`*_circular_*` files are NOT icons** — a round badge crop that sits in the same folder at
    the same size, CQ9's `角標` trap in another costume. Excluded by name.
  * ⭐ **44 games have REAL Indonesian art** (`Thumbnail/ID/…_318x420_id.png`, e.g. AFK Airport
    Security's logotype reads "AFK Petugas Bandara") — the first vendor pack in the fleet that
    does. Language preference is therefore `id` -> `en` per game, CQ9-style, rather than one
    language for the whole vendor.
  * **The pack is keyed by TITLE, and the titles drift from the sheet's**: `Bushido Way xNudge`
    vs folder `Bushido Ways xNudge®`, `Mental 2` vs `Mental II`, `Duck Hunters` vs `Duck Hunter`,
    `Tombstone Slaughter` vs `Tombstone Slaughter：El Gordo's Revenge` (a FULL-WIDTH colon).
    Matching is: exact normalised title, then normalised with the `xNudge`/`xBomb`/`xSplit`/
    `xWays` mechanic suffixes stripped, then the explicit ALIASES below. Anything still
    unmatched is REPORTED, never guessed at.
  * **The pack predates the sheet**: `NLC-SLOT-118 Dead Men Walking` has no folder at all, so it
    stays NULL and the UI falls back to its initial-letter placeholder. The pack also carries 11
    games our agent's catalog does not sell (Kitchen Drama, Oktoberfest, Tanked 3, …) — skipped
    and reported.
  * **Idempotent and resync-safe**: the SQL keys on `game_code` and only touches rows whose
    image_url differs. Re-running the whole script overwrites the same assets byte-for-byte.

Requires cwebp (brew install webp); sips (macOS) measures and downscales.
"""
import argparse, concurrent.futures, csv, html, json, os, re, subprocess, sys, tempfile, time
import unicodedata, urllib.request

# The public share AWC handed over (2026-08-26). Pass --folder if they ever reissue the link.
DEFAULT_FOLDER = "1fj8-GsAQgfbTzACItrgW6T2yWGKwndJe"

SIZE, QUALITY = 512, 82        # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "awc")
URL_PREFIX = "/assets/games/awc"
TIMEOUT = 90
WORKERS = 8                    # Drive throttles the anonymous listing; 8 is comfortable
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Language preference. Indonesian art exists for 44 of the 131 and is genuinely localised.
LANGS = ("ID", "EN")

# Tile preference within a language, best first. Portrait sizes are the lobby tile (3/4 card);
# the squares are a last resort — they are rounded-corner stickers on transparency.
PORTRAIT = ("318x420", "300x400", "288x375", "228x375")
SQUARE = ("1080x1080", "550x550", "500x500", "200x200")

# A downloaded tile is accepted once sips confirms this much short side. Everything in PORTRAIT
# clears it; the check exists because a pack that mislabels sizes is the norm, not the exception
# (DS shipped a 200x200 named `_512`).
MIN_SHORT = 200

# Round badge crops, not tiles — the same trap as CQ9's `角標` files.
EXCLUDE = re.compile(r"circular|round|badge", re.I)

# Finder/Explorer litter Drive lists alongside the real folders.
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$", re.I)

# Brand/aggregate folders at the pack root: banners, logos, and the `01_Thumbnail Pack` trap.
NOT_A_GAME = re.compile(r"^\d\d_")

# Sheet title -> pack folder title, for the five the normalisers cannot bridge. Each was checked
# by hand against the folder's own art. `：` in the last one is U+FF1A, a full-width colon.
ALIASES = {
    "Bushido Way xNudge": "Bushido Ways xNudge®",     # singular/plural, not just the ® and mechanic
    "Duck Hunters": "Duck Hunter",
    "Duck Hunters Happy Hour": "Duck Hunter Happy Hour",
    "Mental 2": "Mental II",
    "Tombstone Slaughter": "Tombstone Slaughter：El Gordo's Revenge",
}

# NLC bakes its mechanic brands into some titles and not others, inconsistently between the sheet
# and the pack ("Fire In The Hole xBomb" vs folder "Fire In The Hole"). Stripped on the 2nd pass.
MECHANICS = re.compile(r"\b(xnudge|xbomb|xsplit|xways|xterminate|xreel)\b", re.I)


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
    """One folder -> [{id, name, dir}] via the anonymous embedded folder view.

    strict=True only where an empty answer must mean "Google changed the HTML". Elsewhere a
    folder really can list empty — `01_Thumbnail Pack/EN/318x420` does, which is exactly why
    this importer walks the per-game folders instead.
    """
    body, _ = _get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id)
    page = body.decode("utf-8", "replace")
    out = []
    for chunk in page.split('<div class="flip-entry" id="entry-')[1:]:
        fid = chunk.split('"', 1)[0]
        name = re.search(r'flip-entry-title">(.*?)</div>', chunk, re.S)
        if not fid or not name:
            continue
        head = chunk.split("flip-entry-title")[0]
        out.append({"id": fid, "name": html.unescape(name.group(1)),
                    "dir": 'aria-label="Folder"' in head})
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
    """Walk the pack -> {folder title: {"files": {LANG: [{id, name}]}}} for every game."""
    top = listdir(folder_id, strict=True)
    games = [e for e in top if e["dir"] and not NOT_A_GAME.match(e["name"])
             and not IGNORE.match(e["name"])]
    print("pack has %d game folders (of %d entries)" % (len(games), len(top)))

    def one(entry):
        try:
            return entry["name"], {"files": _thumbs(entry)}
        except Exception as e:                        # one bad folder must not kill the crawl
            return entry["name"], {"error": str(e)}

    def _thumbs(entry):
        # "Thumbnail", "Thumbnails" and — for one game — "Thumbnali". Match on the stem.
        thumbs = [e for e in listdir(entry["id"], strict=True)
                  if e["dir"] and re.search(r"thumbnai?l", e["name"], re.I)]
        if not thumbs:
            raise RuntimeError("no Thumbnail folder")
        byline = {}
        for t in thumbs:
            for sub in listdir(t["id"]):
                if IGNORE.match(sub["name"]):
                    continue
                if not sub["dir"]:
                    # A loose tile straight in Thumbnail/ — language read off the file name.
                    lang = _lang_of(sub["name"]) or "EN"
                    byline.setdefault(lang, []).append({"id": sub["id"], "name": sub["name"]})
                    continue
                lang = sub["name"].strip().upper()
                if lang not in LANGS:                 # SC/JP/KR/PSD/Website Banner/EVO — not ours
                    continue
                for f in listdir(sub["id"]):
                    if f["dir"] or IGNORE.match(f["name"]):
                        continue
                    byline.setdefault(lang, []).append({"id": f["id"], "name": f["name"]})
        if not byline:
            raise RuntimeError("no %s tiles" % "/".join(LANGS))
        return byline

    found = {}
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for name, rec in pool.map(one, games):
            found[name] = rec
    return found


def _lang_of(filename):
    m = re.search(r"_(id|en|sc|jp|kr)\.(png|jpe?g|webp)$", filename, re.I)
    return m.group(1).upper() if m else None


# ---------------------------------------------------------------- catalog + title matching

def load_catalog(path):
    """-> {game_code: English name}. Accepts AWC's CSV, 000055_awc_catalog.up.sql, or a psql dump."""
    if path.endswith(".csv"):
        out = {}
        for row in csv.DictReader(open(path, encoding="utf-8-sig")):
            code = name = ""
            for k, v in row.items():
                if not k:
                    continue
                if "game code" in k.lower():
                    code = (v or "").strip()
                elif "english name" in k.lower():
                    name = (v or "").strip()
            if code and name:
                out[code] = name
        if not out:
            sys.exit("no (game code, English name) rows found in %s" % path)
        return out
    text = open(path, encoding="utf-8").read()
    if path.endswith(".sql"):
        rows = re.findall(r"\('awc-[^']+',\s*'awc',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'", text)
        if not rows:
            sys.exit("no ('awc-…', 'awc', 'CODE', 'Name') rows found in %s" % path)
        return {c.replace("''", "'"): n.replace("''", "'") for c, n in rows}
    blob = json.loads(text)
    rows = blob["games"] if isinstance(blob, dict) and "games" in blob else blob
    return {str(r["game_code"]): r.get("name", r["game_code"]) for r in rows}


def norm(title, strip_mechanics=False):
    s = unicodedata.normalize("NFKD", title)
    s = s.replace("®", "").replace("™", "").replace("&", "and").replace("’", "'")
    if strip_mechanics:
        s = MECHANICS.sub(" ", s)
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def match_titles(catalog, pack):
    """{game_code: folder title} + the codes with no folder. Never guesses — see ALIASES."""
    by_exact = {norm(t): t for t in pack}
    by_loose = {}
    for t in pack:                                    # first writer wins: exact spellings first
        by_loose.setdefault(norm(t, True), t)
    picked, absent = {}, []
    for code, name in catalog.items():
        folder = (ALIASES.get(name)
                  or by_exact.get(norm(name))
                  or by_loose.get(norm(name, True)))
        if folder and folder in pack:
            picked[code] = folder
        else:
            absent.append((code, name))
    return picked, absent


# ---------------------------------------------------------------- convert

def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout
    w = re.search(r"pixelWidth:\s*(\d+)", out)
    h = re.search(r"pixelHeight:\s*(\d+)", out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (0, 0)


def convert(src, dest):
    """PNG -> WebP, downscaling only if the source is bigger than SIZE on its short side."""
    w, h = dims(src)
    if min(w, h) > SIZE:
        subprocess.run(["sips", "-Z", str(SIZE), src, "--out", src],
                       check=True, capture_output=True)
    # -alpha_q keeps a transparent cut-out crisp (the square fallbacks ship on alpha).
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   check=True, capture_output=True)


def candidates(files):
    """Preference order: id portrait -> en portrait -> id square -> en square."""
    def pick(lang, sizes):
        out = []
        for size in sizes:
            for f in files.get(lang, []):
                flat = f["name"].lower().replace(" ", "")
                if size in flat and not EXCLUDE.search(f["name"]):
                    out.append(dict(f, want=size, lang=lang))
        return out
    ordered = []
    for sizes in (PORTRAIT, SQUARE):
        for lang in LANGS:
            ordered += pick(lang, sizes)
    seen, out = set(), []
    for c in ordered:
        if c["id"] not in seen:
            seen.add(c["id"])
            out.append(c)
    return out


def grab(job):
    """Take the first candidate that MEASURES big enough -> (job, webp bytes) or (job, None)."""
    code = job["game_code"]
    best = None                                       # (short side, candidate, webp bytes)
    for cand in job["candidates"]:
        try:
            blob = download(cand["id"])
        except Exception as e:
            print("  ! %s %s: %s" % (code, cand["name"], e), file=sys.stderr)
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = os.path.join(tmp, "src.png"), os.path.join(tmp, "out.webp")
            with open(src, "wb") as fh:
                fh.write(blob)
            w, h = dims(src)
            if not w:
                print("  ! %s %s: not an image sips can read" % (code, cand["name"]),
                      file=sys.stderr)
                continue
            try:
                convert(src, dst)
            except subprocess.CalledProcessError as e:
                print("  ! %s %s: convert failed: %s"
                      % (code, cand["name"], e.stderr.decode(errors="replace").strip()),
                      file=sys.stderr)
                continue
            got = (min(w, h), dict(cand, w=w, h=h), open(dst, "rb").read())
        if got[0] >= MIN_SHORT:
            job["chosen"] = got[1]
            return job, got[2]
        if best is None or got[0] > best[0]:
            best = got
    if best is None:
        return job, None
    job["chosen"] = best[1]
    return job, best[2]


# ---------------------------------------------------------------- SQL

def render_sql(rows, langs, squares, absent):
    lang_note = ("-- Language: %d rows use AWC's **Indonesian** art (`Thumbnail/ID`), %d fall back to\n"
                 "-- English. NLC localises the logotype itself (NLC-SLOT-082 Tombstone No Mercy reads\n"
                 "-- \"Akhir Keputusasaan Kejam\" on the id tile), so id is preferred per GAME, not per\n"
                 "-- vendor — the id folders only exist for the newer titles (NLC-SLOT-075 upwards).\n"
                 % (langs.get("ID", 0), langs.get("EN", 0)))
    square_note = ""
    if squares:
        square_note = ("--\n-- ⚠️ These games have no portrait tile and fall back to the square sticker,\n"
                       "-- which cover-crops into the 3/4 card with its transparent margin showing:\n"
                       + "".join("--   %s\n" % s for s in sorted(squares)))
    absent_note = ""
    if absent:
        absent_note = ("--\n-- No art in the pack (image_url stays NULL -> initial-letter placeholder);\n"
                       "-- the pack predates these titles, so ask AWC for a refreshed one:\n"
                       + "".join("--   %s %s\n" % (c, n) for c, n in sorted(absent)))
    return ("-- AWC (NLC) game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: AWC's public Google Drive art pack (folder id 1fj8-GsAQgfbTzACItrgW6T2yWGKwndJe,\n"
            "-- handed over 2026-08-26), one folder per NLC title holding Game Art / Game Sheet /\n"
            "-- Thumbnail, with Thumbnail split by language. Mirrored into\n"
            "-- client-facing/public/assets/games/awc/<game_code lowercased>.webp and committed.\n"
            "-- Generated by client-facing/scripts/import-awc-icons.py.\n"
            "--\n"
            "-- ⭐ PORTRAIT, not square. `.game-card` is aspect-ratio 3/4 + object-fit cover, and NLC\n"
            "-- ships a tile drawn for exactly that shape (318x420 / 300x400 / 288x375, full-bleed art\n"
            "-- with the logotype baked in). The 550x550 \"square\" that the pack's `01_Thumbnail Pack/`\n"
            "-- folder pushes first is a rounded-corner sticker on TRANSPARENCY — cover-cropped into a\n"
            "-- 3/4 card it shows the card background down both sides. The `*_circular_*` files at the\n"
            "-- same size are round badges, not tiles (CQ9's 角標 trap in another costume).\n"
            "--\n"
            + lang_note
            + square_note
            + absent_note
            + "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042) /\n"
            "-- pp (000044) / afb (000045) / evolution (000046) / ds (000047) / cq9 (000049) /\n"
            "-- naga (000053): the icons are served by the client-facing Next.js app, so the path stays\n"
            "-- correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on game_code, not id: AWC's catalog ships in 000055 with literal `awc-<code>` ids,\n"
            "-- and game_code is the vendor's own stable key ('NLC-SLOT-001', used verbatim on launch).\n"
            "--\n"
            "-- ⛔ This does NOT publish anything: 000055 seeds every row `inactive` behind a\n"
            "-- tenant_vendors OFF row, and artwork does not change that. Publishing stays one\n"
            "-- deliberate UPDATE at go-live, after the adapter ships.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'awc'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="awc-nlc-gamelist-*.csv, 000055_awc_catalog.up.sql, "
                                    "or a psql dump of vendor_games")
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="Drive folder id of the art pack")
    ap.add_argument("--manifest", help="cache the crawl here (reused on the next run)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="resolve + download, write no assets")
    args = ap.parse_args()

    if args.manifest and os.path.exists(args.manifest):
        pack = json.load(open(args.manifest))
        print("manifest %s: %d folders (delete it to re-crawl)" % (args.manifest, len(pack)))
    else:
        pack = crawl(args.folder)
        if args.manifest:
            json.dump(pack, open(args.manifest, "w"), ensure_ascii=False, indent=1)

    broken = {t: r for t, r in pack.items() if "error" in r}
    for title, rec in sorted(broken.items()):
        print("  NO TILES: %r — %s" % (title, rec["error"]))
    usable = {t: r for t, r in pack.items() if t not in broken}

    catalog = load_catalog(args.catalog)
    bad = [c for c in catalog if not re.fullmatch(r"[A-Za-z0-9._-]+", c)]
    if bad:
        sys.exit("game_code is not a usable path segment for: %s" % bad)

    picked, absent = match_titles(catalog, usable)
    extra = sorted(set(usable) - set(picked.values()))
    if extra:
        print("pack has art for %d titles outside our catalog (skipped): %s"
              % (len(extra), ", ".join(extra)))
    for code, name in sorted(absent):
        print("  NO FOLDER: %s %r" % (code, name))

    jobs = []
    for code in sorted(picked):
        cands = candidates(usable[picked[code]]["files"])
        if not cands:
            absent.append((code, catalog[code]))
            print("  NO USABLE TILE: %s %r (folder %r)" % (code, catalog[code], picked[code]))
            continue
        jobs.append({"game_code": code, "name": catalog[code], "folder": picked[code],
                     "candidates": cands})
    print("importing %d/%d catalog games" % (len(jobs), len(catalog)))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    rows, failed, langs, squares, total = [], [], {}, [], 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for job, blob in pool.map(grab, jobs):
            if blob is None:
                failed.append(job)
                continue
            code, chosen = job["game_code"], job["chosen"]
            langs[chosen["lang"]] = langs.get(chosen["lang"], 0) + 1
            if chosen["want"] in SQUARE:
                squares.append("%s %s (%s, %dx%d)"
                               % (code, job["name"], chosen["name"], chosen["w"], chosen["h"]))
            asset = code.lower()
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, asset + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append("  ('%s', '%s/%s.webp')" % (code, URL_PREFIX, asset))

    for job in failed:
        print("  FAILED: %s %r" % (job["game_code"], job["name"]))
        absent.append((job["game_code"], job["name"]))
    print("language mix: %s" % ", ".join("%s=%d" % kv for kv in sorted(langs.items())))
    if squares:
        print("square fallbacks: %s" % "; ".join(sorted(squares)))
    verb = "would write" if args.dry_run else "wrote"
    print("%s %d icons -> %s  (%.1f MB), %d without art"
          % (verb, len(rows), OUT_DIR, total / 1024 / 1024, len(absent)))

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w", encoding="utf-8") as fh:
            fh.write(render_sql(sorted(rows), langs, squares, absent))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
