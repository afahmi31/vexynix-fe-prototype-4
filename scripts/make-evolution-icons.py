#!/usr/bin/env python3
"""Build Evolution's lobby tiles into public/assets/games/evolution + emit the catalog SQL.

⚠️ EVOLUTION SHIPS NO ARTWORK — this is the one pack we DRAW rather than mirror.

Verified 2026-08-21 against both sources of truth:

  * the vendor PDF (`spec/evolution/game-list-api.pdf`, "Common fields"): a table row is exactly
    `Table Name`, `Table ID`, `Direct Launch Table ID`, `Game Type`, `Bet Limit` — no image field;
  * the LIVE staging Game List (`GET /api/lobby/v1/{casino_key}/tablelist`): 270 assigned tables,
    the same five keys and nothing else. `?thumbnails=…`/`?images=…`/`?includeThumbnails=…` change
    nothing, and there is no sibling `/thumbnails`, `/state` or `/games` route (all 404).
    The Classification API (`/api/classification/v1/games`) is pure taxonomy — `{code,name}` tuples.

So there is no `picture` URL to mirror the way import-afb-icons.py does, and no art pack to
convert the way import-sg-icons.py does. What migration 000030 publishes is also NOT 270 tables:
it is SEVEN LOBBY-CATEGORY rows (`category:roulette`, `category:game_shows`, …), because category
launch works without the per-casino virtual table ids (13p sheet Q6). Category tiles are art
Evolution would never ship even if it shipped table thumbnails.

    # draw the seven tiles + write the migration
    python3 scripts/make-evolution-icons.py \
        --sql ../backend/services/simles/migrations/000046_evolution_game_icons.up.sql

    # see what it would write, touch nothing
    python3 scripts/make-evolution-icons.py --dry-run

    # ⭐ the day Evolution DOES hand over a marketing art pack, drop it in and re-run — same
    # file names, same migration, no SQL churn. Files are matched as <slug>.<ext> (top-games,
    # roulette, blackjack, baccarat-sicbo, game-shows, poker, slots), any format sips reads.
    python3 scripts/make-evolution-icons.py --art-dir ~/Downloads/evo-art --sql …

What this encodes:

  * **Generated, not scraped.** Guessing at an Evolution CDN path would hot-link an undocumented
    host from the PLAYER's browser — the exact failure mode 000045's header warns about, minus
    even a staging URL in writing. Drawn tiles are ours, stable, and cost one HTTP request to
    nobody.
  * **The bottom fifth of a card is spoken for.** `.game-card-info` is an absolutely-positioned
    black gradient carrying the game name and vendor (`_game-card.scss`), so the emblem sits at
    ~42% height and the tile darkens below it instead of putting art there.
  * **Square art, centre-safe.** `.game-card-image img` is `object-fit: cover` on a `3/4` card —
    a square source is cropped ~12.5% off EACH SIDE — while the lobby's `.featured-card-banner`
    crops the other axis. Everything that matters stays inside the middle box.
  * **Rendered at 2x, stored at 512** — matching the pgsoft/sg (512) and pt (500) packs.
  * Safe against a resync: nothing rewrites `vendor_games` for evolution at runtime (`catalog.go`
    is a DRIFT REPORT, never a sync — 13p TECHNICAL §6), so image_url cannot be cleared behind us.

Requires cwebp (brew install webp) and a Chrome/Chromium — Playwright's bundled build is found
automatically (client-facing already depends on it), else $CHROME, else an installed Chrome.
"""
import argparse, glob, math, os, shutil, subprocess, sys, tempfile

SIZE, SCALE, QUALITY = 512, 2, 88
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "evolution")
URL_PREFIX = "/assets/games/evolution"
VENDOR = "evolution"

# (top, bottom, accent) — the accent echoes the category gradients in _game-card.scss so a tile
# and its placeholder gradient read as the same family.
THEMES = {
    "royal":    ("#3d2072", "#140a28", "#8b5cf6"),
    "crimson":  ("#6d1220", "#1a0508", "#f5576c"),
    "emerald":  ("#0f4a37", "#04160f", "#43e97b"),
    "sapphire": ("#123a63", "#050f1e", "#4facfe"),
    "magenta":  ("#5c1140", "#1a0518", "#f093fb"),
    "teal":     ("#0d4149", "#04161a", "#30cfd0"),
    "violet":   ("#4a1470", "#12061f", "#d946ef"),
}

