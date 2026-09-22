#!/usr/bin/env python3
"""Import RiCH88's game icons into public/assets/games/rich88 + emit the image_url SQL.

RiCH88's 3-1 gamelist carries no image field at all (the CQ9 problem), so a pack is the only
possible source. The one they handed over is a **public Google Drive folder** — one folder per
game named `<their numeric id>_<English title>`, each holding `Graphic Material` / `ICON`
(sometimes `Banner`), with the lobby tiles under `ICON/PNG`:

    <nnn>_<Title>/ICON/PNG/<key>_400x581_<LANG>.png

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-rich88-icons.py \
        ../backend/services/simles/migrations/000058_rich88_catalog.up.sql \
        --manifest /tmp/rich88-manifest.json \
        --sql ../backend/services/simles/migrations/000069_rich88_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-rich88-icons.py <catalog> --manifest /tmp/rich88-manifest.json --dry-run

The catalog argument takes 000058_rich88_catalog.up.sql or a psql dump of `vendor_games` —
anything carrying `game_code` plus the English name, because half the pack is keyed by TITLE
and only the catalog knows which `SlotCrazyRichMan` that is.

What this encodes:

  * **The Drive API is unusable here** (same as the DS, CQ9, Naga and AWC packs): `files.list`
    answers `API_KEY_SERVICE_BLOCKED` for the web client's key and we have no OAuth to RiCH88's
    account. The tree is walked through the anonymous `drive.google.com/embeddedfolderview?id=…`
    HTML listing, files come down via `uc?export=download&id=…`. No credential — but both are
    HTML surfaces Google can restyle, hence the parse guards.
  * ⭐ **The pack is TWO packs with different keying conventions.** The older folders hold
    `ICON/PNG/<Title>_<size>_<LANG>.png` keyed by the English title (`7PK`, `monkey climb
    tree`), and the languages are `CNY/ENG/THB/VND`. The newer `ICON(2025)/` folders (41 games,
    plus `ICON/2025/` for one) are keyed by our **`game_code` verbatim** — `SlotCrazyRichMan`,
    `DuelSoccer` — and the languages are `CNY/ENU/ESP/PTE/THB/VND/IDR/CHT`. So `ENG` and `ENU`
    are the same language in two vintages, and a game is resolved by game_code FIRST (exact,
    case-insensitively) and only then by title. Every one of the 109 catalog rows resolves:
    41 by code, 68 by exact normalised title — no fuzzy matching is needed or done.
  * ⭐ **`PNGX` and `最高倍率版` are the max-multiplier PROMO cut, not the tile.** Same key art
    with a "6000X" / "5500X" badge burned into the top corner — Fastspin's max-win ribbon trap
    in another costume. Both folders sit right beside the clean one at every size, so ranking
    candidates by size alone fills the lobby with multiplier badges. ⚠️ The marker is the
    `最高倍率版` SUFFIX, not the letter X: `165_Western Sheriff` files its promo cut under
    `PNG(最高倍率版)` (spelled PNG, not PNGX) and its clean cut under `PNG(一般)` — matching on
    the folder name `PNGX` alone would take the promo art for that game.
  * ⭐ **PORTRAIT, one size for the whole catalog.** `.game-card` is `aspect-ratio: 3/4` +
    `object-fit: cover` (client-facing/src/styles/portal/_game-card.scss:176) and `400x581` is
    the only size RiCH88 draws full-bleed for that shape, with the logotype baked in. It covers
    all 109 games, so this takes ONLY that size rather than falling back down a size ladder and
    mixing shapes — `500x500`/`301x300`/`200x200` are squares that cover-crop ~12% off each side
    and clip the logotype, and `500x300`/`220x162`/`150x100`/`300x200` are landscape banner
    cuts. The other sizes stay in SIZES purely as a reported last resort if RiCH88 ever ships a
    game without the portrait.
  * ⭐ **35 games have REAL Indonesian art** (`_IDR`, e.g. Duel Soccer's logotype reads "DUEL
    SEPAK BOLA", matching the catalog's own `nameId`) — only in the newer `ICON(2025)` folders.
    Language preference is therefore `IDR -> ENU -> ENG` per GAME, the AWC/CQ9/JDB rule, rather
    than one language for the whole vendor. **Worth asking RiCH88 to extend the `id` cut** to
    the older 74 titles.
  * **Two games ship ONLY the promo cut**: `SlotPoseidon` (Poseidon Unleashed) and
    `SlotDragonTilesLegend` (Dragon Tiles Legend) have no clean `PNG` folder at all, so they
    take the badged art and are REPORTED. Art with a max-win badge beats the letter placeholder;
    swap them the moment RiCH88 ships a clean cut.
  * **Idempotent and resync-safe**: the SQL keys on `game_code` and only touches rows whose
    image_url differs. `rich88.CatalogUpsertSQL` refreshes only name/category/status/metadata
    ON CONFLICT, so a `rich88-probe sync-games` never clears image_url.

Requires cwebp (brew install webp); sips (macOS) measures and downscales.
"""
import argparse, concurrent.futures, html, json, os, re, subprocess, sys, tempfile, time
import unicodedata, urllib.request

