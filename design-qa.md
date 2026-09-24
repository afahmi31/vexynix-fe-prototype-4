# Design QA — P4 category catalog redesign

## Source visual truth

- Source mockup: `C:\Users\user\.codex\generated_images\01a0bf6d-e7ea-74f1-ac79-1b911463af15\exec-6861ed09-622b-4bdb-b13f-7c46a8365d9a.png`
- Source pixels: `1003 x 1568`
- Source state: public `Semua Game` category with the selected filter-sidebar layout, split Neon Racer hero, quick picks, 5-column catalog, pagination, new-games CTA, activity/ranking panels, and VEXYNIX footer.

## Rendered implementation evidence

- Local route: `http://localhost:3004/lobby?category=all#p4-catalog`
- Browser evidence: screenshots captured from the live Chrome tab through CUA at desktop, tablet, and mobile viewports. The browser adapter returned the captures inline and did not expose a persisted screenshot file path.
- Desktop CSS viewport: `2560 x 1215`, device scale factor 1; full-page capture was also inspected after the lazy-loaded CTA/activity regions were brought into view.
- Tablet CSS viewport: `1024 x 800`, device scale factor 1.
- Tablet revision viewport: `820 x 1180`, device scale factor 1.
- Mobile CSS viewport: `390 x 844`, device scale factor 1.
- Implementation asset pixels: hero `2170 x 725`; CTA `2172 x 724`.
- Density normalization: no downsampling was applied; comparisons use CSS viewport measurements and the source mockup's displayed composition.

## Comparison evidence

- Full-view composition: the category page now follows the selected mockup hierarchy: heading/search, split Neon Racer hero with `Pilihan cepat`, filter rail plus catalog grid, pagination, image-led CTA, activity/ranking block, and footer.
- Focused hero comparison: the desktop keeps the dark copy area on the right; tablet and mobile move the same copy to the lower-left with a left-side readability gradient.
- Focused CTA comparison: the generated pink/lilac new-games banner keeps copy space on the left and the character/coins on the right. The banner uses the full image without a white card overlay.
- Responsive evidence: desktop rendered 5 catalog columns; the revised tablet view renders 5 columns with a modal filter; mobile renders 3 columns with the same modal filter, and no horizontal overflow was observed.

## Interaction checks

- Provider checkbox filtering: verified `Evolution` changes the result count from 106 to 7.
- Category filtering: verified `Slot` navigates to `/lobby?category=slot#p4-catalog` and combines with the selected provider to show the matching result.
- Reset filter: verified provider/search/sort state resets and returns to `category=all`.
- Pagination controls remain present and update the catalog page.
- Hero action, quick-pick actions, CTA action, game cards, latest activity rows, and ranking rows remain wired to the existing P4 prototype interactions.

## Required fidelity surfaces

- Fonts and typography: hierarchy, weight, wrapping, and line-height were reviewed at desktop/tablet/mobile. The existing P4 type system is retained; compact labels reduce at narrow widths without clipping.
- Spacing and layout rhythm: category hero, filter rail, 5-column grid, CTA, activity panels, and footer use consistent gutters and section gaps. The mobile CTA and activity panels remain within the viewport width.
- Colors and visual tokens: lavender page canvas, indigo type, pink active states, white glass panels, dark navy hero copy area, and navy footer remain aligned with the selected P4 theme.
- Image quality and asset fidelity: existing game artwork is reused. Only the two missing visual slots use generated raster assets: the catalog hero and new-games CTA. No inline SVG or placeholder artwork was introduced.
- Copy and content: all visible labels are user-facing Indonesian copy; no development or generation prefixes appear in the UI.

## Comparison history

- Initial implementation pass: no actionable P0/P1/P2 visual difference remained after the desktop, tablet, and mobile review. The only build blocker was the existing P4 header `useSearchParams()` prerender requirement; a `Suspense` boundary was added in `PortalHeader.tsx`, then the production build passed.
- Post-fix evidence: `next build` completed successfully, and the live route continued to render the category page with the same tested interactions.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Accepted polish: generated hero/CTA imagery is directionally matched to the mockup rather than pixel-identical to the source illustration. This is within the user's explicit permission to generate missing assets and keeps the layout/content contract intact.

