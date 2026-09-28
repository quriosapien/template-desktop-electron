import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, toErrorPayload } from '../../../main/utils/app-error.util';

describe('toErrorPayload', () => {
  it('passes AppError kind and message through', () => {
    expect(toErrorPayload(new AppError('forbidden', 'Nope'))).toEqual({
      kind: 'forbidden',
      message: 'Nope',
    });
  });

  it('maps validation failures to invalid-input', () => {
    const result = z.string().safeParse(42);
    expect(toErrorPayload(result.error)).toMatchObject({ kind: 'invalid-input' });
  });

  it('maps filesystem errors to io without leaking paths', () => {
    const error = Object.assign(new Error("EACCES: permission denied, open '/Users/me/x'"), {
      code: 'EACCES',
    });
    expect(toErrorPayload(error)).toEqual({ kind: 'io', message: 'File system error (EACCES)' });
  });

  it('hides everything else behind a generic internal error', () => {
    expect(toErrorPayload(new Error('boom'))).toEqual({
      kind: 'internal',
      message: 'Unexpected error — see the app log.',
    });
    expect(toErrorPayload('string')).toMatchObject({ kind: 'internal' });
  });
});
