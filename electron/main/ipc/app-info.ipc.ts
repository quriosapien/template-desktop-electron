import type { AppInfo } from '../../../src/types/native.types';
import { IPC } from '../../shared/ipc.contract';

type AppLike = { getName(): string; getVersion(): string };

export function createAppInfoHandlers(deps: { app: AppLike; homepage: string }) {
  const info = (): AppInfo => ({
    name: deps.app.getName(),
    version: deps.app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    homepage: deps.homepage,
  });

  return { [IPC.appInfo]: info };
}
