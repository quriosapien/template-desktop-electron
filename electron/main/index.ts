import path from 'node:path';
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  type Session,
  safeStorage,
  session,
  shell,
} from 'electron';
import electronUpdater from 'electron-updater';
import { IPC } from '../shared/ipc.contract';
import { config } from './config/env';
import { createAppInfoHandlers } from './ipc/app-info.ipc';
import { registerIpcHandlers } from './ipc/register';
import { createSecretsHandlers, createSecretsStore } from './ipc/secrets.ipc';
import { createSettingsHandlers, createSettingsStore } from './ipc/settings.ipc';
import { createShellHandlers } from './ipc/shell.ipc';
import { createUpdateHandlers, createUpdateService } from './ipc/updates.ipc';
import { buildMenuTemplate } from './menu';
import { APP_ORIGIN, registerAppScheme, serveRenderer } from './protocol';
import { buildContentSecurityPolicy, originOf } from './security';
import { createLogger } from './utils/logger.util';
import { createMainWindow } from './window';

// electron-updater is CommonJS; its named exports only exist on the default.
const { autoUpdater } = electronUpdater;

// ── Before ready ───────────────────────────────────────────────────────────

registerAppScheme();

// No <webview> anywhere — refuse to attach one even if something injects it.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (attachEvent) => attachEvent.preventDefault());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// A second launch focuses the running instance instead of racing it for the
// same settings/secrets files.
if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  void app.whenReady().then(start);
} else {
  app.quit();
}

// ── After ready ────────────────────────────────────────────────────────────

function applyCspToDevServer(target: Session, devOrigin: string, csp: string): void {
  target.webRequest.onHeadersReceived({ urls: [`${devOrigin}/*`] }, (details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] },
    });
  });
}

async function start(): Promise<void> {
  const logger = createLogger({ isPackaged: app.isPackaged });

  // Packaged builds ignore ELECTRON_RENDERER_URL: an env var must never be
  // able to point a shipped app at arbitrary web content.
  const devServerUrl = app.isPackaged ? undefined : config.ELECTRON_RENDERER_URL;
  const trustedOrigin = devServerUrl ? (originOf(devServerUrl) ?? APP_ORIGIN) : APP_ORIGIN;
  const csp = buildContentSecurityPolicy({ apiBaseUrl: config.VITE_API_BASE_URL, devServerUrl });

  // The UI needs no web permissions (camera, mic, notifications, geolocation…):
  // deny every request rather than let the default grant them.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );

  if (devServerUrl) {
    applyCspToDevServer(session.defaultSession, trustedOrigin, csp);
  } else {
    serveRenderer(path.join(app.getAppPath(), 'dist/renderer'), csp);
  }

  const userData = app.getPath('userData');
  const settings = createSettingsStore({
    filePath: path.join(userData, 'settings.json'),
    onChange: (next) => {
      nativeTheme.themeSource = next.theme;
    },
  });
  nativeTheme.themeSource = (await settings.get()).theme;

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false; // the UI asks first (updates.store.ts)

  registerIpcHandlers({
    ipcMain,
    trustedOrigin,
    logger,
    handlers: {
      ...createAppInfoHandlers({ app, homepage: config.APP_HOMEPAGE }),
      ...createSecretsHandlers(
        createSecretsStore({
          filePath: path.join(userData, 'secrets.json'),
          safeStorage,
          platform: process.platform,
        }),
      ),
      ...createSettingsHandlers(settings),
      ...createUpdateHandlers(
        createUpdateService({ isPackaged: app.isPackaged, updater: autoUpdater }),
      ),
      ...createShellHandlers({ openExternal: (url) => shell.openExternal(url) }),
    },
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate({
        appName: app.getName(),
        platform: process.platform,
        isPackaged: app.isPackaged,
        sendAction: (action) =>
          BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.menuAction, action),
        openHomepage: () => void shell.openExternal(config.APP_HOMEPAGE),
      }),
    ),
  );

  const openWindow = () =>
    createMainWindow({
      preloadPath: path.join(import.meta.dirname, '../preload/index.cjs'),
      url: devServerUrl ?? `${APP_ORIGIN}/index.html`,
      trustedOrigin,
      title: app.getName(),
    });

  openWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindow();
    }
  });

  logger.info(`Started ${app.getName()} ${app.getVersion()} (${trustedOrigin})`);
}
