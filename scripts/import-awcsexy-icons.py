#!/usr/bin/env python3
"""Import AWC SEXY's (SEXYBCRT) game icons into public/assets/games/awcsexy + emit the SQL.

The sister agent's art arrives as a **public Dropbox shared folder** rather than NLC's Google
Drive pack (import-awc-icons.py), one folder per SEXYBCRT title:

    /MX-LIVE-006 DragonTiger/DragonTiger.png          <- the lobby tile: 348x462, EN, portrait

    # crawl the share, download, convert, write the assets + the migration
    python3 scripts/import-awcsexy-icons.py \
        ../backend/services/simles/migrations/000060_awcsexy_catalog.up.sql \
        --manifest /tmp/awcsexy-tree.json \
        --sql ../backend/services/simles/migrations/000061_awcsexy_game_icons.up.sql

    # see what resolves before writing anything (also caches the crawl)
    python3 scripts/import-awcsexy-icons.py <catalog> --manifest /tmp/awcsexy-tree.json --dry-run

The catalog argument takes `000060_awcsexy_catalog.up.sql` or a psql dump of `vendor_games` —
anything carrying `game_code`, `name` and `metadata.nameCn`, because the share is keyed by TITLE
(and, for the CN pack, by the CHINESE title) and only the catalog knows the `MX-LIVE-nnn`.

What this encodes:

  * ⭐ **Dropbox's SPA renders nothing a fetch can read**, and `?dl=1` on the folder is a
    **10.3 GB** zip (the share is mostly `.psd`/`.psb`/`.zip` masters) that ignores Range
    requests. The tree is walked through the endpoint the web client itself calls,
    `POST /list_shared_link_folder_entries`, seeded with the `t` CSRF cookie the share page sets.
  * ⭐ **Each subfolder mints its OWN `secure_hash`, and needs BOTH halves.** The root hash with a
    `sub_path` 404s; a subfolder's hash with an empty `sub_path` 404s too. Both are read off the
    `href` the listing hands back: `/scl/fo/<link_key>/<secure_hash>/<url-encoded sub_path>`.
  * ⭐ **PORTRAIT, not square.** `.game-card` is `aspect-ratio: 3/4` + `object-fit: cover`
    (client-facing/src/styles/portal/_game-card.scss) and SEXY ships a tile drawn for exactly
    that shape: `<TitleNoSpaces>.png` at 348x462, full-bleed art with the English logotype and
    the Sexy wordmark baked in. Five of the nine titles have one.
  * ⭐ **`<Title> C01.png` / `<Title> 71.png` (800x800) are per-TABLE tiles, not game tiles** —
    the table number is baked into the logotype ("ROULETTE 71", "SEDIE C151"), so using one
    labels the lobby card with a table that player may never be seated at. Excluded by name;
    this is NLC's `*_circular_*` trap in another costume.
  * **The square that IS usable is `<Title>(NEW).png`** — 2168x2168 full-bleed art, English
    logotype, subject and text both centred, so a 3/4 cover-crop keeps them. It is the fallback
    for the three titles with no portrait, downscaled to SIZE.
  * ⭐ **`CN_橫式素材/` is LANDSCAPE and CHINESE** (430x300, "橫式" = horizontal). Cover-cropped
    into a 3/4 card it throws away half the width, so it is the LAST resort — reached only by
    `MX-LIVE-002 Baccarat`, which has no folder of its own in the share. It is matched by the
    catalog's own `metadata.nameCn` (`百家乐`), an exact vendor-supplied string, never guessed.
  * **The share is SEXYBCRT only.** `SV-LIVE-001/003` (SV388 cockfight) have no art anywhere in
    it — they stay NULL and the UI falls back to the initial-letter placeholder. Ask AWC for the
    SV388 share. The share also carries `MX-LIVE-019 EXTRA Roulette`, which our catalog does not
    sell — skipped and reported.
  * **Idempotent and resync-safe**: the SQL keys on `game_code` and only touches rows whose
    image_url differs. Re-running overwrites the same assets byte-for-byte.
  * ⚠️ The download cache is keyed by a HASH of the path, not a slugged path: slugging strips CJK
    and every `CN_橫式素材/PNG/430x300/*.png` collapses onto one filename and overwrites itself.

Requires cwebp (brew install webp); sips (macOS) measures and downscales.
"""
import argparse, concurrent.futures, hashlib, json, os, re, subprocess, sys, tempfile, threading
import time, urllib.parse, urllib.request, http.cookiejar

