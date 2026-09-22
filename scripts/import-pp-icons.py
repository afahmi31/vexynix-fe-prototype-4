#!/usr/bin/env python3
"""Import Pragmatic Play's game icons into public/assets/games/pragmaticplay + emit the catalog SQL.

Unlike PG SOFT (which ships a Dropbox art pack — see import-pgsoft-icons.py), PP publishes
artwork on a public CDN at one deterministic URL per gameID, documented in
game-docs/Pragmatic-Play-Integration-API-Reference.md §2.1.1:

    https://common-static.ppgames.net/gs2c/common/lobby/v1/apps/slots-lobby-assets
        /{gameID}/{gameID}_{size}_{branding}[_{language}].{ext}

No auth, no hash, no IP allow-list — the one PP surface that is not gated. So there is no
title matching and no OVERRIDES table here: game_code IS the gameID IS the file name.

    # 1. the catalog, as the DB has it (game_code is PP's gameID)
    psql "$SIMLES_DATABASE_URL" -Atc "select json_agg(json_build_object('id',id,
        'game_code',game_code,'name',name))
        from vendor_games where vendor_id='pragmaticplay'" > pp-catalog.json
    # 2. import
    python3 scripts/import-pp-icons.py pp-catalog.json --sql 000041_pp_game_icons.up.sql

PP already serves WebP (~50 KB) alongside PNG (~183 KB), so we download WebP directly — no
cwebp, no re-encode, no dependency beyond the stdlib.

⚠️  common-static.ppgames.net is DNS-blocked by Indonesian ISPs: the local resolver answers
with a block-page address instead of PP's CloudFront distribution, and the connection hangs.
That is exactly why these icons are mirrored rather than hot-linked — a hot-linked URL would
be fetched by the PLAYER's browser and hit the same block. This script detects the hijack and
routes around it by resolving the real address over DNS-over-HTTPS and pinning it (SNI and
certificate validation still use the real hostname, so TLS stays fully verified).
"""
import argparse, concurrent.futures, json, os, re, socket, ssl, sys, urllib.request

HOST = "common-static.ppgames.net"
BASE = f"https://{HOST}/gs2c/common/lobby/v1/apps/slots-lobby-assets"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "assets", "games", "pragmaticplay")
URL_PREFIX = "/assets/games/pragmaticplay"

# Variants to try per game, best first. The official spec (spec/Pragmatic Integration API
# Specification.pdf §2.1.1, p.18) lists ~14 sizes but bolds the "old sizes" that exist for
# MOST games: 138x138, 160x115, 188x83, 200x200, 325x234. Probing live, 200x200 is the only
# bold size served as WebP for every game tried (260x350 is missing for vs50aladdin, 138x138
# WebP for vs20olympgate), and its square shape matches the pgsoft tiles — so it leads.
# "NB" = unbranded; "B" carries PP's own lobby branding baked into the art.
VARIANTS = ("200x200_NB", "325x234_NB", "260x350_NB")
TIMEOUT = 20
# Measured ~1 icon/sec end to end (latency-bound, not worker-bound — raising this further
# barely moved the wall clock), so budget roughly a minute per 60 games.
WORKERS = 16


