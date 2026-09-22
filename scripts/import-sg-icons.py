#!/usr/bin/env python3
"""Import Spadegaming's game-icon art into public/assets/games/sg + emit the catalog SQL.

Spadegaming ships artwork as a Dropbox *folder link* holding ~37 GB of source material,
sorted into 1.NewGame / 2.Slot / 3.FishGame / 4.CrashGame, each with `500x500_PSD/`,
`1920x1080_PSD/` and `Game Materials/`. The `500x500_PSD` files are the square lobby tiles
we want; everything else (1920x1080 banners, the per-game "Game Materials" zips, promo
videos, certificates) is marketing material we do not ship.

    # crawl the share link, download just the 500x500 PSDs, convert, emit SQL
    python3 scripts/import-sg-icons.py --dropbox "https://www.dropbox.com/scl/fo/<key>/<hash>?rlkey=<rlkey>" \
        --psd-dir /tmp/sg-psd catalog.json --sql ../backend/services/simles/migrations/000041_sg_game_icons.up.sql

    # re-run against an already-downloaded PSD dir (skips the network entirely)
    python3 scripts/import-sg-icons.py --psd-dir /tmp/sg-psd catalog.json --sql ...

catalog.json is the catalog as the DB has it:

    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name)) from vendor_games where vendor_id='sg'" > catalog.json

Traps this encodes:

  * **Do not use `?dl=1` on the folder link.** Dropbox zips the whole 37 GB share on the fly
    at well under 1 MB/s. Walking the listing API and pulling only the 60 icon PSDs is the
    difference between ~8 GB and ~37 GB.
  * Dropbox's `list_shared_link_folder_entries` needs BOTH the subfolder's own `secure_hash`
    (from its entry `href`) AND `sub_path` set to the full path from the share root. Passing
    only one of the two is a 404.
  * The PSDs are layered masters, not flats — several are 500-950 MB for a 500x500 image.
    macOS `sips` reads the flattened composite, so no Photoshop/ImageMagick is needed.
  * The pack covers **60 of the 138 `sg` catalog rows** (the newer titles). Games with no PSD
    keep image_url NULL and fall back to the UI's initial-letter placeholder — that is the
    vendor's coverage, not a matching failure. Re-run when Spadegaming refreshes the share.
  * Asset file names use the catalog's `game_code` (e.g. `s-fo01.webp`); unlike PG SOFT,
    Spadegaming's `vendor_games.metadata` carries no slug.

Requires cwebp (brew install webp) and macOS sips.
"""
import argparse, difflib, json, os, re, shutil, subprocess, sys, tempfile
import urllib.parse, urllib.request, http.cookiejar

SIZE, QUALITY = 512, 82
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "sg")
URL_PREFIX = "/assets/games/sg"
ICON_DIR = "500x500_PSD"          # the only directory in the pack we pull
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")


# --------------------------------------------------------------------------- dropbox

