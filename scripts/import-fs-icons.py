#!/usr/bin/env python3
"""Import Fastspin's game-icon art into public/assets/games/fs + emit the catalog SQL.

Fastspin (`fs`) is Spadegaming's other brand, but its art pack is a completely different
shape from the one `import-sg-icons.py` walks. Instead of one `500x500_PSD` folder per game
category, the share is organised **by size and language** — `1.NewGame/332x460_EN`,
`2.SlotGame/1000x1000_CN`, ... — each a flat pile of per-game files, the way CQ9's pack is.
So the game is identified by the *file name*, and the same game appears in ~30 size folders.

    # crawl the share, download the best tile per game, convert, emit SQL
    python3 scripts/import-fs-icons.py --dropbox "https://www.dropbox.com/scl/fo/<key>/<hash>?rlkey=<rlkey>" \
        --art-dir /tmp/fs-art catalog.json --sql ../backend/services/simles/migrations/000067_fs_game_icons.up.sql

    # re-run off the cached listing / already-downloaded files (no network)
    python3 scripts/import-fs-icons.py --art-dir /tmp/fs-art catalog.json --dry-run

catalog.json is the catalog as the DB has it:

    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name)) from vendor_games where vendor_id='fs'" > catalog.json

Traps this encodes:

  * **`?dl=1` on a per-FILE href now serves the SPA shell**, not the bytes — a ~215 KB HTML
    page that a naive downloader writes out as "the png" (every file the same size, and
    `sips` refuses them). `raw=1` is the form that returns bytes.
  * **The listing endpoint pages on `next_request_voucher`, which must be sent back as
    `voucher`.** Reading `voucher` off the response (as the older sg importer did) re-requests
    page 1 forever; sg's folders just happened to fit in one page.
  * Dropbox **slow-rolls** `list_shared_link_folder_entries` after ~25 calls on one cookie
    jar. A socket timeout never fires on a drip-fed body, so the crawl hangs; hence curl with
    a wall-clock `--max-time` and a fresh jar every 25 calls.
  * ⭐ **The `180x235` folders spell the size with a mojibake multiplication sign**
    (`img_fastspin_180<C3><A2>...235_the_maya_myth_en.jpg`), so a `\d+x\d+` size-token filter
    misses it and every one of those files keys as "180235<title>".
  * ⭐ **The size folders are not the same art at different resolutions.** `332x460` is the
    clean lobby tile; every other portrait size (400x540, 336x450, 200x290, 200x270, ...)
    and every square (500x500, 1000x1000) is a **max-win promo** cut — the same key art
    with a red "25000X" ribbon across a corner, plus a gold picture frame above 336x450 —
    and `540x740` is hero/banner art with a third of the canvas left empty for copy. Picking
    "the biggest file" gets you a lobby full of promo badges. 332x460 alone covers every
    game in the catalog, so there is no fallback: a game missing from it is reported.
  * ⭐ **Three different "not the plain tile" markers, and they do not mean the same thing in
    both sections.** In `2.SlotGame` the bare file is the clean unbranded full-bleed tile and
    `_b_` has the FASTSPIN wordmark baked in. In `1.NewGame` *everything* carries the wordmark
    and the bare file has a light rounded **frame border** while `_f_` is the frameless
    full-bleed cut — so there `_f_` is the one to take. `circle` is a round sticker on
    transparency (the CQ9 `角標` / AWC `*_circular_*` trap) and is never selected.
  * `QQ288`/`home` in a file name are an operator-branded and a lobby-hero cut of the same art.
  * Nine games are keyed by **game code** (`S-GG03`, `S-SS03`, `S-VH01`) rather than title,
    and the pack misspells several titles (`apolo_ray_of_luck`, `mushromm_bandit`,
    `the_nutcrackerse`, `goldrush_cowboy` for our "Gold Rush Cowboys").
  * ⭐ **Fortune Jewels I/II/III are three separate catalog rows** and the pack spells them
    `Fortune Jewels` / `Fortune Jewels II` / `Fortune Jewels 3` in most folders and
    `..._I/_II/_III` in the 180x235 ones. Roman numerals are folded to digits and a bare title
    is treated as "1", so all three land correctly; fuzzy matching is then forbidden from
    crossing a differing numeral, or `Fortune Jewels 3` would fuzz onto Fortune Jewels I.
  * The pack has **no Indonesian art** — only EN and CN — so every tile ships the English
    logotype. Worth asking Fastspin for an `id` cut, as with CQ9, Naga and Habanero.
  * `fs-lobby` (game_code `FS`) is a brand entry, not a game; it stays NULL and falls back to
    the UI's initial-letter placeholder, like `ds-lobby` and `habanero-lobby`.

Requires cwebp (brew install webp), macOS sips, and curl.
"""
import argparse, collections, difflib, json, os, re, shutil, subprocess, sys, tempfile
import urllib.parse

