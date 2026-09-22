#!/usr/bin/env python3
"""Import CQ9's game icons into public/assets/games/cq9 + emit the catalog SQL.

CQ9's art pack is a **public Google Drive folder** ("CQ9 Materials 素材") laid out by SIZE and
LANGUAGE, not by game: every leaf folder holds one flat pile of PNGs named
`<gamecode>_<title>_<lang><size>.png`. So unlike the ds/pgsoft packs there is no per-game
folder to walk — the game code is the file-name prefix, and the language is a CJK marker inside
the name (印 Indonesian · 英 English · 簡中 Chinese) or the `en` / `zh-cn` folder it sits in.

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-cq9-icons.py cq9-catalog.json \
        --sql ../backend/services/simles/migrations/000049_cq9_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-cq9-icons.py cq9-catalog.json --manifest /tmp/cq9-manifest.json --dry-run

The catalog argument is a psql row dump of the live CQ9 catalog:

    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('game_code',game_code,
        'name',name)) from vendor_games where vendor_id='cq9' and game_code <> ''" > cq9-catalog.json

`code|name` per line (psql -At -F'|') is accepted too. Pass --all to take every game the pack
has instead of only the ones our hall actually lists.

What this encodes:

  * ⭐ **The Indonesian art is a PARTIAL, LEGACY set.** "Game Logo/Icon Indonesian" covers only
    31 of our 148 catalog games — CQ9 localised the art once, years ago, and never kept it up:
    everything newer (the whole `VPCQS*` / `GB*` / `CP*` line and the 100–250 numeric range) is
    English/Chinese only. Indonesian is therefore the PREFERENCE, not the source: LANG_RANK puts
    `id` first, English second, Chinese last, so a game gets its Indonesian tile when one exists
    and an English one when it does not. Demanding Indonesian would leave ~80% of the lobby on
    the initial-letter placeholder.
  * **Language lives in the file name, not (only) the folder.** `Game Logo/Icon 128x128` mixes
    `…_英128x128.png` and `…_簡中128x128.png` in one directory, so the marker in the name is
    what decides, with the `/en` · `/zh-cn` · ` EN` · ` CN` path segment as the fallback signal.
    Files marked for a language we do not ship (韓 日 泰 越 西 葡) are dropped, not guessed at.
  * ⭐ **`角標` files are NOT icons.** `1010.五福_jp角標_in.png` is the little jackpot CORNER
    BADGE that overlays a tile — same code prefix, same folder, same extension as the real art.
    Shipping one would give the game a transparent ribbon instead of a picture, so 角標 (and its
    simplified 角标) is excluded by name.
  * **Squares beat banners.** `.game-card` is `aspect-ratio: 3/4` with `object-fit: cover`, so a
    300x210 or 291x136 tile loses its sides to the crop. SOURCES therefore ranks the near-square
    folders (200x200, 182x170, 150x150, 146x136, 128x128) above the wide ones, ahead of raw
    pixel count — a 182px square survives the crop better than a 300px letterbox.
  * **The `PSD 500x500` folder is ignored.** It is the only place with 500px masters, but the
    files are layered multi-language PSDs (`…_簡英印泰越500x500.psd`) whose flattened composite
    is whichever language CQ9 last saved — there is no way to pull the Indonesian layer out with
    sips/cwebp, and a composite with several logotypes stacked is worse than a small clean PNG.
    Nothing here opens an archive or a layered master.
  * **Sizes in names are a claim, not a fact** (the ds pack taught us this): every chosen file is
    measured with sips and only accepted at >= MIN_SHORT, else the next candidate is tried.
  * **The SQL keys on `game_code`** — CQ9's own `cq9:<code>` — because the row id also carries
    the hall (`cq9-<hall>-<code>`) and a hall rename would break an id-keyed patch.
  * **Safe against a resync**: cq9.CatalogUpsertSQL refreshes only game_code/name/category/
    status/metadata ON CONFLICT, so it never clears image_url. A game CQ9 adds LATER lands with
    image_url NULL and the UI falls back to its initial-letter placeholder.

Requires cwebp (brew install webp); sips (macOS) measures and downscales.
"""
import argparse, concurrent.futures, html, json, os, re, subprocess, sys, tempfile, time
import urllib.error
import urllib.request