class Share:
    """Read-only walker over a Dropbox shared-folder link."""

    def __init__(self, link):
        u = urllib.parse.urlparse(link)
        _, _, _, self.link_key, self.root_hash = u.path.split("/")[:5]
        self.rlkey = urllib.parse.parse_qs(u.query).get("rlkey", [""])[0]
        self.base = (f"https://www.dropbox.com/scl/fo/{self.link_key}/{self.root_hash}"
                     f"?rlkey={self.rlkey}&dl=0")
        cj = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        self.op.addheaders = [("User-Agent", UA)]
        self.op.open(self.base).read()
        self.tok = next(c.value for c in cj if c.name == "t")

    def ls(self, secure_hash, sub_path):
        body = urllib.parse.urlencode({
            "t": self.tok, "link_key": self.link_key, "link_type": "s",
            "secure_hash": secure_hash, "sub_path": sub_path, "rlkey": self.rlkey,
        }).encode()
        req = urllib.request.Request(
            "https://www.dropbox.com/list_shared_link_folder_entries", data=body,
            headers={"User-Agent": UA, "X-Requested-With": "XMLHttpRequest",
                     "Referer": self.base,
                     "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
        return json.loads(self.op.open(req).read()).get("entries", [])

    @staticmethod
    def _hash(href):
        return urllib.parse.urlparse(href).path.split("/")[4]

    def icons(self):
        """Every file under a 500x500_PSD directory, as (filename, download url)."""
        out = []
        for section in self.ls(self.root_hash, ""):
            if not section.get("is_dir"):
                continue
            spath = "/" + section["filename"]
            for sub in self.ls(self._hash(section["href"]), spath):
                if not sub.get("is_dir") or sub["filename"] != ICON_DIR:
                    continue
                ipath = f"{spath}/{ICON_DIR}"
                for f in self.ls(self._hash(sub["href"]), ipath):
                    if not f.get("is_dir"):
                        out.append((f["filename"],
                                    f["href"].replace("dl=0", "dl=1"),
                                    f.get("bytes", 0)))
        return out

    def fetch(self, url, dest):
        with self.op.open(urllib.request.Request(url, headers={"User-Agent": UA})) as r, \
                open(dest, "wb") as fh:
            shutil.copyfileobj(r, fh, 1 << 20)


# --------------------------------------------------------------------------- matching

def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("&", " and "))


def title_of(psd_name):
    """'Fiery_Sevens_Hot_20_500x500.psd' -> 'Fiery Sevens Hot 20'."""
    stem = os.path.splitext(psd_name)[0]
    stem = re.sub(r"[_ ]*500x500$", "", stem)
    return stem.replace("_", " ").strip()


def match(psds, catalog):
    by_norm = {}
    for g in catalog:
        by_norm.setdefault(norm(g["name"]), g)

    matched, leftover = {}, []
    for path in psds:
        t = norm(title_of(os.path.basename(path)))
        hit, how = by_norm.get(t), "name"
        if not hit:
            close = difflib.get_close_matches(t, list(by_norm), n=1, cutoff=0.86)
            hit, how = (by_norm[close[0]], "fuzzy:" + close[0]) if close else (None, "")
        if hit:
            matched.setdefault(hit["id"], (path, how))
        else:
            leftover.append(path)
    return matched, leftover


# --------------------------------------------------------------------------- convert

def to_webp(psd, dst):
    """Flatten the PSD composite and re-encode as a square WebP tile."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        png = tf.name
    try:
        r = subprocess.run(["sips", "-s", "format", "png", psd, "--out", png],
                           capture_output=True, text=True)
        if r.returncode or not os.path.getsize(png):
            return f"sips: {r.stderr.strip() or 'empty output'}"
        r = subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY),
                            "-resize", str(SIZE), str(SIZE), png, "-o", dst],
                           capture_output=True, text=True)
        return f"cwebp: {r.stderr.strip()}" if r.returncode else None
    finally:
        os.unlink(png)


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="catalog.json: [{id, game_code, name}, ...]")
    ap.add_argument("--psd-dir", required=True,
                    help="where the 500x500 PSDs live (and are downloaded to)")
    ap.add_argument("--dropbox", help="share link to pull missing PSDs from")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    catalog = json.load(open(args.catalog))
    os.makedirs(args.psd_dir, exist_ok=True)

    if args.dropbox:
        share = Share(args.dropbox)
        want = share.icons()
        print(f"share holds {len(want)} icon PSDs "
              f"({sum(b for _, _, b in want) / 2**30:.1f} GB)")
        for name, url, size in want:
            dest = os.path.join(args.psd_dir, name)
            if os.path.exists(dest) and os.path.getsize(dest) == size:
                continue
            print(f"  fetching {name} ({size / 2**20:.0f} MB)", flush=True)
            share.fetch(url, dest)

    psds = sorted(os.path.join(args.psd_dir, f) for f in os.listdir(args.psd_dir)
                  if f.lower().endswith(".psd"))
    matched, leftover = match(psds, catalog)
    by_id = {g["id"]: g for g in catalog}

    print(f"catalog {len(catalog)}  psds {len(psds)}  matched {len(matched)}")
    for gid, (_, how) in sorted(matched.items()):
        if how.startswith("fuzzy"):
            print(f"  fuzzy: {by_id[gid]['name']!r} <- {os.path.basename(matched[gid][0])!r}")
    for p in leftover:
        print(f"  psd with no catalog game: {os.path.basename(p)!r}")
    missing = [g for g in catalog if g["id"] not in matched]
    print(f"  {len(missing)} catalog games have no art in the pack")
    if args.dry_run:
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    for gid, (src, _) in sorted(matched.items()):
        slug = re.sub(r"[^a-z0-9]+", "-", by_id[gid]["game_code"].lower()).strip("-")
        dst = os.path.join(OUT_DIR, slug + ".webp")
        err = to_webp(src, dst)
        if err:
            sys.exit(f"{gid} ({os.path.basename(src)}): {err}")
        rows.append(f"  ('{gid}', '{URL_PREFIX}/{slug}.webp')")

    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"wrote {len(rows)} icons -> {OUT_DIR}  ({total / 2**20:.1f} MB)")

    if args.sql:
        with open(args.sql, "w") as fh:
            fh.write("ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
                     "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
                     + ",\n".join(rows)
                     + "\n  ) AS v(id, url)\n WHERE g.id = v.id\n"
                       "   AND g.vendor_id = 'sg'\n"
                       "   AND g.image_url IS DISTINCT FROM v.url;\n")
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
