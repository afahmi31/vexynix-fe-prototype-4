#!/usr/bin/env python3
"""Import JDB's game icons into public/assets/games/jdb + emit the image_url SQL.

JDB's art pack is a **public Google Drive folder** — the one its own docs list under
Appendix -> Other Resources ("Game icon image | Google drive"),
`drive.google.com/drive/folders/1Jo9TsGgt_WS6llS2IW_odkT0xI7nFl6e`. It is organised as five
gType category folders, one folder per game beneath them, and the lobby tile is the 500x500
square inside the game's own Icon folder:

    <category>/<mType>_<Chinese> <English>/01. 游戏Icon_Game Icon/<language>/500x500/<mType>_500x500_<lang>.png

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-jdb-icons.py \
        ../game-docs/13o-game-provider-jdb/vendor/jdb-gamelist-sheet-2026-08-04.csv \
        --art-dir /tmp/jdb-art \
        --sql ../backend/services/simles/migrations/000068_jdb_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-jdb-icons.py <sheet.csv> --art-dir /tmp/jdb-art --dry-run

The positional argument is JDB's own game-list sheet (the committed snapshot in
game-docs/13o-game-provider-jdb/vendor/). It is only used to NAME games in the report and to
say which of the sellable rows the pack covers — the pack itself is keyed by `mType`, and so is
the SQL, so this runs fine before the real catalog has been cut.

What this encodes:

  * ⭐ **The Drive link JDB hands over by hand is the wrong one.** The folder circulated with the
    integration pack (`1rIG6_IP4bclRd2_ZLp8xEqDYMcdnKtsD`) is the **brand-logo** pack: 17
    sub-provider folders (Aviatrix, CP Games, SmartSoft, …) holding company wordmarks in .ai/.eps
    /.png and not one game tile. The game icons live in the folder above, published only in the
    doc site's Appendix.
  * **The pack covers JDB's OWN games only** — 167 folders across gType 7/9/12/18 and the slot
    range, which is all 148 JDB-brand rows of the 702-row sheet. The other 17 sub-providers
    (SPRIBE, FC, YB, Funky Games, …) ship no art here at all and stay NULL.
  * ⭐ **The SQL keys on `split_part(game_code, ':', 2)`, i.e. the mType**, not the row id and not
    the whole `gType:mType` code. Two reasons: the pack's category folders label slots
    "G type 8, 14, 15" while the sheet files the same games under gType 0, so the gType half is
    not trustworthy from the pack side; and mType is **globally unique across all 702 games**
    (checked), so the match is exact anyway. Asset name is the mType (`8050.webp`) because `:`
    is not a file name.
  * ⭐ **Every layout convention in this pack has at least three spellings.** The Icon folder is
    `01. 游戏Icon_Game Icon` / `01. 遊戏ICON_Game Icon` / `Icon` / `ICON` / `01. 游戏 Icon_ Game
    Icon`, and for 9017 Hilo and 9018 Plinko it is `01. 游戏素材_Game Icon` — Chinese says
    *materials*, English says *Icon*. A crawl that skips 素材 folders (they are symbol sheets
    everywhere else) silently loses those two games, so "icon" in a folder name always wins over
    the skip list. Sizes appear as folders (`500x500`, `500 x 500`, `200*200`) and/or in the file
    name, language as folders (`英文 English`, `EN`, `印尼 id`, `印尼文 Indonesian`) and/or as a
    file suffix.
  * ⭐ **The file name's language beats the folder's**: `.../01. 游戏Icon_Game Icon/CN/JPG/
    9023_500x500_en.jpg` is the ENGLISH tile filed under CN. Read the folder only when the file
    name carries no language.
  * ⭐ **`_Promo_`/`_Prome_` is a badged cut, not a resolution** — the same key art with a gold
    "PROMO" medal in the top-left corner (Fastspin's max-win-ribbon trap in another costume).
    The bare file is the clean tile. `(圓)`/`(圆)` and the `PNG circle` folders are round
    stickers on transparency, which cover-crop into a 3/4 card showing the card background down
    both sides — CQ9's 角標 and AWC's `*_circular_*` trap for the third time. Both excluded.
  * ⭐ **22 games have genuinely localised Indonesian art** (14006 Billionaire's logotype reads
    "MILIARDER"), so language preference is `id` -> `en` -> `cn`/`tw` **per game**, the AWC rule,
    rather than one language for the whole vendor. Worth asking JDB to extend the `id` cut — the
    other 145 fall back to English.
  * ⭐ **One game is Takeout-wrapped**: 14106 Lucky Pearl sits in
    `14106 好棒蚌 Lucky Pearl-20260114T063857Z-1-001/14106 好棒蚌 Lucky Pearl/…`, one level deeper
    than every other game, which is why the crawl descends past the game folder rather than
    assuming a fixed depth.
  * **500x500 is the only size with full coverage** (167/167) and is the square shape pgsoft/pp/
    ds/sg already use. The portrait cuts (250x350, 215x286) reach only ~95 games, so taking them
    would mix shapes across the lobby for no gain. Smaller squares stay as a fallback ladder.
  * **Idempotent and resync-safe**: JDB's catalog is a DRIFT CHECK, never a live sync
    (`internal/jdb/catalog.go` — the game list is cut into a migration by a human), so nothing
    ever clears image_url; the SQL only touches rows whose image_url differs.

Requires cwebp (brew install webp); sips (macOS) measures and converts.
"""
import argparse, concurrent.futures, csv, html, json, os, re, shutil, subprocess, sys
import tempfile, threading, time, urllib.error, urllib.request