# The public share CQ9 handed over ("CQ9 Materials 素材"). resourcekey is required for the
# legacy `0B…` root; the modern `1…` child folders below it need none.
DEFAULT_ID_FOLDER = "1uETX7CmIqRLl-Axtf99s-6RVDNSB3Aue"    # Game Logo/Icon Indonesian
DEFAULT_EN_FOLDER = "1sT77thFpvx6kvKp8oXJOGskeiSJXenKC"    # Game Logo/Icon EN/CN

SIZE, QUALITY = 512, 82           # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "cq9")
URL_PREFIX = "/assets/games/cq9"
TIMEOUT = 60
WORKERS = 8                       # Drive throttles the anonymous listing; 8 is comfortable
UA = "game-web-icon-import/1.0"
MIN_SHORT = 110                   # 128x128 is the smallest set we are willing to ship

# Leaf folders we take, best first. `rank` is the tie-break AFTER language: near-square before
# wide, bigger before smaller. Anything not listed here (291x136, 236x132, 1920x1080, 80x80,
# 301x180, PSD, 190x240 portrait) is deliberately left out — see the module docstring.
SOURCES = [
    ("ID",                                        1),   # Indonesian 200x200, on a plate
    ("ID/220x162",                                2),
    ("ID/146x136",                                3),
    ("ID/128x128",                                4),
    ("ENCN/Game Logo/Icon 500x500",               5),   # only ~11 games, but they are the best
    ("ENCN/Game Logo/Icon 268X268無底圖",          6),
    ("ENCN/Game Logo/Icon 182x170",               7),   # the widest coverage at a usable size
    ("ENCN/Game Logo/Icon 180x180",               8),
    ("ENCN/Game Logo/Icon 150x150",               9),
    ("ENCN/Game Logo/Icon 150x150有底圖",         10),
    ("ENCN/146x136_有底圖",                       11),
    ("ENCN/Game Logo/Icon 128x128",              12),
    ("ENCN/128x128_有底圖",                       13),
    ("ENCN/Game Logo/Icon 300x210",              14),   # 1.43:1 — last resort before nothing
]
LANG_RANK = {"id": 0, "en": 1, "cn": 2}

# A jackpot corner-badge overlay, not a game tile. Same prefix, same folder as the real art.
BADGE = re.compile(r"角[標标]")
# Languages we do not ship. Checked before the EN/CN markers so `簡英韓` style names still work.
OTHER_LANG = re.compile(r"[韓韩日泰越西葡]")
IMAGE = re.compile(r"\.(png|jpe?g)$", re.I)
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$", re.I)


# ---------------------------------------------------------------- Drive (anonymous surfaces)

def _get(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"user-agent": UA})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.read(), r.headers.get("content-type", "")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404):     # a permission answer, not a transient fault
                raise
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def listdir(folder_id, strict=False):
    """One folder -> [{id, name}] via the anonymous embedded folder view.

    ⭐ Parts of this pack are LEGACY `0B…` folders ("Game materials", "Icon 200x200", the brand
    LOGO folder) that answer 401 without the resourcekey CQ9 never gave us. Those are reported
    and skipped: every one of them has a modern `1…` sibling holding the same sizes, so losing
    them costs no coverage — but letting a 401 abort the crawl would cost all of it.
    """
    try:
        body, _ = _get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403, 404) and not strict:
            print("  (skipped %s: HTTP %d — legacy folder, needs a resourcekey)"
                  % (folder_id, e.code), file=sys.stderr)
            return []
        raise
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
        # The big-file virus-scan interstitial, or a permission page. Never an image.
        raise RuntimeError("got HTML, not an image (interstitial or access denied)")
    return blob


