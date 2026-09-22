#!/usr/bin/env python3
"""Import Playtech's default game thumbnails into public/assets/games/pt + emit the catalog SQL.

Playtech ships artwork on their own SharePoint ("Marketing Materials" site, folder
`@Marketing Materials (Public)/Thumbnail (Game) 游戏入口图/Default Thumbnails`). That link is
**tenant-authenticated** — it 403s / bounces to login.microsoftonline.com for anyone outside
Playtech's tenant, and unlike the game-list xlsx there is no anonymous share token for it, so
the pack has to be handed over out of band: download the folder from a logged-in browser
(SharePoint's "Download" zips it) and point this script at the zip.

    # the catalog, as the DB has it
    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name)) from vendor_games where vendor_id='pt'" > catalog.json

    python3 scripts/import-pt-icons.py OneDrive_1_8-18-2026.zip catalog.json \
        --sql ../backend/services/simles/migrations/000042_pt_game_icons.up.sql

    # see what would match before writing anything
    python3 scripts/import-pt-icons.py OneDrive_1_8-18-2026.zip catalog.json --dry-run

The pack as it shipped (2026-08-18): 1,298 PNGs, all English, `Slot/`, `Live/Table/` and a
10-file `Live/Lobby/`, named `<Title>_500x500_en.png` (78 are `_1000x1000_en`, one uses hyphens).

What this encodes about matching it:

  * **Files are named by TITLE, not by game code.** Playtech's own codes (`gpas_ladz_pop`) appear
    nowhere in the pack, so the match runs against `vendor_games.name` — and the two名 spellings
    disagree constantly. Hence the tiers: exact code, exact name, name minus its trailing
    qualifier, same tokens in any order, then fuzzy. First tier to hit wins.
  * **The catalog's trailing qualifier is not in the file names.** 186 rows end in `(Live)`, 54 in
    `(Lobby)`, one in `(Direct Table)`; 36 more are stake variants (`Fortunate Five $0.04 [frtf1]`).
    Both tails are stripped for matching, so every stake variant inherits its base game's art.
  * **Word order drifts between the two sides**: the catalog says `Blackjack VZN 6 (Live)` where
    the pack says `VZN Blackjack 6`, and `Speed Baccarat 한국어 2` where the pack says
    `Korean Speed Baccarat 2`. The token-set tier handles the reordering; CJK locale words are
    folded to their English name (한국어 -> korean, 日本語 -> japanese) so they line up at all.
  * **Do not strip locale words from the middle of a title.** An earlier cut matched `_en`/`_500x500`
    by scanning every token, which silently ate real words — `El Capy` lost "El" to Greek `el`,
    `Thai Temple` lost "Thai" to Thai. Size and locale are only ever popped off the END of a stem,
    and only when the popped token really is one of them.
  * `Live/Lobby/` is **category** art (Roulette, Poker, Sicbo, New & Hot...), not per-game art, so
    it ranks last: a row uses a lobby tile only when it has no dedicated thumbnail of its own.
  * **Smallest source that still covers 512.** Sizes come from a `WxH` token in the name when there
    is one, else from sips. Output is a 512 short side, aspect ratio preserved (never upscaled —
    the 500x500 bulk of the pack stays 500) because `.game-card-image img` is `object-fit: cover`,
    so squashing a non-square thumbnail to a square would only distort it.
  * One asset per distinct source image, not per row: rows sharing a thumbnail (a `(Live)`/`(Lobby)`
    pair, the stake variants) all point at the same file instead of copying identical bytes.
  * Rows of EVERY status get art, not just 'active': the 'staged' rows are the ones that go live
    when Playtech clears the launcher block, and they should not need a second art pass then.

Requires cwebp (brew install webp) and macOS sips.
"""
import argparse, difflib, json, os, re, shutil, subprocess, sys, tempfile, textwrap
import unicodedata, zipfile

SIZE, QUALITY = 512, 82
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "pt")
URL_PREFIX = "/assets/games/pt"
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")

