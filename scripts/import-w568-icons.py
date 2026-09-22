#!/usr/bin/env python3
"""Import 568Win / SBO's product tiles into public/assets/games/w568 + emit the SQL.

568Win handed over TWO public Google Drive folders (2026-09-07):

    1nZ-Gy3qGaBLB8h8digfL2yszZDP5WRTl   568Win's OWN products  <- the only one this reads
    13-YQLEaCsrt6tESws9KaA5ykqoBgNmh_   the aggregator's third-party vendor packs

    # crawl the pack, download, convert, write the assets + the migration
    python3 scripts/import-w568-icons.py \
        --sql ../backend/services/simles/migrations/000084_w568_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-w568-icons.py --manifest /tmp/w568-tree.json --dry-run

What this encodes:

  * ⭐ **This vendor has no per-game catalog.** 568Win is a SPORTSBOOK-shaped protocol: 3.2.1 New
    Login takes a *Portfolio* plus (for seamless games) a GpId/GameId pair, and 000024 seeds six
    PORTFOLIO rows, not games — `Sportsbook::`, `VirtualSports::`, `Casino::0`, `Games::` and the
    two `SeamlessGame:10000:*` lobbies. So this importer resolves six product tiles by an explicit
    per-row path list, not a catalog join. It is Evolution's shape (000046, seven `category:*`
    rows), not RiCH88's.
  * ⭐ **The SECOND Drive folder is deliberately NOT read.** `13-YQLE…` is one folder per resold
    third-party vendor keyed by GpId — 1018_PT_Playtech, 1031_HB_Habanero, 1062_DragoonSoft,
    1079_Fastspin, 1026_Rich88, 2_CQNine, 35_PGSoft, 20_EvolutionGaming … i.e. vendors we already
    integrate DIRECTLY. 000024's own header states the rule: reaching one vendor through two
    integrations means two catalogs, two recon feeds and a player who sees the same game twice —
    ⭐ DECIDE PER VENDOR: direct, or via 568Win, NEVER BOTH. Nothing under ProductType 9 is
    seeded, so nothing there has a row to point at. Pass --survey-aggregator to list it anyway.
  * ⭐ **The Sportsbook tile is the only PORTRAIT one, and it is the whole point.** `.game-card`
    is `aspect-ratio: 3/4` + `object-fit: cover` (client-facing/src/styles/portal/_game-card.scss)
    and `SBOBET_powered by 568Win_Sports_thumbnail_430x614.png` is drawn full-bleed for exactly
    that shape (it ships at 896x1279) with the SBOBET logotype and "SPORTS" baked in. The other
    four products only ever ship a 500x500 square, which cover-crops ~12% off the top and bottom.
    Asked 568Win for a 430x614 cut of the rest — see game-docs/13l-game-provider-568win/TECHNICAL.md §9.
  * ⭐ **"Banner" is marketing copy, not a tile.** Every product also ships
    `<product>_648x648.png` / `_936x620.png` under `Banner/`, which look like lobby squares but
    carry burned-in slogans ("PLAY, WIN, REPEAT!", "FEEL THE THRILL, LIVE THE WIN!"). CQ9's
    Promotion Materials trap in another costume. Excluded by path — only `Thumbnail`/`thumbnails`
    /`Game icon` subtrees are ever read.
  * ⭐ **Four brand vintages sit side by side and only one is current.** Each product's Thumbnail
    folder splits `New_SBOBET powered by 568Win` vs `Old_SBOBET`, and Sportsbook offers four
    (`thumbnail_SBOBET_logo_old`, `…_new`, `thumbnail_568WinPoweredBySBOBET_logo`,
    `thumbnail_SBOBETpoweredby568Win_logo`). The house brand is **SBOBET powered by 568Win** — the
    lockup the New_* folders use for RNG Games, Slot and Virtual Sports — so Sportsbook takes
    `thumbnail_SBOBETpoweredby568Win_logo`, NOT the confusingly-named 568WinPoweredBySBOBET one.
    568Win's own Live Casino is its own brand (`New_568Win`) and keeps the 568win wordmark.
  * ⭐ **No Indonesian art anywhere in the pack.** Languages are EN / CN only for the thumbnails
    (the RNG per-game icons add ES/PT/TH). Every tile here is EN — worth asking 568Win for an `id`
    cut, as with CQ9, Naga, Fastspin, Habanero and RiCH88.
  * **`SeamlessGame:10000:1` (568Win Casino Lobby) reuses the Live Casino tile deliberately.** It
    is the same 568Win Live Casino product reached through the seamless lobby rather than
    ProductType 7, so the same key art is the honest answer, not a stand-in.
  * ⚠️ **`SeamlessGame:10000:0` (568Win Games Lobby) stays NULL.** The only 568WinGames brand
    assets in the pack are a 210x59 wordmark and the slogan banners above — the `ds-lobby` trap
    (a wordmark cover-cropped into a 3/4 card is a sliver). The letter placeholder is better.
    ⭐ This is the one gap to close: ask 568Win for a 568WinGames square/portrait thumbnail in the
    shape the other four products already have.
  * **Idempotent and resync-safe**: the SQL keys on `game_code` and only touches rows whose
    image_url differs. `w568.CatalogUpsertSQL` never writes image_url, so a SyncOnce cannot clear
    it. Re-running writes the same assets byte-for-byte.
  * ⭐ **The Drive API is unusable** (`API_KEY_SERVICE_BLOCKED`, and we have no OAuth to 568Win's
    account), so the tree is walked through the anonymous
    `drive.google.com/embeddedfolderview?id=…` HTML listing and files come down via
    `uc?export=download&id=…`. Both are unauthenticated HTML surfaces Google can restyle, hence
    the parse guards. Same crawler as ds / cq9 / naga / awc / rich88.

Requires cwebp (brew install webp); sips (macOS) measures and downscales.
"""
import argparse, concurrent.futures, html, json, os, re, subprocess, sys, tempfile
import urllib.request

