import { readFileSync } from 'node:fs';
import { defineConfig, type UserConfig } from 'tsdown';
import { loadEnv } from 'vite';

const { homepage } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Main + preload builds (the UI is Vite's job). `mode` picks the .env.<mode>
 * file whose VITE_API_BASE_URL is inlined into main, where it feeds the CSP.
 * Only `electron` stays external among devDependencies; everything else main
 * imports (zod…) is bundled, and `dependencies` ship in the asar.
 */
export function createTsdownConfig(mode: 'development' | 'production'): UserConfig[] {
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), 'VITE_');
  const shared: UserConfig = {
    platform: 'node',
    tsconfig: 'electron/tsconfig.json',
    sourcemap: true,
    clean: true,
    deps: { neverBundle: ['electron'] },
    // One self-contained file per entry: no shared chunks between main and preload.
    outputOptions: { codeSplitting: false },
    env: { APP_HOMEPAGE: homepage, ...(VITE_API_BASE_URL ? { VITE_API_BASE_URL } : {}) },
  };

  return [
    {
      ...shared,
      entry: { index: 'electron/main/index.ts' },
      outDir: 'dist-electron/main',
      // `dependencies` stay external (shipped in the asar); zod is the one bundled devDependency.
      deps: { neverBundle: ['electron'], onlyBundle: ['zod'] },
      format: 'esm',
      fixedExtension: false, // index.js, as package.json `main` expects
      target: 'node24', // Electron 44 embeds Node 24.21
    },
    {
      ...shared,
      entry: { index: 'electron/preload/index.ts' },
      outDir: 'dist-electron/preload',
      // Sandboxed preloads can't load ES modules: one self-contained CJS file.
      format: 'cjs',
      target: 'chrome152', // Electron 44 embeds Chromium 152
      outExtensions: () => ({ js: '.cjs' }),
    },
  ];
}

export default defineConfig(createTsdownConfig('production'));
