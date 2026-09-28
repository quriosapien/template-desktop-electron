import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
// Explicit extension: Vite's upcoming native config loader requires it.
import { mockApiPlugin } from './src/mocks/mock-api.plugin.ts';

/** The UI (renderer) build. Main and preload are built by tsdown (tsdown.config.ts). */
export default defineConfig(({ mode }) => {
  // Node context: read all vars (no VITE_ filter) — DEV_* stay dev-server-side only.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
      tailwindcss(),
      ViteImageOptimizer(),
      ...(env.DEV_MOCK_API === 'true' ? [mockApiPlugin()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
    },
    server: {
      // scripts/dev.ts hands this exact origin to Electron, which trusts only it.
      port: 5173,
      strictPort: true,
      proxy:
        env.DEV_PROXY === 'true'
          ? {
              '/api': {
                target: env.DEV_PROXY_TARGET ?? 'http://localhost:3000',
                changeOrigin: true,
              },
            }
          : undefined,
    },
  };
});