# The two folders 568Win handed over (2026-09-07). Pass --folder if they ever reissue them.
OWN_PRODUCTS_FOLDER = "1nZ-Gy3qGaBLB8h8digfL2yszZDP5WRTl"
AGGREGATOR_FOLDER = "13-YQLEaCsrt6tESws9KaA5ykqoBgNmh_"

SIZE, QUALITY = 640, 82        # SIZE = short-side CEILING, never a target to upscale to
MIN_SHORT_SIDE = 200           # a tile below this is a wordmark or a favicon, not key art

# w568.DefaultCatalogMinBet / DefaultCatalogMaxBet (internal/w568/catalog.go), in ledger rupiah.
# ⚠️ Placeholders on their side too: 568Win publishes no per-game stake ladder in 8.1.
CATALOG_MIN_BET, CATALOG_MAX_BET = 10000, 100000000
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "w568")
URL_PREFIX = "/assets/games/w568"
TIMEOUT = 180
WORKERS = 6
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

IS_IMAGE = re.compile(r"\.(png|jpe?g|webp)$", re.I)

# ⭐ Only these subtrees hold tiles. Everything else in the pack is banners, event/promotion
# artwork, .psd/.psb/.ai masters, per-game icons for products we do not seed, or brand logos.
# ⚠️ The folder name is a SUFFIX, not an exact match: Sportsbook files its tiles under
# "SBO Sportsbook Thumbnail", and AWC's pack spelled the same folder "Thumbnails"/"Thumbnali".
TILE_SUBTREE = re.compile(r"/[^/]*(thumbnails?|game icon)/", re.I)

# The six seeded rows, in catalog order, each with its ordered candidate list. A candidate is a
# case-insensitive SUFFIX of the pack path: the first one that exists AND measures at least
# MIN_SHORT_SIDE wins, so 568Win reorganising a parent folder does not break the resolve.
#
# (game_code, asset slug, human name, [candidate path suffixes])
TILES = [
    ("Sportsbook::", "sportsbook", "SBO Sportsbook", [
        # ⭐ the only PORTRAIT tile in the pack — 896x1279, drawn for aspect-ratio 3/4
        "thumbnail_SBOBETpoweredby568Win_logo/SBOBET_powered by 568Win_Sports_thumbnail_430x614.png",
        "500 x 500 - png and psd/SBOBET_powered by 568Win_Sports_thumbnail_500x500.png",
        "thumbnail_SBOBETpoweredby568Win_logo/SBOBET_powered by 568Win_Sports_thumbnail_350x200.png",
    ]),
    ("VirtualSports::", "virtual-sports", "SBO Virtual Sports", [
        "new_SBOBET powered by 568Win/png/virtual_sports_thumbnail_500x500_.png",
        "new_SBOBET powered by 568Win/virtual_sports_thumbnail_500x500_.png",
        "new_SBOBET powered by 568Win/png/virtual_sports_thumbnail_200x200.png",
    ]),
    ("Casino::0", "live-casino", "568Win Live Casino", [
        "New_568Win/png/livecasino_thumbnail_en_500x500_.png",
        "New_568Win/livecasino_thumbnail_en_500x500_.png",
        "New_568Win/png/livecasino_thumbnail_en_200x200.png",
    ]),
    ("Games::", "games", "SBO Games (RNG)", [
        "New_SBOBET powered by 568Win/png/games_thumbnail_en_500x500_.png",
        "New_SBOBET powered by 568Win/games_thumbnail_en_500x500_.png",
        "New_SBOBET powered by 568Win/png/games_thumbnail_en_200x200.png",
    ]),
    # ⚠️ SeamlessGame:10000:0 (568Win Games Lobby) is absent on purpose — see the module docstring.
    ("SeamlessGame:10000:1", "casino-lobby", "568Win Casino Lobby", [
        # the same 568Win Live Casino key art: it IS that product, reached via the seamless lobby
        "New_568Win/png/livecasino_thumbnail_en_500x500_.png",
        "New_568Win/livecasino_thumbnail_en_500x500_.png",
    ]),
]