# The folder JDB's doc site lists under Appendix -> Other Resources (read 2026-08-31).
DEFAULT_FOLDER = "1Jo9TsGgt_WS6llS2IW_odkT0xI7nFl6e"

SIZE, QUALITY = 512, 82        # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "jdb")
URL_PREFIX = "/assets/games/jdb"
TIMEOUT = 90
WORKERS = 12
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Tile size preference, best first. 500x500 covers all 167 games; the rest are insurance for a
# future game that ships without it.
SIZES = ["500x500", "540x540", "472x472", "340x340", "300x300", "246x246", "250x203",
         "222x222", "208x170", "200x200", "199x199", "182x170", "180x180", "150x150"]

# Per-game language preference. 22 games have real Indonesian art; everything else falls to
# English. `tw` is traditional Chinese, `fun` a demo-badged cut (excluded outright below).
LANGS = ["id", "en", "cn", "tw"]

# A downloaded tile is accepted once sips confirms this much short side — every pack so far has
# mislabelled at least one size folder (DS shipped a 200x200 named `_512`).
MIN_SHORT = 400

# Not lobby tiles: the round sticker cut, the PROMO-badged cut (JDB misspells it "Prome" about
# half the time), and the fun/demo badge.
EXCLUDE = re.compile(r"圓|圆|circle|round|prom[oe]|[_\-]fun[_.\-]", re.I)

# Folders that hold no tile. "icon" in a name overrides this — 9017/9018 file their tiles under
# `01. 游戏素材_Game Icon`, where the Chinese half says materials.
SKIP = re.compile(r"psd|banner|edm|video|影片|视频|screen|截图|截圖|撷图|擷取|素材|material"
                  r"|symbol|mps|others|其他|广宣|廣宣|logo|background", re.I)
KEEP = re.compile(r"icon", re.I)

# Language folder spellings seen in the pack, in the order they must be tested (印尼 before 尼).
LANG_DIRS = [
    ("id",  r"印尼|indonesian|^id$"),
    ("en",  r"英文|english|^en$"),
    ("tw",  r"繁中|繁體|taiwanese|^tw$"),
    ("cn",  r"简中|簡中|中文|chinese|^cn$"),
    ("th",  r"泰"), ("vn", r"越"), ("pt", r"葡"), ("spa", r"西"),
    ("kor", r"韩|韓"), ("jpn", r"日文"), ("rus", r"俄"), ("ara", r"阿拉伯"),
    ("ben", r"孟加拉"), ("lao", r"寮"), ("tur", r"土耳其"), ("tgl", r"他加禄|tagalog"),
]
# File-name suffixes, normalised onto the same codes.
LANG_FILE = {"id": "id", "en": "en", "cn": "cn", "tw": "tw", "th": "th", "vn": "vn",
             "pt": "pt", "spa": "spa", "es": "spa", "kor": "kor", "kr": "kor",
             "jpn": "jpn", "jp": "jpn", "rus": "rus", "ara": "ara", "ben": "ben",
             "lao": "lao", "tur": "tur", "tgl": "tgl"}