## Implementation checklist

- [x] Split Neon Racer category hero with quick picks.
- [x] Provider, category, sort, search, reset, and pagination controls.
- [x] Five-column desktop catalog with responsive tablet/mobile layouts.
- [x] Full-image new-games CTA below pagination.
- [x] Activity and ranking panels below the CTA.
- [x] Existing P4 game detail/launch interactions preserved.
- [x] Desktop, tablet, and mobile browser QA completed.
- [x] TypeScript, ESLint, formatting, and production build passed.

## Final result

passed

## Post-comment revision — mobile filter

- At viewports up to `760px`, the full filter sidebar is replaced by a compact `Filter Game` trigger.
- The trigger opens a centered responsive modal dialog with a backdrop, visible close action, category/provider/sort controls, and reset action.
- The page locks body scrolling while the filter modal is open and restores scrolling after close.
- Browser verification at `412 x 915`: the closed trigger is `48px` high, the modal is hidden, the game grid renders three columns with no horizontal overflow, and provider filtering still updates the result count.
- Open-modal measurement at `412 x 915`: the dialog is centered at `380 x 554px` with the themed lavender/indigo surface and backdrop.

final result: passed

## Post-comment revision — mobile hero

- At mobile widths, hero copy is anchored to the lower-left of the artwork instead of the right side.
- The hero overlay now darkens the left side for readable copy while keeping the car/city artwork visible on the right.
- Badge, title, metadata, description, and CTA spacing were tightened to keep the visual focus in the lower hero area.
- Browser verification at `412 x 915`: copy bounds remain inside the hero, the CTA sits above the lower edge, and the page has no horizontal overflow.

final result: passed

## Post-comment revision — tablet parity

- At `820 x 1180`, the tablet filter now uses the same compact trigger and centered modal treatment as mobile.
- Tablet hero copy is anchored to the lower-left with the same spacing direction as mobile.
- Tablet catalog grid now renders five game cards per row.
- Browser verification confirmed five equal grid columns, centered modal bounds, and no horizontal overflow.

final result: passed

## Post-comment revision — P4 game-play redesign

### Source visual truth

- User request: redesign `http://localhost:3004/mock-game/mahjong-ways-2?mode=demo` so the game-play page follows the current Prototype 4 public theme instead of the legacy dark game screen.
- Existing Mahjong Ways 2 artwork was reused from the project catalog; no new raster asset was required.

### Rendered implementation evidence

- Local route: `http://localhost:3004/mock-game/mahjong-ways-2?mode=demo`
- Desktop CSS viewport: `1440 x 900`; the hero uses a wide artwork panel beside the play panel within a centered `1180px` content frame.
- Tablet CSS viewport: `820 x 1180`; the hero collapses to a single column and the three supporting information cards remain in one row.
- Mobile CSS viewport: `412 x 915`; the hero and play panel stack, supporting cards stack vertically, and `document.documentElement.scrollWidth` matches the viewport width.

### Comparison and interaction checks

- The legacy dark header, local preview label, dark console row, and `Classic Cinema` template dock are no longer shown on the game-play route.
- The P4 header and footer are shared with the lobby, including the lavender canvas, indigo typography, pink mode badge, white glass surfaces, and purple primary action.
- The game image remains the visual anchor; title and metadata stay readable over a left-to-bottom dark gradient.
- `Putar Sekali` was clicked in the live browser and the displayed round count changed from `0` to `1`.
- `Kembali ke Lobby` and `Jelajahi game lainnya` remain available as real links.

### Verification

- TypeScript: `node_modules/.bin/tsc.cmd --noEmit` passed.
- Prettier: passed for the changed TSX and SCSS files.
- Browser QA: desktop, tablet, and mobile layout measurements completed; no horizontal overflow observed.
- ESLint: blocked by the existing environment because `eslint-plugin-react-hooks` is missing from `node_modules`; no code lint result is claimed.