# game_code -> the tile. Codes are migration 000030's, verbatim.
TILES = [
    {"code": "category:top_games",     "slug": "top-games",     "label": "TOP GAMES",
     "theme": "royal",    "emblem": "star"},
    {"code": "category:roulette",      "slug": "roulette",      "label": "ROULETTE",
     "theme": "crimson",  "emblem": "wheel"},
    {"code": "category:blackjack",     "slug": "blackjack",     "label": "BLACKJACK",
     "theme": "emerald",  "emblem": "blackjack"},
    {"code": "category:baccarat_sicbo","slug": "baccarat-sicbo","label": "BACCARAT & SIC BO",
     "theme": "sapphire", "emblem": "baccarat"},
    {"code": "category:game_shows",    "slug": "game-shows",    "label": "GAME SHOWS",
     "theme": "magenta",  "emblem": "moneywheel"},
    {"code": "category:poker",         "slug": "poker",         "label": "POKER",
     "theme": "teal",     "emblem": "poker"},
    {"code": "category:slots",         "slug": "slots",         "label": "SLOTS",
     "theme": "violet",   "emblem": "slots"},
]


# --------------------------------------------------------------------------- svg helpers

def wedge(r0, r1, a0, a1):
    """Annulus sector between radii r0<r1 and angles a0<a1 (radians), centred on 0,0."""
    pts = [(r1 * math.cos(a0), r1 * math.sin(a0)), (r1 * math.cos(a1), r1 * math.sin(a1)),
           (r0 * math.cos(a1), r0 * math.sin(a1)), (r0 * math.cos(a0), r0 * math.sin(a0))]
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = [(round(x, 2), round(y, 2)) for x, y in pts]
    big = 1 if (a1 - a0) > math.pi else 0
    return (f"M{x0},{y0} A{r1},{r1} 0 {big} 1 {x1},{y1} "
            f"L{x2},{y2} A{r0},{r0} 0 {big} 0 {x3},{y3} Z")


def ring(n, r0, r1, colors, rotate=-math.pi / 2):
    step = 2 * math.pi / n
    out = []
    for i in range(n):
        a0 = rotate + i * step
        out.append(f'<path d="{wedge(r0, r1, a0, a0 + step)}" fill="{colors[i % len(colors)]}"/>')
    return "".join(out)


def card(w=116, h=160, rot=0, dx=0, dy=0, face=""):
    """A playing card, centred on its own origin then rotated/translated."""
    return (f'<g transform="translate({dx},{dy}) rotate({rot})">'
            f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="12" fill="#fdfdff"/>'
            f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="12" fill="none" '
            f'stroke="#c9ccd8" stroke-width="2"/>{face}</g>')


SPADE = ("M0,-32 C-19,-9 -36,2 -36,17 C-36,30 -25,36 -15,32 C-9,29 -5,25 -3,21 "
         "L-7,40 L7,40 L3,21 C5,25 9,29 15,32 C25,36 36,30 36,17 C36,2 19,-9 0,-32 Z")
HEART = ("M0,36 C-32,13 -42,-6 -31,-21 C-23,-32 -6,-29 0,-15 C6,-29 23,-32 31,-21 "
         "C42,-6 32,13 0,36 Z")
DIAMOND = "M0,-36 L26,0 L0,36 L-26,0 Z"


def suit(path, fill, s=1.0, dx=0, dy=0):
    return f'<g transform="translate({dx},{dy}) scale({s})"><path d="{path}" fill="{fill}"/></g>'