# Rows we knowingly leave NULL, reported every run so the gap never goes quiet.
UNRESOLVED_BY_DESIGN = {
    "SeamlessGame:10000:0":
        "568Win Games Lobby — the pack's only 568WinGames brand art is a 210x59 wordmark and "
        "slogan banners; ask 568Win for a square/portrait 568WinGames thumbnail",
}


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read(), r.headers.get("Content-Type", "")


def listdir(folder_id, strict=False):
    """One level of a public Drive folder, off the anonymous embeddedfolderview HTML."""
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
        # The big-file virus-scan interstitial, or a permission page. Never an image.
        raise RuntimeError("got HTML, not an image (interstitial or access denied)")
    return blob


def crawl(folder_id, prune=True):
    """Walk the pack -> [{id, path}] for every image under a tile subtree.

    prune=True stops descending into Banner / Promotion / Event / PSD branches, which is what
    keeps the crawl to ~30 listings instead of several hundred.
    """
    files, seen = [], set()
    skip_dir = re.compile(r"^(Banner|Promotion|Event.*|PSD|Logo|BackGrounds and character|"
                          r"\.psd|.*\.gsheet)$", re.I)

    def walk(fid, path, depth):
        if fid in seen or depth > 6:
            return
        seen.add(fid)
        try:
            entries = listdir(fid, strict=(depth == 0))
        except Exception as exc:                       # a dead subfolder must not kill the crawl
            print("  ! listdir %s: %s" % (path or "/", exc), file=sys.stderr)
            return
        for e in entries:
            p = path + "/" + e["name"]
            if e["dir"]:
                if prune and skip_dir.match(e["name"]):
                    continue
                walk(e["id"], p, depth + 1)
            elif IS_IMAGE.search(e["name"]) and (not prune or TILE_SUBTREE.search(p)):
                files.append({"id": e["id"], "path": p})

    walk(folder_id, "", 0)
    return files


