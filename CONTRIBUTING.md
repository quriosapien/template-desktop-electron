# Contributing

## Prerequisites

- Node.js >= 26: run `nvm use` to pick up the version pinned in `.nvmrc`.
- npm >= 12. Node 26 bundles npm 11, so run `npm install -g npm@12` once per Node install. This is
  enforced by `devEngines`: on an older Node or npm, npm commands fail with `EBADDEVENGINES`.

## Setup

```bash
nvm use
npm install                  # also installs git hooks via lefthook (the "prepare" script)
cp .env.example .env.local   # defaults work for local dev (mock API on)
npm run dev                  # opens the app window
```

## Local dev loop

- `npm run dev`: UI edits hot-reload; saving anything under `electron/` restarts the app.
- `npm test`: run both test projects once, without coverage (fast, for iterating).
- `npm run test:watch`: Vitest watch mode. Use `--project ui` or `--project main` to focus.
- `npm start`: after `npm run build`, runs the app the way a packaged build loads it (`app://`,
  production CSP).

## Before pushing

Run the same checks CI runs, in the same order:

```bash
npm run lint         # Biome: lint + format + import order
npm run typecheck    # vue-tsc (UI) + tsc (electron/)
npm run build        # vite + tsdown: catches bundling issues typecheck alone won't
npm run test:coverage
```

`lefthook` runs `biome check --write` on staged files at commit time, so most style issues are
fixed before you get to `npm run lint`.

If you changed packaging, updates or the protocol handler, also run `npm run dist` and launch the
app from `release/`.

## What CI checks

`.github/workflows/ci.yml` runs on every push to `main` and every PR: lint → typecheck → build →
test, with coverage thresholds enforced (see `vitest.config.ts`).

`release.yml` runs only on `v*` tags; see README → Releasing.

## PR checklist

- [ ] Tests added or updated (this repo follows TDD; see [CLAUDE.md](CLAUDE.md)).
- [ ] A new native capability touches every layer listed in CLAUDE.md's layering rule.
- [ ] Security-relevant changes (window, protocol, CSP, IPC) keep their regression tests green.
- [ ] Any change under `src/` that isn't shell-specific is mirrored to `template-desktop-tauri`.
- [ ] Clear, descriptive commit messages.
