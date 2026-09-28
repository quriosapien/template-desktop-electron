import { describe, expect, it, vi } from 'vitest';
import { createShellHandlers } from '../../../main/ipc/shell.ipc';
import { IPC } from '../../../shared/ipc.contract';

describe('shell handlers', () => {
  it('opens https URLs externally', async () => {
    const openExternal = vi.fn(async () => {});
    await createShellHandlers({ openExternal })[IPC.shellOpenExternal]('https://example.com');
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('refuses every other scheme and non-strings', async () => {
    const openExternal = vi.fn(async () => {});
    const open = createShellHandlers({ openExternal })[IPC.shellOpenExternal];

    await expect(open('file:///etc/passwd')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(open('smb://share/x')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(open(42)).rejects.toThrow();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
