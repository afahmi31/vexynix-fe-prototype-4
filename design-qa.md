# FE Prototype 4 Top 5 Design QA

## Source visual truth

- Target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-eee7ae92-b384-451b-9a5f-cc4873785640.png`
- Featured target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-dfbe7d12-aaaf-4fd5-bf6c-496d4b4055bd.png`
- CTA target crop: `C:\Users\user\AppData\Local\Temp\codex-clipboard-e32db656-aa71-44e8-98b8-e847253dffbe.png`
- Baseline comparison: `C:\Users\user\AppData\Local\Temp\codex-clipboard-faf9a28d-91fc-41d1-8004-3d1ad730f037.png`
- Page-context reference: `D:\xproject\oches\fe-prototype-4\design\design-prototype-3.png`
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
