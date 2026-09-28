import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NativeApiModule from '@/api/native.api';
import { FAKE_APP_INFO } from '@/tests/support/fake-native';
import { NativeError } from '@/utils/native-error.util';
import type { NativeBridge } from '../../../electron/shared/ipc.contract';

// setup.ts swaps in the fake shell everywhere; this suite tests the real one.
const { nativeApi } = await vi.importActual<typeof NativeApiModule>('@/api/native.api');

const ok = <T>(data: T) => Promise.resolve({ ok: true as const, data });

function stubBridge(overrides: Partial<NativeBridge> = {}): NativeBridge {
  const bridge = {
    appInfo: vi.fn(() => ok(FAKE_APP_INFO)),
    secretsGet: vi.fn(() => ok('secret')),
    secretsSet: vi.fn(() => ok(undefined)),
    secretsDelete: vi.fn(() => ok(undefined)),
    settingsGet: vi.fn(() => ok({ theme: 'dark' as const })),
    settingsSet: vi.fn(() => ok({ theme: 'light' as const })),
    updatesCheck: vi.fn(() => ok({ status: 'up-to-date' as const })),
    updatesInstall: vi.fn(() => ok(undefined)),
    shellOpenExternal: vi.fn(() => ok(undefined)),
    onMenuAction: vi.fn(() => () => {}),
    ...overrides,
  };
  window.native = bridge;
  return bridge;
}

describe('nativeApi (Electron)', () => {
  let bridge: NativeBridge;

  beforeEach(() => {
    bridge = stubBridge();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'native');
  });

  it('unwraps successful envelopes', async () => {
    expect(await nativeApi.app.info()).toEqual(FAKE_APP_INFO);
    expect(await nativeApi.secrets.get('refresh-token')).toBe('secret');
    expect(await nativeApi.settings.get()).toEqual({ theme: 'dark' });
    expect(await nativeApi.updates.check()).toEqual({ status: 'up-to-date' });
  });

  it('passes arguments through to the preload bridge', async () => {
    await nativeApi.secrets.set('refresh-token', 'value');
    await nativeApi.secrets.delete('refresh-token');
    await nativeApi.settings.set({ theme: 'light' });
    await nativeApi.shell.openExternal('https://example.com');
    await nativeApi.updates.install();

    expect(bridge.secretsSet).toHaveBeenCalledWith('refresh-token', 'value');
    expect(bridge.secretsDelete).toHaveBeenCalledWith('refresh-token');
    expect(bridge.settingsSet).toHaveBeenCalledWith({ theme: 'light' });
    expect(bridge.shellOpenExternal).toHaveBeenCalledWith('https://example.com');
    expect(bridge.updatesInstall).toHaveBeenCalled();
  });

  it('turns failure envelopes into NativeError with the native kind', async () => {
    stubBridge({
      secretsGet: () =>
        Promise.resolve({ ok: false, error: { kind: 'unsupported', message: 'No keychain' } }),
    });

    const failure = await nativeApi.secrets.get('refresh-token').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(NativeError);
    expect(failure).toMatchObject({ kind: 'unsupported', message: 'No keychain' });
  });

  it('delegates menu subscriptions and returns the unsubscribe function', () => {
    const unsubscribe = vi.fn();
    stubBridge({ onMenuAction: vi.fn(() => unsubscribe) });

    const result = nativeApi.onMenuAction(() => {});

    expect(result).toBe(unsubscribe);
  });
});
