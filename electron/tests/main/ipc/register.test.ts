import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { type IpcHandlers, registerIpcHandlers } from '../../../main/ipc/register';
import { AppError } from '../../../main/utils/app-error.util';
import { IPC } from '../../../shared/ipc.contract';
import { createFakeLogger } from '../../support/fake-logger';

type Invoke = (
  event: { senderFrame: { url: string } | null },
  ...args: unknown[]
) => Promise<unknown>;

function setup(overrides: Partial<IpcHandlers> = {}) {
  const registered = new Map<string, Invoke>();
  const ipcMain = { handle: (channel: string, fn: Invoke) => registered.set(channel, fn) };
  const handlers = Object.fromEntries(
    Object.values(IPC)
      .filter((channel) => channel !== IPC.menuAction)
      .map((channel) => [channel, vi.fn(async () => 'default')]),
  ) as unknown as IpcHandlers;
  const logger = createFakeLogger();

  registerIpcHandlers({
    ipcMain: ipcMain as never,
    handlers: { ...handlers, ...overrides },
    trustedOrigin: 'app://renderer',
    logger,
  });

  const invoke = (channel: string, url: string | null, ...args: unknown[]) =>
    registered.get(channel)?.({ senderFrame: url === null ? null : { url } }, ...args);
  return { registered, invoke, logger };
}

const trusted = 'app://renderer/index.html';

describe('registerIpcHandlers', () => {
  it('registers every invoke channel', () => {
    const { registered } = setup();
    expect([...registered.keys()].sort()).toEqual(
      Object.values(IPC)
        .filter((c) => c !== IPC.menuAction)
        .sort(),
    );
  });

  it('wraps results in a success envelope and passes arguments through', async () => {
    const secretsGet = vi.fn(async (key: unknown) => `value-of-${String(key)}`);
    const { invoke } = setup({ [IPC.secretsGet]: secretsGet });

    expect(await invoke(IPC.secretsGet, trusted, 'refresh-token')).toEqual({
      ok: true,
      data: 'value-of-refresh-token',
    });
  });

  it('rejects calls from frames outside the app origin without running the handler', async () => {
    const secretsGet = vi.fn();
    const { invoke, logger } = setup({ [IPC.secretsGet]: secretsGet });

    const result = await invoke(IPC.secretsGet, 'https://evil.example/', 'refresh-token');
    const detached = await invoke(IPC.secretsGet, null);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'forbidden', message: 'Untrusted sender.' },
    });
    expect(detached).toMatchObject({ ok: false, error: { kind: 'forbidden' } });
    expect(secretsGet).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('reports AppErrors with their kind and logs them as warnings', async () => {
    const { invoke, logger } = setup({
      [IPC.secretsGet]: async () => {
        throw new AppError('unsupported', 'No keychain');
      },
    });

    expect(await invoke(IPC.secretsGet, trusted)).toEqual({
      ok: false,
      error: { kind: 'unsupported', message: 'No keychain' },
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('reports validation failures as invalid-input', async () => {
    const { invoke } = setup({
      [IPC.settingsSet]: async (patch: unknown) => z.object({}).strict().parse(patch),
    });

    expect(await invoke(IPC.settingsSet, trusted, { bogus: 1 })).toMatchObject({
      ok: false,
      error: { kind: 'invalid-input' },
    });
  });

  it('hides unexpected errors behind a generic message and logs them as errors', async () => {
    const { invoke, logger } = setup({
      [IPC.appInfo]: async () => {
        throw new Error('secret internal detail /Users/me/path');
      },
    });

    const result = await invoke(IPC.appInfo, trusted);

    expect(result).toMatchObject({ ok: false, error: { kind: 'internal' } });
    expect(JSON.stringify(result)).not.toContain('/Users/me');
    expect(logger.error).toHaveBeenCalled();
  });
});