# Locale tails Playtech appends to a file stem. Only ever matched at the END of a stem.
LOCALES = {"en", "eng", "english", "enus", "engb", "cn", "zh", "zhcn", "zhtw", "tw", "hk", "chs",
           "cht", "jp", "ja", "kr", "ko", "th", "vn", "vi", "id", "ms", "my", "ru", "es", "pt",
           "ptbr", "br", "de", "fr", "it", "tr", "ar", "hi", "pl", "el", "ro", "bg", "cs", "sv",
           "nl", "fa", "bn"}
EN_LOCALES = {"en", "eng", "english", "enus", "engb"}
# CJK/Thai locale words the catalog spells natively and the pack spells in English.
CJK_WORDS = {"한국어": " korean ", "日本語": " japanese ", "日本语": " japanese ",
             "中文": " chinese ", "简体": " chinese ", "繁體": " chinese ",
             "ไทย": " thai "}
# Titles spell small numbers either way ("Furious Four" vs "Furious 4").
NUMBER_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
                "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"}
# One live table, two spellings of "roulette" across the catalog and the pack.
SYNONYMS = {"roleta": "roulette", "ruleta": "roulette"}
# Directories of marketing material, not entry thumbnails.
SKIP_DIR_WORDS = ("banner", "logo", "screenshot", "background", "promo", "psd", "source",
                  "video", "sound", "font", "wallpaper")
SIZE_TOKEN = re.compile(r"^\d{2,4}[x×*]\d{2,4}$", re.I)
TAIL_TOKEN = re.compile(r"[ _\-]+([0-9a-z]{2,9})$", re.I)

# Match strength, strongest first: exact code, exact name, name minus its tail, same token set,
# fuzzy, row-driven second pass. An override is hand-picked, so it outranks everything.
TIER_OVERRIDE, TIER_FUZZY, TIER_ROWPASS = -1, 4, 5

# Games the pack files somewhere no key reaches, keyed by catalog game_code. The value is a
# substring of the image path to use. Re-check these when a new pack lands.
OVERRIDES = {
    # The pack doubles the title on this one file, so no key reaches it.
    "aogs": "Slot/Age of the Gods Age of the Gods",
    "aogs_d": "Slot/Age of the Gods Age of the Gods",
    # Live variants the pack only ships art for under the base game's name.
    "ejpl": "Slot/Everybody's Jackpot_",
    "ejpl;ejl_everybodysjp": "Slot/Everybody's Jackpot_",
    "swle": "Live/Table/Spin A Win_",
    "bfbl;bfbl_liveslots": "Live/Table/Buffalo Blitz Live_",
    # Same table, words in a different order and minus "Jackpot".
    "aogfbjprol": "Live/Table/Age of the Gods Mega Fire Blaze Roulette Live",
}


def fold(s):
    """Accents to ASCII, CJK locale words to their English name."""
    for k, v in CJK_WORDS.items():
        s = s.replace(k, v)
    s = unicodedata.normalize("NFKD", s.replace("+", " plus "))
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", fold(s).lower().replace("&", " and "))


def tokens(s):
    """Sorted word set — the catalog and the pack often order a title differently.

    "Live" is dropped: the catalog moves it around and sometimes adds it ("Quantum Roulette Live"
    for the pack's "Quantum Roulette"), and inside a live-table name it carries no meaning.
    """
    ws = re.findall(r"[a-z0-9]+", fold(s).lower().replace("&", " and "))
    ws = (SYNONYMS.get(w, NUMBER_WORDS.get(w, w)) for w in ws if w != "live")
    return " ".join(sorted(ws))


def slug(code):
    return re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")


def base_name(n):
    """Catalog name minus the tails the pack never carries: `(Live)`, `$0.04 [frtf1]`."""
    n = re.sub(r"\s*\([^)]*\)\s*$", "", n)
    n = re.sub(r"\s*\$\s*[\d.]+\s*(?:\[[^\]]*\])?\s*$", "", n)
    return n.strip() or n


def qualifier(n):
    m = re.search(r"\(([^)]*)\)\s*$", n)
    return m.group(1) if m else ""