SIZE, QUALITY = 512, 82
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "fs")
URL_PREFIX = "/assets/games/fs"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")
ENDPOINT = "https://www.dropbox.com/list_shared_link_folder_entries"
IMG_EXT = (".png", ".jpg", ".jpeg")

# folders that hold marketing masters / per-game source zips, never lobby tiles
PRUNE_PREFIX = ("/4.Fastspin Media",)
PRUNE_NAME = ("Game Materials",)


# --------------------------------------------------------------------------- dropbox

class Share:
    """Read-only walker over a public Dropbox shared-folder link, driven by curl.

    curl rather than urllib because Dropbox answers a throttled session by *slow-rolling*
    the body: urllib's `timeout=` is per socket read, so a drip-fed response never trips it
    and the crawl hangs forever. `--max-time` bounds the whole transfer instead.
    """

    def __init__(self, link, max_time=45):
        u = urllib.parse.urlparse(link)
        _, _, _, self.link_key, self.root_hash = u.path.split("/")[:5]
        self.rlkey = urllib.parse.parse_qs(u.query).get("rlkey", [""])[0]
        self.base = (f"https://www.dropbox.com/scl/fo/{self.link_key}/{self.root_hash}"
                     f"?rlkey={self.rlkey}&dl=0")
        self.max_time = max_time
        self.jar = tempfile.mktemp(suffix=".cookies")
        self._session()

    def _session(self):
        if os.path.exists(self.jar):
            os.unlink(self.jar)
        subprocess.run(["curl", "-s", "-c", self.jar, "-A", UA, self.base, "-o", os.devnull],
                       check=True, timeout=60)
        self.tok = ""
        for line in open(self.jar):
            f = line.split("\t")
            if len(f) >= 7 and f[5] == "t":
                self.tok = f[6].strip()
        if not self.tok:
            raise RuntimeError("no CSRF cookie on the share link")
        self.calls = 0

    def _post(self, form):
        args = ["curl", "-s", "--max-time", str(self.max_time), "-b", self.jar, "-c", self.jar,
                "-A", UA, "-H", "X-Requested-With: XMLHttpRequest", "-H", f"Referer: {self.base}",
                "-w", "\n%{http_code}"]
        for k, v in form.items():
            args += ["-d", f"{k}={urllib.parse.quote(str(v), safe='')}"]
        args.append(ENDPOINT)
        for attempt in range(5):
            r = subprocess.run(args, capture_output=True, text=True, timeout=self.max_time + 20)
            body, _, code = r.stdout.rpartition("\n")
            if code == "200":
                self.calls += 1
                return json.loads(body)
            if code in ("403", "404"):
                raise RuntimeError(f"HTTP {code} listing {form.get('sub_path')!r}")
            print(f"    ! http={code or 'timeout'}, new session (attempt {attempt + 1})",
                  file=sys.stderr, flush=True)
            self._session()
            form["t"] = self.tok
        raise RuntimeError(f"gave up listing {form.get('sub_path')!r}")

    def ls(self, secure_hash, sub_path):
        if self.calls >= 25:                 # rotate before the slow-roll kicks in
            self._session()
        out, voucher = [], None
        while True:
            form = {"t": self.tok, "link_key": self.link_key, "link_type": "s",
                    "secure_hash": secure_hash, "sub_path": sub_path, "rlkey": self.rlkey}
            if voucher:
                form["voucher"] = voucher
            d = self._post(form)
            out += d.get("entries", [])
            # the continuation token comes back as `next_request_voucher` and is SENT as
            # `voucher`; reading `voucher` off the response pages forever on page 1
            voucher = d.get("next_request_voucher")
            if not d.get("has_more_entries") or not voucher:
                return out

    @staticmethod
    def hash_of(href):
        return urllib.parse.urlparse(href).path.split("/")[4]

    def tree(self, cache):
        """Walk the whole share into {folder path: [entry]}, resuming from `cache`."""
        done = json.load(open(cache)) if cache and os.path.exists(cache) else {}
        queue, seen = [(self.root_hash, "")], set()
        while queue:
            h, path = queue.pop(0)
            if path in seen:
                continue
            seen.add(path)
            if path not in done:
                print(f"  ls {path or '/'}", flush=True)
                done[path] = [{"filename": e["filename"], "is_dir": bool(e.get("is_dir")),
                               "bytes": e.get("bytes", 0), "href": e["href"]}
                              for e in self.ls(h, path)]
                if cache:
                    json.dump(done, open(cache, "w"))
            for e in done[path]:
                p = f"{path}/{e['filename']}"
                if (e["is_dir"] and e["filename"] not in PRUNE_NAME
                        and not any(p.startswith(x) for x in PRUNE_PREFIX)):
                    queue.append((self.hash_of(e["href"]), p))
        return done

    def fetch(self, href, dest):
        # `dl=1` on a per-file href inside a folder share serves the SPA shell; `raw=1` the bytes
        r = subprocess.run(["curl", "-sL", "--max-time", "300", "-b", self.jar, "-A", UA,
                            href.replace("dl=0", "raw=1"), "-o", dest,
                            "-w", "%{http_code} %{content_type}"],
                           capture_output=True, text=True, timeout=330)
        code, _, ctype = r.stdout.strip().partition(" ")
        if code != "200" or "html" in ctype:
            raise RuntimeError(f"download gave {code} {ctype}")


