# CLAUDE.md: Hull Down

A Longlight Interactive game. You run a state tank design bureau in Tarnovia
from the 1980s to today: design a tank against a weight limit, watch it at
trial, read the after-action report, fix it. An engineering game about
trade-offs.

- **Plan of record:** `docs/HULL-DOWN-PLAN.md`. Work through its staged PRs
  (section 14) in order. Do not start a later PR's features early.
- **Progress:** `docs/STATUS.md`. Add a line in every PR.
- **Names:** check `docs/NAMES.md` and section 8 of
  `.github/LONGLIGHT-STUDIO.md` before inventing any name.
- This file wins over the plan and the studio catalogue where they disagree.

## Working with Kelbo

- Kelbo is a beginner-plus coder who tests on his phone from the live site.
  End every task with a plain-language summary and how to test it on a phone.
- Use the name Kelbo only. No real name, initials or email anywhere.
- The plan pitches; Kelbo decides. Ask him about real design questions.
- **Always quote and ask before using Higgsfield or ElevenLabs**, including
  free generations. No explicit yes, no generation.
- Branch, PR, merge when checks pass. Never push to `main`. Keep PRs small
  enough to read on a phone.

## Stack

- TypeScript (strict), Vite (`base: './'`), Vitest, ESLint. No UI framework.
- Design office: 2D, plain DOM, SVG and canvas.
- Trials: three.js from npm, loaded only when a trial opens (from PR 4).
- Hosting: GitHub Pages from GitHub Actions. Merging into `main` deploys.
  Live at `https://jxstrr0.github.io/Hull-Down/` until the custom domain
  `hulldown.longlight.games` is set up.
- No backend, accounts, analytics, ads or API keys.

## Folders

```
src/sim/      pure simulation: vehicle model, mobility, gunnery, hits, AI, career
src/data/     parts, materials, threats, tenders, tuning numbers, strings
src/office/   blueprint views and the design screen
src/render/   three.js trials
src/ui/       reports, career screens, menus
src/audio/    cues and engine
src/persist/  saves, save code, safety
art/          Blender scripts, audio build, third-party originals
scripts/      build checks and tools
tests/        Vitest tests
docs/         plan, NAMES.md, STATUS.md
```

## Rules for code

- `src/sim/` imports only from `src/sim/` and `src/data/`. No DOM, no
  three.js, no `Math.random`, no `Date.now`. Seeded RNG and a fixed time step
  only. ESLint and `tests/simPurity.test.ts` both enforce this.
- Use `src/sim/det.ts` for sin, cos, exp, log and pow inside the sim, so
  results match on every device.
- Every tuning number lives in a table in `src/data/`, never inline.
- Player-facing text lives in `src/data/strings.ts`.
- All sim models are game-level abstractions, not engineering data.
- Storage: localStorage keys start `hulldown.`, IndexedDB database
  `hulldown`, caches start `hulldown-`. Never touch anything outside that
  prefix. Save code prefix `HD1:`.
- Phone first, portrait first. Touch must work before a feature is done.
  Tap targets at least 44 px.
- The protection map must never rely on colour alone.

## Look

- Design office: paper `#e9ece6`, grid `#c9d0c8`, ink `#1f3558`, pencil red
  `#b23a2e`, stamp green `#3d6b4f`. Paper is the default; "blueprint" is the
  dark option (`#12305a`, line `#e8eef6`, dim `#8fa6c4`).
- Fonts, self-hosted: Archivo Narrow (headings), Archivo (UI), Spline Sans
  Mono (numbers).
- Studio pieces (splash, credit line, studio link) follow the Longlight brand
  exactly: the official logo files in `public/brand/`, Space Grotesk, and
  `© 2026 Kelbo / Longlight Interactive`. Never redraw or recolour the logo.

## Content rules

- No real countries, wars, vehicles, companies or insignia. No gore; crew are
  status icons ("out of action").
- Generic engineering terms are fine (smoothbore, ERA, APFSDS).
- Third-party assets: CC0 or CC BY only without asking Kelbo. Every file gets
  a line in `CREDITS.md`; a test fails the build otherwise.

## Versions

- Four numbers, Major.Minor.Patch.Build, in the root `VERSION` file. The build
  fails if it is not four numbers. Bump it in every PR.
- Shown in the page footer as `v0.1.0.0 · <commit> · <date>` so a fresh
  deploy is easy to spot.
- `package.json` keeps a three-part number that players never see.

## Commands

- `npm run dev`: local server
- `npm run test`: Vitest
- `npm run lint`: ESLint and type check
- `npm run build`: production build, then the 3 MB first-load check

Run test, lint and build before pushing. CI (`deploy.yml`) runs the same
three on every PR; merge only when it is green.
