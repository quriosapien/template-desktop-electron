import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import type { MenuAction } from '../../src/types/native.types';
import { IPC, type NativeBridge } from '../shared/ipc.contract';

/**
 * The entire surface the UI can reach: one function per call, never
 * ipcRenderer itself (which would let any script invoke any channel).
 * Runs sandboxed — bundled by tsdown into one CJS file, as sandboxed preloads
 * can neither load ES modules nor require() local files.
 */
const bridge: NativeBridge = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  secretsGet: (key) => ipcRenderer.invoke(IPC.secretsGet, key),
  secretsSet: (key, value) => ipcRenderer.invoke(IPC.secretsSet, key, value),
  secretsDelete: (key) => ipcRenderer.invoke(IPC.secretsDelete, key),
  settingsGet: () => ipcRenderer.invoke(IPC.settingsGet),
  settingsSet: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  updatesCheck: () => ipcRenderer.invoke(IPC.updatesCheck),
  updatesInstall: () => ipcRenderer.invoke(IPC.updatesInstall),
  shellOpenExternal: (url) => ipcRenderer.invoke(IPC.shellOpenExternal, url),
  onMenuAction: (listener) => {
    const handler = (_event: IpcRendererEvent, action: MenuAction) => listener(action);
    ipcRenderer.on(IPC.menuAction, handler);
    return () => {
      ipcRenderer.removeListener(IPC.menuAction, handler);
    };
  },
};

contextBridge.exposeInMainWorld('native', bridge);
