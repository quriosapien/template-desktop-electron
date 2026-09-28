import type {
  AppInfo,
  MenuAction,
  NativeErrorPayload,
  Settings,
  UpdateCheck,
} from '../../src/types/native.types';

/**
 * The IPC contract — the one file main, preload and the UI all import, so a
 * channel name or payload type can't drift between them. Domain types live in
 * src/types/native.types.ts, shared with template-desktop-tauri.
 */
export const IPC = {
  appInfo: 'app:info',
  secretsGet: 'secrets:get',
  secretsSet: 'secrets:set',
  secretsDelete: 'secrets:delete',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  updatesCheck: 'updates:check',
  updatesInstall: 'updates:install',
  shellOpenExternal: 'shell:open-external',
  /** main → UI event, not an invoke channel. */
  menuAction: 'menu:action',
} as const;

export type InvokeChannel = Exclude<(typeof IPC)[keyof typeof IPC], typeof IPC.menuAction>;

/**
 * Every invoke resolves to an envelope instead of rejecting: Electron flattens
 * rejected errors into "Error invoking remote method …" strings, losing `kind`.
 * The same success/failure envelope idea as template-webserver-ts7's responses.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: NativeErrorPayload };

/** What the preload script exposes as `window.native`. */
export interface NativeBridge {
  appInfo(): Promise<IpcResult<AppInfo>>;
  secretsGet(key: string): Promise<IpcResult<string | null>>;
  secretsSet(key: string, value: string): Promise<IpcResult<void>>;
  secretsDelete(key: string): Promise<IpcResult<void>>;
  settingsGet(): Promise<IpcResult<Settings>>;
  settingsSet(patch: Partial<Settings>): Promise<IpcResult<Settings>>;
  updatesCheck(): Promise<IpcResult<UpdateCheck>>;
  updatesInstall(): Promise<IpcResult<void>>;
  shellOpenExternal(url: string): Promise<IpcResult<void>>;
  onMenuAction(listener: (action: MenuAction) => void): () => void;
}