# The public share AWC handed over (2026-08-25). Pass --link if they ever reissue it.
DEFAULT_LINK = ("https://www.dropbox.com/scl/fo/4t11gkjf6icw4f7uz671h/"
                "AJLPNEpImJCffPPRwORqUPM?rlkey=c8auy8efmmt9td88je6lh20ld")

SIZE, QUALITY = 512, 82        # SIZE = short-side CEILING, never a target to upscale to
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "awcsexy")
URL_PREFIX = "/assets/games/awcsexy"
TIMEOUT = 180
WORKERS = 6
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

LIST_EP = "https://www.dropbox.com/list_shared_link_folder_entries"

# Only these are tiles. The share's bulk is .psd/.psb/.zip/.ai masters and .gif teasers.
IS_IMAGE = re.compile(r"\.(png|jpe?g)$", re.I)

# ⭐ Per-TABLE tiles: "Roulette 71", "Sedie C151", "Baccarat C01", "2. Korea Baccarat C11".
# The table id is baked into the artwork's logotype, so none of these name a GAME.
TABLE_TILE = re.compile(r"(?:\bC\d{1,3}|\s\d{1,3})(?:\s*\(.*\))?\.(png|jpe?g)$", re.I)
KOREA = re.compile(r"\bkorea\b", re.I)

# Finder/Explorer litter.
IGNORE = re.compile(r"^(\.|~\$)|^Thumbs\.db$", re.I)

# Aggregate/brand folders at the share root — banners, logos, dealer headshots, the CN pack.
NOT_A_GAME = re.compile(r"^_|^(Ad-hoc Requests|Lobby Image)$")
CN_PACK = "CN_橫式素材"

# Shape buckets, by width/height. The card is 3/4 = 0.75.
PORTRAIT = (0.60, 0.85)
SQUARE = (0.85, 1.20)

# A tile is accepted once sips confirms this much short side.
MIN_SHORT = 200

_lock = threading.Lock()


# ---------------------------------------------------------------- Dropbox (the SPA's own API)

