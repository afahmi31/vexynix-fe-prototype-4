#!/usr/bin/env python3
"""Compose WM Casino's game tiles into public/assets/games/wm + emit the vendor_games SQL.

WM is the first vendor whose art pack CANNOT be mirrored file-for-file: neither of the two
things WM shipped is a lobby tile, and both fail `.game-card` (aspect-ratio 3/4 +
object-fit: cover) in a different way. So this script COMPOSITES a tile out of them, the way
make-evolution-icons.py draws Evolution's — except here every pixel is real WM art.

    python3 scripts/import-wm-icons.py \
        --icons   "../spec/game icon" \
        --posters ../spec/WMcasinoGamesposter_500x300_x10 \
        --sql     ../backend/services/simles/migrations/000070_wm_game_icons.up.sql

    # render to a directory and look at them before writing anything
    python3 scripts/import-wm-icons.py --icons ... --posters ... --dry-run --preview /tmp/wm

Both sources are already in the repo under spec/ (`game icon.rar`, extracted with `bsdtar` —
macOS has no unrar but libarchive reads RAR fine; and `WMcasinoGamesposter_500x300_x10.7z`).
There is no WM art URL to fetch: WM has no catalog API at all (13g TECHNICAL §0 — the 23 rows
are hand-seeded in migrations 000018 + 000027), so a hand-delivered pack is the only source.

What WM shipped, and why neither is usable raw
----------------------------------------------
  * ⛔ **`game icon/` = round glossy DISCS ON TRANSPARENCY** (258x226 PSD / 250x250 PNG).
    Cover-cropping a transparent sticker into a 3/4 card shows the card's own pink
    `.game-card-live` gradient down both sides — the CQ9 `角標` / AWC `*_circular_*` /
    Habanero `Circle` trap for the fourth time. Lovely art, wrong container.
  * ⛔ **`WMcasinoGamesposter_500x300_x10/` = opaque photographic posters, but LANDSCAPE 5:3**
    with the WM wordmark and the English game name BAKED IN. A 3:4 cover-crop keeps the middle
    45% of the width, which beheads the logo to "CASINO" and the titles to "ragon&Tig",
    "n-Prawn-C", "ahjong Til". Habanero's landscape `Rectangle` trap.
  * ⭐ **They compose.** The poster is the only photographic ground WM has; the disc is the only
    per-game object art. Blurring the poster is what makes it work: the baked-in text dissolves
    into bokeh (so it cannot fight the clean title drawn on top) while the dealer's colour and
    the live-casino mood survive. Compositing the poster UNBLURRED was tried and is unusable —
    a ghost "ASI…Baccarat" reads straight through behind the real title.
  * ⭐ **The wordmark is recovered FROM a poster** rather than redrawn: it sits on pure black at
    a fixed 8%..60% x 19%..43% of every 500x300 poster, so it crops cleanly and composites with
    `mix-blend-mode: screen` (black -> transparent). No WM logo file was shipped, and drawing
    one would be the one part of the tile that is not WM's own art.

Mapping
-------
⭐ **The poster number IS the live gtype, offset by 100**: `_01` Baccarat = gtype 101,
`_07` Fantan = 107, `_13` Mahjong Tiles = 113. That is what makes the pack self-describing —
and what exposes a real catalog gap (see NOT_IN_CATALOG below).

  * **8/8 live rows get a photo tile.** All seven tables plus the lobby.
  * **3 of the 15 slots get a DRAWN-GROUND tile.** `sicbovideo` / `xocdiavideo` /
    `hooheyhowvideo` are the RNG cuts of Sic Bo / Se Die / Fish-Prawn-Crab, and those three
    discs are pure game-object art (dice, discs, animal dice) with no dealer in frame. They get
    WM's black/gold ground instead of a poster ON PURPOSE: putting a live-dealer photo behind an
    RNG game would be a false claim about what the player is about to open, and the different
    ground is also what stops "Sicbo Spin" reading as a duplicate of the "Sic Bo" table tile.
  * **The other 12 slots (witchlove, nekomaid, plinkop, …) stay NULL** and fall back to the UI's
    letter placeholder. Neither pack contains a single 5031 slot asset — worth asking WM for.

Output is 512x683 (3:4, short side 512 like every other vendor), WebP q88. Keyed on the row
`id`, not `game_code`: WM's codes are `''` (lobby) and `5031:witchlove` (a colon), neither of
which is a usable asset file name, and unlike the probe-synced vendors WM's ids are literals in
its own migrations. Safe against a resync because WM has nothing to resync from.

Requires cwebp (brew install webp) and a Chrome/Chromium — Playwright's bundled build is found
automatically (client-facing already depends on it), else $CHROME, else an installed Chrome.
"""
import argparse, glob, html, os, shutil, subprocess, sys, tempfile

