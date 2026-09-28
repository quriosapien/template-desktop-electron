import { z } from 'zod';

/**
 * Single source of truth for the main process's environment. The ONLY place
 * that reads `process.env`. Two sources feed it:
 *   - runtime: ELECTRON_RENDERER_URL, set by scripts/dev.ts;
 *   - build time: VITE_API_BASE_URL and APP_HOMEPAGE, inlined by tsdown (see
 *     tsdown.config.ts) — each `process.env.X` below is replaced with a literal.
 */
const envSchema = z.object({
  /** Vite dev server URL. Honoured only in unpackaged runs (see index.ts). */
  ELECTRON_RENDERER_URL: z.url().optional(),
  /** Same value the UI uses; its origin is allowed in the CSP's connect-src. */
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  /** package.json `homepage`, opened from Help → Project Homepage. */
  APP_HOMEPAGE: z.url({ protocol: /^https$/ }),
});

/** Exported for unit tests; app code uses the `config` singleton below. */
export function parseEnv(raw: Record<string, unknown>) {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    // Fail fast with a readable report instead of crashing deep inside the app.
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return Object.freeze(parsed.data);
}

// Explicit member reads (not `parseEnv(process.env)`) so tsdown can inline them.
export const config = parseEnv({
  ELECTRON_RENDERER_URL: process.env.ELECTRON_RENDERER_URL,
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
  APP_HOMEPAGE: process.env.APP_HOMEPAGE,
});

export type Config = typeof config;
