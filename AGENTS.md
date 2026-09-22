# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Language Rules (MANDATORY)

- **Code and documentation: ALWAYS English.** Every file, skill, config, comment, variable name, function name, doc, README — English only. No exceptions.
- **Communication with user: ALWAYS Indonesian.** All conversation, explanations, questions, and responses in Bahasa Indonesia.
- **This rule has been stated hundreds of times. Do not forget. Do not violate.**

## 6. Software Engineering Principles

**Heuristics for code design, not laws — judgment wins over dogma.**

- **SOLID** — better object-oriented design
- **DRY** — avoid repetition
- **KISS** — keep things simple
- **YAGNI** — don't build unnecessary features
- **SRP** — one responsibility (part of SOLID, restated for emphasis)
- **Open/Closed** — extend without breaking
- **Dependency Inversion** — loose coupling
- **Composition** — build flexible components
- **Separation of Concerns** — cleaner design
- **Fail Fast** — detect problems early
- **Measure First** — optimize what actually matters

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Global Rules

- Do not auto-commit, push, or tag without explicit permission.
- Do not delete files without asking first.
- Ask before judging existing configuration as broken.
- Do not expand scope beyond the specified focus.
- Report outcomes, do not claim success before testing.
- Prefer reading existing code before making changes.
- If a file exceeds 200-300 lines, split or make modular.
- Never write test artifacts, scratch files, or temporary scripts to `/tmp`. Use a `tests/` folder inside the current workdir. The host has 1+ month uptime — `/tmp` does not auto-clean.

## TypeScript Rules

- Strict mode enabled.
- Prefer interfaces over type aliases for object shapes.
- Use `unknown` over `any`.
- Explicit return types on exported functions.

## JavaScript Rules

- Prefer `const` over `let`, never use `var`.
- Use `async`/`await` over callbacks and `.then()`.
- ESLint config must be present.
- Max 80 characters per line.
- Destructure imports when possible.

## Agent Rules

- Never edit official packages (`@ai-sdk/*`, `node_modules`, `vendor/`, etc.) — breaks upstream trust.
- Do not pollute `/tmp`. Place all scratch files, test artifacts, and temporary scripts inside the current workdir (e.g. `tests/`, `.scratch/`).
- For Go: use `go mod`; never replace the toolchain.
- For Python: Never pollute the system Python environment. No `pip install` outside a virtualenv. Execute Python via `uv run` in the project's existing venv, or inside a Docker container. If a new dependency is needed, add it to `pyproject.toml` and run `uv sync`.

## Project Conventions

- Place helper/dev tooling scripts in `scripts/` inside the repo (see `scripts/mock-bff.js`), then commit. Do not scatter one-off helper scripts across the filesystem.
- Truly single-use scratch files: write inside the workspace and delete them before the session ends.
- Background processes (dev server, mock server) started by an agent MUST be stopped before the session ends, unless the user asks to keep them running.
- Run instructions: `pnpm dev:up` — one foreground terminal for the preview stack (mock BFF + Next.js dev, Ctrl+C stops both, pattern follows `9router-fastapi/scripts/start-local.sh`); `pnpm dev:down` — sweep leftover processes; `pnpm dev` — Next.js dev alone (requires the BFF Go backend at `NEXT_PUBLIC_BFF_ORIGIN`, default `http://localhost:18080`); `pnpm lint` / `pnpm typecheck` / `pnpm test` for verification.
- UI language: player-facing UI in Indonesian; admin dashboard in English.
- Commits follow Conventional Commits (`feat(ui): ...`, `chore(dev): ...`).

## User Preferences

### Language Rules (MANDATORY)

- **Code and documentation: ALWAYS English.** Every file, skill, config, comment, variable name, function name, doc, README — English only. No exceptions.
- **Communication with user: ALWAYS Indonesian.** All conversation, explanations, questions, and responses in Bahasa Indonesia.
- **This rule has been stated hundreds of times. Do not forget. Do not violate.**

## Context

- Language: TypeScript / JavaScript (Next.js 15, React 19)
- Project: game-web-client-facing
- Generated: 2026-08-29