def pip_face(n):
    """Die pips for 1..6, on a 72-wide die centred at 0,0."""
    grid = {"tl": (-18, -18), "tr": (18, -18), "ml": (-18, 0), "mr": (18, 0),
            "bl": (-18, 18), "br": (18, 18), "c": (0, 0)}
    layout = {1: ["c"], 2: ["tl", "br"], 3: ["tl", "c", "br"], 4: ["tl", "tr", "bl", "br"],
              5: ["tl", "tr", "c", "bl", "br"], 6: ["tl", "tr", "ml", "mr", "bl", "br"]}[n]
    return "".join(f'<circle cx="{grid[k][0]}" cy="{grid[k][1]}" r="7" fill="#1a1a22"/>'
                   for k in layout)


def die(n, rot=0, dx=0, dy=0):
    return (f'<g transform="translate({dx},{dy}) rotate({rot})">'
            f'<rect x="-36" y="-36" width="72" height="72" rx="14" fill="#fdfdff"/>'
            f'<rect x="-36" y="-36" width="72" height="72" rx="14" fill="none" '
            f'stroke="#c9ccd8" stroke-width="2"/>{pip_face(n)}</g>')


def chip(r=34, dx=0, dy=0, body="#b3122a"):
    """A casino chip: dark body, gold edge dashes, pale inset."""
    dashes = "".join(
        f'<path d="{wedge(r - 9, r, a - 0.20, a + 0.20)}" fill="#f2e3b6" opacity="0.92"/>'
        for a in [i * math.pi / 3 for i in range(6)])
    return (f'<g transform="translate({dx},{dy})">'
            f'<circle r="{r}" fill="{body}"/>{dashes}'
            f'<circle r="{r - 12}" fill="none" stroke="#f2e3b6" stroke-width="3" opacity="0.7"/>'
            f'<circle r="{r - 18}" fill="url(#gold)"/></g>')


# --------------------------------------------------------------------------- the emblems

def emblem_star():
    pts = []
    for i in range(10):
        r = 104 if i % 2 == 0 else 44
        a = -math.pi / 2 + i * math.pi / 5
        pts.append(f"{r*math.cos(a):.2f},{r*math.sin(a):.2f}")
    spark = "".join(
        f'<path d="M0,-{s} L{s*0.28},-{s*0.28} L{s},0 L{s*0.28},{s*0.28} L0,{s} '
        f'L-{s*0.28},{s*0.28} L-{s},0 L-{s*0.28},-{s*0.28} Z" fill="#f7ecc4" opacity="0.9" '
        f'transform="translate({x},{y})"/>' for s, x, y in [(18, -118, -58), (12, 116, -74),
                                                            (14, 104, 62)])
    return (f'<circle r="118" fill="url(#halo)"/>'
            f'<polygon points="{" ".join(pts)}" fill="url(#gold)" stroke="#f7ecc4" '
            f'stroke-width="3" stroke-linejoin="round"/>'
            f'<polygon points="{" ".join(pts)}" fill="#ffffff" opacity="0.18" '
            f'transform="scale(0.62)"/>{spark}')


def emblem_wheel():
    return (f'<circle r="118" fill="url(#halo)"/>'
            f'<circle r="112" fill="url(#gold)"/>'
            f'<circle r="102" fill="#0d0d12"/>'
            f'{ring(18, 46, 100, ["#b3122a", "#15151c"])}'
            f'<circle r="100" fill="none" stroke="url(#gold)" stroke-width="6"/>'
            f'<circle r="46" fill="url(#gold)"/><circle r="34" fill="#15151c"/>'
            f'<circle r="14" fill="url(#gold)"/>'
            f'<g transform="rotate(-58)"><circle cx="80" cy="0" r="11" fill="#ffffff"/>'
            f'<circle cx="80" cy="0" r="11" fill="none" stroke="#cfd3e0" stroke-width="2"/></g>')


def emblem_blackjack():
    back = card(rot=-17, dx=-40, dy=6)
    front = card(rot=11, dx=34, dy=0, face=(
        suit(SPADE, "#15151c", 0.62, 0, 4) +
        '<text x="-40" y="-46" font-size="30" font-weight="800" fill="#15151c" '
        'font-family="Helvetica Neue, Arial, sans-serif">A</text>'
        '<text x="40" y="62" font-size="30" font-weight="800" fill="#15151c" '
        'text-anchor="end" font-family="Helvetica Neue, Arial, sans-serif" '
        'transform="rotate(180 40 52)">A</text>'))
    return (f'<circle r="120" fill="url(#halo)"/>{back}{front}'
            f'{chip(34, -84, 74)}{chip(28, -34, 90, "#15151c")}')


