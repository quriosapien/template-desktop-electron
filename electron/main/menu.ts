import type { MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../../src/types/native.types';

/**
 * The application menu as data (index.ts feeds it to Menu.buildFromTemplate).
 * App-specific items only *announce* an action; the UI decides what it means.
 */
export function buildMenuTemplate(options: {
  appName: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  sendAction: (action: MenuAction) => void;
  openHomepage: () => void;
}): MenuItemConstructorOptions[] {
  const isMac = options.platform === 'darwin';
  const separator: MenuItemConstructorOptions = { type: 'separator' };

  const appActions: MenuItemConstructorOptions[] = [
    {
      label: 'Settings…',
      accelerator: 'CmdOrCtrl+,',
      click: () => options.sendAction('open-settings'),
    },
    { label: 'Check for Updates…', click: () => options.sendAction('check-updates') },
  ];

  // Reload and DevTools are development conveniences, not shipped features.
  const devItems: MenuItemConstructorOptions[] = options.isPackaged
    ? []
    : [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, separator];

  const macAppMenu: MenuItemConstructorOptions = {
    label: options.appName,
    submenu: [
      { role: 'about' },
      separator,
      ...appActions,
      separator,
      { role: 'services' },
      separator,
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      separator,
      { role: 'quit' },
    ],
  };

  return [
    ...(isMac ? [macAppMenu] : []),
    {
      label: 'File',
      submenu: isMac ? [{ role: 'close' }] : [...appActions, separator, { role: 'quit' }],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...devItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        separator,
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Project Homepage', click: () => options.openHomepage() }],
    },
  ];
}
