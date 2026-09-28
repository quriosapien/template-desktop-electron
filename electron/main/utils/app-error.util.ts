import { ZodError, z } from 'zod';
import type { NativeErrorKind, NativeErrorPayload } from '../../../src/types/native.types';

/**
 * An expected, reportable failure. Its kind and message cross the IPC boundary
 * verbatim; anything else is logged and reported as a generic internal error.
 */
export class AppError extends Error {
  constructor(
    readonly kind: NativeErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const hasErrnoCode = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';

/** Maps any thrown value to the payload the UI receives. */
export function toErrorPayload(error: unknown): NativeErrorPayload {
  if (error instanceof AppError) {
    return { kind: error.kind, message: error.message };
  }
  if (error instanceof ZodError) {
    return { kind: 'invalid-input', message: z.prettifyError(error) };
  }
  if (hasErrnoCode(error)) {
    return { kind: 'io', message: `File system error (${error.code})` };
  }
  // Never leak internals (paths, stack details) to the renderer.
  return { kind: 'internal', message: 'Unexpected error — see the app log.' };
}