def emblem_baccarat():
    c = card(rot=-13, dx=-56, dy=-6, face=suit(HEART, "#b3122a", 0.6, 0, 2))
    return (f'<circle r="120" fill="url(#halo)"/>{c}'
            f'{die(5, 12, 46, -34)}{die(3, -8, 62, 52)}{die(6, 18, -8, 74)}')


def emblem_moneywheel():
    beams = "".join(
        f'<polygon points="0,-140 {math.cos(a-0.09)*250:.0f},{math.sin(a-0.09)*250:.0f} '
        f'{math.cos(a+0.09)*250:.0f},{math.sin(a+0.09)*250:.0f}" fill="#ffffff" opacity="0.05"/>'
        for a in [-1.9, -1.55, -1.2])
    return (f'{beams}<circle r="118" fill="url(#halo)"/>'
            f'<circle r="110" fill="url(#gold)"/><circle r="100" fill="#12121a"/>'
            f'{ring(24, 30, 98, ["#f5576c", "#f7d774", "#3ec4c8", "#f093fb"])}'
            f'<circle r="98" fill="none" stroke="url(#gold)" stroke-width="5"/>'
            f'<circle r="30" fill="url(#gold)"/><circle r="20" fill="#12121a"/>'
            f'<polygon points="0,-72 -14,-106 14,-106" fill="url(#gold)" stroke="#f7ecc4" '
            f'stroke-width="2" stroke-linejoin="round"/>')


def emblem_poker():
    left = card(rot=-24, dx=-48, dy=-18, face=suit(SPADE, "#15151c", 0.55, 0, 4))
    right = card(rot=20, dx=48, dy=-18, face=suit(HEART, "#b3122a", 0.55, 0, 2))
    stack = "".join(
        f'<g transform="translate(0,{y})"><ellipse rx="52" ry="18" fill="{dark}"/>'
        f'<ellipse rx="52" ry="18" cy="-9" fill="{light}"/>'
        f'<ellipse rx="30" ry="10" cy="-9" fill="url(#gold)" opacity="0.85"/></g>'
        for y, dark, light in [(96, "#6d0c1a", "#b3122a"), (74, "#0b3c42", "#15616c"),
                               (52, "#5a4407", "#8a6c12")])
    return f'<circle r="120" fill="url(#halo)"/>{left}{right}{stack}'


def emblem_slots():
    reels = "".join(
        f'<g transform="translate({x},0)">'
        f'<rect x="-33" y="-62" width="66" height="124" rx="10" fill="#fdfdff"/>'
        f'<rect x="-33" y="-62" width="66" height="124" rx="10" fill="none" stroke="#c9ccd8" '
        f'stroke-width="2"/>'
        f'<text x="0" y="20" font-size="62" font-weight="900" fill="#b3122a" text-anchor="middle" '
        f'font-family="Helvetica Neue, Arial, sans-serif">7</text></g>' for x in (-76, 0, 76))
    return (f'<circle r="122" fill="url(#halo)"/>'
            f'<rect x="-126" y="-96" width="252" height="192" rx="22" fill="#15151c"/>'
            f'<rect x="-126" y="-96" width="252" height="192" rx="22" fill="none" '
            f'stroke="url(#gold)" stroke-width="6"/>'
            f'<rect x="-112" y="-82" width="224" height="164" rx="14" fill="#23232e"/>'
            f'{reels}'
            f'<g transform="translate(150,-10)"><rect x="-6" y="-40" width="12" height="92" rx="6" '
            f'fill="url(#gold)"/><circle cy="-52" r="18" fill="#b3122a" stroke="url(#gold)" '
            f'stroke-width="4"/></g>')


