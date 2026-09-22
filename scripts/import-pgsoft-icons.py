#!/usr/bin/env python3
"""Import PG SOFT's game-icon pack into public/assets/games/pgsoft + emit the catalog SQL.

PG ships artwork as a Dropbox folder ("PG Soft Game Icons"): one directory per game, named
"<English title> <Chinese title>", holding 1024x1024 app icons (square / rounded / iOS /
Android variants). This turns that pack into web assets and the UPDATE statement that points
vendor_games.image_url at them.

    # 1. grab the pack (any Dropbox folder link, ?dl=1 gives the whole folder as a zip)
    curl -L -o icons.zip "https://www.dropbox.com/scl/fo/.../PG%20Soft%20Game%20Icons?dl=1&rlkey=..."
    # 2. the catalog, as the DB has it
    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name,'slug',metadata->>'gameCode'))
        from vendor_games where vendor_id='pgsoft'" > catalog.json
    # 3. import
    python3 scripts/import-pgsoft-icons.py icons.zip catalog.json --sql 000040_pg_icons.up.sql

Games are matched to catalog rows by normalised English title first, then by PG's own game
slug (metadata->>'gameCode', which the icon FILE names usually carry), then by close-match as
a last resort. Anything left over is printed — it is meant to be read, not ignored: the pack
misspells some titles and occasionally files one game's art inside another game's folder.

Requires cwebp (brew install webp).
"""
import argparse, difflib, json, os, re, shutil, subprocess, sys, tempfile, unicodedata, zipfile

SIZE, QUALITY = 512, 82
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "pgsoft")
URL_PREFIX = "/assets/games/pgsoft"
# Directories of marketing material, not app icons.
SKIP_DIR_WORDS = ("promotion", "screenshot", "background", "banner", "logo")

# Games the pack files somewhere the matcher cannot reach, keyed by catalog id. The value is a
# substring of the icon path to use. Re-check these when a new pack lands.
OVERRIDES = {
    # The "Medusa" folder also carries a stray Medusa_II file; the Android one is the real
    # Medusa 1 art, so match on it explicitly rather than by rank.
    "pg-7": "Medusa_Android",
    "pg-6": "Medusa 2",           # folder name omits the catalog's ": The Quest of Perseus"
    "pg-1508783": "wild-ape",     # shipped inside a generic "App Icons" folder
}


def strip_cjk(s):
    return "".join(c for c in s
                   if not (unicodedata.category(c) == "Lo" and ord(c) > 0x2E80))


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", strip_cjk(s).lower().replace("&", " and "))


def rank(f):
    """Icon variant preference: a square app icon crops best into a game card."""
    n = os.path.basename(f).lower()
    for i, w in enumerate(("square", "ios", "android", "rounded")):
        if w in n:
            return i
    return 4


def collect_icons(root):
    """Every directory holding icon images -> (folder name, chosen file, slugs seen)."""
    icons = []
    for dirpath, dirs, files in os.walk(root):
        if any(w in os.path.basename(dirpath).lower() for w in SKIP_DIR_WORDS):
            dirs[:] = []
            continue
        imgs = [f for f in files if f.lower().endswith((".png", ".jpg"))]
        if not imgs:
            continue
        slugs = set()
        for f in imgs:
            stem = os.path.splitext(f)[0].lower()
            stem = re.split(r"_(icon|app-?icon|square|rounded|ios|android|1024)", stem)[0]
            slugs.add(re.sub(r"[^a-z0-9]+", "", stem))
        best = sorted(imgs, key=lambda f: (rank(f), f))[0]
        icons.append({"folder": os.path.basename(dirpath),
                      "file": os.path.join(dirpath, best),
                      "all": [os.path.join(dirpath, f) for f in imgs],
                      "slugs": slugs, "norm": norm(os.path.basename(dirpath))})
    return icons


def match(icons, catalog):
    by_norm, by_slug = {}, {}
    for g in catalog:
        by_norm.setdefault(norm(g["name"]), g)
        if g.get("slug"):
            by_slug.setdefault(re.sub(r"[^a-z0-9]+", "", g["slug"].lower()), g)

    matched, leftover = {}, []
    for ic in icons:
        hit = by_norm.get(ic["norm"]) or next(
            (by_slug[s] for s in ic["slugs"] if s in by_slug), None)
        how = "name/slug"
        if not hit:
            close = difflib.get_close_matches(ic["norm"], list(by_norm), n=1, cutoff=0.86)
            hit, how = (by_norm[close[0]], "fuzzy:" + close[0]) if close else (None, "")
        if hit:
            matched.setdefault(hit["id"], (ic["file"], how, ic["folder"]))
        else:
            leftover.append(ic)

    # Overrides win over whatever the matcher picked.
    for gid, needle in OVERRIDES.items():
        for ic in icons:
            hits = sorted((p for p in ic["all"] if needle in p), key=rank)
            if hits:
                matched[gid] = (hits[0], "override", ic["folder"])
                # An overridden folder is accounted for — keep it out of the leftover report.
                leftover = [x for x in leftover if x is not ic]
                break
    return matched, leftover


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", help="the icon pack (.zip) or an already-extracted directory")
    ap.add_argument("catalog", help="catalog.json: [{id, game_code, name, slug}, ...]")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    catalog = json.load(open(args.catalog))

    tmp = None
    root = args.zip
    if os.path.isfile(args.zip):
        tmp = tempfile.mkdtemp(prefix="pgicons-")
        zipfile.ZipFile(args.zip).extractall(tmp)
        root = tmp
    try:
        matched, leftover = match(collect_icons(root), catalog)
        by_id = {g["id"]: g for g in catalog}

        print(f"catalog {len(catalog)}  matched {len(matched)}")
        for gid, (_, how, folder) in sorted(matched.items()):
            if how.startswith("fuzzy"):
                print(f"  fuzzy: {by_id[gid]['name']!r} <- {folder!r}")
        for ic in leftover:
            print(f"  icon with no catalog game: {ic['folder']!r}")
        for g in catalog:
            if g["id"] not in matched:
                print(f"  catalog game with NO icon: {g['id']} {g['name']!r}")
        if args.dry_run:
            return

        os.makedirs(OUT_DIR, exist_ok=True)
        rows = []
        for gid, (src, _, _) in sorted(matched.items()):
            g = by_id[gid]
            slug = re.sub(r"[^a-z0-9]+", "-", (g.get("slug") or g["game_code"]).lower()).strip("-")
            dst = os.path.join(OUT_DIR, slug + ".webp")
            r = subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY),
                                "-resize", str(SIZE), str(SIZE), src, "-o", dst],
                               capture_output=True, text=True)
            if r.returncode:
                sys.exit(f"cwebp failed for {gid}: {r.stderr}")
            rows.append(f"  ('{gid}', '{URL_PREFIX}/{slug}.webp')")

        total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
        print(f"wrote {len(rows)} icons -> {OUT_DIR}  ({total/1024/1024:.1f} MB)")

        if args.sql:
            with open(args.sql, "w") as fh:
                fh.write("ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
                         "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
                         + ",\n".join(rows)
                         + "\n  ) AS v(id, url)\n WHERE g.id = v.id\n"
                           "   AND g.vendor_id = 'pgsoft'\n"
                           "   AND g.image_url IS DISTINCT FROM v.url;\n")
            print("wrote", args.sql)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
