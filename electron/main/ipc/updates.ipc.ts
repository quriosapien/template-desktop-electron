import type { AppUpdater } from 'electron-updater';
import type { UpdateCheck } from '../../../src/types/native.types';
import { IPC } from '../../shared/ipc.contract';
import { AppError } from '../utils/app-error.util';

type UpdaterLike = Pick<AppUpdater, 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall'>;

/** First line only: electron-updater's HttpError appends the full response (headers, cookies). */
const messageOf = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0]?.trim();

/**
 * electron-updater against the GitHub Releases feed configured in
 * electron-builder.config.ts. `autoDownload` is off (see index.ts): the UI
 * asks before downloading. macOS can only apply updates to signed builds.
 */
export function createUpdateService(deps: { isPackaged: boolean; updater: UpdaterLike }) {
  let availableVersion: string | null = null;

  return {
    async check(): Promise<UpdateCheck> {
      if (!deps.isPackaged) {
        return { status: 'unsupported', reason: 'Updates only run in packaged builds.' };
      }

      let result: Awaited<ReturnType<UpdaterLike['checkForUpdates']>>;
      try {
        result = await deps.updater.checkForUpdates();
      } catch (error) {
        throw new AppError('io', `Update check failed: ${messageOf(error)}`);
      }

      if (!result?.isUpdateAvailable) {
        availableVersion = null;
        return { status: 'up-to-date' };
      }
      const { version, releaseNotes } = result.updateInfo;
      availableVersion = version;
      return typeof releaseNotes === 'string'
        ? { status: 'available', version, notes: releaseNotes }
        : { status: 'available', version };
    },

    async install(): Promise<void> {
      if (!availableVersion) {
        throw new AppError('invalid-input', 'No update has been found to install.');
      }
      try {
        await deps.updater.downloadUpdate();
      } catch (error) {
        throw new AppError('io', `Update download failed: ${messageOf(error)}`);
      }
      deps.updater.quitAndInstall();
    },
  };
}

export function createUpdateHandlers(service: ReturnType<typeof createUpdateService>) {
  return {
    [IPC.updatesCheck]: () => service.check(),
    [IPC.updatesInstall]: () => service.install(),
  };
}