IMAGE = re.compile(r"\.(png|jpe?g|webp)$", re.I)
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$|desktop\.ini$|的副本", re.I)


# ---------------------------------------------------------------- Drive (anonymous surfaces)

_lock = threading.Lock()
_listings = {}


def _get(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"user-agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read(), r.headers.get("content-type", ""), r.status
        except urllib.error.HTTPError as e:
            # A legacy subfolder can 401/403 without a resourcekey (the CQ9 lesson): report it
            # as empty rather than killing the whole crawl.
            if e.code in (401, 403, 404):
                return b"", "", e.code
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def listdir(folder_id):
    """One folder -> [{id, name, dir}] via the anonymous embedded folder view."""
    with _lock:
        if folder_id in _listings:
            return _listings[folder_id]
    body, _, code = _get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id)
    out = []
    if code == 200:
        page = body.decode("utf-8", "replace")
        for chunk in page.split('<div class="flip-entry" id="entry-')[1:]:
            fid = chunk.split('"', 1)[0]
            name = re.search(r'flip-entry-title">(.*?)</div>', chunk, re.S)
            if not fid or not name:
                continue
            head = chunk.split("flip-entry-title")[0]
            out.append({"id": fid, "name": html.unescape(name.group(1)).strip(),
                        "dir": 'aria-label="Folder"' in head})
    with _lock:
        _listings[folder_id] = out
    return out


def download(file_id):
    blob, ctype, code = _get("https://drive.google.com/uc?export=download&id=%s" % file_id)
    if code != 200 or "html" in ctype.lower():
        # The big-file virus-scan interstitial, or a permission page. Never an image.
        raise RuntimeError("got %s, not an image (interstitial or access denied)" % (code or ctype))
    return blob


def crawl(folder_id, cache_path):
    """Walk the icon subtrees -> [{path, id}] for every image file, cached to disk."""
    if os.path.exists(cache_path):
        with open(cache_path) as fh:
            data = json.load(fh)
        _listings.update(data.get("listings", {}))
        if data.get("files"):
            return data["files"]

    top = listdir(folder_id)
    if not top:
        raise RuntimeError("no entries parsed for %s — Drive's listing HTML may have changed"
                           % folder_id)
    files, level, depth = [], [{"id": e["id"], "path": "/" + e["name"]}
                               for e in top if e["dir"]], 0
    # BFS, not recursion: a recursive fan-out inside a bounded pool deadlocks. 8 levels covers
    # category/game/icon/language/size/format plus the Takeout wrapper on 14106.
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        while level and depth < 8:
            listed = list(pool.map(lambda n: (n, listdir(n["id"])), level))
            nxt = []
            for node, kids in listed:
                for k in kids:
                    if IGNORE.match(k["name"]):
                        continue
                    path = node["path"] + "/" + k["name"]
                    if not k["dir"]:
                        if IMAGE.search(k["name"]):
                            files.append({"path": path, "id": k["id"]})
                    elif not (SKIP.search(k["name"]) and not KEEP.search(k["name"])):
                        nxt.append({"id": k["id"], "path": path})
            print("  crawl depth %d: %d folders, %d images so far"
                  % (depth, len(level), len(files)), flush=True)
            level, depth = nxt, depth + 1

    with open(cache_path, "w") as fh:
        json.dump({"files": files, "listings": _listings}, fh, ensure_ascii=False)
    return files


# ---------------------------------------------------------------- index the pack

def mtype_of(path):
    """The game folder is the first path segment under the category that starts with digits."""
    for part in path.split("/")[2:]:
        m = re.match(r"\s*(\d{3,6})(?!\d)", part)
        if m:
            return m.group(1)
    return None


def lang_of(path):
    """File-name suffix first — `CN/JPG/9023_500x500_en.jpg` is the ENGLISH tile."""
    name = path.rsplit("/", 1)[1]
    m = re.search(r"[_\-. ]([A-Za-z]{2,4})\.(?:png|jpe?g|webp)$", name, re.I)
    if m and m.group(1).lower() in LANG_FILE:
        return LANG_FILE[m.group(1).lower()]
    for part in reversed(path.split("/")[:-1]):
        for code, pat in LANG_DIRS:
            if re.search(pat, part, re.I):
                return code
    return None