def walk(folder_id, prefix, maxdepth=4):
    """Breadth-first crawl of one tree -> [{id, name, path}] for every image file in it."""
    files, level = [], [(folder_id, prefix, 0)]
    while level:
        nxt = []
        with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
            listings = list(pool.map(lambda t: listdir(t[0], strict=(t[2] == 0)), level))
        for (fid, path, depth), kids in zip(level, listings):
            for kid in kids:
                if IGNORE.match(kid["name"]):
                    continue
                sub = path + "/" + kid["name"]
                if IMAGE.search(kid["name"]):
                    files.append({"id": kid["id"], "name": kid["name"], "path": sub})
                elif "." not in kid["name"] and depth < maxdepth:
                    nxt.append((kid["id"], sub, depth + 1))
        level = nxt
    return files


# ---------------------------------------------------------------- classify

def code_of(name):
    """`105_Jumping Mobile_印200X200.png` -> 105 · `AT06_水滸劈魚_印尼…` -> AT06.

    The code is the leading ASCII alphanumeric run. It is NOT split on `_` alone: the pack also
    writes `1.鑽石水果王_印.png` (dot) and `34地鼠戰役200X200_in.png` (straight into CJK).
    """
    m = re.match(r"^([A-Za-z0-9]+)(?=[^A-Za-z0-9]|$)", name)
    return m.group(1) if m else None


def lang_of(rec):
    """id / en / cn / None, from the file name's CJK marker, then the folder it sits in."""
    name, path = rec["name"], rec["path"]
    if "印" in name:
        return "id"
    if "英" in name:
        return "en"
    if re.search(r"[簡简繁][中体體]|_簡|_简", name):
        return "cn"
    if OTHER_LANG.search(name):
        return None                        # 韓/日/泰/越/西/葡 — a language we do not ship
    segs = path.split("/")
    for seg in reversed(segs):
        low = seg.lower()
        if low == "en" or low.endswith(" en"):
            return "en"
        if low in ("zh-cn", "zh_cn") or low.endswith(" cn"):
            return "cn"
    return "id" if segs[0] == "ID" else None


def source_rank(path):
    """The SOURCES rank of the leaf folder holding this file, or None if it is not whitelisted."""
    folder = path.rsplit("/", 1)[0]
    best = None
    for prefix, rank in SOURCES:
        if folder == prefix or folder.startswith(prefix + "/"):
            # Longest matching prefix wins, so `150x150/en` picks 150x150 and not a shorter one.
            if best is None or len(prefix) > best[0]:
                best = (len(prefix), rank)
    return best[1] if best else None


def candidates(files):
    """[{id,name,path}] -> {game_code: [candidate, …] best first}."""
    out = {}
    for rec in files:
        if BADGE.search(rec["name"]):          # jackpot corner badge, not a tile
            continue
        code, lang, rank = code_of(rec["name"]), lang_of(rec), source_rank(rec["path"])
        if not code or lang is None or rank is None:
            continue
        out.setdefault(code, []).append(dict(rec, lang=lang, rank=rank))
    for code, lst in out.items():
        lst.sort(key=lambda c: (LANG_RANK[c["lang"]], c["rank"], c["name"]))
    return out


# ---------------------------------------------------------------- catalog

def load_catalog(path, drive_codes):
    """{bare code: (game_code, name)} — the rows we are allowed to write."""
    if path is None:
        return {c: ("cq9:" + c, c) for c in sorted(drive_codes)}
    text = open(path, encoding="utf-8").read().strip()
    rows = []
    if text.startswith("[") or text.startswith("{"):
        blob = json.loads(text)
        rows = [(r.get("game_code") or r.get("code"), r.get("name", "")) for r in blob]
    else:
        for line in text.splitlines():
            parts = line.split("|")
            if len(parts) >= 2 and parts[0].strip():
                rows.append((parts[0].strip(), parts[1].strip()))
    out = {}
    for game_code, name in rows:
        if not game_code:
            continue
        bare = game_code.split(":", 1)[1] if ":" in game_code else game_code
        out[bare] = (game_code, name or bare)
    if not out:
        sys.exit("no catalog rows parsed from %s" % path)
    return out


# ---------------------------------------------------------------- convert

