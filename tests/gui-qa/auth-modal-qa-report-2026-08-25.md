# Auth Modal QA Report — 2026-08-25

Pre-push verification of the login/register modal feature (replaces separate
`/login` and `/register` pages; routes kept as deep-link shims that redirect to
`/lobby?auth=...` and open the matching modal).

## Environment

- Build: production (`next build` + `next start`), Next.js 15.3.5
- URL: http://localhost:3000
- Backend BFF (localhost:18080): **down** — submit flows verified up to
  client-side error handling only
- Browser: ZCode in-app browser (Chromium), 1280x720
- Method: black-box GUI (DOM snapshot + screenshot cross-validation)

## Results

| # | Test point | Result |
|---|------------|--------|
| T1 | `/login` deep-link redirects to `/lobby` and opens the login modal (autofocus on first field) | PASS |
| T2 | Close button dismisses modal, removes `modal-open` body class (scroll unlock), URL stays `/lobby` | PASS |
| T3 | Header "Masuk" button opens login modal without navigation | PASS |
| T4 | Header "Daftar" button opens register modal (5 fields, IDR preselected) | PASS |
| T5 | Empty login submit shows "Username atau No. HP wajib diisi" + "Password wajib diisi" | PASS |
| T6 | `/register` deep-link redirects to `/lobby` and opens the register modal | PASS |
| T7 | Register password mismatch shows "Password tidak cocok" | PASS |
| T8 | Register submit with backend down shows graceful "Pendaftaran gagal. Silakan coba lagi."; modal intact; submit re-enables (no stuck spinner) | PASS |
| T9 | Visual: both modals centered, dark backdrop, all fields/labels render, no overlap or clipping | PASS |

Evidence: `t1b_login_deeplink_modal_open.png`, `t9_register_modal.png` in this
folder.

## Observation (non-reproducible)

On the very first page load of the session, the login modal (opened via
`/login` deep-link) was present in the DOM at ~1.5s but absent ~20s later,
with the query string already stripped — consistent with a full page reload
that reset client state. Two controlled reproductions of the identical user
path (15s and 25s observation windows) showed the modal staying open the
whole time. Most plausible cause is the in-app browser host recreating the
webview when its pane first opened (environment artifact), not app code.
No code path closes the modal automatically (verified: only backdrop click,
close button, and login success call `close()`).

## Static checks (same session)

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS (1 pre-existing `no-img-element` warning in lobby, unrelated)
- `pnpm test`: 244/245 — 1 pre-existing failure in `src/lib/rate-limit.test.ts`
  (expects English message; message changed to Indonesian in commit 480d6c0
  without updating the test)
- `pnpm build`: PASS — 24 routes; `/login` 483 B, `/register` 390 B,
  `/lobby` 7.13 kB
- Playwright e2e: not runnable in this environment — browser binary version
  mismatch (needs `chromium_headless_shell-1234`) and MSW handlers not wired
  into the Playwright config (both pre-existing)

## Setup actions

Production server started via `pnpm start` (stopped after testing). No data
seeded; no test accounts used.

## Post-integration re-verification (after rebase onto origin/main)

The local commit was rebased onto origin/main, which had gained the
fix_login/fix_functional PRs (session-expired redirect with ?next=..., deposit
button fix) plus game asset commits. Integration notes:

- Conflict in `login/page.tsx` resolved as shim + forwarding `?next=...`
- Session-expired flow ported into the modal: shim forwards `next`, lobby
  re-sanitizes it into the auth-modal store, login modal shows the
  `.auth-notice` banner via `takeSessionExpired()` and returns to `nextPath`
  after successful login (same precedence as the PR: only the default
  post-login route is overridden)
- Register-success banner wording follows the PR update ("Silakan masuk
  untuk melanjutkan.")
- `layout.tsx` (auth full-bleed) and `PortalHeader.tsx` (deposit button on
  deposit page) auto-merged with the modal changes

Checks after rebase: typecheck PASS, lint PASS, vitest 259/260 (same
pre-existing rate-limit failure), build PASS (24 routes), GUI smoke PASS —
`/login?next=/wallet/deposit` opens the login modal, `/login?registered=1`
shows the updated banner, register modal opens from the header
(`post-integration_register_modal.png`). The expired-session banner itself
cannot be triggered black-box without a backend 401; its logic is a direct
port of the PR code whose lib functions pass unit tests
(`auth-redirect.test.ts`).

