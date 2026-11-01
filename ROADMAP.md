# Roadmap — template-desktop-electron

An Electron 45 desktop template with the Vue 3 UI of `template-webapp-vuejs`, a keychain-backed
session, native settings and GitHub Releases auto-update. Its UI (`src/`) is shared with
`template-desktop-tauri`. This roadmap is a record of intent: items here are candidates, not
commitments. Pick one up, or leave the repo as-is.

## Now — parity + hardening, no new dependencies

- **Persist window size and position.**
  _Steps:_ save `getBounds()` on `close` to `userData/window-state.json` via
  `writeJsonFileAtomic`. Restore it in `createMainWindow`, clamped to a visible display
  (`screen.getDisplayMatching`).
  _Done when:_ resizing, quitting and relaunching restores the window, and a disconnected
  monitor doesn't strand it off-screen.

- **Guard redirects the way navigation is guarded.** `window.ts` blocks `will-navigate` but not
  `will-redirect`. The UI never redirects, so the guard is cheap insurance.
  _Done when:_ `window.test.ts` pins both.

- **Validate the login payload with Zod.** This is the same gap as in both webapps' roadmaps, and
  `zod` is already a dependency.

## Next — meaningful advancement, small dependency cost

- **Standing item: recheck electron-vite on every sweep.** electron-vite 5 (stable) caps Vite at
  7, and 6.0 (Vite 8) was still beta when this repo was created. That's why `scripts/dev.ts` +
  tsdown exist. Rechecked 2026-11-01: `6.0.0` is stable (2026-10-14) but skipped this sweep.
  [alex8088/electron-vite#929](https://github.com/alex8088/electron-vite/issues/929) reports
  failures on this repo's Electron + Vite 8 stack and its fixes (#932, #934) are unmerged, and the
  done-when below is unreachable as written: typecheck still needs both tsconfigs. Recheck once a
  6.0.x lands those fixes.
  _Steps:_ once `electron-vite@6` is stable, prototype it in a branch.
  _Done when:_ it replaces `scripts/dev.ts`, `tsdown.config.ts` and the two tsconfigs with less
  code, keeping the CJS preload, inlined `VITE_API_BASE_URL` and restart-on-change. If it doesn't,
  record why here and drop the item.

- **Playwright `_electron` E2E.** It covers login → restart → session restored from the keychain,
  menu → Settings, and theme persistence. The flow was verified by hand when the repo was created.
  _Note:_ the `EnableNodeCliInspectArguments` fuse is off, so Playwright can only drive unpackaged
  builds (`npm start`), not `release/` apps. That's intended.

- **Wire up code signing.** The secrets are listed, commented out, in `release.yml`. The macOS
  Developer ID + notarization step is what makes auto-update work on macOS; see README.

## Later — opt-in, adds a real dependency or platform surface

- Tray icon, deep links (`app.setAsDefaultProtocolClient`), notifications, global shortcuts.
- Multiple windows. `register.ts` already trusts by origin, not by window, so the IPC layer holds.
- Renovate config, shared in shape with the other `template-*` repos.

## Deliberately not doing

- **ESLint / Prettier:** Biome replaces both.
- **`nodeIntegration`, disabling `sandbox`/`contextIsolation`, or exposing `ipcRenderer`:** the
  whole security model rests on these.
- **`file://` loading:** the `app://` scheme gives the UI a real origin for CSP and IPC checks.
- **Electron Forge:** electron-builder already covers installers, fuses, publishing and the
  updater feed.
- **Squirrel.Windows:** NSIS is the target; `electron-winstaller`'s install script is denied in
  `allowScripts`.
- **An MSW service worker in the UI:** mocking runs on the dev server so `src/` stays identical to
  the Tauri sibling, whose macOS webview refuses service workers.

## Family conventions

These rules are shared across the `template-*` repos and apply here too:

- `biome.json`'s `$schema` URL tracks the installed `@biomejs/biome` version: bump both together.
  (This repo also enables `css.parser.tailwindDirectives` for `@theme` / `@apply`.)
- Manifests pin `^<then-latest>`. `allowScripts` keys embed exact versions and move in lockstep
  with the packages they gate. `false` entries (`msw`, `electron-winstaller`) record install
  scripts that were reviewed and are not needed.
- No pre-release dependencies, apart from documented exceptions. This repo has none.
- Dependency sweeps commit with a lowercase `setup:` or `chore(deps):` prefix. Nothing is pushed
  without the user's say-so.
- **TypeScript 6** until `vue-tsc` supports TS 7, the same gate as `template-webapp-vuejs`.
  Rechecked 2026-11-01: `typescript` 7.0.2 + `vue-tsc` 3.3.14 still fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Node 26 everywhere**, enforced by `devEngines`. CI upgrades to npm 12 before `npm ci` because
  Node 26 bundles npm 11. Any sibling adding `devEngines` needs the same step.