### Final result

passed

## Post-comment revision — game-play mobile/tablet control spacing

- Added an explicit `1rem` gap between the balance/round stat cards and the `Putar Sekali` button below the `900px` breakpoint.
- Browser verification at `412 x 915` and `820 x 1180` measured a `16px` gap in both layouts with no horizontal overflow.

final result: passed

## Post-comment revision — catalog filter typography and panel width

- Widened the desktop catalog filter column to `248px` so the sidebar no longer reads as a narrow strip beside the five-column game grid.
- Increased the filter heading, group labels, category pills, provider/sort options, counts, and reset action to the same readable scale used by the P4 navigation and footer.
- Browser verification at `1920px`: filter panel width measured `248px`; heading `17.28px`, group label `12.8px`, provider option `12.16px`, and category pill `11.52px`.
- Browser verification at `412px`: the filter remains a centered modal with a `567px` sheet height and no horizontal overflow.

final result: passed

---

## Historical QA records

The earlier P4 provider and lobby QA records are retained below for traceability.

# Design QA — P4 Provider game grid parity

## Comparison target

- Source visual truth: `C:/Users/user/AppData/Local/Temp/codex-clipboard-a83ef2c3-c7dd-4f0a-b4b9-1fca1c36cbe5.png`
- Implementation URL: `http://localhost:3004/lobby`
- Implementation focus: `#p4-provider-games`
- Implementation screenshots:
  - `output/playwright/p4-provider-games-desktop.png`
  - `output/playwright/p4-provider-games-tablet.png`
  - `output/playwright/p4-provider-games-mobile.png`

The requested visual is the existing provider game-list treatment: a six-column desktop grid with three rows, a soft fade over the last row, and a centered `Lihat Semua` action layered over the fade.

## Capture and normalization

| Capture                | CSS viewport | Screenshot pixels |           Density | State                              |
| ---------------------- | -----------: | ----------------: | ----------------: | ---------------------------------- |
| Source visual          |          n/a |        1315 × 543 |     source raster | Provider game list, Pragmatic Play |
| Desktop implementation |  1440 × 1000 |        1348 × 548 | 1x CSS screenshot | Provider game list, Pragmatic Play |
| Tablet implementation  |   768 × 1024 |         720 × 301 | 1x CSS screenshot | Provider game list, Pragmatic Play |
| Mobile implementation  |    390 × 844 |         374 × 602 | 1x CSS screenshot | Provider game list, Pragmatic Play |

The focused captures use the same game-list component boundary so the source and implementation can be compared without stretching the full lobby canvas.

## Visual review

- Desktop now renders 18 provider games in 6 columns × 3 rows, matching the reference composition.
- The final row is covered by the lavender bottom fade and the centered white `Lihat Semua` button is layered above it.
- Tablet preserves the six-column list used by the previous P4 treatment; mobile switches to three columns so cards remain usable without horizontal overflow.
- No placeholder imagery or new interaction was introduced; the existing provider selection and `Lihat Semua` navigation remain intact.

## Findings

No actionable P0, P1, or P2 findings remain for this requested parity change.

## Verification

- Browser metrics: 18 games, overlay present, `Lihat Semua` present at 1440px, 768px, and 390px widths.
- Responsive width check: `document.body.scrollWidth` equals the viewport width at all three tested widths.
- Browser console: 0 errors and 0 warnings in the final Playwright pass.
- Prettier: passed for the changed TSX and SCSS files.
- ESLint: passed for `src/components/game/p4/P4LobbyPage.tsx`.
- TypeScript: `node_modules/.bin/tsc.cmd --noEmit` passed.
- Dev server: running at `http://localhost:3004` from `D:/xproject/oches/fe-prototype-4`.

## Implementation checklist

- [x] 6-column × 3-row desktop provider game grid.
- [x] Soft bottom overlay over the final row.
- [x] Centered `Lihat Semua` action on the overlay.
- [x] Responsive tablet/mobile columns without horizontal overflow.
- [x] Existing provider and game interactions preserved.

