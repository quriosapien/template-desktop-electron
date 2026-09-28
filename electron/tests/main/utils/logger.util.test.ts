import { describe, expect, it, vi } from 'vitest';

const log = vi.hoisted(() => ({
  transports: { file: { level: '' as unknown }, console: { level: '' as unknown } },
  errorHandler: { startCatching: vi.fn() },
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('electron-log/main', () => ({ default: log }));

const { createLogger } = await import('../../../main/utils/logger.util');

describe('createLogger', () => {
  it('logs to file always and to the console only in unpackaged runs', () => {
    createLogger({ isPackaged: false });
    expect(log.transports.file.level).toBe('info');
    expect(log.transports.console.level).toBe('debug');

    createLogger({ isPackaged: true });
    expect(log.transports.console.level).toBe(false);
  });

  it('captures uncaught errors', () => {
    createLogger({ isPackaged: true });
    expect(log.errorHandler.startCatching).toHaveBeenCalled();
  });
});