def split_stem(stem):
    """`Whack A Fluffy-1000x1000-en` -> ('Whack A Fluffy', (1000,1000), 'en').

    Pops size / locale tokens off the END only, and stops at the first token that is neither —
    a title ending in a short real word (`Rise of the Sun`) keeps it.
    """
    size, lang = None, None
    m = TAIL_TOKEN.search(stem)
    if m and m.group(1).lower() in LOCALES and not SIZE_TOKEN.match(m.group(1)):
        head = stem[:m.start()]
        n = TAIL_TOKEN.search(head)
        if n and SIZE_TOKEN.match(n.group(1)):      # ..._<size>_<lang>: a real locale tail
            lang = m.group(1).lower()
            stem = head
    while True:                                      # then any number of size tails
        m = TAIL_TOKEN.search(stem)
        if not m or not SIZE_TOKEN.match(m.group(1)):
            break
        w, h = re.split(r"[x×*]", m.group(1).lower())
        size = (int(w), int(h))
        stem = stem[:m.start()]
    return stem.strip(), size, lang


def lang_rank(path, lang):
    """0 = English (or unmarked), 1 = some other locale."""
    if lang:
        return 0 if lang in EN_LOCALES else 1
    segs = [s.lower() for s in path.split(os.sep)]
    return 1 if any(s in LOCALES and s not in EN_LOCALES for s in segs) else 0


def probe_size(path):
    """Actual pixel size via sips (macOS); (0, 0) if it cannot be read."""
    r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                       capture_output=True, text=True)
    d = dict(re.findall(r"(pixelWidth|pixelHeight):\s*(\d+)", r.stdout))
    return int(d.get("pixelWidth", 0)), int(d.get("pixelHeight", 0))


def size_rank(wh):
    """Smallest source that still covers a 512 short side; anything smaller is a last resort."""
    short = min(wh) if wh and all(wh) else 0
    return (0, short) if short >= SIZE else (1, -short)


def dir_rank(path, qual):
    """Per-game art beats the generic `Live/Lobby/` category tiles, except for '(Lobby)' rows."""
    segs = [s.lower() for s in path.split(os.sep)]
    lobby = "lobby" in segs
    if qual.lower() == "lobby":
        return 0 if lobby else 1
    return 1 if lobby else 0


def collect(root):
    """Every image in the pack -> {path, name, size, lang}."""
    out = []
    for dirpath, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if not d.startswith(("__MACOSX", "."))
                   and not any(w in d.lower() for w in SKIP_DIR_WORDS)]
        if any(w in os.path.basename(dirpath).lower() for w in SKIP_DIR_WORDS):
            continue
        for n in names:
            if not n.lower().endswith(IMG_EXT) or n.startswith("."):
                continue
            title, size, lang = split_stem(os.path.splitext(n)[0])
            out.append({"path": os.path.join(dirpath, n), "name": title,
                        "size": size, "lang": lang})
    return out


def index(catalog):
    """Match tiers, each mapping a key to every catalog row that answers to it."""
    code, name, base, tokd = {}, {}, {}, {}
    for g in catalog:
        for half in g["game_code"].split(";"):          # composite live-table codes
            code.setdefault(norm(half), []).append(g)
        b = base_name(g["name"])
        name.setdefault(norm(g["name"]), []).append(g)
        base.setdefault(norm(b), []).append(g)
        tokd.setdefault(tokens(b), []).append(g)
    return code, name, base, tokd