final result: passed

# Design QA — P4 Provider Pilihan Option 3

## Comparison target

- Source visual truth: `C:/Users/user/.codex/generated_images/01a0bf6d-e7ea-74f1-ac79-1b911463af15/exec-aa7110d4-cf82-4577-9876-53f6cd95331c.png`
- Implementation URL: `http://localhost:3004/lobby`
- Implementation focus: `#p4-providers`
- Implementation screenshots:
  - `output/playwright/p4-provider-option3-desktop.png`
  - `output/playwright/p4-provider-option3-tablet.png`
  - `output/playwright/p4-provider-option3-mobile.png`

The source visual is an isolated Provider Pilihan section. The implementation was compared as the same section inside the unauthenticated P4 public lobby so the surrounding shell was not treated as part of the target.

## Capture and normalization

| Capture                | CSS viewport | Screenshot pixels |           Density | State                             |
| ---------------------- | -----------: | ----------------: | ----------------: | --------------------------------- |
| Source visual          |          n/a |        1586 × 992 |     source raster | Option 3, Pragmatic Play selected |
| Desktop implementation |  1440 × 1000 |        1348 × 777 | 1x CSS screenshot | `/lobby`, Pragmatic Play selected |
| Tablet implementation  |   768 × 1024 |         720 × 913 | 1x CSS screenshot | `/lobby`, Pragmatic Play selected |
| Mobile implementation  |    390 × 844 |         374 × 701 | 1x CSS screenshot | `/lobby`, Pragmatic Play selected |

The implementation captures are element screenshots of `#p4-providers`; their pixels exclude the surrounding page gutter. Comparison was made on the content region rather than by stretching the two different canvas sizes to identical dimensions.

## Visual review

### Full-view evidence

The source and desktop implementation were opened together for comparison. The final implementation has the same primary composition: Provider Pilihan heading and link, five equal provider selector cards, a coral selected state, the divider with diamond ends, and six landscape game cards in a 3 × 2 grid.

### Focused-region evidence

The provider selector and game grid were reviewed at desktop, tablet, and mobile widths. The focused region was required because the source visual is itself a component-level design and the important fidelity details are the selector state, divider treatment, card ratio, image crop, and responsive grid.

## Findings

No actionable P0, P1, or P2 findings remain after the final pass.

### Comparison history

1. Initial implementation review — fixed: the provider component rendered the complete provider catalog instead of the six cards shown by the selected design, which added extra rows and exposed mock assets that were not part of the target. Fix: render `providerGames.slice(0, 6)` in `P4ProviderSection`. Post-fix desktop, tablet, and mobile captures show exactly six cards.
2. Final review — no P0/P1/P2 findings. The provider selector, selected state, game count, responsive columns, copy, imagery, and spacing were rechecked after the fix.

## Required fidelity surfaces

- Fonts and typography: heading hierarchy, italic provider label, compact selector labels, and game metadata remain readable at all three tested widths; no text collision or unexpected wrapping was observed in the provider section.
- Spacing and layout rhythm: five selector cards are evenly distributed on desktop, collapse to three columns on tablet and two columns on mobile, and the game grid uses three columns on desktop/tablet and two columns on mobile. Final checks reported no horizontal overflow (`body.scrollWidth === innerWidth`).
- Colors and visual tokens: the selected provider uses the warm coral outline, pale peach surface, orange mark, and active dot from the target direction; inactive cards retain the quiet lavender/white P4 palette.
- Image quality and asset fidelity: the six displayed game cards use the existing P4 mock game imagery and landscape crop; no new placeholder imagery or CSS image substitute was introduced.
- Copy and content: the target-facing copy remains `Provider Pilihan`, `Pilih provider favorit untuk melihat koleksi gamenya.`, provider names, and the existing `Lihat Semua` action.
- Icons: existing Font Awesome provider marks are used consistently and remain visible at the tested breakpoints.
- States and interactions: provider selector buttons are semantic buttons with `aria-pressed`; clicking Evolution changed the selected state, heading, and six displayed games to Evolution data. Existing game-card click behavior and the top `Lihat Semua` action remain available.
- Accessibility and responsiveness: provider controls have descriptive labels, selected state is exposed, and no viewport overflow was observed at 1440px, 768px, or 390px widths.

