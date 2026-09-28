/**
 * `npm run dev`: Vite dev server (UI, with HMR) + tsdown watch (main, preload) +
 * an Electron process that restarts whenever main or preload rebuilds.
 * Run directly by Node 26 (native type stripping) — no tsx needed.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import electronPath from 'electron';
import { build } from 'tsdown';
import { createServer } from 'vite';
import { createTsdownConfig } from '../tsdown.config.ts';

const vite = await createServer({ mode: 'development' });
await vite.listen();
const rendererUrl = vite.resolvedUrls?.local[0];
if (!rendererUrl) {
  throw new Error('Vite did not report a local URL');
}
vite.printUrls();

let electron: ChildProcess | null = null;
let restarting = false;
let restartTimer: NodeJS.Timeout | undefined;

function startElectron(): void {
  electron = spawn(String(electronPath), ['.'], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RENDERER_URL: rendererUrl },
  });
  electron.once('exit', (code) => {
    if (!restarting) {
      // The user quit the app: stop watching too.
      void vite.close().then(() => process.exit(code ?? 0));
    }
  });
}

/** Debounced: main and preload usually rebuild together. */
function scheduleRestart(): void {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (!electron) {
      startElectron();
      return;
    }
    restarting = true;
    electron.once('exit', () => {
      restarting = false;
      startElectron();
    });
    electron.kill();
  }, 150);
}

const bundles = createTsdownConfig('development');
const built = new Set<number>();

bundles.forEach((options, index) => {
  void build({
    ...options,
    config: false, // `options` already is the config — don't merge tsdown.config.ts again
    watch: ['electron', 'src/types'],
    onSuccess: async () => {
      built.add(index);
      // The first launch waits for both bundles: Electron must not start
      // against a main bundle that is still being written.
      if (built.size === bundles.length) {
        scheduleRestart();
      }
    },
  });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    restarting = true;
    electron?.kill();
    void vite.close().then(() => process.exit(0));
  });
}
