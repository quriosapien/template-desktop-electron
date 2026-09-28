import { describe, expect, it } from 'vitest';
import { createAppInfoHandlers } from '../../../main/ipc/app-info.ipc';
import { IPC } from '../../../shared/ipc.contract';

describe('app info handler', () => {
  it('reports name, version, platform, arch and homepage', () => {
    const handlers = createAppInfoHandlers({
      app: { getName: () => 'Test App', getVersion: () => '1.2.3' },
      homepage: 'https://example.com',
    });

    expect(handlers[IPC.appInfo]()).toEqual({
      name: 'Test App',
      version: '1.2.3',
      platform: process.platform,
      arch: process.arch,
      homepage: 'https://example.com',
    });
  });
});
