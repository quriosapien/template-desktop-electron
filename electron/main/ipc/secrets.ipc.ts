import { z } from 'zod';
import { IPC } from '../../shared/ipc.contract';
import { AppError } from '../utils/app-error.util';
import { createSerialQueue, readJsonFile, writeJsonFileAtomic } from '../utils/json-file.util';

/** The async safeStorage API: Electron 45 deprecates the sync one and Electron 46 removes it. */
type SafeStorageLike = {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(encrypted: Buffer): Promise<{ shouldReEncrypt: boolean; result: string }>;
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

  const assertAvailable = async () => {
    if (!(await deps.safeStorage.isAsyncEncryptionAvailable())) {
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
  const encrypt = async (value: string) =>
    (await deps.safeStorage.encryptStringAsync(value)).toString('base64');

  return {
    async get(key: unknown): Promise<string | null> {
      const validKey = secretKey.parse(key);
      await assertAvailable();
      const encrypted = (await readAll())[validKey];
      if (!encrypted) return null;
      const { result, shouldReEncrypt } = await deps.safeStorage.decryptStringAsync(
        Buffer.from(encrypted, 'base64'),
      );
      if (shouldReEncrypt) {
        // The OS key rotated or got stronger: store the value under the current key.
        await serial(async () => {
          const all = await readAll();
          if (all[validKey] !== encrypted) return; // a newer set/delete won the race
          all[validKey] = await encrypt(result);
          await writeJsonFileAtomic(deps.filePath, all);
        });
      }
      return result;
    },

    async set(key: unknown, value: unknown): Promise<void> {
      const validKey = secretKey.parse(key);
      const validValue = secretValue.parse(value);
      await assertAvailable();
      return serial(async () => {
        const all = await readAll();
        all[validKey] = await encrypt(validValue);
        await writeJsonFileAtomic(deps.filePath, all);
      });
    },

    async delete(key: unknown): Promise<void> {
      const validKey = secretKey.parse(key);
      await assertAvailable();
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