def sizes_of(path):
    """Size tokens from the file name and every folder above it (`500x500`, `500 x 500`, `200*200`)."""
    out = set()
    parts = path.split("/")
    for part in [parts[-1]] + parts[2:-1]:
        for m in re.finditer(r"(?<!\d)(\d{2,4})\s*[x*×X]\s*(\d{2,4})(?!\d)", part):
            out.add("%sx%s" % (m.group(1), m.group(2)))
    return out


def index(files):
    """-> {mType: [candidate, ...]} with the ranking keys resolved."""
    games = {}
    for f in files:
        if EXCLUDE.search(f["path"]):
            continue
        mt = mtype_of(f["path"])
        if not mt:
            continue                              # shared folders like "老虎機 角色素材 Slot-Matrial"
        # ⭐ A file whose name starts with a DIFFERENT mType is misfiled in this game's folder —
        # `8006 Formosa Bear/.../8005_500x500_en.png` is Llama Adventure's tile, and taking it
        # gives two games the same picture. (DS shipped the same trap; there the file name was
        # the liar and the folder the truth, and it is the same rule: they must agree.) A file
        # with no mType prefix at all — `500x500_en.png` — is fine, that is just the short name.
        # The negative lookahead keeps `500x500_en.png` — a size, not an mType — out of it.
        head = re.match(r"\s*(\d{3,6})(?![\dx*×])", f["path"].rsplit("/", 1)[1], re.I)
        if head and head.group(1) != mt:
            continue
        sizes = sizes_of(f["path"])
        best = next((i for i, s in enumerate(SIZES) if s in sizes), None)
        if best is None:
            continue
        lang = lang_of(f["path"])
        games.setdefault(mt, []).append({
            "id": f["id"], "path": f["path"], "name": f["path"].rsplit("/", 1)[1],
            "size": SIZES[best], "size_rank": best,
            "lang": lang or "??",
            "lang_rank": LANGS.index(lang) if lang in LANGS else len(LANGS),
            # PNG is the lossless master where both exist; JPG is a re-encode of it.
            "fmt_rank": 0 if f["path"].lower().endswith(".png") else 1,
        })
    for cs in games.values():
        cs.sort(key=lambda c: (c["size_rank"], c["lang_rank"], c["fmt_rank"], c["name"]))
    return games


# ---------------------------------------------------------------- convert

def dimensions(path):
    r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                       capture_output=True, text=True)
    d = dict(re.findall(r"(pixelWidth|pixelHeight):\s*(\d+)", r.stdout))
    return int(d.get("pixelWidth", 0)), int(d.get("pixelHeight", 0))


def to_webp(src, dst):
    """Re-encode to a WebP tile, downscaling only if the source is larger than SIZE."""
    png, tmp = src, None
    if not src.lower().endswith(".png"):
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
        r = subprocess.run(["sips", "-s", "format", "png", src, "--out", tmp],
                           capture_output=True, text=True)
        if r.returncode or not os.path.getsize(tmp):
            return "sips: %s" % (r.stderr.strip() or "empty output")
        png = tmp
    try:
        w, h = dimensions(png)
        args = ["cwebp", "-quiet", "-q", str(QUALITY)]
        if min(w, h) > SIZE:
            args += ["-resize", str(SIZE), "0"] if w <= h else ["-resize", "0", str(SIZE)]
        r = subprocess.run(args + [png, "-o", dst], capture_output=True, text=True)
        return "cwebp: %s" % r.stderr.strip() if r.returncode else None
    finally:
        if tmp:
            os.unlink(tmp)


# ---------------------------------------------------------------- the sheet (naming only)

