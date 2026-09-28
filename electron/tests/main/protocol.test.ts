import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTempDir } from '../support/temp-dir';

type Handler = (request: Request) => Promise<Response>;

const electron = vi.hoisted(() => ({
  handler: undefined as Handler | undefined,
  registerSchemesAsPrivileged: vi.fn(),
  fetch: vi.fn(
    async (url: string) =>
      new Response(`file:${url}`, { headers: { 'Content-Type': 'text/html' } }),
  ),
}));

vi.mock('electron', () => ({
  net: { fetch: electron.fetch },
  protocol: {
    registerSchemesAsPrivileged: electron.registerSchemesAsPrivileged,
    handle: (_scheme: string, handler: Handler) => {
      electron.handler = handler;
    },
  },
}));

const { registerAppScheme, resolveRendererFile, serveRenderer } = await import(
  '../../main/protocol'
);

const root = path.resolve('/opt/app/dist/renderer');

describe('resolveRendererFile', () => {
  it('maps the app origin root to index.html', () => {
    expect(resolveRendererFile(root, 'app://renderer/')).toBe(path.join(root, 'index.html'));
  });

  it('maps asset paths inside the renderer directory', () => {
    expect(resolveRendererFile(root, 'app://renderer/assets/index-abc.js?v=1')).toBe(
      path.join(root, 'assets', 'index-abc.js'),
    );
  });

  it('keeps dot segments inside the root (the URL parser clamps them)', () => {
    const clamped = path.join(root, 'etc', 'passwd');
    expect(resolveRendererFile(root, 'app://renderer/../../etc/passwd')).toBe(clamped);
    expect(resolveRendererFile(root, 'app://renderer/%2e%2e/%2e%2e/etc/passwd')).toBe(clamped);
  });

  it('refuses encoded separators that would escape the root once decoded', () => {
    expect(resolveRendererFile(root, 'app://renderer/assets%2F..%2F..%2F..%2Fsecret')).toBeNull();
    expect(resolveRendererFile(root, 'app://renderer/..%2F..%2Fsecret')).toBeNull();
  });

  it('refuses other hosts, schemes and malformed URLs', () => {
    expect(resolveRendererFile(root, 'app://other/index.html')).toBeNull();
    expect(resolveRendererFile(root, 'https://renderer/index.html')).toBeNull();
    expect(resolveRendererFile(root, 'app://renderer/%E0%A4%A')).toBeNull();
  });
});

describe('registerAppScheme', () => {
  it('registers app:// as a standard, secure, fetch-capable scheme', () => {
    registerAppScheme();
    expect(electron.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
    ]);
  });
});

describe('serveRenderer', () => {
  const tempDir = useTempDir();

  beforeEach(async () => {
    await mkdir(path.join(tempDir(), 'assets'));
    await writeFile(path.join(tempDir(), 'index.html'), '<html></html>');
    serveRenderer(tempDir(), "default-src 'self'");
  });

  const request = (url: string) => {
    if (!electron.handler) throw new Error('handler not registered');
    return electron.handler(new Request(url));
  };

  it('serves files with the CSP and nosniff headers stamped on', async () => {
    const response = await request('app://renderer/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe("default-src 'self'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('404s for missing files, directories and escapes — never falling back to index.html', async () => {
    expect((await request('app://renderer/api/auth/login')).status).toBe(404);
    expect((await request('app://renderer/assets/')).status).toBe(404);
    expect((await request('app://renderer/..%2F..%2Fsecret')).status).toBe(404);
  });
});
