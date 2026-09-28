import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (...args: unknown[]) => void;

const created: FakeWindow[] = [];
const openExternal = vi.fn();

class FakeWindow {
  readonly options: { webPreferences: Record<string, unknown> };
  readonly listeners = new Map<string, Listener>();
  windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
  loadedUrl = '';
  readonly webContents = {
    on: (event: string, listener: Listener) => this.listeners.set(event, listener),
    setWindowOpenHandler: (handler: FakeWindow['windowOpenHandler']) => {
      this.windowOpenHandler = handler;
    },
  };
  constructor(options: FakeWindow['options']) {
    this.options = options;
    created.push(this);
  }
  once = vi.fn();
  show = vi.fn();
  loadURL = async (url: string) => {
    this.loadedUrl = url;
  };
}

vi.mock('electron', () => ({ BrowserWindow: FakeWindow, shell: { openExternal } }));

const { createMainWindow } = await import('../../main/window');

function open() {
  createMainWindow({
    preloadPath: '/app/preload.cjs',
    url: 'app://renderer/index.html',
    trustedOrigin: 'app://renderer',
    title: 'Test',
  });
  const window = created.at(-1);
  if (!window) throw new Error('no window created');
  return window;
}

describe('createMainWindow', () => {
  beforeEach(() => {
    created.length = 0;
    openExternal.mockClear();
  });

  it('keeps every security-relevant webPreference pinned', () => {
    const { webPreferences } = open().options;

    expect(webPreferences).toMatchObject({
      preload: '/app/preload.cjs',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    });
  });

  it('loads the given URL', () => {
    expect(open().loadedUrl).toBe('app://renderer/index.html');
  });

  it('blocks navigation away from the app, sending https links to the browser', () => {
    const willNavigate = open().listeners.get('will-navigate');
    const event = { preventDefault: vi.fn() };

    willNavigate?.(event, 'app://renderer/index.html#/settings');
    expect(event.preventDefault).not.toHaveBeenCalled();

    willNavigate?.(event, 'https://example.com');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://example.com');

    willNavigate?.(event, 'file:///etc/passwd');
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it('never opens new Electron windows', () => {
    const handler = open().windowOpenHandler;

    expect(handler?.({ url: 'https://example.com' })).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
    expect(handler?.({ url: 'http://insecure.example' })).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledTimes(1);
  });
});