def read_sheet(path):
    """JDB's game-list CSV -> {mType: {name, provider, gtype}}. Header is two rows deep."""
    out = {}
    with open(path, encoding="utf-8") as fh:
        for row in list(csv.reader(fh))[2:]:
            if len(row) < 7 or not row[4].strip():
                continue
            out[row[4].strip()] = {"provider": row[1].strip(), "gtype": row[3].strip(),
                                   "name": row[6].strip() or row[5].strip()}
    return out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet", nargs="?",
                    help="JDB game-list CSV — names the games and reports coverage")
    ap.add_argument("--folder", default=DEFAULT_FOLDER, help="Drive folder id of the icon pack")
    ap.add_argument("--art-dir", required=True, help="where pack files are downloaded to")
    ap.add_argument("--tree", help="listing cache (default: <art-dir>/tree.json)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    os.makedirs(args.art_dir, exist_ok=True)

    files = crawl(args.folder, args.tree or os.path.join(args.art_dir, "tree.json"))
    games = index(files)
    sheet = read_sheet(args.sheet) if args.sheet else {}
    print("pack: %d images -> %d games with a usable tile" % (len(files), len(games)))

    if args.dry_run:
        for mt in sorted(games, key=lambda m: (len(m), m)):
            c = games[mt][0]
            print("  %-7s %-34s %s_%s  %s"
                  % (mt, sheet.get(mt, {}).get("name", "(not in sheet)")[:34],
                     c["size"], c["lang"], c["name"]))
        missing = sorted(m for m, g in sheet.items()
                         if g["provider"] == "JDB" and m not in games)
        print("  JDB-brand sheet rows with no art: %s" % (missing or "none"))
        others = sorted({g["provider"] for g in sheet.values()} - {"JDB"})
        print("  sub-providers the pack does not cover: %s" % ", ".join(others))
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    rows, picked, failed = [], {}, {}
    for mt in sorted(games, key=lambda m: (len(m), m)):
        for cand in games[mt][:6]:
            # Cache under the full pack path: the same file name lives in ~30 size folders.
            src = os.path.join(args.art_dir,
                               cand["path"].strip("/").replace("/", "__"))
            try:
                if not os.path.exists(src) or not os.path.getsize(src):
                    with open(src, "wb") as fh:
                        fh.write(download(cand["id"]))
                w, h = dimensions(src)
                if min(w, h) < MIN_SHORT:
                    failed[mt] = "%s is really %dx%d" % (cand["name"], w, h)
                    continue
                dst = os.path.join(OUT_DIR, mt + ".webp")
                err = to_webp(src, dst)
                if err:
                    failed[mt] = "%s: %s" % (cand["name"], err)
                    continue
            except Exception as e:                # one bad file must not kill the run
                failed[mt] = "%s: %s" % (cand["name"], e)
                continue
            picked[mt] = dict(cand, w=w, h=h)
            failed.pop(mt, None)
            rows.append("  ('%s', '%s/%s.webp')" % (mt, URL_PREFIX, mt))
            break

    for mt in sorted(picked, key=lambda m: (len(m), m)):
        c = picked[mt]
        print("  %-7s %-34s %dx%d_%s  %s"
              % (mt, sheet.get(mt, {}).get("name", "(not in sheet)")[:34],
                 c["w"], c["h"], c["lang"], c["name"]))
    for mt, why in sorted(failed.items()):
        print("  NO ART  %-7s %s" % (mt, why))

    by_lang = {}
    for c in picked.values():
        by_lang[c["lang"]] = by_lang.get(c["lang"], 0) + 1
    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print("wrote %d icons -> %s  (%.1f MB)  languages: %s"
          % (len(rows), OUT_DIR, total / 2 ** 20,
             ", ".join("%s %d" % kv for kv in sorted(by_lang.items(), key=lambda kv: -kv[1]))))
    if sheet:
        sellable = {m for m, g in sheet.items() if g["provider"] == "JDB"}
        print("covers %d/%d JDB-brand sheet rows; %d pack games are not in the sheet"
              % (len(sellable & set(picked)), len(sellable), len(set(picked) - set(sheet))))

    if args.sql:
        with open(args.sql, "w") as fh:
            fh.write(
                "-- JDB game icons. Keyed on the mType half of `game_code` ('<gType>:<mType>'):\n"
                "-- the pack's category folders and the game sheet disagree about gType, while\n"
                "-- mType is unique across all 702 games JDB aggregates.\n\n"
                "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
                "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
                + ",\n".join(rows)
                + "\n  ) AS v(mtype, url)\n WHERE g.vendor_id = 'jdb'\n"
                  "   AND split_part(g.game_code, ':', 2) = v.mtype\n"
                  "   AND g.image_url IS DISTINCT FROM v.url;\n")
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
