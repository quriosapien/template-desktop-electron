import { describe, expect, it, vi } from 'vitest';
import { createUpdateHandlers, createUpdateService } from '../../../main/ipc/updates.ipc';
import { IPC } from '../../../shared/ipc.contract';

function fakeUpdater(result: unknown = null) {
  return {
    checkForUpdates: vi.fn(async () => result as never),
    downloadUpdate: vi.fn(async () => []),
    quitAndInstall: vi.fn(),
  };
}

const available = (releaseNotes: unknown = 'Bug fixes') => ({
  isUpdateAvailable: true,
  updateInfo: { version: '2.0.0', releaseNotes },
});

describe('createUpdateService', () => {
  it('reports unsupported in unpackaged runs without touching the updater', async () => {
    const updater = fakeUpdater();
    const service = createUpdateService({ isPackaged: false, updater });

    expect(await service.check()).toMatchObject({ status: 'unsupported' });
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('reports up-to-date when no update is available', async () => {
    const service = createUpdateService({
      isPackaged: true,
      updater: fakeUpdater({ isUpdateAvailable: false, updateInfo: { version: '1.0.0' } }),
    });

    expect(await service.check()).toEqual({ status: 'up-to-date' });
  });

  it('reports an available update with string release notes', async () => {
    const service = createUpdateService({ isPackaged: true, updater: fakeUpdater(available()) });

    expect(await service.check()).toEqual({
      status: 'available',
      version: '2.0.0',
      notes: 'Bug fixes',
    });
  });

  it('omits structured release notes', async () => {
    const service = createUpdateService({
      isPackaged: true,
      updater: fakeUpdater(available([{ version: '2.0.0', note: 'x' }])),
    });

    expect(await service.check()).toEqual({ status: 'available', version: '2.0.0' });
  });

  it('keeps only the first line of updater errors (they embed full HTTP responses)', async () => {
    const updater = fakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(
      new Error(
        '404 \n"method: GET url: https://github.com/…"\nHeaders: {"set-cookie": "logged_in=no"}',
      ),
    );
    const service = createUpdateService({ isPackaged: true, updater });

    const failure = await service.check().catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: 'io', message: 'Update check failed: 404' });
  });

  it('turns updater failures into io errors', async () => {
    const updater = fakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('HttpError: 404'));
    const service = createUpdateService({ isPackaged: true, updater });

    await expect(service.check()).rejects.toMatchObject({ kind: 'io', message: /404/ });
  });

  it('install downloads then restarts, but only after a successful check', async () => {
    const updater = fakeUpdater(available());
    const service = createUpdateService({ isPackaged: true, updater });

    await expect(service.install()).rejects.toMatchObject({ kind: 'invalid-input' });

    await service.check();
    await service.install();

    expect(updater.downloadUpdate).toHaveBeenCalled();
    expect(updater.quitAndInstall).toHaveBeenCalled();
  });

  it('install reports download failures without restarting', async () => {
    const updater = fakeUpdater(available());
    updater.downloadUpdate.mockRejectedValueOnce(new Error('checksum mismatch'));
    const service = createUpdateService({ isPackaged: true, updater });
    await service.check();

    await expect(service.install()).rejects.toMatchObject({ kind: 'io' });
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('exposes check/install on their IPC channels', async () => {
    const handlers = createUpdateHandlers(
      createUpdateService({ isPackaged: false, updater: fakeUpdater() }),
    );

    expect(await handlers[IPC.updatesCheck]()).toMatchObject({ status: 'unsupported' });
    await expect(handlers[IPC.updatesInstall]()).rejects.toThrow();
  });
});
