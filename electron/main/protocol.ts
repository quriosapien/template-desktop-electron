import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';

export const APP_SCHEME = 'app';
export const APP_HOST = 'renderer';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Packaged builds load the UI from app://renderer/ instead of file://.
 * file:// pages share one origin with every file on disk; a privileged
 * standard scheme gives the UI a real, isolated origin that CSP, fetch and
 * the IPC sender check can all reason about. Must run before `app.ready`.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/**
 * Maps `app://renderer/<path>` to a file inside `rendererDir`, or null for any
 * request that isn't ours or would escape the directory (`..`, `%2F..`).
 */
export function resolveRendererFile(rendererDir: string, requestUrl: string): string | null {
  let url: URL;
  let pathname: string;
  try {
    url = new URL(requestUrl);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) {
    return null;
  }

  const root = path.resolve(rendererDir);
  const file = path.resolve(root, pathname === '/' ? 'index.html' : `.${pathname}`);
  return file.startsWith(`${root}${path.sep}`) ? file : null;
}

const notFound = () => new Response('Not found', { status: 404 });

/**
 * Serves the built UI, stamping every response with the CSP. No SPA fallback:
 * the router uses hash history, so a missing file really is a 404 — which also
 * keeps a relative `/api` call from being answered with index.html.
 */
export function serveRenderer(rendererDir: string, contentSecurityPolicy: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const file = resolveRendererFile(rendererDir, request.url);
    if (!file || !(await stat(file).catch(() => null))?.isFile()) {
      return notFound();
    }

    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', contentSecurityPolicy);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  });
}