# --------------------------------------------------------------------------- matching

# tokens that describe the cut, the brand or the language rather than the game
DROP = {"img", "fs", "fastspin", "square", "circle", "frame", "b", "f", "min",
        "qq288", "home", "logo", "icon"}
LANG_TOK = re.compile(r"^(en|cn|zh|th|vn|kr|jp|id)\d*$")
ROMAN = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5"}


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def fold(key):
    """Fold a trailing roman numeral to a digit so 'fortunejewelsii' == 'fortunejewels2'."""
    m = re.match(r"^(.*?)(i{1,3}|iv|v)$", key)
    if m and m.group(1):
        return m.group(1) + ROMAN[m.group(2)]
    return key


def numeral(key):
    """Trailing sequel number, with a bare title counting as 1 ('Fortune Jewels' == I)."""
    m = re.search(r"(\d+)$", fold(key))
    return m.group(1) if m else "1"


def parse(filename, w, h):
    """Pack file name -> (game key, {flags}); None if it carries no game name."""
    stem = os.path.splitext(filename)[0]
    # strip the size however it is written: 332x460, 332X460, 332×460 and the mojibake
    # '180├ù235' the 180x235 folders ship, plus the bare concatenation left behind
    stem = re.sub(rf"{w}\s*[^0-9a-zA-Z]{{0,4}}\s*{h}", " ", stem)
    flags = set()
    keep = []
    for t in re.split(r"[_\s\-]+", stem):
        lt = norm(t)
        if not lt:
            continue
        if lt == "circle":
            flags.add("circle")
        if lt == "frame":
            flags.add("framed")
        if lt == "b":
            flags.add("branded")
        if lt == "f":
            flags.add("frameless")
        if lt == "qq288":
            flags.add("partner")
        if lt in DROP or LANG_TOK.match(lt) or re.fullmatch(r"\d+x\d+", lt):
            continue
        keep.append(lt)
    key = fold("".join(keep))
    return (key, flags) if key else None


