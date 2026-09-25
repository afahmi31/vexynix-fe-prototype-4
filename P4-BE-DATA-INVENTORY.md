# P4 Staging BE Data Inventory

Snapshot date: 2026-09-25

Environment: `https://app.vexynix.com`

This is a read-only snapshot of the public responses used by the P4 frontend. It
is an inventory, not a replacement for the backend contract. Counts can change
when the staging catalog is refreshed.

## Public endpoints checked

| Endpoint | Response observed | P4 usage |
| --- | --- | --- |
| `GET /api/brand` | Brand label, logo URL, merchant ID, and theme values | Brand and theme bootstrap |
| `GET /api/vendors` | 24 vendor records | Provider names and provider filters |
| `GET /api/games/catalog` | 3,528 active game records | Catalog, game cards, category filter, provider game lists |
| `GET /api/games/catalog?vendor=<id>` | Backend-supported vendor filter | Available for a narrower catalog request; the current P4 hook requests the full catalog |
| `GET /api/feed/latest-bets?limit=18&window=7d` | Latest settled bets for the public lobby | `Taruhan Terbaru` activity tab |
| `GET /api/feed/big-wins?limit=18&window=7d` | Big-win activity for the public lobby | `Menang Besar` activity tab |
| `GET /api/feed/leaderboard?limit=18&window=7d` | Ranked players with wager and win totals | `Top Pemain` activity tab |
| `POST /api/games/launch` | Game launch action | Not a catalog data source |

The catalog response has the top-level shape:

```json
{
  "games": []
}
```

The vendors response has the top-level shape:

```json
{
  "vendors": []
}
```

## Current totals

- Games returned: **3,528**.
- Active games: **3,528**.
- Vendors returned: **24**.
- Vendors with at least one catalog game: **21**.
- Vendors with zero catalog games: **AWC**, **Evolution Slot**, and **Naga Games**.
- Games with an image URL: **3,346**.
- Games without an image URL: **182**.
- Games with `demo_supported: true`: **1,352**.

## Catalog fields observed

| Field | Present | Non-empty | Notes |
| --- | ---: | ---: | --- |
| `id` | 3,528 | 3,528 | Frontend game identifier |
| `vendor_id` | 3,528 | 3,528 | Joins to `vendors[].id` |
| `game_code` | 3,528 | 3,524 | Four records have an empty game code |
| `name` | 3,528 | 3,528 | Player-facing game name |
| `category` | 3,528 | 3,528 | Used by the dynamic P4 category filter |
| `min_bet` | 3,528 | 3,528 | Numeric minimum bet |
| `max_bet` | 3,528 | 3,528 | Numeric maximum bet |
| `status` | 3,528 | 3,528 | All records in this snapshot are `active` |
| `image_url` | 3,346 | 3,346 | 182 records omit this field |
| `demo_supported` | 3,528 | 3,528 | Boolean demo capability |
| `rtp` | 0 | 0 | Not returned publicly |
| `description` | 0 | 0 | Not returned publicly |
| `is_featured` | 0 | 0 | Not returned publicly |
| `is_popular` | 0 | 0 | Not returned publicly |
| `is_new` | 0 | 0 | Not returned publicly |

The public catalog response also does not expose `hot` or `trending` flags.
Provider-internal probe data may contain similar concepts, but those values are
not part of the public catalog response and are not safe for the frontend to
assume.

## Categories returned by BE

| Category | Games |
| --- | ---: |
| `slot` | 2,973 |
| `live` | 270 |
| `table` | 137 |
| `fish` | 46 |
| `arcade` | 34 |
| `table game` | 21 |
| `crash` | 16 |
| `bingo` | 11 |
| `casino` | 7 |
| `card` | 6 |
| `animal` | 2 |
| `lobby` | 2 |
| `sports` | 2 |
| `baccarat` | 1 |

## Vendors returned by BE

All 24 vendors were `active` and `enabled: true` in this snapshot.

