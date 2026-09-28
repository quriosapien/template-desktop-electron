import { BrowserWindow, shell } from 'electron';
import { isSafeExternalUrl, isSameOrigin } from './security';

/**
 * The one app window, with every webPreferences security default spelled out
 * (and pinned by electron/tests/main/window.test.ts) rather than implied.
 */
export function createMainWindow(options: {
  preloadPath: string;
  url: string;
  trustedOrigin: string;
  title: string;
}): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: options.title,
    show: false, // shown on ready-to-show: no white flash before first paint
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });

  window.once('ready-to-show', () => window.show());

  // The UI never navigates away from its own origin (hash routing only changes
  // the fragment). Anything else — a stray <a href>, an injected redirect — is
  // blocked, and https links go to the system browser instead.
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (isSameOrigin(targetUrl, options.trustedOrigin)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalUrl(targetUrl)) {
      void shell.openExternal(targetUrl);
    }
  });

  // window.open / target="_blank": never a new Electron window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void window.loadURL(options.url);
  return window;
}