# The public share RiCH88 handed over (2026-08-31). Pass --folder if they ever reissue the link.
DEFAULT_FOLDER = "1gqmR2qTmpp2GzJ7pDCuq-1u5mXVbxzgv"

SIZE, QUALITY = 512, 82        # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "rich88")
URL_PREFIX = "/assets/games/rich88"
TIMEOUT = 90
WORKERS = 8                    # Drive throttles the anonymous listing; 8 is comfortable
MAX_DEPTH = 4                  # ICON(2025)/PNG(一般)/<file> is 2; ICON/2025/PNG/<file> is 3
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Language preference, best first. ENG (old pack) and ENU (2025 pack) are both English; IDR is
# genuinely localised and exists for 35 of the 109. Everything after English is a reported
# last resort — a Chinese/Thai/Vietnamese logotype in an Indonesian lobby is worse than nothing,
# but still better than a blank tile if RiCH88 ever ships a game with no English cut.
LANGS = ("IDR", "ENU", "ENG", "ESP", "PTE", "CHT", "CNY", "THB", "VND", "")

# The lobby tile. 400x581 is the vendor's portrait cut and covers the whole catalog; the rest
# are here only so a future gap is filled and REPORTED rather than silently dropped.
PORTRAIT = ("400x581", "300x500", "300x400")
FALLBACK = ("301x300", "500x500", "200x200")
SIZES = PORTRAIT + FALLBACK

# A downloaded tile is accepted once sips confirms this much short side. 400x581 clears it; the
# check exists because a pack that mislabels sizes is the norm, not the exception (DS shipped a
# 200x200 named `_512`).
MIN_SHORT = 200

# ⭐ The max-multiplier promo cut. Matched on the folder PATH, and on the 最高倍率版 ("highest
# multiplier version") suffix rather than the letter X — 165_Western Sheriff spells its promo
# folder `PNG(最高倍率版)` and its clean one `PNG(一般)` ("general version").
PROMO = re.compile(r"pngx|最高倍率|最高倍率版", re.I)

# Source trees that are not lobby tiles: layered masters, marketing banners, key-art kits.
SKIP_DIR = re.compile(r"graphic material|banner|素材|\bpsd\b|^dm$", re.I)

# Finder/Explorer litter, and Drive's own `foo (1).png` copies that sit beside the real file.
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$|\(\d+\)\.\w+$", re.I)

