# template-desktop-electron

A production-grade Electron desktop template with a Vue 3 + TypeScript UI. It uses Electron 44, a
Vite 8 renderer, tsdown-built main and preload bundles, and electron-builder installers.

The UI carries full parity with `template-webapp-vuejs`: JWT auth with refresh-token rotation,
guarded routes, Pinia and Tailwind CSS v4. On top of that sits a desktop layer:
- the refresh token lives in the **OS keychain**, not localStorage;
- settings are persisted natively and applied natively;
- a native menu, safe external links, and a single-instance lock;
- **auto-update from GitHub Releases**.

The `src/` UI is shared with its sibling `template-desktop-tauri` (see
[Shared with template-desktop-tauri](#shared-with-template-desktop-tauri)).

## Toolchain

| Tool                                                                                                     | Role                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Electron](https://www.electronjs.org) 44                                                                | Desktop shell: Chromium 152 + Node 24.21                                                                                                                                  |
| [Vite](https://vitejs.dev) 8                                                                             | UI dev server (HMR) and renderer build                                                                                                                                    |
| [tsdown](https://tsdown.dev)                                                                             | Main and preload bundles, built by Rolldown (Rust). Same tool as `template-webserver-ts7`; the preload is emitted as CJS because sandboxed preloads can't load ES modules |
| [electron-builder](https://www.electron.build)                                                           | Installers (dmg/zip, NSIS, AppImage/deb), fuses, GitHub Releases publishing                                                                                               |
| [electron-updater](https://www.electron.build/auto-update)                                               | Auto-update from the GitHub Releases feed                                                                                                                                 |
| [electron-log](https://github.com/megahertz/electron-log)                                                | Main-process logging to the OS log directory, with rotation                                                                                                               |
| [vue-tsc](https://github.com/vuejs/language-tools) + `tsc`                                               | Typecheck: vue-tsc for the UI, plain tsc for `electron/`. Held at TypeScript 6 for the same reason as `template-webapp-vuejs`: vue-tsc can't load TS 7 yet                |
| [Biome](https://biomejs.dev)                                                                             | Lint + format (no ESLint, no Prettier)                                                                                                                                    |
| [Vitest](https://vitest.dev) + [@vue/test-utils](https://test-utils.vuejs.org) + [MSW](https://mswjs.io) | Unit tests in two projects: `ui` (jsdom) and `main` (Node, with `electron` mocked)                                                                                        |
| [lefthook](https://github.com/evilmartians/lefthook)                                                     | Git hooks (pre-commit lint)                                                                                                                                               |
| [Tailwind CSS v4](https://tailwindcss.com)                                                               | Styling, via `@tailwindcss/vite`                                                                                                                                          |

## Requirements

- Node.js >= 26 (`.nvmrc` pins `26`; run `nvm use`).
- npm >= 12. Node 26 bundles npm 11, so run `npm install -g npm@12` once per Node install. This is
  enforced by `devEngines`: on an older Node or npm, npm commands fail with `EBADDEVENGINES`.
- To build installers for another OS, use CI (`release.yml`). Cross-building locally is
  unreliable.

## Getting started

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

An app window opens. Sign in with `demo@example.com` / `password123`; the dev server answers with
the mock API, so no backend is needed. The first `npm run dev` downloads the Electron binary:
Electron 44 fetches it lazily rather than in an install script.

## Scripts

| Script                                      | Description                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                               | Vite dev server + tsdown watch + Electron. Restarts Electron when main or preload changes; UI edits hot-reload |
| `npm run build`                             | Typecheck, then `vite build` (→ `dist/renderer`), then `tsdown` (→ `dist-electron`)                            |
| `npm start`                                 | Run the built app unpackaged, loading from `app://`, as a packaged build would                                 |
| `npm run dist`                              | `build`, then electron-builder for the current OS (→ `release/`)                                               |
| `npm run typecheck`                         | `vue-tsc --noEmit` (UI) and `tsc --noEmit -p electron` (main, preload, scripts)                                |
| `npm run lint` / `lint:fix` / `lint:ci`     | Biome check / fix / CI mode (no writes; fails on any issue)                                                    |
| `npm run format`                            | Format all files with Biome                                                                                    |
| `npm test` / `test:watch` / `test:coverage` | Vitest once / watch / with enforced coverage thresholds                                                        |
| `npm run prepare`                           | Install lefthook git hooks (runs automatically after `npm install`)                                            |

## Environment configuration

There is no `dotenv` package: Vite loads `.env` / `.env.<mode>` natively. Only `.env.example` is
committed; copy it to `.env.local`.

- **UI:** `src/config/env.ts` is the only reader of `import.meta.env`. It validates `VITE_*` vars
  with Zod into a frozen `config`. `VITE_*` values end up in the renderer bundle, so **never put
  secrets in them**.
- **Main process:** `electron/main/config/env.ts` is the only reader of `process.env`. It combines
  two sources:
  - `ELECTRON_RENDERER_URL`, set at runtime by `scripts/dev.ts`. Packaged builds ignore it.
  - `VITE_API_BASE_URL` and `APP_HOMEPAGE`, which tsdown inlines at build time.
- **API URL in packaged builds:** relative `/api` only works in dev, because packaged builds serve
  the UI from `app://`, where nothing answers `/api`. Put an absolute `VITE_API_BASE_URL` in
  `.env.production`. Its origin is added to the CSP's `connect-src` automatically.
- **Dev-server only:** `DEV_MOCK_API`, `DEV_PROXY` and `DEV_PROXY_TARGET` are read by
  `vite.config.ts` in Node and never reach the UI.

## Project structure

```
src/                  # the Vue UI — same layout as template-webapp-vuejs
  api/                # http.client.ts, auth.api.ts, native.api.ts (the only Electron-aware UI file)
  components/         # *.component.vue (update banner)
  config/             # the ONLY reader of import.meta.env
  mocks/              # MSW handlers, msw/node server (tests), mock-api.plugin.ts (dev server)
  router/  stores/  styles/  types/  utils/  views/
  tests/              # ui test project, mirroring src/ (+ support/fake-native.ts)
electron/
  main/               # main process: index.ts (wiring), window, protocol, menu, security
    config/           # the ONLY reader of process.env
    ipc/              # *.ipc.ts handler groups + register.ts (sender check, envelopes)
    utils/            # app-error, json-file (atomic writes), logger
  preload/            # contextBridge → window.native
  shared/             # ipc.contract.ts — channels + types shared by main, preload, UI
  tests/              # main test project, mirroring electron/
scripts/dev.ts        # the dev orchestrator, run by Node 26 directly
build/                # icon.svg → icon.png, macOS entitlements
tsdown.config.ts  electron-builder.config.ts  vite.config.ts  vitest.config.ts
```

## How the pieces talk

```
Vue UI ──nativeApi──▶ window.native (preload) ──ipcRenderer.invoke──▶ ipcMain handlers (main)
  ▲                                                                        │
  └──────────── IpcResult envelope { ok, data } | { ok: false, error } ◀───┘
```

- **Views and stores call `nativeApi` only** (`src/api/native.api.ts`). It implements
  `NativeApi` from `src/types/native.types.ts` and turns failure envelopes into `NativeError`s.
- **The preload exposes one function per call**, never `ipcRenderer` itself.
- **Every main-process handler sits behind `register.ts`**, which does three things:
  - rejects any caller whose frame isn't the app's own origin;
  - validates arguments with Zod;
  - maps errors to `{ kind, message }`: `unsupported`, `invalid-input`, `forbidden`, `io` or
    `internal`. Internal details are logged, never sent to the UI.
- **The native menu only announces actions** (`open-settings`, `check-updates`). `app.vue`
  decides what they mean.

## Auth flow

This is the same flow as `template-webapp-vuejs`: login, bearer requests, 401 → single-flight
refresh → retry, and lazy bootstrap in the router guard. Where the refresh token lives is what
differs:

- **Access token:** kept in memory only.
- **Refresh token:** `nativeApi.secrets` stores it with Electron's `safeStorage`, which encrypts it
  with a key held in the OS keychain (macOS Keychain, Windows DPAPI, or libsecret/kwallet on Linux).
  Only the ciphertext is written, to `userData/secrets.json`. A session therefore survives an app
  restart.
- **No keychain:** on Linux without a secret service, `safeStorage` falls back to a hard-coded key.
  The shell refuses that with `unsupported`, and the UI keeps the refresh token in memory, so the
  session simply won't survive a restart.

## Security model

- **Renderer:**
  - `contextIsolation`, `sandbox`, no `nodeIntegration`, no `<webview>`.
  - Pinned by `electron/tests/main/window.test.ts`.
- **Origin:**
  - Packaged builds load from a privileged `app://renderer` scheme, not `file://`.
  - The protocol handler serves files only from `dist/renderer` and refuses encoded `..` escapes.
    Missing files are real 404s (hash routing needs no SPA fallback).
- **CSP:**
  - Stamped on every response (`security.ts`): `script-src 'self'`, no `unsafe-*` in production,
    `connect-src` limited to `'self'` and the API origin.
  - Dev only adds Vite's HMR websocket and inline styles.
- **Navigation:**
  - The app never leaves its own origin.
  - `https:` links open in the system browser; every other scheme is dropped.
  - `window.open` never creates a window.
- **Fuses** (`electron-builder.config.ts`):
  - off: `RunAsNode`, `NODE_OPTIONS`, and `--inspect`;
  - on: asar integrity and only-load-from-asar.

## Mock API vs. real backend

`DEV_MOCK_API=true` makes the Vite dev server answer `/api/*` with the MSW handlers in
`src/mocks/handlers.ts` (`mock-api.plugin.ts`). Unit tests use the same handlers through `msw/node`.

It runs on the dev server rather than as a service worker so that `src/` stays identical to
the Tauri sibling: WKWebView (Tauri on macOS) refuses service workers. Production builds never
include the mock.

To use a real backend, set `DEV_MOCK_API=false DEV_PROXY=true DEV_PROXY_TARGET=<url>` in
`.env.local`. The endpoint contract is the one in `template-webapp-vuejs`'s README (login, refresh,
logout, me).

## Releasing and auto-update

1. Bump `version` in `package.json`, commit, then tag and push: `git tag v0.2.0 && git push --tags`.
2. `.github/workflows/release.yml` builds three sets of installers and uploads them, with the
   `latest*.yml` update feeds, to a **draft** GitHub Release:
   - macOS: arm64 + x64
   - Windows: x64
   - Linux: x64
3. Review and **publish** the draft. electron-updater only sees published releases.

Installed apps check once per launch (production builds only). The update banner offers
**Restart to install**; Settings → Updates checks on demand.

Set the repo variable `VITE_API_BASE_URL` (Settings → Variables) so release builds get an absolute
API URL.

**Signing** is opt-in; the environment block in `release.yml` lists the secrets.
- **Unsigned macOS builds:** ad-hoc signed (`resetAdHocDarwinSignature`), so they run on Apple
  silicon. **macOS cannot apply auto-updates to an app that isn't Developer ID–signed**, and
  Gatekeeper warns on first launch.
- **Unsigned Windows builds:** they update fine, but SmartScreen warns on first launch.

To sign:
1. Add `CSC_LINK` and `CSC_KEY_PASSWORD`, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
   `APPLE_TEAM_ID` for notarization.
2. Uncomment their lines in `release.yml`.

## App icon

`build/icon.svg` is the source; electron-builder derives the `.icns` and `.ico` files from
`build/icon.png`. After editing the SVG, regenerate the PNG:

```bash
node -e "require('sharp')('build/icon.svg').resize(1024,1024).png().toFile('build/icon.png')"
```

## Shared with template-desktop-tauri

Both desktop templates keep `src/` identical, so UI work moves between them by copying files. Only
these differ:
- `src/api/native.api.ts` and its test: the shell binding.
- The `VITE_APP_NAME` default in `src/config/env.ts` and its test.
- The accent colour in `src/styles/index.css`.
- `src/assets/logo.svg`.

## File suffix convention

Kebab-case filenames with a role suffix. UI code imports through the `@/` alias, and `electron/`
uses relative imports.

| Suffix            | Role                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `*.view.vue`      | Routed page component                                                      |
| `*.component.vue` | Reusable (non-routed) component                                            |
| `*.store.ts`      | Pinia store                                                                |
| `*.api.ts`        | Typed call group (HTTP or native)                                          |
| `*.client.ts`     | Low-level transport (HTTP client)                                          |
| `*.plugin.ts`     | Vite plugin (dev/build tooling, runs in Node)                              |
| `*.ipc.ts`        | Main-process IPC handler group for one domain                              |
| `*.contract.ts`   | Cross-process contract (channels + types)                                  |
| `*.util.ts`       | Framework-agnostic helper                                                  |
| `*.types.ts`      | Shared TypeScript types                                                    |
| `*.test.ts`       | Unit test, in `src/tests/` or `electron/tests/`, mirroring the source tree |

## Code style consistency

Three layers keep formatting and linting consistent:

1. **Editor:** `.vscode/settings.json` makes Biome the formatter (format-on-save), and
   `.vscode/extensions.json` recommends Biome and Volar.
2. **Pre-commit:** lefthook runs `biome check --write` on staged files.
3. **CI backstop:** `npm run lint:ci` (`biome ci .`) fails the build on anything left.

Biome only parses a `.vue` file's `<script>` block, so `biome.json` turns off the unused-binding
rules for `**/*.vue`, and vue-tsc enforces them with full template awareness. `biome.json` also
enables Tailwind directive parsing (`@theme`, `@apply` in `src/styles/index.css`).
