import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createSerialQueue,
  readJsonFile,
  writeJsonFileAtomic,
} from '../../../main/utils/json-file.util';
import { useTempDir } from '../../support/temp-dir';

const tempDir = useTempDir();
const schema = z.object({ count: z.number() });

describe('readJsonFile', () => {
  it('returns the fallback for a missing, corrupt or invalid file', async () => {
    const file = path.join(tempDir(), 'data.json');
    expect(await readJsonFile(file, schema, { count: 0 })).toEqual({ count: 0 });

    await writeFile(file, 'not json');
    expect(await readJsonFile(file, schema, { count: 0 })).toEqual({ count: 0 });

    await writeFile(file, '{"count":"three"}');
    expect(await readJsonFile(file, schema, { count: 0 })).toEqual({ count: 0 });
  });

  it('rethrows unexpected read errors', async () => {
    // Reading a directory fails with EISDIR, not ENOENT.
    await expect(readJsonFile(tempDir(), schema, { count: 0 })).rejects.toThrow();
  });
});

describe('writeJsonFileAtomic', () => {
  it('creates parent directories and leaves no temp files behind', async () => {
    const file = path.join(tempDir(), 'nested', 'data.json');

    await writeJsonFileAtomic(file, { count: 3 });

    expect(await readJsonFile(file, schema, { count: 0 })).toEqual({ count: 3 });
    expect(await readdir(path.dirname(file))).toEqual(['data.json']);
  });

  it.skipIf(process.platform === 'win32')('writes owner-only files', async () => {
    const file = path.join(tempDir(), 'data.json');
    await writeJsonFileAtomic(file, { count: 1 });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('writes pretty JSON with a trailing newline', async () => {
    const file = path.join(tempDir(), 'data.json');
    await writeJsonFileAtomic(file, { count: 1 });
    expect(await readFile(file, 'utf8')).toBe('{\n  "count": 1\n}\n');
  });
});

describe('createSerialQueue', () => {
  it('runs tasks one at a time in call order, surviving failures', async () => {
    const serial = createSerialQueue();
    const order: string[] = [];
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const first = serial(async () => {
      await delay(20);
      order.push('first');
    });
    const failing = serial(async () => {
      throw new Error('boom');
    });
    const last = serial(async () => {
      order.push('last');
      return 'done';
    });

    await first;
    await expect(failing).rejects.toThrow('boom');
    expect(await last).toBe('done');
    expect(order).toEqual(['first', 'last']);
  });
});
