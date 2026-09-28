import log from 'electron-log/main';

export type Logger = Pick<typeof log, 'debug' | 'info' | 'warn' | 'error'>;

/**
 * electron-log writes to the OS log directory (e.g. ~/Library/Logs/<app>/ on
 * macOS) with rotation. Packaged builds log to file only; dev also logs to
 * the terminal running `npm run dev`.
 */
export function createLogger(options: { isPackaged: boolean }): Logger {
  log.transports.file.level = 'info';
  log.transports.console.level = options.isPackaged ? false : 'debug';
  log.errorHandler.startCatching();
  return log;
}
