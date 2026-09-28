import { vi } from 'vitest';
import type { Logger } from '../../main/utils/logger.util';

export function createFakeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
