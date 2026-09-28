import { z } from 'zod';
import { IPC } from '../../shared/ipc.contract';
import { isSafeExternalUrl } from '../security';
import { AppError } from '../utils/app-error.util';

export function createShellHandlers(deps: { openExternal: (url: string) => Promise<void> }) {
  return {
    [IPC.shellOpenExternal]: async (url: unknown) => {
      const validUrl = z.string().parse(url);
      if (!isSafeExternalUrl(validUrl)) {
        throw new AppError('forbidden', 'Only https links can be opened.');
      }
      await deps.openExternal(validUrl);
    },
  };
}
