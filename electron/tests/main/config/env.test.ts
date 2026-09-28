import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../main/config/env';

const HOMEPAGE = 'https://github.com/quriosapien/template-desktop-electron';

describe('parseEnv (main)', () => {
  it('applies defaults when optional vars are missing', () => {
    const config = parseEnv({ APP_HOMEPAGE: HOMEPAGE });

    expect(config.ELECTRON_RENDERER_URL).toBeUndefined();
    expect(config.VITE_API_BASE_URL).toBe('/api');
  });

  it('accepts a dev server URL', () => {
    expect(
      parseEnv({ APP_HOMEPAGE: HOMEPAGE, ELECTRON_RENDERER_URL: 'http://localhost:5173/' })
        .ELECTRON_RENDERER_URL,
    ).toBe('http://localhost:5173/');
  });

  it('rejects a non-https homepage and malformed URLs with a readable error', () => {
    expect(() => parseEnv({ APP_HOMEPAGE: 'http://example.com' })).toThrow(/APP_HOMEPAGE/);
    expect(() => parseEnv({ APP_HOMEPAGE: HOMEPAGE, ELECTRON_RENDERER_URL: 'nope' })).toThrow(
      /ELECTRON_RENDERER_URL/,
    );
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseEnv({ APP_HOMEPAGE: HOMEPAGE }))).toBe(true);
  });
});
