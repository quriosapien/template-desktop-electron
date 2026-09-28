import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    // Two worlds, two environments: the UI runs in a DOM, main/preload in Node.
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          // Node 26 ships an experimental native `localStorage` global that jsdom's
          // setup trips over (warning noise, and it would shadow jsdom's own).
          execArgv: ['--no-experimental-webstorage'],
          include: ['src/tests/**/*.test.ts'],
          setupFiles: ['src/tests/setup.ts'],
          // Node's fetch (used by Vitest even under jsdom) rejects relative URLs, so
          // tests need an absolute API base. MSW handlers use `*/api/...` wildcards
          // so they match both this absolute base and the dev server's.
          env: {
            VITE_API_BASE_URL: 'http://localhost/api',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: ['electron/tests/**/*.test.ts'],
          // tsdown inlines this at build time; config/env.ts requires it at import.
          env: {
            APP_HOMEPAGE: 'https://github.com/quriosapien/template-desktop-electron',
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}', 'electron/**/*.ts'],
      exclude: [
        'src/tests/**',
        'electron/tests/**',
        'src/**/*.types.ts',
        'src/**/*.d.ts',
        'src/mocks/**',
        // Process entry points: pure wiring, exercised by running the app.
        'src/main.ts',
        'electron/main/index.ts',
        'electron/preload/index.ts',
        'electron/shared/**',
      ],
      // Ratchet, not aspirational: a few points below the measured baseline
      // (95.2 / 89.7 / 95.5 / 95.9). Raise these as coverage grows; never lower.
      thresholds: { statements: 92, branches: 85, functions: 92, lines: 92 },
    },
  },
});