## Verification

- Prettier: passed for `src/components/game/p4/P4LobbyPage.tsx` and `src/styles/portal/_p4-lobby.scss`.
- ESLint: passed for `src/components/game/p4/P4LobbyPage.tsx`.
- TypeScript: `node_modules/.bin/tsc.cmd --noEmit` passed.
- Production build: `node_modules/.bin/next.cmd build` passed.
- Browser console: final Playwright pass reported 0 errors. One existing warning concerns the below-the-fold leaderboard CTA image being an LCP candidate; it is outside this provider redesign.
- Dev server: running at `http://localhost:3004` from `D:/xproject/oches/fe-prototype-4`.

## Implementation checklist

- [x] Five equal provider selector cards.
- [x] Coral selected state with active dot.
- [x] Provider divider with diamond ends.
- [x] Six provider games only, arranged as 3 × 2 on desktop.
- [x] Responsive 3-column/2-column behavior for tablet and mobile.
- [x] Existing provider and game interactions preserved.
- [x] No new image generation required; existing project assets reused.

## Follow-up Polish

No follow-up is required for this option build. Exact pixel-scale tuning can be revisited only if a final target export with the same page canvas and density is provided.

final result: passed

## Previous QA record retained

The preceding P4 lobby QA record is retained below; the latest provider Option 3 pass follows it.

# FE Prototype 4 Top 5 Design QA

## Source visual truth

- Target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-eee7ae92-b384-451b-9a5f-cc4873785640.png`
- Featured target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-dfbe7d12-aaaf-4fd5-bf6c-496d4b4055bd.png`
- CTA target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-e32db656-aa71-44e8-98b8-e847253dffbe.png`
- Baseline comparison: `C:\Users\user\AppData\Local\Temp\codex-clipboard-faf9a28d-91fc-41d1-8004-3d1ad730f037.png`
- Target crop pixels: 919 x 344

## Implementation evidence

- Rendered URL: `http://127.0.0.1:3004/lobby`
- Browser: Chrome localhost tab for the latest visual pass
- Default visual capture: 1087 x 912 CSS px, device scale factor 1
- Latest live viewport check: 1593 x 855 CSS px, device scale factor 1
- Focused Top 5 capture: 596 x 216 CSS px, normalized to the section bounds
- Responsive captures/checks: 768 x 1024 tablet and 390 x 844 mobile
- State: unauthenticated lobby, local mock catalog, default hero, detail modal closed

The focused source is a zoomed section crop while the implementation is inside
the documented two-column lobby composition. Comparison therefore uses the
section bounds and visual proportions rather than raw pixel dimensions.

## Fidelity review

- Fonts and typography: section heading hierarchy and compact supporting copy
  are preserved; ranked cards now use a two-line bottom band for the game title
  and provider label.
- Spacing and layout rhythm: five cards remain in rank order, the ranked card
  ratio changes from 0.62 to 0.70, and the card spacing remains responsive.
- Colors and visual tokens: each rank uses a separate pastel tile gradient, with
  a violet emphasis for rank one that remains within the existing theme.
- Image quality and asset fidelity: existing local game artwork remains in use;
  the CTA backgrounds use two lightweight local generated illustrations rather
  than placeholders or CSS drawings.
- Copy and content: `Top 5 Minggu Ini`, `Game yang paling sering dimainkan.`,
  game names, provider labels, and the display-only `HACKSAW GAMING` label match
  the target treatment. The underlying mock catalog contract remains unchanged.

## Comparison history

### Baseline

- Rank numerals existed in the DOM but were visually hidden by the stacking
  order and text-gradient rendering.
- Ranked cards were too tall at a 0.62 aspect ratio.
- The card overlay repeated the game title even though the artwork already
  contains the title.
- The third card provider label showed `Pragmatic Play` instead of the supplied
  reference's `HACKSAW GAMING` presentation label.