def match(images, catalog):
    """game_code -> [(tier, image)], plus the images that matched nothing.

    The tier is kept because a row can collect candidates from several images at different
    strengths, and the strongest must win: `Jade Speed Blackjack 2` is matched exactly by its own
    file AND loosely by `Jade Speed Blackjack`, and without the tier the tie-break would hand it
    the shorter path — i.e. game 1's artwork.
    """
    code, name, base, tokd = index(catalog)
    cand, leftover = {}, []
    for im in images:
        for tier, hit in enumerate((code.get(norm(im["name"])), name.get(norm(im["name"])),
                                    base.get(norm(im["name"])), tokd.get(tokens(im["name"])))):
            if hit:
                break
        else:
            hit = None
        if not hit:
            close = difflib.get_close_matches(norm(im["name"]), list(base), n=1, cutoff=0.9)
            hit, tier = (base[close[0]], TIER_FUZZY) if close else (None, None)
        if not hit:
            leftover.append(im)
            continue
        for g in hit:
            cand.setdefault(g["game_code"], []).append((tier, im))

    # Second pass, row-driven. An earlier tier claiming an image stops later tiers from ever
    # running, which strands rows that only answer to a looser key — the pack's "Roulette" is
    # taken by `Roulette (Live)` at the name tier, leaving `Roulette Live (Live)` with nothing.
    # Reporting-only side-bet rows (`... [abbj_bu]`, status='extra') are deliberately skipped:
    # they are never launchable and never rendered, so art on them is noise in the migration.
    by_norm, by_tok = {}, {}
    for im in images:
        by_norm.setdefault(norm(im["name"]), []).append(im)
        by_tok.setdefault(tokens(im["name"]), []).append(im)
    for g in catalog:
        if g["game_code"] in cand or re.search(r"\[[^\]]+\]\s*$", g["name"]):
            continue
        b = base_name(g["name"])
        hit = by_norm.get(norm(b)) or by_tok.get(tokens(b))
        if not hit:
            close = difflib.get_close_matches(norm(b), list(by_norm), n=1, cutoff=0.9)
            hit = by_norm[close[0]] if close else None
        if hit:
            cand[g["game_code"]] = [(TIER_ROWPASS, im) for im in hit]
    return cand, leftover


def choose(cands, qual):
    """Strongest match first, then English, per-game art over lobby tiles, smallest source >= 512."""
    for _, im in cands:
        if im["size"] is None:
            im["size"] = probe_size(im["path"])
    tier, im = min(cands, key=lambda c: (c[0], lang_rank(c[1]["path"], c[1]["lang"]),
                                         dir_rank(c[1]["path"], qual),
                                         size_rank(c[1]["size"]), len(c[1]["path"]), c[1]["path"]))
    return im


