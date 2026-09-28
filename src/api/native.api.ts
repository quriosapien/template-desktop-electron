// The one UI file that differs from template-desktop-tauri: this is where the
// shell-agnostic NativeApi meets Electron's preload bridge.
import type { NativeApi } from '@/types/native.types';
import { NativeError } from '@/utils/native-error.util';
// Relative on purpose: `@/` stops at src/, and this contract is shared with main.
import type { IpcResult, NativeBridge } from '../../electron/shared/ipc.contract';

declare global {
  interface Window {
    /** Exposed by electron/preload/index.ts via contextBridge. */
    native: NativeBridge;
  }
}

async function unwrap<T>(pending: Promise<IpcResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) {
    throw new NativeError(result.error.kind, result.error.message);
  }
  return result.data;
}

/** Resolved per call (not at import) so tests can stub `window.native`. */
const bridge = (): NativeBridge => window.native;

export const nativeApi: NativeApi = {
  app: {
    info: () => unwrap(bridge().appInfo()),
  },
  secrets: {
    get: (key) => unwrap(bridge().secretsGet(key)),
    set: (key, value) => unwrap(bridge().secretsSet(key, value)),
    delete: (key) => unwrap(bridge().secretsDelete(key)),
  },
  settings: {
    get: () => unwrap(bridge().settingsGet()),
    set: (patch) => unwrap(bridge().settingsSet(patch)),
  },
  updates: {
    check: () => unwrap(bridge().updatesCheck()),
    install: () => unwrap(bridge().updatesInstall()),
  },
  shell: {
    openExternal: (url) => unwrap(bridge().shellOpenExternal(url)),
  },
  onMenuAction: (listener) => bridge().onMenuAction(listener),
};