EMBLEMS = {"star": emblem_star, "wheel": emblem_wheel, "blackjack": emblem_blackjack,
           "baccarat": emblem_baccarat, "moneywheel": emblem_moneywheel, "poker": emblem_poker,
           "slots": emblem_slots}


def svg(tile):
    top, bot, accent = THEMES[tile["theme"]]
    label = tile["label"]
    # The label must survive the 3/4 `object-fit: cover` crop, which keeps only x=64..448 — so
    # fit it to 352px, leaving a margin rather than butting the longest label ("BACCARAT & SIC
    # BO") right up against the cut.
    fs = min(38, int(352 / (0.63 * max(len(label), 1))))
    rays = "".join(
        f'<polygon points="256,-40 {256+math.cos(a-0.06)*760:.0f},{math.sin(a-0.06)*760:.0f} '
        f'{256+math.cos(a+0.06)*760:.0f},{math.sin(a+0.06)*760:.0f}" fill="#ffffff" '
        f'opacity="0.045"/>' for a in [0.95, 1.35, 1.75, 2.15])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}"
     viewBox="0 0 {SIZE} {SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.45" y2="1">
      <stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.40" r="0.62">
      <stop offset="0" stop-color="{accent}" stop-opacity="0.50"/>
      <stop offset="1" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#fbf0c8"/><stop offset="0.45" stop-color="#dcb757"/>
      <stop offset="1" stop-color="#9a6d1b"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>

  <rect width="{SIZE}" height="{SIZE}" fill="url(#bg)"/>
  <rect width="{SIZE}" height="{SIZE}" fill="url(#glow)"/>
  {rays}
  <rect width="{SIZE}" height="{SIZE}" fill="url(#vignette)"/>
  <!-- the bottom fifth is `.game-card-info`'s gradient: darken, never decorate -->
  <rect y="332" width="{SIZE}" height="180" fill="url(#fade)"/>

  <g transform="translate(256,214)">{EMBLEMS[tile["emblem"]]()}</g>

  <text x="256" y="62" text-anchor="middle" font-size="21" font-weight="700" letter-spacing="7"
        fill="url(#gold)" font-family="Helvetica Neue, Arial, sans-serif">EVOLUTION</text>
  <!-- a RECT, not a stroked line: `url(#gold)` is objectBoundingBox, and a horizontal
       line has zero height, so a stroked rule paints nothing at all -->
  <rect x="186" y="75" width="140" height="2" fill="url(#gold)" opacity="0.7"/>

  <text x="256" y="378" text-anchor="middle" font-size="{fs}" font-weight="800" letter-spacing="1.5"
        fill="#ffffff" font-family="Helvetica Neue, Arial, sans-serif">{label}</text>
  <text x="256" y="404" text-anchor="middle" font-size="14" font-weight="600" letter-spacing="4"
        fill="#ffffff" opacity="0.55"
        font-family="Helvetica Neue, Arial, sans-serif">LIVE CASINO</text>