def convert(src, dst):
    # Real pixels only: a `1000x1000` in a name is the pack's nominal bucket, and PT's landscape
    # art can sit in it at other dimensions — trusting the token here would squash it.
    w, h = probe_size(src)
    short = min(w, h) if all((w, h)) else 0
    dims = []
    if short > SIZE:                                    # downscale only, ratio preserved
        scale = SIZE / short
        dims = ["-resize", str(round(w * scale)), str(round(h * scale))]
    r = subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), *dims, src, "-o", dst],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"cwebp failed for {src}: {r.stderr}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", help="the thumbnail pack (.zip) or an already-extracted directory")
    ap.add_argument("catalog", help="catalog.json: [{id, game_code, name}, ...]")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    catalog = json.load(open(args.catalog))
    by_code = {g["game_code"]: g for g in catalog}

    tmp, root = None, args.pack
    if os.path.isfile(args.pack):
        tmp = root = tempfile.mkdtemp(prefix="pticons-")
        with zipfile.ZipFile(args.pack) as z:
            for i in z.infolist():
                z.extract(i, root)
    try:
        images = collect(root)
        cand, leftover = match(images, catalog)
        for code, needle in OVERRIDES.items():
            hits = [(TIER_OVERRIDE, im) for im in images if needle in im["path"]]
            if hits:
                cand[code] = hits
                leftover = [im for im in leftover if (TIER_OVERRIDE, im) not in hits]

        print(f"pack {len(images)} images  catalog {len(catalog)}  matched {len(cand)} rows")
        for im in sorted(leftover, key=lambda i: i["path"]):
            print(f"  image with no catalog game: {os.path.relpath(im['path'], root)}")
        missing = [g for g in catalog if g["game_code"] not in cand]
        print(f"  catalog rows with NO art: {len(missing)}")
        for g in missing:
            print(f"    {g['game_code']}  {g['name']!r}")
        if args.dry_run:
            return

        os.makedirs(OUT_DIR, exist_ok=True)
        picks = {code: choose(ims, qualifier(by_code[code]["name"]))["path"]
                 for code, ims in cand.items()}
        # One asset per distinct source image; rows sharing a thumbnail share the URL.
        urls = {}
        for code in sorted(picks):
            src = picks[code]
            if src not in urls:
                name = slug(code) + ".webp"
                convert(src, os.path.join(OUT_DIR, name))
                urls[src] = f"{URL_PREFIX}/{name}"
        rows = [f"  ('{by_code[code]['id']}', '{urls[picks[code]]}')" for code in sorted(picks)]

        total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
        print(f"wrote {len(urls)} icons for {len(rows)} rows -> {OUT_DIR} ({total/1024/1024:.1f} MB)")

        if args.sql:
            extras = [g for g in missing if re.search(r"\[[^\]]+\]\s*$", g["name"])]
            bare = [g for g in missing if g not in extras]
            bare_list = textwrap.fill(", ".join(repr(g["name"]) for g in bare) + ".",
                                      width=94, initial_indent="--   ",
                                      subsequent_indent="--   ")
            header = f"""-- 13m Playtech: point every catalog row at its local game thumbnail.
--
-- Source: Playtech's own "Default Thumbnails" pack — SharePoint, Marketing Materials site,
-- `@Marketing Materials (Public)/Thumbnail (Game) 游戏入口图/Default Thumbnails`. That link is
-- tenant-authenticated (it 403s / bounces to login.microsoftonline.com for anyone outside
-- Playtech's tenant, and unlike the game-list xlsx of 000029 there is no anonymous share token
-- for it), so the folder was exported from a logged-in browser and handed over as a zip:
-- {len(images)} English PNGs, mostly 500x500, split Slot / Live Table / Live Lobby.
--
-- Generated by client-facing/scripts/import-pt-icons.py, which also holds the matching notes.
-- The pack names files by TITLE, not by game code, and the two spellings disagree constantly
-- (`Blackjack VZN 6` vs the pack's `VZN Blackjack 6`, `Speed Baccarat 한국어 2` vs
-- `Korean Speed Baccarat 2`), so matching runs in tiers: code, exact name, name minus its
-- `(Live)`/`(Lobby)`/`$0.04 [frtf1]` tail, same tokens in any order, then fuzzy.
--
-- {len(rows)} of {len(catalog)} pt rows get art, from {len(urls)} distinct images — rows share a
-- file wherever the catalog splits one game into a `(Live)` + `(Lobby)` pair or into stake
-- variants, rather than committing identical bytes twice. Each was re-encoded to WebP q82 at a
-- 512 short side, aspect ratio preserved and never upscaled (the pack's 500x500 bulk stays 500),
-- and committed under client-facing/public/assets/games/pt/<game_code>.webp.
--
-- image_url is a ROOT-RELATIVE path, not an absolute URL: the icons are served by the
-- client-facing Next.js app itself, so it stays correct across every host/tenant domain.
--
-- Not covered, deliberately: {len(extras)} reporting-only side-bet rows (`... [abbj_bu]`,
-- status='extra' since 000033) — Playtech never launches them and the lobby never renders them.
-- Not covered, because the pack ships no art for them: {len(bare)} rows
{bare_list}
-- Both keep image_url NULL and fall back to the UI's initial-letter placeholder.
--
-- Nothing resyncs this catalog — internal/pt never writes vendor_games, the rows come from
-- 000025/000029/000033 — so no upsert can clear image_url. Re-running is safe: the UPDATE is
-- guarded by IS DISTINCT FROM.

"""
            with open(args.sql, "w") as fh:
                fh.write(header
                         + "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
                         "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
                         + ",\n".join(rows)
                         + "\n  ) AS v(id, url)\n WHERE g.id = v.id\n"
                           "   AND g.vendor_id = 'pt'\n"
                           "   AND g.image_url IS DISTINCT FROM v.url;\n")
            print("wrote", args.sql)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