### Fix and post-fix evidence

- Raised the rank layer above the artwork edge, added explicit prefixed text
  clipping/fill rules, and applied per-rank gradients.
- Changed ranked cards to a 0.70 aspect ratio and kept the provider-only footer.
- Added a scoped Top 5 display override for the third provider label without
  changing the shared mock game or vendor contracts.
- Post-fix browser evidence shows all five numerals, card artwork, provider
  labels, and the Top 5 heading in the same state. Tablet and mobile checks
  show no horizontal page overflow.

### Top 5 redesign — Pastel Rank Tiles

- Replaced the oversized overlapping numerals with compact pastel ranking tiles
  attached to the upper-left of each card; rank one includes the existing
  Font Awesome crown icon as a decorative winner cue.
- Added the small ranking mark beside the section heading and restored the game
  title above its provider label inside the dark-indigo bottom band.
- Synchronized rank-tile hover and keyboard-focus motion with the card artwork:
  both lift slightly and zoom together instead of leaving a static tile behind.
- Browser evidence at the desktop lobby viewport shows all five cards, rank
  tiles, title/provider bands, and the adjacent `Pilihan Teratas` section in
  the same theme. The existing card-detail interaction remains functional.

### Pilihan Teratas rail

- Replaced the four-column featured grid with a horizontal portrait-card rail
  containing ten existing catalog games.
- Removed the rounded panel treatment from `Pilihan Teratas` and added a
  vertical divider line between it and `Top 5 Minggu Ini`. At mobile width the
  divider changes to a horizontal separator for the stacked layout.
- Replaced the opaque divider stroke with a soft lavender gradient so the
  separator follows the page theme instead of reading as a standalone border.
- Added non-interactive lavender fade overlays to the left and right edges of
  the featured rail. The right fade sits below the arrow control, preserving
  rail navigation while blending the card edges into the page background.
- Synced overlay visibility with slider state: the left fade is hidden at the
  start, both fades show in the middle, and the right fade is hidden at the
  end alongside the hidden next button.
- The rail still shows four complete cards and a partial next card, with an
  accessible previous/next control pair that scrolls through all ten cards.
  Controls are stateful: the start state exposes only next, the middle state
  exposes both controls, and the end state exposes only previous.
- Synced the featured poster height to the measured Top 5 poster height at
  runtime. The current desktop capture measures 239.56px for both card types;
  the same equality was confirmed at 768px and 390px viewport widths.
- The latest browser capture was reviewed in the live Chrome localhost tab;
  the temporary viewport override was reset after responsive checks.

### Hero slider

- Replaced the static hero artwork and decorative dots with a four-slide local
  carousel using Neon Racer, Solar Riches, Velvet Roulette, and Deep Sea Odyssey.
- The hero auto-advances every six seconds, and each dot is now an accessible
  control for selecting a slide directly. The selected game's title, metadata,
  description, artwork, and CTA target change together.
- The carousel uses lightweight local images and a short entrance animation;
  it does not introduce autoplay video.

### Sedang Ramai Dimainkan rail

- Reused the same horizontal rail structure as `Pilihan Teratas`: a scroll
  wrapper, edge fades, conditional previous/next controls, and snap scrolling.
- Expanded the rail to ten curated game cards and added a second ten-card
  `Game Paling Hot` rail directly below it in the same left-column stack.
- Kept the trending cards in their landscape treatment while hiding the native
  scrollbar so the navigation controls become the primary slider affordance.
- The in-app browser verification showed the expected states for both rails at
  the default viewport: start exposes only next, the middle exposes both
  controls and both fades, and the end exposes only previous with the right
  fade hidden.
- The activity panel now stretches to the combined height of the two left-column
  rails, each activity tab presents eighteen user rows, and the table scrolls
  vertically inside the card to keep the page height stable.

### Provider cards

- Increased the provider card minimum height and normalized featured and regular
  cards to the same responsive height so the provider choices no longer render
  as overly flat banners.