# `<key>_<W>x<H>[_<LANG>][junk].png`, with RiCH88's optional numeric folder-id prefix on the
# file name too (`239_Dragon Tiles Legend_400x581_ENU.png`). The trailing junk absorbs the
# stray `_s` / `-` suffixes the pack sprinkles around (`..._146x136_CNY_s.png`, `..._PTE-.png`).
FNAME = re.compile(r"^(?:\d+[._])?(?P<stem>.+?)_(?P<w>\d+)x(?P<h>\d+)"
                   r"(?:_(?P<lang>[A-Za-z]+))?[-_A-Za-z0-9]*\.(?:png|jpe?g)$", re.I)


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

    strict=True only at the pack root, where an empty answer must mean "Google changed the
    HTML". Deeper down a folder really can list empty.
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
        out.append({"id": fid, "name": html.unescape(name.group(1)).strip(),
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
    """Walk the pack -> {folder name: {"files": [{id, name, path, stem, size, lang, promo}]}}."""
    top = listdir(folder_id, strict=True)
    games = [e for e in top if e["dir"] and not IGNORE.match(e["name"])]
    print("pack has %d game folders (of %d entries)" % (len(games), len(top)))

    def walk(fid, path, depth, acc):
        if depth > MAX_DEPTH:
            return
        for e in listdir(fid):
            if IGNORE.match(e["name"]):
                continue
            if e["dir"]:
                if SKIP_DIR.search(e["name"]):
                    continue
                walk(e["id"], path + "/" + e["name"], depth + 1, acc)
                continue
            m = FNAME.match(e["name"])
            if not m:                       # brand kits, DM jpgs, `R88-200x200-1.png` — not tiles
                continue
            acc.append({"id": e["id"], "name": e["name"], "path": path,
                        "stem": m.group("stem"), "lang": (m.group("lang") or "").upper(),
                        "size": "%sx%s" % (m.group("w"), m.group("h")),
                        "promo": bool(PROMO.search(path))})

    def one(entry):
        acc = []
        try:
            walk(entry["id"], "", 0, acc)
        except Exception as e:              # one bad folder must not kill the crawl
            return entry["name"], {"error": str(e)}
        return entry["name"], {"files": acc}

    found = {}
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for name, rec in pool.map(one, games):
            found[name] = rec
    return found


# ---------------------------------------------------------------- catalog + matching

def load_catalog(path):
    """-> {game_code: English name}. Accepts 000058_rich88_catalog.up.sql or a psql dump."""
    text = open(path, encoding="utf-8").read()
    if path.endswith(".sql"):
        rows = re.findall(r"\('rich88-[^']*',\s*'rich88',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'",
                          text)
        if not rows:
            sys.exit("no ('rich88-…', 'rich88', 'CODE', 'Name') rows found in %s" % path)
        return {c.replace("''", "'"): n.replace("''", "'") for c, n in rows}
    if text.lstrip().startswith(("[", "{")):
        blob = json.loads(text)
        rows = blob["games"] if isinstance(blob, dict) and "games" in blob else blob
        return {str(r["game_code"]): _english(r) for r in rows}
    # psql -At -F'|' dump: id|game_code|name|category|status|image_url|metadata
    out = {}
    for line in text.strip().splitlines():
        parts = line.split("|", 6)
        if len(parts) < 3:
            continue
        meta = {}
        if len(parts) > 6:
            try:
                meta = json.loads(parts[6])
            except ValueError:
                meta = {}
        out[parts[1]] = meta.get("nameEn") or parts[2]
    if not out:
        sys.exit("no rows parsed from %s" % path)
    return out


def _english(row):
    meta = row.get("metadata") or {}
    return meta.get("nameEn") or row.get("name") or row["game_code"]


def norm(title):
    s = unicodedata.normalize("NFKD", title)
    s = s.replace("®", "").replace("™", "").replace("&", "and").replace("’", "'")
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def index(pack):
    """-> (files by lowercased file-name stem, folders by normalised title).

    Keying the code index on the FILE stem rather than the folder means a misfiled tile lands
    on the right game: `008_Football Battle` carries a stray `SlotGoldenSoccer_301x300_CNY.png`,
    the DS `1005_Fish Feeder` trap again.
    """
    by_code, by_title = {}, {}
    for folder, rec in pack.items():
        title = re.sub(r"^[\d.]+_", "", folder)
        by_title.setdefault(norm(title), []).append(folder)
        for f in rec.get("files", []):
            by_code.setdefault(f["stem"].lower(), []).append(f)
    return by_code, by_title


def resolve(code, name, pack, by_code, by_title):
    """-> (files, how). game_code first (the 2025 pack), then exact normalised title."""
    if code.lower() in by_code:
        return by_code[code.lower()], "code"
    folders = by_title.get(norm(name), [])
    if folders:
        # `Aviator` has two folders (153 old, 235 new) — merge them and let LANGS decide.
        return [f for fo in folders for f in pack[fo].get("files", [])], "title"
    return [], "none"


def candidates(files):
    """Preference order: clean art before promo, portrait before square, IDR before English."""
    ordered = []
    for promo in (False, True):
        for size in SIZES:
            for lang in LANGS:
                ordered += [dict(f, want=size) for f in files
                            if f["promo"] == promo and f["size"] == size and f["lang"] == lang]
    seen, out = set(), []
    for c in ordered:
        if c["id"] not in seen:
            seen.add(c["id"])
            out.append(c)
    return out


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
    # -alpha_q keeps the rounded corners crisp: RiCH88's tiles are palette PNGs with a tRNS
    # chunk, so the corner radius is transparent. At 400x581 vs the 3/4 card the cover-crop
    # eats 24px off the top and bottom, taking most of that radius with it.
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   check=True, capture_output=True)


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

def render_sql(rows, langs, promos, offshape, absent):
    lang_note = ("-- Language: %d rows use RiCH88's **Indonesian** art (`_IDR`), %d English\n"
                 "-- (`_ENU` in the 2025 folders, `_ENG` in the older ones)%s. RiCH88 localises the\n"
                 "-- logotype itself — DuelSoccer's id tile reads \"DUEL SEPAK BOLA\", matching the\n"
                 "-- catalog's own nameId — so id is preferred per GAME, not per vendor. The id cut\n"
                 "-- only exists in the newer ICON(2025) folders; ⭐ worth asking RiCH88 to extend it\n"
                 "-- to the older titles, as with CQ9, Naga, Fastspin and Habanero.\n"
                 % (langs.get("IDR", 0),
                    langs.get("ENU", 0) + langs.get("ENG", 0),
                    "" if set(langs) <= {"IDR", "ENU", "ENG"} else
                    ", %d neither (reported below)" % sum(v for k, v in langs.items()
                                                          if k not in ("IDR", "ENU", "ENG"))))
    promo_note = ""
    if promos:
        promo_note = ("--\n"
                      "-- ⚠️ These games ship ONLY the max-multiplier cut — no clean `PNG` folder\n"
                      "-- exists for them — so their tile carries the promo badge. Swap them the\n"
                      "-- moment RiCH88 ships a clean one:\n"
                      + "".join("--   %s\n" % p for p in sorted(promos)))
    shape_note = ""
    if offshape:
        shape_note = ("--\n-- ⚠️ No 400x581 portrait; these fall back to another shape and will\n"
                      "-- cover-crop differently from the rest of the lobby:\n"
                      + "".join("--   %s\n" % s for s in sorted(offshape)))
    absent_note = ""
    if absent:
        absent_note = ("--\n-- No art in the pack (image_url stays NULL -> initial-letter placeholder):\n"
                       + "".join("--   %s %s\n" % (c, n) for c, n in sorted(absent)))
    n = str(len(rows))
    return ("-- RiCH88 game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: RiCH88's public Google Drive art pack (folder id\n"
            "-- 1gqmR2qTmpp2GzJ7pDCuq-1u5mXVbxzgv, handed over 2026-08-31), one folder per game named\n"
            "-- `<their numeric id>_<English title>` holding Graphic Material / ICON / Banner.\n"
            "-- RiCH88's own 3-1 gamelist carries NO image field (the CQ9 problem), so the pack is the\n"
            "-- only possible source. Mirrored into\n"
            "-- client-facing/public/assets/games/rich88/<game_code lowercased>.webp and committed.\n"
            "-- Generated by client-facing/scripts/import-rich88-icons.py.\n"
            "--\n"
            "-- ⭐ PORTRAIT, one size for the whole catalog. `.game-card` is aspect-ratio 3/4 +\n"
            "-- object-fit cover, and 400x581 is the only size RiCH88 draws full-bleed for that shape\n"
            "-- with the logotype baked in. It covers all " + n + " games, so nothing mixes shapes: the\n"
            "-- 500x500 / 301x300 / 200x200 squares crop ~12% off each side and clip the logotype, and\n"
            "-- 500x300 / 220x162 / 300x200 / 150x100 are landscape banner cuts.\n"
            "--\n"
            "-- ⭐ The pack's `PNGX` / `最高倍率版` folders are the max-multiplier PROMO cut — the same\n"
            "-- key art with a \"6000X\" badge burned into the top corner (Fastspin's max-win ribbon trap\n"
            "-- again). They sit beside the clean folder at every size, so the importer excludes them by\n"
            "-- path. ⚠️ The marker is the 最高倍率版 suffix, not the letter X: Western Sheriff files its\n"
            "-- promo cut under `PNG(最高倍率版)` and its clean cut under `PNG(一般)`.\n"
            "--\n"
            + lang_note
            + promo_note
            + shape_note
            + absent_note
            + "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042) /\n"
            "-- pp (000044) / afb (000045) / evolution (000046) / ds (000047) / cq9 (000049) /\n"
            "-- naga (000053) / awc (000056) / habanero (000066) / fs (000067) / jdb (000068): the icons\n"
            "-- are served by the client-facing Next.js app, so the path stays correct across every\n"
            "-- tenant domain.\n"
            "--\n"
            "-- Keyed on game_code, not id: RiCH88's catalog ships in 000058 with literal\n"
            "-- `rich88-<code lowercased>` ids, and game_code is the vendor's own stable key\n"
            "-- ('SlotCrazyRichMan', used verbatim on launch). The codes are MIXED CASE, like\n"
            "-- Habanero's, so the VALUES list below must keep their exact spelling — but the asset\n"
            "-- FILE names are lowercased, because they are served off a case-sensitive filesystem in\n"
            "-- the container. Verified collision-free across all " + n + " codes.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'rich88'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="000058_rich88_catalog.up.sql or a psql dump of vendor_games")
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
        print("  CRAWL FAILED: %r — %s" % (title, rec["error"]))
    usable = {t: r for t, r in pack.items() if t not in broken}

    catalog = load_catalog(args.catalog)
    bad = [c for c in catalog if not re.fullmatch(r"[A-Za-z0-9._-]+", c)]
    if bad:
        sys.exit("game_code is not a usable path segment for: %s" % bad)
    assets = [c.lower() for c in catalog]
    if len(set(assets)) != len(assets):
        sys.exit("game_codes collide when lowercased: %s"
                 % [a for a in set(assets) if assets.count(a) > 1])

    by_code, by_title = index(usable)
    jobs, absent, hows, touched = [], [], {}, set()
    for code in sorted(catalog):
        files, how = resolve(code, catalog[code], usable, by_code, by_title)
        hows[how] = hows.get(how, 0) + 1
        cands = candidates(files)
        if not cands:
            absent.append((code, catalog[code]))
            print("  NO TILE: %s %r (%s)" % (code, catalog[code], how))
            continue
        touched.update(f["path"] for f in files)
        jobs.append({"game_code": code, "name": catalog[code], "candidates": cands})
    print("resolved: %s" % ", ".join("%s=%d" % kv for kv in sorted(hows.items())))
    print("importing %d/%d catalog games" % (len(jobs), len(catalog)))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    rows, failed, langs, promos, offshape, total = [], [], {}, [], [], 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for job, blob in pool.map(grab, jobs):
            if blob is None:
                failed.append(job)
                continue
            code, chosen = job["game_code"], job["chosen"]
            langs[chosen["lang"]] = langs.get(chosen["lang"], 0) + 1
            if chosen["promo"]:
                promos.append("%s %s (%s)" % (code, job["name"], chosen["name"]))
            if chosen["want"] != PORTRAIT[0]:
                offshape.append("%s %s (%s, %dx%d)"
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
    print("language mix: %s" % ", ".join("%s=%d" % (k or "(none)", v)
                                         for k, v in sorted(langs.items())))
    if promos:
        print("promo-only art: %s" % "; ".join(sorted(promos)))
    if offshape:
        print("off-shape fallbacks: %s" % "; ".join(sorted(offshape)))
    verb = "would write" if args.dry_run else "wrote"
    print("%s %d icons -> %s  (%.1f MB), %d without art"
          % (verb, len(rows), OUT_DIR, total / 1024 / 1024, len(absent)))

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w", encoding="utf-8") as fh:
            fh.write(render_sql(sorted(rows), langs, promos, offshape, absent))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