W, H, SCALE, QUALITY = 512, 683, 2, 88          # 3:4, short side 512 — the fleet standard
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "wm")
URL_PREFIX = "/assets/games/wm"
VENDOR = "wm"

# The wordmark's bounding box inside any 500x300 poster, as fractions. Measured off _01 with a
# percentage grid; it is screen-printed at the same place on all ten. Kept tight: every extra
# row of poster included here is a row of not-quite-black that `screen` turns into a visible box.
MARK_BOX = (0.075, 0.185, 0.605, 0.440)         # left, top, right, bottom

# id -> tile. `poster`/`icon` are file names inside the two pack dirs; poster None = drawn ground.
# Titles are the poster's own English labels (the live rows) or vendor_games.name (the slots).
TILES = [
    {"id": "wm-lobby",    "poster": "WMcasinoGamesposter_500x300_01.jpg",
     "icon": None,                    "title": "Live Casino"},
    {"id": "wm-live-101", "poster": "WMcasinoGamesposter_500x300_01.jpg",
     "icon": "大廳圖示_百家.psd",       "title": "Baccarat"},
    {"id": "wm-live-102", "poster": "WMcasinoGamesposter_500x300_02.jpg",
     "icon": "大廳圖示_龍虎.psd",       "title": "Dragon & Tiger"},
    {"id": "wm-live-103", "poster": "WMcasinoGamesposter_500x300_03.jpg",
     "icon": "大廳圖示_輪盤.psd",       "title": "Roulette"},
    {"id": "wm-live-104", "poster": "WMcasinoGamesposter_500x300_04.jpg",
     "icon": "大廳圖示_骰寶.psd",       "title": "Sic Bo"},
    {"id": "wm-live-105", "poster": "WMcasinoGamesposter_500x300_05.jpg",
     "icon": "大廳圖示_牛牛.psd",       "title": "Niuniu"},
    {"id": "wm-live-107", "poster": "WMcasinoGamesposter_500x300_07.jpg",
     "icon": "大廳圖示_翻攤.psd",       "title": "Fantan"},
    {"id": "wm-live-108", "poster": "WMcasinoGamesposter_500x300_08.jpg",
     "icon": "大廳圖示_色碟.psd",       "title": "Se Die"},

    # RNG cuts of the three table games — drawn ground, never a live-dealer photo (see above).
    {"id": "wm-5031-sicbovideo",     "poster": None,
     "icon": "大廳圖示_骰寶.psd",       "title": "Sicbo Spin"},
    {"id": "wm-5031-xocdiavideo",    "poster": None,
     "icon": "大廳圖示_色碟.psd",       "title": "Xoc Dia Spin"},
    {"id": "wm-5031-hooheyhowvideo", "poster": None,
     "icon": "大廳圖示_魚蝦蟹.psd",      "title": "Fish Prawn Crab"},
]

# ⭐ Art WM shipped for live tables that are NOT in vendor_games. The pack is evidence that our
# hand-seeded live catalog (101-105, 107, 108) is short by six gtypes — 000018 was transcribed
# from WM's own pages in 2026-08 and never revisited. Deliberately NOT added here: seeding a
# game row publishes it into the live lobby (ListGamesForTenant defaults tenant_vendors to
# enabled), and none of these six has ever been launch-tested. Raise with WM, then seed.
NOT_IN_CATALOG = [
    ("106", "Samgong",         "WMcasinoGamesposter_500x300_06.jpg", "大廳圖示_三公.psd"),
    ("110", "Fish-Prawn-Crab", "WMcasinoGamesposter_500x300_10.jpg", "大廳圖示_魚蝦蟹.psd"),
    ("111", "Zhajinhua",       None,                                 "WM_Lobby-icons-11炸金花.png"),
    ("112", "(unnamed)",       None,                                 "112.png"),
    ("113", "Mahjong Tiles",   "WMcasinoGamesposter_500x300_13.jpg", "113.png"),
    ("117", "Andar Bahar",     None,                                 "WM_Lobby-icons-17安達巴哈.png"),
]