class Share:
    """A public Dropbox folder share, walked through the endpoint its web client calls."""

    def __init__(self, link):
        u = urllib.parse.urlparse(link)
        parts = u.path.split("/")
        if len(parts) < 5 or parts[1:3] != ["scl", "fo"]:
            sys.exit("not a Dropbox folder share link: %s" % link)
        self.link_key, self.secure_hash = parts[3], parts[4]
        self.rlkey = urllib.parse.parse_qs(u.query).get("rlkey", [""])[0]
        self.base = "https://www.dropbox.com/scl/fo/%s/%s?rlkey=%s" % (
            self.link_key, self.secure_hash, self.rlkey)
        jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        self.op.addheaders = [("User-Agent", UA)]
        self.op.open(self.base + "&dl=0", timeout=TIMEOUT).read()   # sets the `t` CSRF cookie
        try:
            self.t = next(c.value for c in jar if c.name == "t")
        except StopIteration:
            sys.exit("Dropbox did not set the `t` CSRF cookie — the share may have expired")

    def listdir(self, node, tries=4):
        """node = (secure_hash, sub_path); BOTH are required (see the module docstring)."""
        secure_hash, sub_path = node
        out, voucher = [], None
        for _ in range(200):                       # page through; guard against a runaway cursor
            data = {"t": self.t, "link_key": self.link_key, "link_type": "s",
                    "secure_hash": secure_hash, "rlkey": self.rlkey, "sub_path": sub_path}
            if voucher:
                data["voucher"] = voucher
            for attempt in range(tries):
                try:
                    req = urllib.request.Request(
                        LIST_EP, urllib.parse.urlencode(data).encode(),
                        {"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                         "X-Requested-With": "XMLHttpRequest", "Referer": self.base})
                    blob = json.loads(self.op.open(req, timeout=TIMEOUT).read().decode())
                    break
                except Exception as e:
                    if attempt == tries - 1:
                        raise RuntimeError("%s: %s" % (sub_path or "/", e))
                    time.sleep(1.5 * (attempt + 1))
            out += blob.get("entries", [])
            voucher = blob.get("next_request_voucher") or blob.get("voucher")
            if not blob.get("has_more_entries") or not voucher:
                break
        return out

    def download(self, href):
        with self.op.open(href.replace("&dl=0", "&dl=1"), timeout=TIMEOUT) as r:
            return r.read()


def node_of(href):
    """A subfolder's (secure_hash, sub_path), both read off the href the listing returns."""
    parts = urllib.parse.urlparse(href).path.split("/")
    if len(parts) < 6:
        return None
    return parts[4], "/" + urllib.parse.unquote("/".join(parts[5:]))


def crawl(share):
    """BFS the whole share -> {path: {dir, bytes, href}}."""
    tree, level = {}, [((share.secure_hash, ""), "")]
    while level:
        nxt = []
        with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
            futs = {pool.submit(share.listdir, node): path for node, path in level}
            for fut in concurrent.futures.as_completed(futs):
                parent = futs[fut]
                try:
                    entries = fut.result()
                except Exception as e:                # one bad folder must not kill the crawl
                    print("  ! %s" % e, file=sys.stderr)
                    continue
                for e in entries:
                    if IGNORE.match(e["filename"]):
                        continue
                    path = parent + "/" + e["filename"]
                    with _lock:
                        tree[path] = {"dir": e.get("is_dir", False), "bytes": e.get("bytes"),
                                      "href": e.get("href")}
                    if e.get("is_dir"):
                        node = node_of(e.get("href") or "")
                        if node:
                            nxt.append((node, path))
        print("  crawled %d paths, %d folders to descend" % (len(tree), len(nxt)),
              file=sys.stderr)
        level = nxt
    return tree


# ---------------------------------------------------------------- catalog

def load_catalog(path):
    """-> [{game_code, name, name_cn}] in catalog order."""
    text = open(path, encoding="utf-8").read()
    if path.endswith(".sql"):
        rows = []
        for m in re.finditer(r"\('awcsexy-[^']+',\s*'awcsexy',\s*'((?:[^']|'')*)',"
                             r"\s*'((?:[^']|'')*)'(.*?)::jsonb", text, re.S):
            code, name, tail = m.group(1), m.group(2), m.group(3)
            cn = re.search(r'"nameCn":\s*"([^"]*)"', tail)
            rows.append({"game_code": code.replace("''", "'"), "name": name.replace("''", "'"),
                         "name_cn": cn.group(1) if cn else ""})
        if not rows:
            sys.exit("no ('awcsexy-…', 'awcsexy', 'CODE', 'Name') rows found in %s" % path)
        return rows
    blob = json.loads(text)
    rows = blob["games"] if isinstance(blob, dict) and "games" in blob else blob
    out = []
    for r in rows:
        meta = r.get("metadata") or {}
        if isinstance(meta, str):
            meta = json.loads(meta)
        out.append({"game_code": str(r["game_code"]), "name": r.get("name", r["game_code"]),
                    "name_cn": meta.get("nameCn", "")})
    return out


def norm(title):
    """⚠️ Latin-only, and DELIBERATELY empty for a pure-CJK string. Callers matching Chinese
    names must reject an empty result — otherwise every CJK title normalises to "" and matches
    every other one (`斗鸡` would happily claim `泰国博丁`'s tile)."""
    return re.sub(r"[^a-z0-9]+", "", title.lower())


# ---------------------------------------------------------------- candidate selection

def candidates(tree, game):
    """Tiles for one catalog row, best first: EN portrait -> EN square -> CN landscape.

    Within the game's own folder the shape is measured after download (the names carry no size),
    so every non-table image in the folder is a candidate and `grab` sorts them by what sips says.
    """
    code, name, cn = game["game_code"], game["name"], game["name_cn"]
    out = []

    # The share's folder is named "<CODE> <Title>", e.g. "MX-LIVE-006 DragonTiger".
    folder = None
    for p, v in tree.items():
        if v["dir"] and p.count("/") == 1 and p[1:].split(" ", 1)[0] == code:
            folder = p
            break
    if folder:
        for p, v in sorted(tree.items()):
            if v["dir"] or not p.startswith(folder + "/") or p.count("/") != 2:
                continue
            leaf = p.rsplit("/", 1)[-1]
            if not IS_IMAGE.search(leaf) or TABLE_TILE.search(leaf) or KOREA.search(leaf):
                continue
            out.append({"path": p, "href": v["href"], "source": "folder", "lang": "en"})

    # Last resort: the Chinese landscape pack, keyed by the catalog's own nameCn.
    if cn:
        for p, v in sorted(tree.items()):
            if v["dir"] or not p.startswith("/%s/" % CN_PACK):
                continue
            leaf = p.rsplit("/", 1)[-1]
            if not leaf.lower().endswith(".png"):     # the JPG twins are the same art, worse
                continue
            stem = os.path.splitext(leaf)[0].strip()
            # Exact on the raw string first; norm() only where it says something (see its note).
            if stem == cn.strip() or (norm(cn) and norm(stem) == norm(cn)):
                out.append({"path": p, "href": v["href"], "source": "cn", "lang": "cn"})
    return out, folder


# ---------------------------------------------------------------- convert

def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                         capture_output=True, text=True).stdout
    w = re.search(r"pixelWidth:\s*(\d+)", out)
    h = re.search(r"pixelHeight:\s*(\d+)", out)
    return (int(w.group(1)), int(h.group(1))) if w and h else (0, 0)


def convert(src, dest):
    """PNG/JPG -> WebP, downscaling only if the source is bigger than SIZE on its short side."""
    w, h = dims(src)
    if min(w, h) > SIZE:
        subprocess.run(["sips", "-Z", str(SIZE), src, "--out", src], check=True,
                       capture_output=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-alpha_q", "100", src, "-o", dest],
                   check=True, capture_output=True)


def shape(w, h):
    """-> ('portrait'|'square'|'landscape', rank) with rank 0 = best for the 3/4 card."""
    ar = w / h if h else 0
    if PORTRAIT[0] <= ar < PORTRAIT[1]:
        return "portrait", 0
    if PORTRAIT[1] <= ar < SQUARE[1]:
        return "square", 1
    return "landscape", 2


def grab(job, cache):
    """Download every candidate, measure it, keep the best-shaped -> (job, webp bytes | None)."""
    code = job["game_code"]
    best = None                                    # (rank, -short side, candidate, webp bytes)
    for cand in job["candidates"]:
        # ⚠️ hash the path: slugging strips CJK and the whole CN pack collides onto one name.
        key = hashlib.sha1(cand["path"].encode()).hexdigest()[:16]
        raw = os.path.join(cache, key + os.path.splitext(cand["path"])[1].lower())
        try:
            if not os.path.exists(raw) or os.path.getsize(raw) == 0:
                blob = job["share"].download(cand["href"])
                with open(raw, "wb") as fh:
                    fh.write(blob)
        except Exception as e:
            print("  ! %s %s: %s" % (code, cand["path"], e), file=sys.stderr)
            continue
        w, h = dims(raw)
        if not w:
            print("  ! %s %s: not an image sips can read" % (code, cand["path"]), file=sys.stderr)
            continue
        if min(w, h) < MIN_SHORT:
            continue
        kind, rank = shape(w, h)
        if best is not None and (rank, -min(w, h)) >= best[0]:
            continue                                # already hold something at least as good
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src" + os.path.splitext(raw)[1])
            dst = os.path.join(tmp, "out.webp")
            with open(src, "wb") as fh:
                fh.write(open(raw, "rb").read())
            try:
                convert(src, dst)
            except subprocess.CalledProcessError as e:
                print("  ! %s %s: convert failed: %s"
                      % (code, cand["path"], e.stderr.decode(errors="replace").strip()),
                      file=sys.stderr)
                continue
            webp = open(dst, "rb").read()
        best = ((rank, -min(w, h)), dict(cand, w=w, h=h, shape=kind), webp)
    if best is None:
        return job, None
    job["chosen"] = best[1]
    return job, best[2]


# ---------------------------------------------------------------- SQL

def render_sql(rows, shapes, fallbacks, absent):
    shape_note = "-- Shape mix: %s.\n" % ", ".join("%s=%d" % kv for kv in sorted(shapes.items()))
    fb_note = ""
    if fallbacks:
        fb_note = ("--\n-- ⚠️ These rows do NOT get the 348x462 portrait tile and are cropped by\n"
                   "-- `object-fit: cover` into the 3/4 card:\n"
                   + "".join("--   %s\n" % f for f in sorted(fallbacks)))
    absent_note = ""
    if absent:
        absent_note = ("--\n-- No art in the share (image_url stays NULL -> initial-letter"
                       " placeholder):\n"
                       + "".join("--   %s %s\n" % (c, n) for c, n in sorted(absent)))
    return ("-- AWC SEXY (SEXYBCRT) game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: AWC's public Dropbox share for the SEXY agent (link key\n"
            "-- 4t11gkjf6icw4f7uz671h, handed over 2026-08-25), one folder per SEXYBCRT title.\n"
            "-- Mirrored into client-facing/public/assets/games/awcsexy/<game_code lowercased>.webp\n"
            "-- and committed. Generated by client-facing/scripts/import-awcsexy-icons.py.\n"
            "--\n"
            "-- ⭐ PORTRAIT, not square. `.game-card` is aspect-ratio 3/4 + object-fit cover, and\n"
            "-- SEXY ships a tile drawn for exactly that shape — `<TitleNoSpaces>.png` at 348x462,\n"
            "-- full-bleed art with the English logotype and the Sexy wordmark baked in.\n"
            "--\n"
            "-- ⭐ The 800x800 `<Title> C01.png` / `<Title> 71.png` files in the same folders are\n"
            "-- per-TABLE tiles — the table number is drawn into the logotype (\"ROULETTE 71\",\n"
            "-- \"SEDIE C151\") — so they never name a GAME and the importer excludes them. The\n"
            "-- usable square is `<Title>(NEW).png` (2168x2168, centred subject and logotype).\n"
            "--\n"
            + shape_note
            + fb_note
            + absent_note
            + "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) /\n"
            "-- pt (000042) / pp (000044) / afb (000045) / evolution (000046) / ds (000047) /\n"
            "-- cq9 (000049) / naga (000053) / awc (000056): the icons are served by the\n"
            "-- client-facing Next.js app, so the path stays correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on game_code, not id: 000060 ships literal `awcsexy-<code>` ids, and\n"
            "-- game_code is the vendor's own stable key ('MX-LIVE-006', used verbatim on launch).\n"
            "--\n"
            "-- ⛔ This does NOT publish anything: 000060 seeds every row `inactive` behind a\n"
            "-- tenant_vendors OFF row, and artwork does not change that. Publishing stays one\n"
            "-- deliberate UPDATE at go-live, after AWC approves the /awcsexy/callback URL.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(game_code, url)\n WHERE g.vendor_id = 'awcsexy'\n"
              "   AND g.game_code = v.game_code\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="000060_awcsexy_catalog.up.sql or a psql dump of vendor_games")
    ap.add_argument("--link", default=DEFAULT_LINK, help="Dropbox folder share URL")
    ap.add_argument("--manifest", help="cache the crawl here (reused on the next run)")
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "awcsexy-art"),
                    help="keep downloaded originals here so a re-run is offline")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="resolve + download, write no assets")
    args = ap.parse_args()

    share = Share(args.link)
    if args.manifest and os.path.exists(args.manifest):
        tree = json.load(open(args.manifest))
        print("manifest %s: %d paths (delete it to re-crawl)" % (args.manifest, len(tree)))
    else:
        tree = crawl(share)
        if args.manifest:
            json.dump(tree, open(args.manifest, "w"), ensure_ascii=False, indent=1)
    files = sum(1 for v in tree.values() if not v["dir"])
    print("share: %d files, %d folders" % (files, len(tree) - files))

    catalog = load_catalog(args.catalog)
    bad = [g["game_code"] for g in catalog
           if not re.fullmatch(r"[A-Za-z0-9._-]+", g["game_code"])]
    if bad:
        sys.exit("game_code is not a usable path segment for: %s" % bad)

    os.makedirs(args.cache, exist_ok=True)
    jobs, absent, matched = [], [], set()
    for game in catalog:
        cands, folder = candidates(tree, game)
        if folder:
            matched.add(folder)
        if not cands:
            absent.append((game["game_code"], game["name"]))
            print("  NO ART: %s %r" % (game["game_code"], game["name"]))
            continue
        jobs.append(dict(game, candidates=cands, share=share))

    extra = sorted(p for p, v in tree.items()
                   if v["dir"] and p.count("/") == 1 and not NOT_A_GAME.match(p[1:])
                   and p != "/" + CN_PACK and p not in matched)
    if extra:
        print("share has art for %d titles outside our catalog (skipped): %s"
              % (len(extra), ", ".join(x[1:] for x in extra)))
    print("importing %d/%d catalog games" % (len(jobs), len(catalog)))

    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    rows, failed, shapes, fallbacks, total = [], [], {}, [], 0
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for job, blob in pool.map(lambda j: grab(j, args.cache), jobs):
            if blob is None:
                failed.append(job)
                continue
            code, chosen = job["game_code"], job["chosen"]
            shapes[chosen["shape"]] = shapes.get(chosen["shape"], 0) + 1
            if chosen["shape"] != "portrait":
                fallbacks.append("%s %s — %s %s (%dx%d, %s)"
                                 % (code, job["name"], chosen["shape"],
                                    chosen["path"].rsplit("/", 1)[-1], chosen["w"], chosen["h"],
                                    "Chinese logotype" if chosen["lang"] == "cn" else "English"))
            asset = code.lower()
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, asset + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append("  ('%s', '%s/%s.webp')" % (code, URL_PREFIX, asset))
            print("  %-12s %-24s <- %s (%dx%d %s)"
                  % (code, job["name"], chosen["path"], chosen["w"], chosen["h"],
                     chosen["shape"]))

    for job in failed:
        print("  FAILED: %s %r" % (job["game_code"], job["name"]))
        absent.append((job["game_code"], job["name"]))
    print("shape mix: %s" % ", ".join("%s=%d" % kv for kv in sorted(shapes.items())))
    verb = "would write" if args.dry_run else "wrote"
    print("%s %d icons -> %s  (%.1f MB), %d without art"
          % (verb, len(rows), OUT_DIR, total / 1024 / 1024, len(absent)))

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w", encoding="utf-8") as fh:
            fh.write(render_sql(sorted(rows), shapes, fallbacks, absent))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