</svg>"""


# --------------------------------------------------------------------------- rendering

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


def render(chrome, markup, png):
    """SVG -> PNG at SCALE x, via headless Chrome (the renderer this repo already ships)."""
    with tempfile.TemporaryDirectory() as td:
        html = os.path.join(td, "tile.html")
        with open(html, "w") as fh:
            fh.write(f'<!doctype html><html><body style="margin:0">{markup}</body></html>')
        # ⚠️ NO --user-data-dir. A fresh profile makes headless Chrome sit in GCM registration
        # for minutes before it screenshots anything; the default profile renders in ~2 s.
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                        f"--force-device-scale-factor={SCALE}", f"--window-size={SIZE},{SIZE}",
                        f"--screenshot={png}", "file://" + html],
                       check=True, capture_output=True, timeout=120)


def to_webp(src, dest):
    subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), "-resize", str(SIZE), str(SIZE),
                    src, "-o", dest], check=True)


def from_art_dir(art_dir, slug, tmp):
    """Vendor art, if it ever arrives: <slug>.<ext>, downscaled to the 512 CEILING (never up)."""
    hits = [p for p in sorted(glob.glob(os.path.join(art_dir, slug + ".*")))
            if not p.endswith((".json", ".txt", ".md"))]
    if not hits:
        return None
    src = hits[0]
    out = os.path.join(tmp, slug + ".png")
    subprocess.run(["sips", "-s", "format", "png", "-Z", str(SIZE * SCALE), src, "--out", out],
                   check=True, capture_output=True)
    return out


# --------------------------------------------------------------------------- sql

SQL_HEADER = """-- Evolution lobby artwork: point every catalog row at its local icon asset.
--
-- ⚠️ UNLIKE EVERY OTHER ICON MIGRATION, THIS ART IS OURS — Evolution ships none.
-- Verified 2026-08-21 both ways: the Game List API PDF's "Common fields" table is exactly
-- {Table Name, Table ID, Direct Launch Table ID, Game Type, Bet Limit}, and the live staging
-- GET /api/lobby/v1/{casino_key}/tablelist returns those same five keys across all 270 assigned
-- tables (thumbnail/image query params change nothing; /thumbnails, /state, /games 404). The
-- Classification API is taxonomy only. There is no `picture` URL to mirror the way AFB (000045)
-- has one, and no art pack to convert the way SG (000041) had.
--
-- The rows here are also NOT tables: migration 000030 publishes SEVEN LOBBY-CATEGORY rows,
-- because category launch works without the per-casino virtual table ids (13p sheet Q6). Category
-- tiles are art Evolution would not ship even if it shipped table thumbnails.
--
-- Generated by client-facing/scripts/make-evolution-icons.py (512x512 webp, drawn as SVG and
-- rasterised at 2x). Re-running that script with --art-dir swaps in a real vendor pack under the
-- SAME file names, so this migration stays correct without an edit.
--
-- image_url is a ROOT-RELATIVE path, matching pgsoft (000039) / sg (000041) / pt (000042) /
-- pp (000044) / afb (000045): the icons are served by the client-facing Next.js app, so it stays
-- correct across every host/tenant domain.
--
-- Keyed on game_code: 000030 ships literal ids, and the category code is the stable key. Nothing
-- rewrites these rows at runtime — evolution/catalog.go is a DRIFT REPORT, never a sync
-- (13p TECHNICAL §6) — so image_url cannot be cleared behind us.

ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE vendor_games g
   SET image_url = v.url
  FROM (VALUES
"""


def emit_sql(path, rows):
    body = ",\n".join(f"  ('{code}', '{url}')" for code, url in rows)
    with open(path, "w") as fh:
        fh.write(SQL_HEADER + body + "\n  ) AS v(game_code, url)\n"
                 f" WHERE g.vendor_id = '{VENDOR}'\n"
                 "   AND g.game_code = v.game_code\n"
                 "   AND g.image_url IS DISTINCT FROM v.url;\n")


# --------------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sql", help="write the catalog migration here")
    ap.add_argument("--art-dir", help="use a real vendor art pack (<slug>.<ext>) where present")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    if not shutil.which("cwebp"):
        sys.exit("cwebp not found — brew install webp")
    chrome = None if args.dry_run else find_chrome()

    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for t in TILES:
            dest = os.path.join(OUT_DIR, t["slug"] + ".webp")
            url = f"{URL_PREFIX}/{t['slug']}.webp"
            rows.append((t["code"], url))
            src = "drawn"
            if args.dry_run:
                print(f"  {t['code']:<28} -> {url}  ({src})")
                continue
            os.makedirs(OUT_DIR, exist_ok=True)
            png = from_art_dir(args.art_dir, t["slug"], tmp) if args.art_dir else None
            if png:
                src = "art-dir"
            else:
                png = os.path.join(tmp, t["slug"] + ".png")
                render(chrome, svg(t), png)
            to_webp(png, dest)
            print(f"  {t['code']:<28} -> {url}  ({src}, {os.path.getsize(dest)//1024} KB)")

    if args.sql and not args.dry_run:
        emit_sql(args.sql, rows)
        print(f"\nSQL: {args.sql} ({len(rows)} rows)")
    print(f"{len(rows)} tiles")


if __name__ == "__main__":
    main()