# ------------------------------------------------------------------------------ tile markup

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
  html,body {{ margin:0; background:#0b0a08; }}
  #t {{ position:relative; width:{w}px; height:{h}px; overflow:hidden; background:#0b0a08; }}
  #bg {{ position:absolute; inset:-12%; background-position:60% 40%; background-size:cover; }}
  .lay {{ position:absolute; inset:0; }}
  /* `screen` drops the crop's black band out; the contrast crush is what stops the poster's
     not-quite-black (#0a0a0a, plus a corner of bokeh) reading as a lighter box around it. */
  #mark {{ position:absolute; left:50%; top:{mark_top}; transform:translateX(-50%);
           width:{mark_w}; mix-blend-mode:screen; opacity:.95;
           filter:brightness(1.06) contrast(1.45); }}
  #ico {{ position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); width:83%; }}
  #ttl {{ position:absolute; left:0; right:0; bottom:6.5%; text-align:center; white-space:nowrap;
          font:800 58px/1.1 "Helvetica Neue",Helvetica,Arial,sans-serif; color:#fff;
          letter-spacing:.2px; text-shadow:0 3px 14px #000, 0 0 30px rgba(0,0,0,.95); }}
</style></head><body><div id="t">
  <div id="bg" style="{bg}"></div>
  <div class="lay" style="{scrim}"></div>
  <div class="lay" style="background:radial-gradient(120% 85% at 50% 42%,transparent 42%,rgba(0,0,0,.6))"></div>
  <img id="mark" src="_wordmark.png">
  {ico}
  <div id="ttl">{title}</div>
</div><script>
  // Shrink the title until it fits — "Fish Prawn Crab" overflows at the 58px design size.
  var e = document.getElementById('ttl'), max = {w} * 0.88;
  for (var s = 58; s > 26 && e.scrollWidth > max; s -= 1) e.style.fontSize = s + 'px';
</script></body></html>"""

# Blurred poster: the blur is load-bearing, it is what dissolves the baked-in wordmark/title.
# ⭐ The radius must SCALE WITH THE TILE. It was tuned on a 230px-wide preview at 9px (~3.9% of
# the width); reusing that 9px literally at 512px leaves the poster's own "Baccarat"/"Roulette"
# perfectly legible as giant ghost type behind the real title — the V2 failure, reintroduced by
# a unit. 20px is the same 3.9%. (--force-device-scale-factor does NOT affect this: the page is
# still 512 CSS px wide, so CSS px are the right unit here.)
BG_PHOTO = ("background-image:url('_poster.jpg');filter:blur(20px) saturate(1.2);"
            "transform:scale(1.10)")
SCRIM_PHOTO = ("background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.22) 38%,"
               "rgba(0,0,0,.9) 100%)")
# Drawn ground for the RNG cuts: WM's own black/gold palette, the tone the discs were drawn for.
BG_DRAWN = "background:radial-gradient(120% 90% at 50% 22%,#3b3327 0%,#1a1712 45%,#0b0a08 100%)"
SCRIM_DRAWN = ("background:linear-gradient(180deg,rgba(212,175,55,.16) 0%,transparent 38%,"
               "rgba(0,0,0,.55) 100%)")


# ------------------------------------------------------------------------------ rendering

def find_chrome():
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    pats = [
        os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/"
                           "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
        os.path.expanduser("~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/"
                           "Chromium.app/Contents/MacOS/Chromium"),
        os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for p in pats:
        hits = sorted(glob.glob(p))
        if hits:
            return hits[-1]
    for exe in ("google-chrome", "chromium", "chromium-browser"):
        if shutil.which(exe):
            return shutil.which(exe)
    sys.exit("no Chrome/Chromium found — set $CHROME, or `pnpm exec playwright install chromium`")


def shoot(chrome, workdir, page_name, png, w, h):
    """Screenshot workdir/page_name at SCALE x. Sources sit beside it so file:// img loads work."""
    # ⚠️ NO --user-data-dir. A fresh profile makes headless Chrome sit in GCM registration for
    # minutes before it screenshots anything; the default profile renders in ~2 s.
    subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                    "--allow-file-access-from-files",
                    f"--force-device-scale-factor={SCALE}", f"--window-size={w},{h}",
                    f"--screenshot={png}", "file://" + os.path.join(workdir, page_name)],
                   check=True, capture_output=True)
    if not os.path.exists(png):
        sys.exit(f"Chrome produced no screenshot for {page_name}")


