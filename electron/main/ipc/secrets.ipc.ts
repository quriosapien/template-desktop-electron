import { z } from 'zod';
import { IPC } from '../../shared/ipc.contract';
import { AppError } from '../utils/app-error.util';
import { createSerialQueue, readJsonFile, writeJsonFileAtomic } from '../utils/json-file.util';

type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend(): string;
};

const secretKey = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i, 'Invalid secret key');
const secretValue = z.string().max(16_384);
/** key → base64 ciphertext. Only ciphertext ever touches the disk. */
const secretsFileSchema = z.record(z.string(), z.string());

/**
 * Secrets encrypted with Electron's safeStorage, whose key lives in the OS
 * keychain (macOS Keychain, Windows DPAPI, libsecret/kwallet on Linux).
 */
export function createSecretsStore(deps: {
  filePath: string;
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
}) {
  const serial = createSerialQueue();

  const assertAvailable = () => {
    if (!deps.safeStorage.isEncryptionAvailable()) {
      throw new AppError('unsupported', 'OS keychain encryption is unavailable.');
    }
    // Linux with no secret service falls back to a hard-coded key: that's
    // obfuscation, not encryption — refuse rather than pretend.
    if (
      deps.platform === 'linux' &&
      deps.safeStorage.getSelectedStorageBackend() === 'basic_text'
    ) {
      throw new AppError('unsupported', 'No keyring (secret service) is available.');
    }
  };

  const readAll = () => readJsonFile(deps.filePath, secretsFileSchema, {});

  return {
    async get(key: unknown): Promise<string | null> {
      const validKey = secretKey.parse(key);
      assertAvailable();
      const encrypted = (await readAll())[validKey];
      return encrypted ? deps.safeStorage.decryptString(Buffer.from(encrypted, 'base64')) : null;
    },

    async set(key: unknown, value: unknown): Promise<void> {
      const validKey = secretKey.parse(key);
      const validValue = secretValue.parse(value);
      assertAvailable();
      return serial(async () => {
        const all = await readAll();
        all[validKey] = deps.safeStorage.encryptString(validValue).toString('base64');
        await writeJsonFileAtomic(deps.filePath, all);
      });
    },

    async delete(key: unknown): Promise<void> {
      const validKey = secretKey.parse(key);
      assertAvailable();
      return serial(async () => {
        const all = await readAll();
        if (validKey in all) {
          delete all[validKey];
          await writeJsonFileAtomic(deps.filePath, all);
        }
      });
    },
  };
}

export function createSecretsHandlers(store: ReturnType<typeof createSecretsStore>) {
  return {
    [IPC.secretsGet]: (key: unknown) => store.get(key),
    [IPC.secretsSet]: (key: unknown, value: unknown) => store.set(key, value),
    [IPC.secretsDelete]: (key: unknown) => store.delete(key),
  };
}
