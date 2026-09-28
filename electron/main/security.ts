/**
 * Pure security policy helpers — no Electron imports, so every rule here is
 * unit-tested in plain Node (electron/tests/main/security.test.ts).
 */

/**
 * `scheme://host` of a URL. Node's `URL#origin` is the string "null" for
 * non-special schemes like app://, so it can't be used to compare origins.
 */
export function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.host ? `${parsed.protocol}//${parsed.host}` : null;
  } catch {
    return null;
  }
}

/** True when `url` belongs to `origin` — used for IPC senders and navigation. */
export function isSameOrigin(url: string | undefined, origin: string): boolean {
  return url !== undefined && originOf(url) === origin;
}

/** Only https links may leave the app for the system browser. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The renderer's Content-Security-Policy. `connect-src` gains the API origin
 * when VITE_API_BASE_URL is absolute (packaged builds); dev adds Vite's HMR
 * websocket and inline styles (Vite injects CSS as <style> tags for HMR).
 */
export function buildContentSecurityPolicy(options: {
  apiBaseUrl: string;
  devServerUrl?: string;
}): string {
  const connectSrc = ["'self'"];
  const styleSrc = ["'self'"];

  const apiOrigin = originOf(options.apiBaseUrl);
  if (apiOrigin) {
    connectSrc.push(apiOrigin);
  }
  if (options.devServerUrl) {
    connectSrc.push(`ws://${new URL(options.devServerUrl).host}`);
    styleSrc.push("'unsafe-inline'");
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src ${styleSrc.join(' ')}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