def doh_resolve(host):
    """Real address of `host` via Cloudflare DNS-over-HTTPS, bypassing a hijacked resolver."""
    req = urllib.request.Request(
        f"https://1.1.1.1/dns-query?name={host}&type=A",
        headers={"accept": "application/dns-json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        answers = json.load(r).get("Answer", [])
    # A CNAME chain (ppgames.net -> CloudFront) precedes the A records; keep only the latter.
    ips = [a["data"] for a in answers if a.get("type") == 1]
    if not ips:
        sys.exit(f"DoH returned no A record for {host}")
    return ips[0]


def pin_dns(host, ip):
    """Force `host` to resolve to `ip` process-wide, leaving SNI/cert checks on the hostname."""
    real = socket.getaddrinfo

    def patched(h, port, *a, **kw):
        return real(ip if h == host else h, port, *a, **kw)

    socket.getaddrinfo = patched


def reachable():
    try:
        fetch(f"{BASE}/vs20olympgate/vs20olympgate_{VARIANTS[0]}.webp")
        return True
    except Exception:
        return False


def fetch(url):
    req = urllib.request.Request(url, headers={"user-agent": "game-web-icon-import/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ssl.create_default_context()) as r:
        return r.read()


def grab(game):
    """Download the best available icon for one game -> (game, bytes, variant) or (game, None, '')."""
    gid = game["game_code"]
    for v in VARIANTS:
        try:
            return game, fetch(f"{BASE}/{gid}/{gid}_{v}.webp"), v
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"  ! {gid} {v}: HTTP {e.code}", file=sys.stderr)
        except Exception as e:
            print(f"  ! {gid} {v}: {e}", file=sys.stderr)
    return game, None, ""


def render_sql(rows):
    return ("-- Pragmatic Play game artwork: point every catalog row at its local icon asset.\n"
            "--\n"
            "-- Source: PP's public lobby-asset CDN (Integration API Reference §2.1.1), one\n"
            "-- deterministic URL per gameID. Icons are the unbranded WebP PP already serves —\n"
            "-- the 200x200 square, the size the spec bolds as existing for most games\n"
            "-- (325x234 / 260x350 as fallbacks) — mirrored verbatim into\n"
            "-- client-facing/public/assets/games/pragmaticplay/\n"
            "-- <gameID>.webp and committed. Generated by scripts/import-pp-icons.py.\n"
            "--\n"
            "-- Mirrored rather than hot-linked on purpose: common-static.ppgames.net is\n"
            "-- DNS-blocked by Indonesian ISPs, so a hot-linked URL would break in the PLAYER's\n"
            "-- browser — every lobby tile, for our launch market.\n"
            "--\n"
            "-- image_url is a ROOT-RELATIVE path, matching the pgsoft pack (000039): the icons\n"
            "-- are served by the client-facing Next.js app, so it stays correct across every\n"
            "-- host/tenant domain.\n"
            "--\n"
            "-- Safe against a resync: pp-probe sync-games refreshes only name/category/metadata\n"
            "-- ON CONFLICT, so it never clears image_url. A game PP adds LATER lands with\n"
            "-- image_url NULL and the UI falls back to its initial-letter placeholder.\n\n"
            "ALTER TABLE vendor_games ADD COLUMN IF NOT EXISTS image_url TEXT;\n\n"
            "UPDATE vendor_games g\n   SET image_url = v.url\n  FROM (VALUES\n"
            + ",\n".join(rows)
            + "\n  ) AS v(id, url)\n WHERE g.id = v.id\n"
              "   AND g.vendor_id = 'pragmaticplay'\n"
              "   AND g.image_url IS DISTINCT FROM v.url;\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalog", help="pp-catalog.json: [{id, game_code, name}, ...]")
    ap.add_argument("--sql", help="write the vendor_games UPDATE here")
    ap.add_argument("--dry-run", action="store_true", help="probe availability, download nothing")
    args = ap.parse_args()

    catalog = json.load(open(args.catalog))
    bad = [g for g in catalog if not re.fullmatch(r"[A-Za-z0-9_-]+", g.get("game_code") or "")]
    if bad:
        sys.exit(f"game_code is not a usable path segment for: {[g['id'] for g in bad]}")

    if not reachable():
        ip = doh_resolve(HOST)
        print(f"{HOST} unreachable via the local resolver — pinning {ip} (DoH)")
        pin_dns(HOST, ip)
        if not reachable():
            sys.exit(f"{HOST} still unreachable after pinning {ip}")

    print(f"catalog {len(catalog)} games")
    rows, missing, total = [], [], 0
    os.makedirs(OUT_DIR, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(WORKERS) as pool:
        for game, blob, variant in pool.map(grab, catalog):
            if blob is None:
                missing.append(game)
                continue
            gid = game["game_code"]
            if not args.dry_run:
                with open(os.path.join(OUT_DIR, gid + ".webp"), "wb") as fh:
                    fh.write(blob)
            total += len(blob)
            rows.append(f"  ('{game['id']}', '{URL_PREFIX}/{gid}.webp')")
            if variant != VARIANTS[0]:
                print(f"  {gid}: no {VARIANTS[0]}, used {variant}")

    for g in missing:
        print(f"  NO ICON: {g['id']} {g['name']!r} ({g['game_code']})")
    verb = "would write" if args.dry_run else "wrote"
    print(f"{verb} {len(rows)} icons -> {OUT_DIR}  ({total/1024/1024:.1f} MB), {len(missing)} missing")

    if args.sql and rows and not args.dry_run:
        with open(args.sql, "w") as fh:
            fh.write(render_sql(sorted(rows)))
        print("wrote", args.sql)


if __name__ == "__main__":
    main()