def short_side(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout
    dims = [int(m) for m in re.findall(r"pixel(?:Width|Height):\s*(\d+)", out)]
    return min(dims) if len(dims) == 2 else 0


def convert(src, dest):
    """PNG/JPG -> WebP, downscaling only if the source is bigger than SIZE on its short side."""
    if short_side(src) > SIZE:
        subprocess.run(["sips", "-Z", str(SIZE), src, "--out", src],
                       check=True, capture_output=True)
    # -alpha_q keeps the 去背 (transparent cut-out) sets crisp; harmless on the plated ones.
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   check=True, capture_output=True)


def grab(job):
    """Take the best candidate that MEASURES big enough -> (job, webp bytes) or (job, None)."""
    best = None                                   # (short_side, candidate, webp bytes)
    for cand in job["candidates"][:6]:            # 6 tries is plenty; the list is ranked
        try:
            blob = download(cand["id"])
        except Exception as e:
            print("  ! %s %s: %s" % (job["code"], cand["name"], e), file=sys.stderr)
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src" + os.path.splitext(cand["name"])[1].lower())
            dst = os.path.join(tmp, "out.webp")
            with open(src, "wb") as fh:
                fh.write(blob)
            side = short_side(src)
            try:
                convert(src, dst)
            except subprocess.CalledProcessError as e:
                print("  ! %s %s: convert failed: %s"
                      % (job["code"], cand["name"], e.stderr.decode(errors="replace").strip()),
                      file=sys.stderr)
                continue
            got = (min(side, SIZE), cand, open(dst, "rb").read())
        if got[0] >= MIN_SHORT:
            job["chosen"], job["short_side"] = got[1], got[0]
            return job, got[2]
        if best is None or got[0] > best[0]:
            best = got
    if best is None:
        return job, None
    job["chosen"], job["short_side"] = best[1], best[0]
    return job, best[2]


# ---------------------------------------------------------------- SQL

HEADER_TEMPLATE = """-- CQ9 game artwork: point every catalog row at its local icon asset.
--
-- Source: CQ9's public Google Drive pack ("CQ9 Materials 素材"), which is laid out by SIZE and
-- LANGUAGE rather than by game — each leaf folder is a flat pile of
-- `<gamecode>_<title>_<lang><size>.png`. Mirrored into
-- client-facing/public/assets/games/cq9/<code>.webp and committed.
-- Generated by client-facing/scripts/import-cq9-icons.py.
--
-- ⭐ The INDONESIAN art is a partial, legacy set: "Game Logo/Icon Indonesian" covers only
-- %(id_pack)d of the %(catalog)d catalog games. CQ9 localised the art once and stopped;
-- everything newer (the VPCQS*/GB*/CP* line and most of the 100-250 range) exists in English
-- and Chinese only. So Indonesian is a PREFERENCE, not the source — the importer ranks
-- id > en > cn per game, and what actually shipped is:
--   %(id)d rows on Indonesian art
--   %(en)d rows on English art
--   %(cn)d rows on Chinese art
--
-- Squares beat banners: `.game-card` is aspect-ratio 3/4 with object-fit: cover, so the
-- near-square sets (200x200, 268x268, 182x170, 150x150, 146x136, 128x128) outrank the wider
-- 300x210 / 291x136 / 1920x1080 ones regardless of pixel count. The `PSD 500x500` folder is
-- ignored: layered multi-language masters whose flattened composite cannot be steered to
-- Indonesian. Nothing in this pipeline opens an archive or a PSD.
--
-- ⭐ `角標` files are excluded by name: `1010.五福_jp角標_in.png` is the jackpot CORNER BADGE
-- overlay, not a tile — same code prefix and folder as the real art.
--
-- %(covered)d of the %(catalog)d catalog rows get real art. The other %(absent_n)d have none
-- anywhere in the pack and keep image_url NULL (the UI falls back to the initial-letter
-- placeholder) — CQ9's newest `VPCQ*` line plus the GINKGO/GO halls the pack never covered:
%(absent)s--
-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042) /
-- pp (000044) / afb (000045) / evolution (000046) / ds (000047): the icons are served by the
-- client-facing Next.js app, so it stays correct across every tenant domain.
--
-- Keyed on game_code (CQ9's own `cq9:<code>`), not id: the row id also carries the hall
-- (`cq9-<hall>-<code>`, see internal/cq9/catalog.go gameRowID), so an id-keyed patch would
-- break if CQ9 ever moved a game between halls.
--
-- Safe against a resync: cq9.CatalogUpsertSQL refreshes only game_code/name/category/status/
-- metadata ON CONFLICT, so it never clears image_url. A game CQ9 adds LATER lands with
-- image_url NULL and falls back to the placeholder.

"""