def flatten(src, dest):
    """PSD/PNG/JPG -> PNG. sips reads a PSD's flattened composite, so no Photoshop is needed."""
    subprocess.run(["sips", "-s", "format", "png", src, "--out", dest],
                   check=True, capture_output=True)


def make_wordmark(chrome, workdir, poster, dest):
    """Crop the WM CASINO wordmark out of a poster (it is screen-printed on pure black)."""
    l, t, r, b = MARK_BOX
    sw, sh = 2000, 1200                                     # 4x the 500x300 poster, for crisp type
    cw, ch = round((r - l) * sw), round((b - t) * sh)
    shutil.copy(poster, os.path.join(workdir, "_mark_src.jpg"))
    page = (f'<!doctype html><html><body style="margin:0;background:#000">'
            f'<div style="width:{cw}px;height:{ch}px;overflow:hidden;position:relative">'
            f'<img src="_mark_src.jpg" style="position:absolute;left:{-round(l*sw)}px;'
            f'top:{-round(t*sh)}px;width:{sw}px;height:{sh}px"></div></body></html>')
    with open(os.path.join(workdir, "_mark.html"), "w") as fh:
        fh.write(page)
    shoot(chrome, workdir, "_mark.html", dest, cw, ch)
    subprocess.run(["sips", "-Z", "540", dest, "--out", dest], check=True, capture_output=True)


def render_tile(chrome, tile, icons_dir, posters_dir, wordmark, dest_png):
    with tempfile.TemporaryDirectory() as td:
        shutil.copy(wordmark, os.path.join(td, "_wordmark.png"))
        if tile["poster"]:
            shutil.copy(os.path.join(posters_dir, tile["poster"]),
                        os.path.join(td, "_poster.jpg"))
            bg, scrim = BG_PHOTO, SCRIM_PHOTO
        else:
            bg, scrim = BG_DRAWN, SCRIM_DRAWN
        ico = ""
        if tile["icon"]:
            flatten(os.path.join(icons_dir, tile["icon"]), os.path.join(td, "_icon.png"))
            ico = '<img id="ico" src="_icon.png">'
            mark_top, mark_w = "5.5%", "60%"
        else:
            # The lobby has no disc of its own, so the wordmark IS the subject: centred and large
            # where a game tile puts its icon, rather than a small badge over empty space.
            mark_top, mark_w = "36%", "84%"
        with open(os.path.join(td, "tile.html"), "w") as fh:
            fh.write(PAGE.format(w=W, h=H, bg=bg, scrim=scrim, ico=ico,
                                 mark_top=mark_top, mark_w=mark_w,
                                 title=html.escape(tile["title"])))
        shot = os.path.join(td, "shot.png")
        shoot(chrome, td, "tile.html", shot, W, H)
        subprocess.run(["sips", "-Z", str(H), shot, "--out", shot],  # undo --force-device-scale
                       check=True, capture_output=True)
        subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), shot, "-o", dest_png],
                       check=True, capture_output=True)


# ------------------------------------------------------------------------------ SQL