| ID | Name | Games |
| --- | --- | ---: |
| `pt` | Playtech (GamesLink) | 967 |
| `pragmaticplay` | Pragmatic Play | 723 |
| `joker` | Joker Gaming | 330 |
| `habanero` | Habanero | 265 |
| `bng` | BNG | 201 |
| `pgsoft` | PG SOFT | 170 |
| `cq9` | CQ9 Gaming | 149 |
| `afb` | AFB Gaming | 142 |
| `sg` | Spadegaming | 139 |
| `ds` | Dragoon Soft | 123 |
| `rich88` | RiCH88 | 109 |
| `fs` | FastSpin | 80 |
| `cosmoplay` | CosmoPlay | 38 |
| `wm` | WM Casino | 23 |
| `fuma` | FUMA (FumaGames) | 34 |
| `awcsexy` | AWC SEXY (Sexy Baccarat & SV388) | 11 |
| `jdb` | JDB | 8 |
| `evolution` | Evolution (Live Casino) | 7 |
| `w568` | 568Win / SBO | 6 |
| `dg` | DreamGaming | 1 |
| `jokerbaccarat` | Joker Baccarat (EliteHubz) | 1 |
| `awc` | AWC (All We Can) | 0 |
| `evolution_slot` | Evolution Slot | 0 |
| `naga` | Naga Games | 0 |

## Sample catalog records

```json
[
  {
    "id": "afb-88fortunes-skg",
    "vendor_id": "afb",
    "game_code": "88Fortunes-skg",
    "name": "Banyak Keberuntungan",
    "category": "slot",
    "min_bet": 1000,
    "max_bet": 100000000,
    "status": "active",
    "image_url": "/assets/games/afb/88Fortunes-skg.webp",
    "demo_supported": false
  },
  {
    "id": "afb-andarbahar-skg",
    "vendor_id": "afb",
    "game_code": "andarBahar-skg",
    "name": "Andar Bahar",
    "category": "table",
    "min_bet": 1000,
    "max_bet": 100000000,
    "status": "active",
    "image_url": "/assets/games/afb/andarBahar-skg.webp",
    "demo_supported": false
  }
]
```

## P4 integration decision

- The catalog category filter now builds its options from `games[].category`.
- The existing **Top 5** selection remains unchanged. It is not replaced by a
  catalog sort because the public BE response has no ranking field.
- **Sedang Ramai Dimainkan** and **Game Paling Hot** keep their existing
  section titles and current fallback content. They are not switched to BE
  trending or hot data because no public endpoint or field for those lists was
  found in this staging contract.
- The lobby content structure is unchanged.

## Activity data from the PM chat and staging BE

The PM chat names three intended activity views:

1. `Taruhan Terbaru` — latest bets.
2. `Menang Besar` — big wins.
3. `Top Pemain` — top players or leaderboard.

The deployed staging lobby uses these public, tenant-scoped, read-only feeds:

```text
GET /api/feed/latest-bets?limit=18&window=7d
GET /api/feed/big-wins?limit=18&window=7d
GET /api/feed/leaderboard?limit=18&window=7d
```

The two bet feeds return `game`, masked `player`, `bet`, `payout`, `win`,
`multiplier`, `vendor_id`, and `settled_at`. The leaderboard returns `rank`,
masked `player`, `rounds`, `wager`, `payout`, and `win`.

The P4 activity card now maps these responses to `Taruhan Terbaru`, `Menang
Besar`, and `Top Pemain` without changing the surrounding lobby structure. The
catalog activity panel uses the same feed data when the catalog view is open.

The current staging snapshot contained one row for each bet feed and two rows
for the leaderboard. The values are live staging data and can change between
requests.

## Refreshing this inventory

Run these read-only PowerShell commands from the repository root when the
staging catalog changes:

```powershell
Invoke-RestMethod 'https://app.vexynix.com/api/games/catalog' |
  ConvertTo-Json -Depth 10

Invoke-RestMethod 'https://app.vexynix.com/api/vendors' |
  ConvertTo-Json -Depth 10

Invoke-RestMethod 'https://app.vexynix.com/api/feed/latest-bets?limit=18&window=7d' |
  ConvertTo-Json -Depth 10

Invoke-RestMethod 'https://app.vexynix.com/api/feed/big-wins?limit=18&window=7d' |
  ConvertTo-Json -Depth 10

Invoke-RestMethod 'https://app.vexynix.com/api/feed/leaderboard?limit=18&window=7d' |
  ConvertTo-Json -Depth 10
```