def render_sql(rows, stats, absent):
    """The migration, with the provenance a reader needs before trusting these paths."""
    header = HEADER_TEMPLATE % {
        "id_pack": stats["id_pack"],
        "catalog": stats["catalog"],
        "id": stats["id"],
        "en": stats["en"],
        "cn": stats["cn"],
        "covered": len(rows),
        "absent_n": len(absent),
        "absent": "".join("--   %s\n" % code for code in absent),
    }
    return (header
            + "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
              "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'cq9'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")

# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", nargs="?",
                    help="psql dump of vendor_games where vendor_id='cq9' (json, or code|name "
                         "lines); omit with --all to take every game in the pack")
    ap.add_argument("--all", action="store_true", help="ignore the catalog, import every game")
    ap.add_argument("--id-folder", default=DEFAULT_ID_FOLDER, help="Drive id of Icon Indonesian")
    ap.add_argument("--en-folder", default=DEFAULT_EN_FOLDER, help="Drive id of Icon EN/CN")
    ap.add_argument("--manifest", help="cache the crawl here (reused on the next run)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="resolve + download, write no assets")
    args = ap.parse_args()
    if not args.catalog and not args.all:
        ap.error("give a catalog file, or --all to take the whole pack")

    if args.manifest and os.path.exists(args.manifest):
        files = json.load(open(args.manifest, encoding="utf-8"))
        print("manifest %s: %d files (delete it to re-crawl)" % (args.manifest, len(files)))
    else:
        files = walk(args.id_folder, "ID") + walk(args.en_folder, "ENCN")
        print("pack: %d image files" % len(files))
        if args.manifest:
            json.dump(files, open(args.manifest, "w"), ensure_ascii=False, indent=1)

    found = candidates(files)
    catalog = load_catalog(None if args.all else args.catalog, set(found))
    bad = [c for c in catalog if not re.fullmatch(r"[A-Za-z0-9_-]+", c)]
    if bad:
        sys.exit("game_code is not a usable path segment for: %s" % bad)

    id_pack = len({c for c, lst in found.items()
                   if any(x["lang"] == "id" for x in lst)} & set(catalog))
    extra = sorted(set(found) - set(catalog))
    if extra:
        print("pack has art for %d games outside the catalog (skipped)" % len(extra))
    absent = sorted(c for c in catalog if c not in found)
    if absent:
        print("catalog games with NO art in the pack (%d): %s" % (len(absent), ", ".join(absent)))

    jobs = [{"code": c, "game_code": catalog[c][0], "name": catalog[c][1],
             "candidates": found[c]} for c in sorted(catalog) if c in found]
    print("importing %d/%d catalog games (%d have Indonesian art)"
          % (len(jobs), len(catalog), id_pack))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    rows, missing, picked, total = [], [], [], 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for job, blob in pool.map(grab, jobs):
            if blob is None:
                missing.append(job)
                continue
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, job["code"] + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            picked.append(job)
            rows.append("  ('%s', '%s/%s.webp')" % (job["game_code"], URL_PREFIX, job["code"]))

    for job in missing:
        print("  FAILED: %s %r" % (job["code"], job["name"]))
    stats = {"catalog": len(catalog), "id_pack": id_pack,
             "id": sum(1 for j in picked if j["chosen"]["lang"] == "id"),
             "en": sum(1 for j in picked if j["chosen"]["lang"] == "en"),
             "cn": sum(1 for j in picked if j["chosen"]["lang"] == "cn")}
    print("language of the tile actually shipped: id=%(id)d en=%(en)d cn=%(cn)d" % stats)
    verb = "would write" if args.dry_run else "wrote"
    print("%s %d icons -> %s  (%.1f MB), %d failed"
          % (verb, len(rows), OUT_DIR, total / 1024 / 1024, len(missing)))

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(sorted(rows), stats, absent))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