def render_sql(rows):
    return ("-- 13g WM Casino game tiles.\n"
            "--\n"
            "-- COMPOSITED, not mirrored, by client-facing/scripts/import-wm-icons.py. WM shipped\n"
            "-- two packs and neither is a lobby tile: `game icon/` is round glossy discs on\n"
            "-- TRANSPARENCY (cover-cropping one shows the card's own pink gradient down both\n"
            "-- sides — the CQ9 角標 / AWC circular / Habanero Circle trap), and\n"
            "-- `WMcasinoGamesposter_500x300_x10/` is LANDSCAPE 5:3 with the wordmark and the game\n"
            "-- name baked in, so a 3:4 crop beheads the logo to \"CASINO\" and the titles to\n"
            "-- \"ragon&Tig\" / \"n-Prawn-C\". The tile composes both: the poster blurred as the\n"
            "-- photographic ground (the blur is what dissolves the baked-in text), the disc as the\n"
            "-- game object, the wordmark cropped out of the poster's own black band, and a clean\n"
            "-- title. WM has no catalog API and no art URL, so a hand-delivered pack is the only\n"
            "-- possible source.\n"
            "--\n"
            "-- image_url is ROOT-RELATIVE: the bytes are served by the client-facing Next.js app,\n"
            "-- so the path stays correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on the row `id`, not game_code: WM's codes are '' (the lobby) and\n"
            "-- '5031:witchlove' (a colon), neither of which is a usable asset file name, and WM's\n"
            "-- ids are literals in its own migrations 000018 / 000027 rather than probe-synced.\n"
            "--\n"
            "-- Coverage 11/23. All 8 live rows get a photo tile. The three RNG cuts of table games\n"
            "-- (sicbovideo / xocdiavideo / hooheyhowvideo) get WM's black/gold DRAWN ground instead\n"
            "-- of a poster on purpose — a live-dealer photo behind an RNG game would misdescribe\n"
            "-- what the player is opening. The other 12 slots (witchlove, nekomaid, plinkop, …)\n"
            "-- have no asset in either pack and stay NULL, falling back to the letter placeholder.\n"
            "--\n"
            "-- Safe against a resync: WM has no catalog API at all, and 000027's upsert refreshes\n"
            "-- only game_code/name/category/status/metadata ON CONFLICT.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(id, url)\n"
              f" WHERE g.vendor_id = '{VENDOR}'\n"
              "   AND g.id = v.id\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


# ------------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--icons", required=True, help="the extracted `game icon` directory")
    ap.add_argument("--posters", required=True, help="the WMcasinoGamesposter_500x300_x10 directory")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--preview", help="also drop the PNGs here, for eyeballing")
    ap.add_argument("--dry-run", action="store_true", help="render, write no assets and no SQL")
    args = ap.parse_args()

    for d in (args.icons, args.posters):
        if not os.path.isdir(d):
            sys.exit(f"{d}: not a directory")
    missing = [t["icon"] for t in TILES
               if t["icon"] and not os.path.exists(os.path.join(args.icons, t["icon"]))]
    missing += [t["poster"] for t in TILES
                if t["poster"] and not os.path.exists(os.path.join(args.posters, t["poster"]))]
    if missing:
        sys.exit("missing source art: " + ", ".join(sorted(set(missing))))

    chrome = find_chrome()
    print(f"chrome {chrome}")
    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
    if args.preview:
        os.makedirs(args.preview, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        wordmark = os.path.join(td, "wordmark.png")
        make_wordmark(chrome, td, os.path.join(args.posters, TILES[0]["poster"]), wordmark)
        print("wordmark cropped from", TILES[0]["poster"])

        rows, total = [], 0
        for tile in TILES:
            asset = tile["id"] + ".webp"
            dest = os.path.join(td, asset)
            render_tile(chrome, tile, args.icons, args.posters, wordmark, dest)
            blob = open(dest, "rb").read()
            total += len(blob)
            ground = "photo" if tile["poster"] else "drawn"
            print(f"  {tile['id']:<24} {ground:<5} {len(blob)/1024:6.1f} KB  {tile['title']}")
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, asset), "wb") as fh:
                    fh.write(blob)
            if args.preview:
                shutil.copy(dest, os.path.join(args.preview, asset))
            rows.append(f"  ('{tile['id']}', '{URL_PREFIX}/{asset}')")

    verb = "would write" if args.dry_run else "wrote"
    print(f"{verb} {len(rows)} tiles -> {OUT_DIR}  ({total/1024/1024:.1f} MB)")

    print("\nno art in either pack (stay NULL, letter placeholder):")
    print("  12 slots on slotCode 5031 — witchlove, nekomaid, adventureofsinbad, blastxp,")
    print("  plinkop, hilop, wheelp, dicep, gidol, goallinebaby, missholmescoldcase,")
    print("  kitsunesister. Ask WM for a 5031 icon pack.")
    print("\nart shipped for live tables NOT in vendor_games (poster number = gtype - 100):")
    for gtype, name, poster, icon in NOT_IN_CATALOG:
        print(f"  gtype {gtype}  {name:<17} poster={'yes' if poster else ' - '}  icon=yes")
    print("  -> our live catalog (101-105, 107, 108) is short by six. Confirm with WM, then seed.")

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(rows))
        print("\nwrote", args.sql)


if __name__ == "__main__":
    main()