def index(tree):
    """Every per-game image in the pack, keyed by folded game key."""
    out = collections.defaultdict(list)
    for path, entries in tree.items():
        m = re.match(r"^/(\d\.[^/]+)/(\d+)x(\d+)_(CN|EN)$", path)
        if not m:
            continue
        sec, w, h, lang = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        for e in entries:
            if e["is_dir"] or not e["filename"].lower().endswith(IMG_EXT):
                continue
            p = parse(e["filename"], w, h)
            if not p:
                continue
            key, flags = p
            out[key].append({"key": key, "sec": sec, "w": w, "h": h, "lang": lang,
                             "flags": flags, "name": e["filename"], "href": e["href"],
                             "path": path})
    # in 1.NewGame the bare file is the FRAMED cut and `_f_` the frameless one, so a bare
    # file is only "clean" when no `_f_` sibling exists for the same game/size/language
    has_f = {(c["key"], c["w"], c["h"], c["lang"])
             for cs in out.values() for c in cs if "frameless" in c["flags"]}
    for cs in out.values():
        for c in cs:
            if ("frameless" not in c["flags"]
                    and (c["key"], c["w"], c["h"], c["lang"]) in has_f):
                c["flags"].add("framed")
    return out


def match(idx, catalog):
    """catalog id -> [candidate images]."""
    by_name, by_code = {}, {}
    for g in catalog:
        by_name.setdefault(fold(norm(g["name"])), g)
        by_code.setdefault(norm(g["game_code"]), g)

    hits, orphans = collections.defaultdict(list), {}
    for key, cands in idx.items():
        g = by_name.get(key) or by_code.get(key)
        if not g:
            # a bare title is that family's "1": 'fortunejewels' -> 'fortunejewels1'
            g = by_name.get(key + "1") or by_name.get(re.sub(r"1$", "", key))
        if not g:
            close = difflib.get_close_matches(key, list(by_name), n=1, cutoff=0.85)
            # never let fuzz cross a sequel number, or 'Fortune Jewels 3' lands on I
            if close and numeral(close[0]) == numeral(key):
                g = by_name[close[0]]
        if g:
            hits[g["id"]] += cands
        else:
            orphans[key] = len(cands)
    return hits, orphans


# --------------------------------------------------------------------------- ranking

# ⭐ 332x460 is the ONLY clean cut in the pack. Every other portrait size (400x540,
# 336x450, 200x270, ...) and every square (500x500, 1000x1000) is a *max-win promo* cut:
# the same key art with a red "25000X" ribbon across the corner and, above 336x450, a gold
# picture frame. 540x740 is hero/banner art with a third of the frame left empty for
# copy. Since 332x460 on its own covers every game in the catalog there is no reason to
# fall back onto a badged tile — a game missing from it is reported instead.
TILE = (332, 460)


def rank(c):
    return (0 if c["lang"] == "EN" else 1,       # English logotype is baked into the art
            1 if "framed" in c["flags"] else 0,  # 1.NewGame's bare cut has a border
            1 if "branded" in c["flags"] else 0,  # `_b_` bakes in the FASTSPIN wordmark
            1 if "partner" in c["flags"] else 0,  # QQ288-branded cut
            c["name"])


def choose(cands):
    usable = [c for c in cands
              if (c["w"], c["h"]) == TILE and "circle" not in c["flags"]]
    return min(usable, key=rank) if usable else None


# --------------------------------------------------------------------------- convert