def measure(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout
    w = re.search(r"pixelWidth: (\d+)", out)
    h = re.search(r"pixelHeight: (\d+)", out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (0, 0)


def to_webp(src, dest):
    w, h = measure(src)
    if not w or not h:
        return None
    if min(w, h) > SIZE:                               # ceiling, never an upscale
        subprocess.run(["sips", "-Z", str(SIZE), src, "--out", src],
                       capture_output=True, check=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   capture_output=True, check=True)
    with open(dest, "rb") as fh:
        return (w, h), fh.read()


def resolve(tile, index):
    """First candidate that EXISTS and measures big enough -> (dims, source path, webp bytes)."""
    code, slug, name, candidates = tile
    for cand in candidates:
        hit = index.get(cand.lower())
        if not hit:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src" + os.path.splitext(hit["path"])[1].lower())
            dst = os.path.join(tmp, "out.webp")
            try:
                with open(src, "wb") as fh:
                    fh.write(download(hit["id"]))
            except Exception as exc:
                print("  ! %s %s: %s" % (code, cand, exc), file=sys.stderr)
                continue
            got = to_webp(src, dst)
            if not got:
                print("  ! %s %s: not an image sips can read" % (code, cand), file=sys.stderr)
                continue
            dims, blob = got
            if min(dims) < MIN_SHORT_SIDE:
                print("  ! %s %s: only %dx%d — below the %dpx floor"
                      % (code, cand, dims[0], dims[1], MIN_SHORT_SIDE), file=sys.stderr)
                continue
            return dims, hit["path"], blob
    return None, None, None


# ---- the per-game catalogs (--seed-games) ------------------------------------------------------
#
# ⚠️⚠️ THESE ROWS ARE SEEDED `inactive` AND MUST STAY THAT WAY UNTIL `w568-probe sync-games` RUNS.
# 8.1 Get Game List is the only source that carries `isEnabled`, `supportedCurrencies` and
# `blockCountries`, and w568.Publishable() refuses to publish without all three — a title our
# currency cannot play, or one blocked for Indonesia, is a launch that fails in front of the player
# with an error they cannot act on. The art pack carries NONE of that, so a row derived from it is a
# provisional stub, not a publishable game. store.go filters `status='active'` everywhere, so an
# inactive row is invisible to the catalog API, and SyncOnce (which writes 'active'/'maintenance'
# from live data, and SKIPS anything Publishable() refuses) is exactly the publish step.
#
# ⭐ Only SeamlessGame providers can be seeded per-game at all. 3.2.1 New Login accepts GpId/GameId
# for `SeamlessGame` and `ThirdPartySportsBook` ONLY (W568-OPERATION-API §3.2.1), which is why
# launch.go sends them for those two portfolios and nothing else. So the eight SBO RNG titles
# (GameId 6101-6106 / 604501 / 610001, portfolio `Games`, ProductType 3) are NOT seeded here: every
# such row would launch the same `Games::` lobby the catalog already carries.
GAME_PACKS = [
    # (gpid, provider label, pack path fragment, filename regex with (id)(name) groups)
    (14, "SBO Slot", "/14_SBO Slot/Game Icon/",
     re.compile(r"^(\d+)_(.+)\.(?:png|jpe?g|webp)$", re.I)),
    (1029, "568WinGames", "/1029_568WinGames/Game Icon/200x200/",
     re.compile(r"^1029_(\d+)_(.+)\.(?:png|jpe?g|webp)$", re.I)),
]

# ⭐ Conservative category map. `CategoryOf` (catalog.go) folds 568Win's `newGameType` onto our
# category, and the art pack does not carry newGameType — so these are DERIVED FROM THE TITLE and
# recorded as such in metadata. Only unmistakable words are matched; everything else takes
# CategoryOf's own fallback, "slot". A sync overwrites the lot with the real value.
CATEGORY_WORDS = [
    ("table", ("baccarat", "blackjack", "roulette", "sicbo", "sic bo", "poker", "deuces",
               "jacks or better", "tens or better", "card clash", "pok deng", "bull bull",
               "fan tan", "xoc dia", "three card", "teen patti", "hi lo", "domino")),
    ("lottery", ("keno", "bingo", "lotto", "lottery", "thimbles")),
    ("fish", ("fishing", "fish ", "nuclear fishing", "good fishes")),
    ("arcade", ("crash", "aviator", "limbo", "plinko", "dice", "up down", "racing", "iggy",
                "snail", "squish", "piggy tap", "cricket crash")),
]

# ⚠️ Two filename spellings can share one GameId. The rule is deterministic, never a coin toss:
#   * `<name>_CN` / `<name>_En` are language cuts of one game — prefer `_En`, then the unmarked
#     spelling, then `_CN`, and strip the suffix from the name.
#   * otherwise, if one of the two names is ALSO used by a different GameId, that name belongs to
#     the other row and this id takes the remaining one. This is what resolves SBO Slot's
#     `14000007_BreakAway` / `14000007_TrueBreakAway`, since `BreakAway` is also `14000055`.
LANG_SUFFIX = re.compile(r"_(CN|En|EN|cn|en)$")

CAMEL_BOUNDARIES = (
    (re.compile(r"(?<=[a-z0-9])(?=[A-Z])"), " "),      # aB -> a B, 5T -> 5 T
    (re.compile(r"(?<=[A-Z])(?=[A-Z][a-z])"), " "),    # ABc -> A Bc
    (re.compile(r"(?<=[a-zA-Z])(?=\d)"), " "),         # Rich3 -> Rich 3
)


def pretty_name(stem):
    """`DuoFuDuoCai5Treasures` -> `Duo Fu Duo Cai 5 Treasures`.

    ⚠️ A filename is not a title. 568Win's real multilingual names live in 8.1's `gameInfos`, and
    these are a placeholder until a sync replaces them: run-on lowercase spellings come out imperfect
    (`ADayattheDerby` -> `A Dayatthe Derby`, `TensorBetter` -> `Tensor Better`). That is recorded in
    metadata as `name_source`, so a synced name is an obvious improvement rather than a silent edit.
    """
    s = stem.replace("_", " ").replace("-", " ").strip()
    for rx, rep in CAMEL_BOUNDARIES:
        s = rx.sub(rep, s)
    s = re.sub(r"\s+", " ", s).strip()
    if s and not any(c.isupper() for c in s):
        # a few stems are filed all-lowercase ("roulette"); CamelCase splitting cannot help there
        s = s.title()
    return s


def category_for(name):
    low = " " + name.lower() + " "
    for cat, words in CATEGORY_WORDS:
        if any(w in low for w in words):
            return cat
    return "slot"                                      # CategoryOf's own fallback


def collect_games(files):
    """Pack files -> [{gpid, game_id, name, category, file}] with the dedup rules applied."""
    out, report = [], []
    for gpid, provider, frag, rx in GAME_PACKS:
        by_id, skipped = {}, 0
        for f in files:
            if frag not in f["path"]:
                continue
            m = rx.match(f["path"].split("/")[-1])
            if not m:
                skipped += 1                           # e.g. the SBO RNG tiles misfiled under 1029
                continue
            by_id.setdefault(m.group(1), []).append((m.group(2), f))

        # names claimed by exactly one id, used to break the non-language collisions
        sole = {}
        for gid, cands in by_id.items():
            for stem, _ in cands:
                sole.setdefault(LANG_SUFFIX.sub("", stem).lower(), set()).add(gid)

        for gid, cands in sorted(by_id.items(), key=lambda kv: int(kv[0])):
            if len(cands) > 1:
                langs = [c for c in cands if LANG_SUFFIX.search(c[0])]
                if langs and len(langs) != len(cands):
                    en = [c for c in cands if (LANG_SUFFIX.search(c[0]) or [""])
                          and LANG_SUFFIX.sub("", c[0]) != c[0]
                          and LANG_SUFFIX.search(c[0]).group(1).lower() == "en"]
                    pick = en[0] if en else min(
                        (c for c in cands if not LANG_SUFFIX.search(c[0])), key=lambda c: c[0])
                else:
                    # the name another id also claims belongs to that id, not this one
                    other = [c for c in cands
                             if len(sole.get(LANG_SUFFIX.sub("", c[0]).lower(), set())) == 1]
                    pick = other[0] if other else sorted(cands)[0]
                report.append("gpid %d gameId %s: %s -> %s"
                              % (gpid, gid, "/".join(sorted(c[0] for c in cands)), pick[0]))
            else:
                pick = cands[0]
            name = pretty_name(LANG_SUFFIX.sub("", pick[0]))
            out.append({"gpid": gpid, "game_id": gid, "name": name, "provider": provider,
                        "category": category_for(name), "file": pick[1]})
        print("  gpid %-5d %-13s %4d games (%d files ignored: no <id>_<name> prefix)"
              % (gpid, provider, sum(1 for g in out if g["gpid"] == gpid), skipped))
    return out, report


def sql_quote(s):
    return s.replace("'", "''")


CATALOG_HEADER = """\
-- 568Win / SBO per-game catalog: the two SeamlessGame providers 568Win brands as its OWN —
-- GpId 14 (SBO Slot) and GpId 1029 (568WinGames).
--
-- ⚠️⚠️ EVERY ROW IS SEEDED `inactive` AND MUST STAY THAT WAY UNTIL `w568-probe sync-games` RUNS.
-- This catalog is derived from 568Win's Drive ART PACK (folder {folder}),
-- because 8.1 Get Game List is unreachable: the Operation Company Key answers
-- `error 10101 — Invalid Company Key (EXP)` as of 2026-09-07 (13l roadmap step 5, re-opened).
-- The art pack carries NO `isEnabled`, NO `supportedCurrencies` and NO `blockCountries`, and
-- w568.Publishable() refuses to publish without all three — a title our currency cannot play, or
-- one blocked for Indonesia, is a launch that fails in front of the player with an error they
-- cannot act on. So these are PROVISIONAL STUBS, not publishable games.
--
-- ⭐ Why `inactive` is a real gate and not a comment: store.go filters `status='active'` on every
-- catalog read (GetGame, ListGames, the tenant join), so an inactive row is invisible to the API.
-- And SyncOnce is exactly the publish step — it writes 'active'/'maintenance' from live data via
-- BuildRow, and SKIPS anything Publishable() refuses, so a title that should never have been here
-- simply stays dark. Nothing needs to be undone by hand.
--
-- ⭐ Ids and game_codes are minted by the SAME rules as w568.RowID / w568.GameCode —
-- `w568-<gpid>-<gameid>` and `SeamlessGame:<gpid>:<gameid>` — so the first real sync UPDATEs these
-- rows in place through CatalogUpsertSQL's ON CONFLICT (id) instead of writing a second copy.
--
-- ⭐ Only SeamlessGame providers can be seeded per-game at all: 3.2.1 New Login accepts GpId/GameId
-- for `SeamlessGame` and `ThirdPartySportsBook` ONLY (W568-OPERATION-API §3.2.1), which is why
-- launch.go sends them for those two portfolios and nothing else. The eight SBO RNG titles
-- (GameId 6101-6106 / 604501 / 610001, portfolio `Games`, ProductType 3) are therefore NOT here:
-- every such row would launch the same `Games::` lobby 000024 already carries.
--
-- ⚠️ THE AGGREGATOR-OVERLAP RULE STILL APPLIES (000024's header, 13l TECHNICAL §6). These two GpIds
-- are 568Win's own brands, not vendors we run directly, so they do not trip
-- SIMLES_W568_DIRECT_VENDORS. But SBO Slot's LINE-UP is licensed content, and some of it is
-- Playtech's (`14000039 Buffalo Blitz`, `14000063 Great Blue`, `14000018 Pure Platinum`) — which we
-- also run as a direct integration (13m). ⭐ Decide that per title before flipping GpId 14 active;
-- the same game reachable twice is the exact failure 000024 was written to prevent.
--
-- ⚠️ `name` and `category` are DERIVED FROM THE ART-PACK FILENAME, recorded as `name_source` /
-- `category_source` in metadata. 568Win's real multilingual names live in 8.1's `gameInfos`, and
-- `category` should come from `newGameType` through w568.CategoryOf. Run-on lowercase filenames
-- come out imperfect ("A Dayatthe Derby", "Tensor Better"); a sync fixes them.
--
-- ⚠️ min_bet/max_bet are w568.DefaultCatalogMinBet/MaxBet placeholders. 568Win publishes NO
-- per-game stake ladder in 8.1 at all, and ProductType 9 limits are selected by `BetCode` at launch
-- from their published list and CANNOT be customised (W568-REFERENCE-TABLES §7). No BetCode is
-- seeded, so a launch takes 568Win's default limit for the title.
--
-- Open asks to 568Win, in priority order: (1) rotate the Operation Company Key so 8.1 works;
-- (2) share `External 568Win Games List` — the pack links that sheet
-- (doc 1O63KTzX0g-kMOlVDdkHiI4Rk2motDBNybFbhW3hEdAE) but it answers 401, so it is not public.
--
-- Generated by client-facing/scripts/import-w568-icons.py --seed-games.
{dupes}
INSERT INTO vendor_games (id, vendor_id, game_code, name, category, min_bet, max_bet, status, metadata) VALUES
{rows}
ON CONFLICT (id) DO NOTHING;
"""

GAMES_ICON_HEADER = """\
-- Artwork for the 568Win per-game catalog seeded in {catalog_migration}.
--
-- Source: the same Drive pack the catalog itself was derived from — `14_SBO Slot/Game Icon/` and
-- `1029_568WinGames/Game Icon/200x200/` (folder {folder}). Mirrored into
-- client-facing/public/assets/games/w568/<gpid>-<gameid>.webp and committed.
-- Generated by client-facing/scripts/import-w568-icons.py --seed-games.
--
-- ⭐ The `200x200` folder name LIES — 568WinGames files 400x400 and 512x512 art in it. SBO Slot's
-- `Game Icon/` really is 200x200, which is below the 512 short side most packs give us; nothing is
-- upscaled (`.game-card-image img` is object-fit: cover), the same call as AFB's 308x218 pack.
--
-- ⭐ The 523X523 folder is NOT used: it is keyed by TITLE rather than GameId and covers only 69 of
-- the ~500 568WinGames titles, so taking it would mix two keying conventions to gain art for 14% of
-- the catalog. Worth revisiting if 568Win ever extends it.
--
-- Keyed on game_code, like {catalog_migration} and 000084 — see their headers for why.
-- These rows are `inactive` until a sync publishes them; the artwork is simply ready when they are.

ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE vendor_games g
   SET image_url = v.url
  FROM (VALUES
{rows}
  ) AS v(game_code, url)
 WHERE g.vendor_id = 'w568'
   AND g.game_code = v.game_code
   AND g.image_url IS DISTINCT FROM v.url;
"""


def seed_games(files, args):
    print("collecting the per-game packs:")
    games, dupes = collect_games(files)
    if dupes:
        print("  ⚠️ %d GameId collision(s) resolved:" % len(dupes))
        for d in dupes:
            print("     " + d)

    print("\ndownloading %d tiles (%d workers)…" % (len(games), WORKERS))
    ok, failed = [], []

    def fetch(g):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src" + os.path.splitext(g["file"]["path"])[1].lower())
            dst = os.path.join(tmp, "out.webp")
            try:
                with open(src, "wb") as fh:
                    fh.write(download(g["file"]["id"]))
            except Exception as exc:
                return g, None, str(exc)
            got = to_webp(src, dst)
            if not got:
                return g, None, "not an image sips can read"
            return g, got[1], None

    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for g, blob, err in pool.map(fetch, games):
            (failed if err else ok).append((g, blob, err))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
        for g, blob, _ in ok:
            with open(os.path.join(OUT_DIR, "%d-%s.webp" % (g["gpid"], g["game_id"])), "wb") as fh:
                fh.write(blob)

    total = sum(len(b) for _, b, _ in ok)
    print("  %d/%d tiles converted (%.1f MB of WebP)%s"
          % (len(ok), len(games), total / 1048576.0, " [dry run]" if args.dry_run else ""))
    for g, _, err in failed:
        print("  ! gpid %d gameId %s %s: %s" % (g["gpid"], g["game_id"], g["name"], err),
              file=sys.stderr)

    by_cat = {}
    for g in games:
        by_cat[g["category"]] = by_cat.get(g["category"], 0) + 1
    print("  categories: " + ", ".join("%s %d" % kv for kv in sorted(by_cat.items())))

    if args.dry_run:
        return 0

    if args.games_sql:
        rows = ",\n".join(
            "  ('w568-%d-%s', 'w568', 'SeamlessGame:%d:%s', '%s', '%s', %d, %d, 'inactive', "
            "'{\"gpid\":%d,\"game_id\":\"%s\",\"provider\":\"%s\",\"category_source\":"
            "\"filename-heuristic\",\"name_source\":\"drive-art-pack-2026-09-07\","
            "\"catalog_provisional\":true}'::jsonb)"
            % (g["gpid"], g["game_id"], g["gpid"], g["game_id"], sql_quote(g["name"]),
               g["category"], CATALOG_MIN_BET, CATALOG_MAX_BET,
               g["gpid"], g["game_id"], g["provider"])
            for g in games)
        dupe_note = ""
        if dupes:
            dupe_note = ("--\n-- ⚠️ GameId collisions in the pack, resolved by the rules above:\n"
                         + "".join("--   %s\n" % d for d in dupes))
        with open(args.games_sql, "w") as fh:
            fh.write(CATALOG_HEADER.format(folder=args.folder, dupes=dupe_note, rows=rows))
        print("wrote %s (%d rows)" % (args.games_sql, len(games)))

    if args.games_icons_sql:
        rows = ",\n".join(
            "  ('SeamlessGame:%d:%s', '%s/%d-%s.webp')"
            % (g["gpid"], g["game_id"], URL_PREFIX, g["gpid"], g["game_id"]) for g, _, _ in ok)
        with open(args.games_icons_sql, "w") as fh:
            fh.write(GAMES_ICON_HEADER.format(
                folder=args.folder,
                catalog_migration=os.path.basename(args.games_sql or "the catalog migration"),
                rows=rows))
        print("wrote %s (%d rows)" % (args.games_icons_sql, len(ok)))
    return 0


HEADER = """\
-- 568Win / SBO product artwork: point every seeded catalog row at its local icon asset.
--
-- Source: the public Google Drive pack of 568Win's OWN products (folder id
-- {folder}, handed over 2026-09-07), one folder per product:
-- SBO Sportsbook / SBO Virtual Sports / 568Win Live Casino / SBO RNG Games, plus 14_SBO Slot
-- and 1029_568WinGames. Mirrored into client-facing/public/assets/games/w568/<slug>.webp and
-- committed. Generated by client-facing/scripts/import-w568-icons.py.
--
-- ⭐ This vendor has no per-game catalog. 568Win is a sportsbook-shaped protocol — 3.2.1 New
-- Login takes a Portfolio plus (for seamless games) a GpId/GameId pair — so 000024 seeds six
-- PORTFOLIO rows, not games, and this migration paints those. It is Evolution's shape (000046,
-- seven `category:*` rows), not a slots vendor's.
--
-- ⭐ 568Win also handed over a SECOND folder, {aggregator} — one folder per
-- resold third-party vendor keyed by GpId (1018_PT_Playtech, 1031_HB_Habanero, 1062_DragoonSoft,
-- 1079_Fastspin, 1026_Rich88, 2_CQNine, 35_PGSoft, 20_EvolutionGaming, …). It is NOT imported.
-- 000024's own header sets the rule: reaching one vendor through two integrations means two
-- catalogs, two recon feeds and a player who sees the same game twice — DECIDE PER VENDOR:
-- direct, or via 568Win, NEVER BOTH. Nothing under ProductType 9 is seeded, so nothing in that
-- folder has a row to point at.
--
-- ⭐ Only the Sportsbook tile is PORTRAIT, and it is the one that matters most. `.game-card` is
-- aspect-ratio 3/4 + object-fit cover, and the 430x614 cut (which ships at 896x1279) is drawn
-- full-bleed for exactly that shape with the logotype baked in. The other products ship only a
-- 500x500 square, which cover-crops ~12% off the top and bottom. Asked 568Win to extend the
-- 430x614 cut — see game-docs/13l-game-provider-568win/TECHNICAL.md §9.
--
-- ⭐ The `Banner/` squares (<product>_648x648.png, _936x620.png) look like lobby tiles and are
-- NOT: they carry burned-in slogans ("PLAY, WIN, REPEAT!", "FEEL THE THRILL, LIVE THE WIN!").
-- CQ9's Promotion Materials trap in another costume. Only Thumbnail/Game icon subtrees are read.
--
-- ⭐ Brand vintage: the pack keeps `Old_SBOBET` beside `New_SBOBET powered by 568Win`, and
-- Sportsbook offers four lockups. The house brand is SBOBET powered by 568Win, so Sportsbook
-- takes `thumbnail_SBOBETpoweredby568Win_logo` — NOT the similarly-named
-- `thumbnail_568WinPoweredBySBOBET_logo`. 568Win Live Casino is its own brand and keeps the
-- 568win wordmark (`New_568Win`).
--
-- Language: EN for all of them. ⭐ There is no Indonesian art anywhere in the pack (thumbnails
-- are EN/CN only; the RNG per-game icons add ES/PT/TH). Worth asking 568Win for an `id` cut, as
-- with CQ9, Naga, Fastspin, Habanero and RiCH88.
--
-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042) /
-- pp (000044) / afb (000045) / evolution (000046) / ds (000047) / cq9 (000049) / naga (000053) /
-- awc (000056) / habanero (000066) / fs (000067) / jdb (000068) / rich88 (000069) / wm (000070) /
-- bng (000082): the icons are served by the client-facing Next.js app, so the path stays correct
-- across every tenant domain.
--
-- Keyed on game_code, not id: 000024 ships hand-written ids (`w568-sportsbook`), while
-- w568.RowID() would mint `w568-<gpid>-<gameid>`, so a future SyncOnce writes DIFFERENT rows.
-- game_code is the stable key either way, and w568.CatalogUpsertSQL never writes image_url, so a
-- sync cannot clear what this sets.
{unresolved}
ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE vendor_games g
   SET image_url = v.url
  FROM (VALUES
{rows}
  ) AS v(game_code, url)
 WHERE g.vendor_id = 'w568'
   AND g.game_code = v.game_code
   AND g.image_url IS DISTINCT FROM v.url;
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--folder", default=OWN_PRODUCTS_FOLDER,
                    help="Drive folder id of 568Win's own-product pack")
    ap.add_argument("--manifest", help="cache the crawl here (reused if it exists)")
    ap.add_argument("--sql", help="write the migration to this path")
    ap.add_argument("--dry-run", action="store_true", help="resolve and report, write nothing")
    ap.add_argument("--survey-aggregator", action="store_true",
                    help="list the SECOND folder's per-vendor packs and exit (nothing is imported)")
    ap.add_argument("--seed-games", action="store_true",
                    help="ALSO seed the per-game catalogs for GpId 14 (SBO Slot) and GpId 1029 "
                         "(568WinGames) from the pack, as `inactive` provisional rows, and mirror "
                         "their tiles. ⚠️ They stay invisible until `w568-probe sync-games` runs")
    ap.add_argument("--games-sql", help="--seed-games: write the catalog migration here")
    ap.add_argument("--games-icons-sql", help="--seed-games: write their icon migration here")
    args = ap.parse_args()

    if args.survey_aggregator:
        print("aggregator pack %s — one folder per RESOLD vendor, NOT imported:"
              % AGGREGATOR_FOLDER)
        for e in sorted(listdir(AGGREGATOR_FOLDER, strict=True), key=lambda x: x["name"]):
            print("  %s %s" % ("D" if e["dir"] else "f", e["name"]))
        return 0

    if args.manifest and os.path.exists(args.manifest):
        with open(args.manifest) as fh:
            files = json.load(fh)
        print("pack: %d tile candidates (cached %s)" % (len(files), args.manifest))
    else:
        files = crawl(args.folder)
        print("pack: %d tile candidates" % len(files))
        if args.manifest:
            with open(args.manifest, "w") as fh:
                json.dump(files, fh, indent=1)

    if args.seed_games:
        return seed_games(files, args)

    # Index every file by every suffix of its path, so a candidate matches wherever it moved to.
    index = {}
    for f in files:
        parts = f["path"].strip("/").split("/")
        for i in range(len(parts)):
            index.setdefault("/".join(parts[i:]).lower(), f)

    rows, misses = [], []
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for tile, (dims, src, blob) in zip(TILES, pool.map(lambda t: resolve(t, index), TILES)):
            code, slug, name, _ = tile
            if not blob:
                misses.append((code, name, "no candidate resolved in the pack"))
                continue
            print("  %-22s %-22s %5dx%-5d %6.1f KB  %s"
                  % (code, slug, dims[0], dims[1], len(blob) / 1024.0, src.lstrip("/")))
            rows.append((code, slug, blob))

    for code, why in sorted(UNRESOLVED_BY_DESIGN.items()):
        misses.append((code, "", why))

    print("\nresolved %d/%d seeded rows" % (len(rows), len(TILES) + len(UNRESOLVED_BY_DESIGN)))
    for code, name, why in misses:
        print("  NULL %-22s %s" % (code, why))

    if args.dry_run:
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    for _, slug, blob in rows:
        with open(os.path.join(OUT_DIR, slug + ".webp"), "wb") as fh:
            fh.write(blob)
    print("\nwrote %d asset(s) to %s" % (len(rows), OUT_DIR))

    if args.sql:
        unresolved = ""
        if misses:
            unresolved = ("--\n-- ⚠️ Left NULL (the UI falls back to its initial-letter "
                          "placeholder):\n")
            for code, name, why in misses:
                unresolved += "--   %s — %s\n" % (code, why)
        body = HEADER.format(
            folder=args.folder,
            aggregator=AGGREGATOR_FOLDER,
            unresolved=unresolved,
            rows=",\n".join("  ('%s', '%s/%s.webp')" % (c, URL_PREFIX, s) for c, s, _ in rows))
        with open(args.sql, "w") as fh:
            fh.write(body)
        print("wrote %s" % args.sql)
    return 0


if __name__ == "__main__":
    sys.exit(main())
