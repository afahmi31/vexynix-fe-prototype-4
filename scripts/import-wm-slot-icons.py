#!/usr/bin/env python3
"""Import WM Casino's 5031 slot icons into public/assets/games/wm + emit the vendor_games SQL.

This is the SECOND WM art pack and — unlike the first — it is a plain mirror job.

    # extract (macOS has no 7z in the base install; bsdtar/libarchive reads .7z fine)
    bsdtar -xf "spec/5031電子icon.7z" -C spec/

    python3 scripts/import-wm-slot-icons.py "../spec/5031電子icon" \
        --sql ../backend/services/simles/migrations/000080_wm_slot_icons.up.sql

    # convert into a preview dir and look at them before writing anything
    python3 scripts/import-wm-slot-icons.py "../spec/5031電子icon" --dry-run --preview /tmp/wm5031

Why this one is easy and the first one was not
----------------------------------------------
`import-wm-icons.py` had to COMPOSITE, because WM's live-casino packs were round discs on
transparency (wrong container) and landscape posters with the game name baked in (wrong aspect).
This pack is neither: **250x250 opaque full-bleed square tiles, no wordmark and no baked-in
title.** That is the single most common shape in this fleet — ds, habanero, naga, pgsoft, sg and
evolution all ship plain squares, and cq9/jdb/pt ship 200/500/500 squares — and `.game-card`
(aspect-ratio 3/4 + object-fit: cover) already crops squares every day: it keeps the middle 75%
of the width at full height, and WM centres every subject. So the art ships as-is.

Three things were checked rather than assumed, because each is a trap that has bitten this fleet:

  * **Transparency.** 13/15 are RGB; the two RGBA files measure min alpha 226 and 255 with
    99.0% / 100% of pixels fully opaque — antialiasing, not a sticker. So this is NOT the
    CQ9 `角標` / AWC `*_circular_*` / Habanero `Circle` / WM-disc trap, and the alpha channel is
    passed through untouched rather than flattened.
  * **Aspect.** Square, not landscape — so not the Habanero `Rectangle` / WM-poster trap either.
  * ⛔ **Resolution: 250px is all WM shipped, and it is NOT upscaled here.** Rendering the
    native file and a `sips -Z 512` upscale side by side into a real 230px card at
    `--force-device-scale-factor=2` produces indistinguishable output — interpolation adds bytes,
    not detail. cq9 ships 200x200 for the same reason. Worth asking WM for a higher-res pack;
    do NOT "fix" this by upscaling.

Mapping
-------
⭐ **The pack's numeric filename prefix is the only key**, and it is NOT the catalog's order:
the files are `1.骰寶.png` … `15. 仙狐姐妹.png` (Chinese titles, inconsistent spacing) while
`vendor_games` holds English names and opaque slugs. 15 files, 15 rows, 1:1. The map below is
explicit and carries each file's Chinese title so a re-check does not mean re-translating; every
pairing was confirmed by eye against a rendered contact sheet, not by transliteration alone —
e.g. 12 偶像少女 "idol girl" -> `gidol` and 13 足球寶貝 "football babe" -> `goallinebaby` are
only obvious once you have seen the art.

⭐ **Three of these OVERWRITE composited tiles.** `sicbovideo` / `xocdiavideo` / `hooheyhowvideo`
were drawn in 000070 out of the live pack's discs on a black/gold ground, because no slot art
existed then. WM's own art for those exact RNG games is strictly better, and the asset path is
unchanged — so those three rows are already correct in the DB and 000080's `IS DISTINCT FROM`
guard skips them; only the bytes change, at the next client-facing deploy.

With this pack WM reaches **23/23**: 8 live rows composited in 000070, 15 slots mirrored here.

⚠️ **The migration is 000080, not 000079, and the gap is deliberate.** `000079_jdb_unplayable`
was applied to the dev host and then dropped from the repo, so its row survives in
`schema_migrations` with no file behind it. pg.Migrate keys on the full stem, so a second
`000079_*` would apply cleanly — but two live migrations sharing a number is a trap, not a
saving. Do not renumber this down to close the gap.

Requires cwebp (brew install webp). Output is WebP q88 at the source's native 250x250.
"""

import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "public", "assets", "games", "wm")
URL_PREFIX = "/assets/games/wm"
VENDOR = "wm"
QUALITY = 88

# file prefix -> (vendor_games.id, the file's Chinese title, the catalog's English name).
# The last two columns are documentation: they are what makes this map auditable without
# re-opening the pack, and they are why the pairing can be trusted (see "Mapping" above).
TILES = {
    1:  ("wm-5031-sicbovideo",         "骰寶",       "Sicbo Spin"),
    2:  ("wm-5031-xocdiavideo",        "色碟",       "Xoc Dia Spin"),
    3:  ("wm-5031-hooheyhowvideo",     "魚蝦蟹",     "Fish Prawn Crab Spin"),
    4:  ("wm-5031-blastxp",            "blast X",    "BlastX"),
    5:  ("wm-5031-plinkop",            "plinko",     "Plinko"),
    6:  ("wm-5031-hilop",              "hilo",       "HiLo"),
    7:  ("wm-5031-wheelp",             "wheel",      "Wheel"),
    8:  ("wm-5031-dicep",              "DICE",       "Dice"),
    9:  ("wm-5031-witchlove",          "魔女煉愛",   "Witch Love"),
    10: ("wm-5031-nekomaid",           "甜心女僕",   "Neko Maid"),
    11: ("wm-5031-adventureofsinbad",  "辛巴達冒險", "Adventure of Sinbad"),
    12: ("wm-5031-gidol",              "偶像少女",   "G-idol"),
    13: ("wm-5031-goallinebaby",       "足球寶貝",   "Goal Line Baby"),
    14: ("wm-5031-missholmescoldcase", "夏洛克小姐", "Miss Holmes: Cold Case"),
    15: ("wm-5031-kitsunesister",      "仙狐姐妹",   "Kitsune Sister"),
}