def to_webp(src, dst):
    """Re-encode to a WebP tile, downscaling only if the source is larger than SIZE."""
    png = src
    tmp = None
    if not src.lower().endswith(".png"):
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
        r = subprocess.run(["sips", "-s", "format", "png", src, "--out", tmp],
                           capture_output=True, text=True)
        if r.returncode or not os.path.getsize(tmp):
            return f"sips: {r.stderr.strip() or 'empty output'}"
        png = tmp
    try:
        w, h = dimensions(png)
        args = ["cwebp", "-quiet", "-q", str(QUALITY)]
        if min(w, h) > SIZE:
            args += ["-resize", str(SIZE), "0"] if w <= h else ["-resize", "0", str(SIZE)]
        r = subprocess.run(args + [png, "-o", dst], capture_output=True, text=True)
        return f"cwebp: {r.stderr.strip()}" if r.returncode else None
    finally:
        if tmp:
            os.unlink(tmp)


def dimensions(path):
    r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                       capture_output=True, text=True)
    d = dict(re.findall(r"(pixelWidth|pixelHeight):\s*(\d+)", r.stdout))
    return int(d.get("pixelWidth", 0)), int(d.get("pixelHeight", 0))


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="catalog.json: [{id, game_code, name}, ...]")
    ap.add_argument("--art-dir", required=True, help="where pack files are downloaded to")
    ap.add_argument("--dropbox", help="share link to crawl")
    ap.add_argument("--tree", help="listing cache (default: <art-dir>/tree.json)")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    catalog = json.load(open(args.catalog))
    os.makedirs(args.art_dir, exist_ok=True)
    cache = args.tree or os.path.join(args.art_dir, "tree.json")

    share = Share(args.dropbox) if args.dropbox else None
    if share:
        tree = share.tree(cache)
    elif os.path.exists(cache):
        tree = json.load(open(cache))
    else:
        sys.exit(f"no listing at {cache}; pass --dropbox to crawl the share")

    idx = index(tree)
    hits, orphans = match(idx, catalog)
    by_id = {g["id"]: g for g in catalog}
    picks = {gid: choose(cs) for gid, cs in hits.items()}
    picks = {gid: c for gid, c in picks.items() if c}

    print(f"pack {sum(len(v) for v in idx.values())} images / {len(idx)} keys   "
          f"catalog {len(catalog)}   matched {len(picks)}")
    for gid, c in sorted(picks.items()):
        print(f"  {by_id[gid]['game_code']:8s} {by_id[gid]['name'][:28]:30s} "
              f"{c['w']}x{c['h']}_{c['lang']}  {c['name']}")
    for g in catalog:
        if g["id"] not in picks:
            print(f"  NO ART  {g['game_code']:8s} {g['name']}")
    for k, n in sorted(orphans.items()):
        print(f"  pack key with no catalog game: {k!r} ({n} images)")
    if args.dry_run:
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    rows = []
    for gid, c in sorted(picks.items()):
        # cache under the FULL pack path: the same file name lives in ~30 size folders
        src = os.path.join(args.art_dir,
                           f"{c['path'].strip('/').replace('/', '__')}__{c['name']}")
        if not os.path.exists(src) or not os.path.getsize(src):
            if not share:
                sys.exit(f"{src} not downloaded yet; pass --dropbox")
            print(f"  fetching {c['name']}", flush=True)
            share.fetch(c["href"], src)
        slug = re.sub(r"[^a-z0-9]+", "-", by_id[gid]["game_code"].lower()).strip("-")
        dst = os.path.join(OUT_DIR, slug + ".webp")
        err = to_webp(src, dst)
        if err:
            sys.exit(f"{gid} ({c['name']}): {err}")
        rows.append(f"  ('{gid}', '{URL_PREFIX}/{slug}.webp')")

    total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
    print(f"wrote {len(rows)} icons -> {OUT_DIR}  ({total / 2**20:.1f} MB)")

    if args.sql:
        with open(args.sql, "w") as fh:
            fh.write("ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
                     "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
                     + ",\n".join(rows)
                     + "\n  ) AS v(id, url)\n WHERE g.id = v.id\n"
                       "   AND g.vendor_id = 'fs'\n"
                       "   AND g.image_url IS DISTINCT FROM v.url;\n")
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
