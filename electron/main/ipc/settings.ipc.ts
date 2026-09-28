import { z } from 'zod';
import type { Settings } from '../../../src/types/native.types';
import { IPC } from '../../shared/ipc.contract';
import { createSerialQueue, readJsonFile, writeJsonFileAtomic } from '../utils/json-file.util';

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
}) satisfies z.ZodType<Settings>;

/** `.strict()`: unknown keys are a bug in the caller, not something to persist. */
const settingsPatchSchema = settingsSchema.partial().strict();

export const DEFAULT_SETTINGS: Settings = Object.freeze({ theme: 'system' });

/** JSON-file settings in userData; `onChange` applies them natively (e.g. the theme). */
export function createSettingsStore(deps: {
  filePath: string;
  onChange: (settings: Settings) => void;
}) {
  const serial = createSerialQueue();

  // Spread: the stored shape may be missing keys added in a later version.
  const get = async (): Promise<Settings> => ({
    ...DEFAULT_SETTINGS,
    ...(await readJsonFile(deps.filePath, settingsSchema.partial(), {})),
  });

  return {
    get,

    async set(patch: unknown): Promise<Settings> {
      const validPatch = settingsPatchSchema.parse(patch);
      return serial(async () => {
        const next = { ...(await get()), ...validPatch };
        await writeJsonFileAtomic(deps.filePath, next);
        deps.onChange(next);
        return next;
      });
    },
  };
}

export function createSettingsHandlers(store: ReturnType<typeof createSettingsStore>) {
  return {
    [IPC.settingsGet]: () => store.get(),
    [IPC.settingsSet]: (patch: unknown) => store.set(patch),
  };
}
