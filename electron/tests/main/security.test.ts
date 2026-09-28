import { describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  isSafeExternalUrl,
  isSameOrigin,
  originOf,
} from '../../main/security';

describe('originOf', () => {
  it('handles custom schemes, where URL#origin is "null"', () => {
    expect(originOf('app://renderer/index.html#/login')).toBe('app://renderer');
    expect(originOf('http://localhost:5173/src/main.ts')).toBe('http://localhost:5173');
  });

  it('returns null for unparseable or host-less URLs', () => {
    expect(originOf('not a url')).toBeNull();
    expect(originOf('/api')).toBeNull();
    expect(originOf('data:text/html,hi')).toBeNull();
  });
});

describe('isSameOrigin', () => {
  it('accepts frames from the trusted origin only', () => {
    expect(isSameOrigin('app://renderer/index.html', 'app://renderer')).toBe(true);
    expect(isSameOrigin('https://evil.example/app://renderer', 'app://renderer')).toBe(false);
    expect(isSameOrigin('app://renderer.evil/index.html', 'app://renderer')).toBe(false);
    expect(isSameOrigin(undefined, 'app://renderer')).toBe(false);
  });
});

describe('isSafeExternalUrl', () => {
  it('allows https only', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('http://example.com')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('garbage')).toBe(false);
  });
});

describe('buildContentSecurityPolicy', () => {
  it('locks production down to self plus the absolute API origin', () => {
    const csp = buildContentSecurityPolicy({ apiBaseUrl: 'https://api.example.com/v1' });

    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("connect-src 'self' https://api.example.com;");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe');
  });

  it('adds nothing for a relative API base', () => {
    expect(buildContentSecurityPolicy({ apiBaseUrl: '/api' })).toContain("connect-src 'self';");
  });

  it('allows Vite HMR and injected styles in dev only', () => {
    const csp = buildContentSecurityPolicy({
      apiBaseUrl: '/api',
      devServerUrl: 'http://localhost:5173/',
    });

    expect(csp).toContain("connect-src 'self' ws://localhost:5173");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("script-src 'self';");
  });
});
