import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSecretsHandlers, createSecretsStore } from '../../../main/ipc/secrets.ipc';
import { AppError } from '../../../main/utils/app-error.util';
import { IPC } from '../../../shared/ipc.contract';
import { useTempDir } from '../../support/temp-dir';

const reverse = (text: string) => [...text].reverse().join('');
/** Ciphertext as if written under a since-rotated key: readable, but due for re-encryption. */
const rotatedCiphertext = (text: string) => Buffer.from(`old:${reverse(text)}`).toString('base64');

/** Reversible stand-in for safeStorage: prefixes and reverses the text. */
function fakeSafeStorage(
  options: { available?: boolean; backend?: string; beforeDecrypt?: () => Promise<void> } = {},
) {
  return {
    isAsyncEncryptionAvailable: async () => options.available ?? true,
    getSelectedStorageBackend: () => options.backend ?? 'gnome_libsecret',
    encryptStringAsync: async (text: string) => Buffer.from(`enc:${reverse(text)}`),
    decryptStringAsync: async (buffer: Buffer) => {
      await options.beforeDecrypt?.();
      const text = buffer.toString();
      return { result: reverse(text.slice(4)), shouldReEncrypt: text.startsWith('old:') };
    },
  };
}

const tempDir = useTempDir();

function makeStore(
  options: Parameters<typeof fakeSafeStorage>[0] = {},
  platform: NodeJS.Platform = 'darwin',
) {
  const filePath = path.join(tempDir(), 'secrets.json');
  return {
    filePath,
    store: createSecretsStore({ filePath, safeStorage: fakeSafeStorage(options), platform }),
  };
}

describe('createSecretsStore', () => {
  it('round-trips a secret and returns null for unknown keys', async () => {
    const { store } = makeStore();

    await store.set('refresh-token', 'super-secret');

    expect(await store.get('refresh-token')).toBe('super-secret');
    expect(await store.get('other')).toBeNull();
  });

  it('writes only ciphertext to disk', async () => {
    const { store, filePath } = makeStore();
    await store.set('refresh-token', 'super-secret');

    const onDisk = await readFile(filePath, 'utf8');
    expect(onDisk).not.toContain('super-secret');
    expect(Object.keys(JSON.parse(onDisk))).toEqual(['refresh-token']);
  });

  it('deletes a secret', async () => {
    const { store } = makeStore();
    await store.set('refresh-token', 'super-secret');

    await store.delete('refresh-token');

    expect(await store.get('refresh-token')).toBeNull();
  });

  it('keeps every write when calls overlap', async () => {
    const { store } = makeStore();

    await Promise.all([store.set('a', '1'), store.set('b', '2'), store.set('c', '3')]);

    expect([await store.get('a'), await store.get('b'), await store.get('c')]).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('re-encrypts a secret that safeStorage flags as due for re-encryption', async () => {
    const { store, filePath } = makeStore();
    await writeFile(
      filePath,
      JSON.stringify({ 'refresh-token': rotatedCiphertext('super-secret') }),
    );

    expect(await store.get('refresh-token')).toBe('super-secret');

    const onDisk = JSON.parse(await readFile(filePath, 'utf8'));
    expect(Buffer.from(onDisk['refresh-token'], 'base64').toString()).toBe(
      `enc:${reverse('super-secret')}`,
    );
    expect(await store.get('refresh-token')).toBe('super-secret');
  });

  it('does not let a re-encryption overwrite a newer write', async () => {
    let reachedDecrypt = () => {};
    const atDecrypt = new Promise<void>((resolve) => {
      reachedDecrypt = resolve;
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { store, filePath } = makeStore({
      beforeDecrypt: () => {
        reachedDecrypt();
        return gate;
      },
    });
    await writeFile(filePath, JSON.stringify({ 'refresh-token': rotatedCiphertext('old-token') }));

    // get() has read the old ciphertext and is mid-decrypt when the set lands.
    const pending = store.get('refresh-token');
    await atDecrypt;
    await store.set('refresh-token', 'new-token');
    release();

    expect(await pending).toBe('old-token');
    expect(await store.get('refresh-token')).toBe('new-token');
  });

  it('refuses when OS encryption is unavailable', async () => {
    const { store } = makeStore({ available: false });

    await expect(store.get('refresh-token')).rejects.toMatchObject({ kind: 'unsupported' });
    await expect(store.set('refresh-token', 'x')).rejects.toBeInstanceOf(AppError);
  });

  it('refuses Linux’s plaintext fallback backend instead of pretending to encrypt', async () => {
    const { store } = makeStore({ backend: 'basic_text' }, 'linux');

    await expect(store.set('refresh-token', 'x')).rejects.toMatchObject({ kind: 'unsupported' });
  });

  it('validates keys and values', async () => {
    const { store } = makeStore();

    await expect(store.get('../escape')).rejects.toThrow(/Invalid secret key/);
    await expect(store.set('ok', 42)).rejects.toThrow();
    await expect(store.set('ok', 'x'.repeat(20_000))).rejects.toThrow();
  });

  it('exposes get/set/delete on their IPC channels', async () => {
    const { store } = makeStore();
    const handlers = createSecretsHandlers(store);

    await handlers[IPC.secretsSet]('k', 'v');
    expect(await handlers[IPC.secretsGet]('k')).toBe('v');
    await handlers[IPC.secretsDelete]('k');
    expect(await handlers[IPC.secretsGet]('k')).toBeNull();
  });
});