- Kept the two featured cards on the first row and three regular provider cards
  on the second row; the compact single-column breakpoint uses a shorter shared
  height.
- Added a blended right-side game image to every provider card, sourced from a
  matching mock-catalog game: Neon Racer, Velvet Roulette, Solar Riches, Lucky
  Fortune Cat, and Deep Sea Odyssey.
- Softened the provider artwork fade so more of the game image remains visible,
  slightly increased the card height, and reduced the outer radius to 8px.
- Restyled the selected provider label above the game grid with the hero's bold
  italic display treatment at a smaller responsive scale, while preserving the
  divider lines and the provider-themed color.
- Provider game collections now use the selected vendor's catalog and show up to
  18 cards (three desktop rows). Larger collections fade over the bottom of the
  third row and expose a `Lihat Semua` action; P4 has no provider-specific
  catalog route yet, so the action falls back to the existing all-games route.
- The provider overflow overlay now follows `height: clamp(3.25rem, 10vw, 50rem)`;
  the P4 flush main also has responsive top and bottom padding to separate the
  lobby content from the sticky navbar and footer.
- Deepened the lower overlay tint with a semi-transparent lavender gradient so
  the third-row fade reads more clearly without becoming fully opaque.
- Reworked the provider-card artwork treatment so the theme-colored opaque veil
  stays on the left 7–10% of the artwork area and fades to transparent toward
  the right; the game image remains clear instead of being masked away.
- Increased the responsive spacing between the `Provider Pilihan` heading,
  provider cards, selected-provider title, and provider game grid so the section
  reads as separate visual layers without changing its existing theme.

### Lobby CTA cards

- Added two wide CTA cards directly before `Provider Pilihan`, matching the
  supplied pastel composition: `Temukan game baru hari ini` and `Putar Pilihan`.
- Added local artwork for the compass landscape and crowned fruit slot machine;
  the copy and buttons remain HTML so they stay accessible and responsive.
- Kept the cards stacked at the tablet breakpoint and preserved a readable
  compact height on small mobile screens.

## Interaction and runtime checks

- Top 5 card click opens the existing game detail surface.
- The detail surface closes through `Tutup detail`.
- `Jelajahi Game` navigates to the existing all-games catalog.
- `Pilih Satu Game` opens the existing detail surface for one random active game.
- The P4 header remains accessible at the viewport top while the lobby is
  scrolled; the shell clips horizontal overflow without creating a competing
  scroll context.
- No application-origin runtime error was introduced. The current Chrome tab
  still reports the known Scribe extension-injected `data-scribe-recorder-ready`
  hydration mismatch; this is external to the P4 source tree.
- TypeScript check passed.
- ESLint check passed.
- Vitest passed: 23 files, 269 tests.

The separate production build attempt remains environment-blocked by an
existing Windows `EPERM` while scanning
`.next\standalone\node_modules\react`; this is outside the Top 5 source change
and does not invalidate the browser-rendered visual result.

## Follow-up polish

- The exact poster artwork in the supplied design is not part of the existing
  P4 local asset baseline. Replacing that artwork would require an explicit
  asset decision; this pass keeps the documented mock asset boundary.

final result: passed

---

## Latest result

The Provider Option 3 QA report at the top supersedes the retained prior lobby record.

final result: passed

---

## P4 namespace cleanup

- Migrated active lobby mock data, presentation types, and runtime asset paths
  from legacy prototype naming into the P4 namespace.
- Removed the unused Prototype 2 mock source and 25 orphaned image assets.
- Verified tracked source and asset paths contain no Prototype 1, Prototype 2,
  or Prototype 3 references.
- Verified the local lobby, game-play route, catalog endpoint, and P4 image
  assets return HTTP 200. Legacy Prototype 3 asset paths now return HTTP 404.
- TypeScript, ESLint, scoped Prettier, and Vitest checks passed. Vitest:
  23 files and 269 tests.

The production build remains blocked by a pre-existing Windows `EPERM` while
scanning the generated `.next\\standalone` directory. The source compilation
step succeeds before that generated-output failure.

final result: passed with generated build-cache limitation
