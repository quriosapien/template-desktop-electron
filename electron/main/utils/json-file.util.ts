import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

/**
 * Reads and validates a JSON file. A missing, unparseable or schema-invalid
 * file yields `fallback` — a corrupt settings file must never brick the app.
 */
export async function readJsonFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  fallback: T,
): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fallback;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : fallback;
}

/**
 * Write-to-temp-then-rename, so a crash mid-write leaves the old file intact.
 * Mode 0600: these files live in the user's profile and are theirs alone.
 */
export async function writeJsonFileAtomic(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
}

/**
 * Runs async tasks one at a time, in call order. Stores use it so two
 * concurrent read-modify-write updates can't lose each other's changes.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
