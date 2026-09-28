import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createSettingsHandlers,
  createSettingsStore,
  DEFAULT_SETTINGS,
} from '../../../main/ipc/settings.ipc';
import { IPC } from '../../../shared/ipc.contract';
import { useTempDir } from '../../support/temp-dir';

const tempDir = useTempDir();

function makeStore() {
  const filePath = path.join(tempDir(), 'settings.json');
  const onChange = vi.fn();
  return { filePath, onChange, store: createSettingsStore({ filePath, onChange }) };
}

describe('createSettingsStore', () => {
  it('returns defaults before anything is saved', async () => {
    expect(await makeStore().store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a patch, applies it, and returns the merged settings', async () => {
    const { store, filePath, onChange } = makeStore();

    const result = await store.set({ theme: 'dark' });

    expect(result).toEqual({ theme: 'dark' });
    expect(onChange).toHaveBeenCalledWith({ theme: 'dark' });
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ theme: 'dark' });
    expect(await store.get()).toEqual({ theme: 'dark' });
  });

  it('rejects invalid values and unknown keys without touching the file', async () => {
    const { store, onChange } = makeStore();

    await expect(store.set({ theme: 'neon' })).rejects.toThrow();
    await expect(store.set({ theme: 'dark', extra: true })).rejects.toThrow();
    expect(onChange).not.toHaveBeenCalled();
    expect(await store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults when the file is corrupt', async () => {
    const { store, filePath } = makeStore();
    await writeFile(filePath, '{ not json');

    expect(await store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('exposes get/set on their IPC channels', async () => {
    const handlers = createSettingsHandlers(makeStore().store);

    await handlers[IPC.settingsSet]({ theme: 'light' });

    expect(await handlers[IPC.settingsGet]()).toEqual({ theme: 'light' });
  });
});
