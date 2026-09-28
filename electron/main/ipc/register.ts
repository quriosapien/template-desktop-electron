import type { IpcMain } from 'electron';
import type { InvokeChannel, IpcResult } from '../../shared/ipc.contract';
import { isSameOrigin } from '../security';
import { toErrorPayload } from '../utils/app-error.util';
import type { Logger } from '../utils/logger.util';

/** Handlers receive raw, untrusted IPC arguments and must validate them. */
export type IpcHandler = (...args: never[]) => unknown;

/** Every invoke channel must be handled — a missing one is a compile error. */
export type IpcHandlers = Record<InvokeChannel, IpcHandler>;

/**
 * Registers every handler behind the same two guards:
 *   1. the calling frame must belong to the app's own origin (a navigated or
 *      injected frame gets nothing);
 *   2. results and failures both travel as an IpcResult envelope.
 */
export function registerIpcHandlers(deps: {
  ipcMain: Pick<IpcMain, 'handle'>;
  handlers: IpcHandlers;
  trustedOrigin: string;
  logger: Logger;
}): void {
  for (const [channel, handler] of Object.entries(deps.handlers)) {
    deps.ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<unknown>> => {
      const senderUrl = event.senderFrame?.url;
      if (!isSameOrigin(senderUrl, deps.trustedOrigin)) {
        deps.logger.warn(`IPC ${channel} rejected: untrusted sender ${senderUrl ?? '(none)'}`);
        return { ok: false, error: { kind: 'forbidden', message: 'Untrusted sender.' } };
      }

      try {
        return { ok: true, data: await (handler as (...a: unknown[]) => unknown)(...args) };
      } catch (error) {
        const payload = toErrorPayload(error);
        deps.logger[payload.kind === 'internal' ? 'error' : 'warn'](
          `IPC ${channel} failed:`,
          error,
        );
        return { ok: false, error: payload };
      }
    });
  }
}