# The three tiles this pack replaces with WM's own art (see "Mapping"). Reported at the end so a
# run that silently stops overwriting them is visible rather than quietly leaving 000070's draw.
REDRAWN = {"wm-5031-sicbovideo", "wm-5031-xocdiavideo", "wm-5031-hooheyhowvideo"}


def scan(pack):
    """pack dir -> {prefix: path}. Names are `<n>.<chinese>.png`, spacing is inconsistent."""
    found = {}
    for name in sorted(os.listdir(pack)):
        if not name.lower().endswith(".png"):
            continue
        head = name.split(".", 1)[0].strip()
        if not head.isdigit():
            sys.exit(f"{name}: no leading number — the prefix is the only key to the catalog")
        n = int(head)
        if n in found:
            sys.exit(f"{name}: duplicate prefix {n} (also {os.path.basename(found[n])})")
        found[n] = os.path.join(pack, name)
    return found


def render_sql(rows):
    return ("-- 13g WM Casino slot tiles (slotCode 5031).\n"
            "--\n"
            "-- Mirrored as-is from WM's hand-delivered `5031電子icon` pack by\n"
            "-- client-facing/scripts/import-wm-slot-icons.py. WM has no catalog API and no art\n"
            "-- URL (13g TECHNICAL §0 — the 23 rows are hand-seeded in migrations 000018/000027),\n"
            "-- so a hand-delivered pack is the only possible source.\n"
            "--\n"
            "-- Unlike the live-casino packs behind 000070, these need no compositing: they are\n"
            "-- 250x250 OPAQUE full-bleed squares with no wordmark and no baked-in title — the\n"
            "-- same shape ds/habanero/naga/pgsoft/sg/evolution ship, which .game-card's\n"
            "-- aspect-ratio 3/4 + object-fit: cover already crops cleanly. Not upscaled: 250px is\n"
            "-- what WM shipped and interpolation adds bytes, not detail (cq9 is 200x200).\n"
            "--\n"
            "-- image_url is ROOT-RELATIVE: the bytes are served by the client-facing Next.js app,\n"
            "-- so the path stays correct across every tenant domain.\n"
            "--\n"
            "-- Keyed on the row `id`, not game_code — WM's slot codes are '5031:witchlove', and a\n"
            "-- colon is not a usable asset file name. Same key as 000070.\n"
            "--\n"
            "-- This completes WM at 23/23. sicbovideo/xocdiavideo/hooheyhowvideo were DRAWN in\n"
            "-- 000070 (discs on a black/gold ground) because no slot art existed then; WM's own\n"
            "-- art replaces them at the same path, so those three rows are already correct here\n"
            "-- and the IS DISTINCT FROM guard skips them — only the asset bytes change.\n"
            "--\n"
            "-- Safe against a resync: WM has no catalog API at all, and 000027's upsert refreshes\n"
            "-- only game_code/name/category/status/metadata ON CONFLICT, so it never clears\n"
            "-- image_url.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(id, url)\n"
              f" WHERE g.vendor_id = '{VENDOR}'\n"
              "   AND g.id = v.id\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", help="the extracted `5031電子icon` directory")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="convert, write nothing to the repo")
    ap.add_argument("--preview", help="also drop the .webp files here (works with --dry-run)")
    args = ap.parse_args()

    found = scan(args.pack)
    missing = sorted(set(TILES) - set(found))
    extra = sorted(set(found) - set(TILES))
    if missing:
        print(f"  MISSING from pack: {[TILES[n][0] for n in missing]}", file=sys.stderr)
    for n in extra:
        # A 16th file means WM added a slot; the catalog (migration 000027) needs the row first.
        print(f"  UNMAPPED: {os.path.basename(found[n])} — not in TILES, catalog row?",
              file=sys.stderr)

    dests = []
    if not args.dry_run:
        os.makedirs(OUT_DIR, exist_ok=True)
        dests.append(OUT_DIR)
    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        dests.append(args.preview)

    rows, total = [], 0
    for n in sorted(set(TILES) & set(found)):
        game_id, zh, name = TILES[n]
        src = found[n]
        blob = None
        for d in dests:
            out = os.path.join(d, game_id + ".webp")
            try:
                subprocess.run(["cwebp", "-quiet", "-q", str(QUALITY), src, "-o", out],
                               check=True, capture_output=True)
            except subprocess.CalledProcessError as e:
                sys.exit(f"{game_id}: cwebp failed — {e.stderr.decode(errors='replace').strip()}")
            blob = os.path.getsize(out)
        if blob is None:                       # --dry-run with no --preview: size the encode only
            blob = 0
        total += blob
        tag = "  (replaces the 000070 drawing)" if game_id in REDRAWN else ""
        print(f"  {n:>2}. {zh:<10} -> {game_id:<28} {name}{tag}")
        rows.append(f"  ('{game_id}', '{URL_PREFIX}/{game_id}.webp')")

    verb = "would write" if args.dry_run else "wrote"
    where = ", ".join(dests) or "(nowhere — dry run)"
    print(f"{verb} {len(rows)} icons -> {where}  ({total/1024:.0f} KB)")

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(rows))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
