# CLAUDE.md

Guidance for anyone working in this repo, including AI coding assistants.

## What this repo is

A **scaffold**, not a product. It has three reference features:
- **Auth:** login, keychain-persisted refresh token, and a guarded dashboard.
- **Settings:** a theme persisted and applied natively.
- **Updates:** check and install from GitHub Releases.

Each one crosses every layer below. Copy their shape when adding a native capability.

## Layering rule

`view/store → nativeApi (src/api/native.api.ts) → window.native (preload) → IPC → *.ipc.ts → OS`.

- **UI code never touches `window.native` or Electron.** It imports `nativeApi`, whose
  `NativeApi` type lives in `src/types/native.types.ts`. That keeps `src/` shell-agnostic and
  identical to `template-desktop-tauri`.
- **Adding a native capability takes all of:**
  1. its types in `src/types/native.types.ts`;
  2. its channel(s) and `NativeBridge` method(s) in `electron/shared/ipc.contract.ts`;
  3. a preload function;
  4. a handler group in `electron/main/ipc/<domain>.ipc.ts`, wired in `electron/main/index.ts`.
     `IpcHandlers` makes a missing channel a compile error;
  5. its `nativeApi` method;
  6. a fake in `src/tests/support/fake-native.ts`.
- **Handlers take raw `unknown` arguments and validate them with Zod.** Throw `AppError(kind, …)`
  for failures the UI should see; everything else is reported as `internal`.
- **Main-process modules receive their Electron dependencies as parameters** (`safeStorage`, the
  updater, `openExternal`…), so tests can pass fakes. Only `index.ts`, `window.ts` and
  `protocol.ts` import Electron values directly.

## File-suffix convention

Use the suffix that matches the file's role; don't invent new ones. The full table is in
[README.md](README.md#file-suffix-convention). `*.ipc.ts`, `*.contract.ts` and `*.plugin.ts` are
this repo's additions to the webapp set. Top-level wiring files in `electron/main/` (`index.ts`,
`window.ts`, `protocol.ts`, `menu.ts`, `security.ts`) have no suffix, like the webserver's
`server.ts`.

## Config rule

- **UI:** never read `import.meta.env` outside `src/config/env.ts`.
- **Main:** never read `process.env` outside `electron/main/config/env.ts`.
- **A new env var needs all of:**
  1. a Zod entry in the right `env.ts`;
  2. an entry with a comment in `.env.example`;
  3. if main reads it at build time, an entry in `tsdown.config.ts`'s `env`;
  4. if tests exercise it, an entry in that Vitest project's `test.env`.
- **Allowing a new origin for fetch:** the API origin is added to the CSP automatically (from
  `VITE_API_BASE_URL`, in `security.ts`). Any other origin must be added to
  `buildContentSecurityPolicy`, with a test.

## Testing rule

- **`ui` project** (`src/tests/**`, jsdom): every test gets the in-memory fake shell
  (`support/fake-native.ts`, via `vi.mock` in `setup.ts`) and MSW's `msw/node` server.
  `native.api.test.ts` opts back into the real module with `vi.importActual`.
- **`main` project** (`electron/tests/**`, Node): `electron` is `vi.mock`ed where a module
  imports it. Stores run against real temp directories (`support/temp-dir.ts`).
- **Security rules are regression-tested.** If you change `window.ts`, `protocol.ts`,
  `security.ts` or `register.ts`, update the tests that pin them. Don't delete those tests.
- Coverage thresholds in `vitest.config.ts` are a ratchet: raise them, never lower them.

This project follows **test-driven development**: write the failing test first, watch it fail for
the expected reason, then write the minimal code to pass.

## Known intentional states — not bugs

- **Packaged builds can't log in until `VITE_API_BASE_URL` points at a real backend.** The mock
  API only exists on the dev server.
- **`Update check failed: 404`** until the GitHub repo exists and has a *published* release.
- **Unsigned macOS builds are ad-hoc signed** (`resetAdHocDarwinSignature`). They run, but cannot
  auto-update. That is Squirrel.Mac's rule, not a bug here.
- **On Linux without a keyring, sessions don't survive a restart** (the `unsupported` →
  memory-only fallback in `token-storage.util.ts`).
- **The main bundle is ~750 KB**, which is unminified Zod. That's irrelevant for a desktop app;
  don't add minification to "fix" it.

## Out of scope — don't add without being asked

- `nodeIntegration`, disabling `sandbox`/`contextIsolation`, or exposing `ipcRenderer` from the
  preload.
- `file://` loading, or an SPA fallback in the `app://` handler.
- electron-vite or Electron Forge. The build is Vite + tsdown on purpose; see ROADMAP.
- E2E tests, a tray, deep links, multi-window: see ROADMAP.
- `dotenv`, ESLint, Prettier.

## Pointers

- [README.md](README.md): toolchain, setup, architecture, security model, releasing.
- [CONTRIBUTING.md](CONTRIBUTING.md): local dev loop and the checks to run before pushing.
- [ROADMAP.md](ROADMAP.md): what's next, what's deliberately not done.
