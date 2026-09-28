import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { buildMenuTemplate } from '../../main/menu';

function build(platform: NodeJS.Platform, isPackaged = true) {
  const sendAction = vi.fn();
  const openHomepage = vi.fn();
  const template = buildMenuTemplate({
    appName: 'Test App',
    platform,
    isPackaged,
    sendAction,
    openHomepage,
  });
  return { template, sendAction, openHomepage };
}

const items = (template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
  template.flatMap((item) => [item, ...(Array.isArray(item.submenu) ? items(item.submenu) : [])]);

const byLabel = (template: MenuItemConstructorOptions[], label: string) =>
  items(template).find((item) => item.label === label);

const click = (item: MenuItemConstructorOptions | undefined) =>
  (item?.click as (() => void) | undefined)?.();

describe('buildMenuTemplate', () => {
  it('puts Settings in the app menu on macOS, with the ⌘, accelerator', () => {
    const { template, sendAction } = build('darwin');

    expect(template[0]?.label).toBe('Test App');
    const settings = byLabel(template, 'Settings…');
    expect(settings?.accelerator).toBe('CmdOrCtrl+,');
    click(settings);
    expect(sendAction).toHaveBeenCalledWith('open-settings');
  });

  it('puts Settings in the File menu elsewhere', () => {
    const { template } = build('win32');

    expect(template[0]?.label).toBe('File');
    expect(byLabel(template, 'Settings…')).toBeDefined();
  });

  it('announces update checks and opens the homepage', () => {
    const { template, sendAction, openHomepage } = build('linux');

    click(byLabel(template, 'Check for Updates…'));
    click(byLabel(template, 'Project Homepage'));

    expect(sendAction).toHaveBeenCalledWith('check-updates');
    expect(openHomepage).toHaveBeenCalled();
  });

  it('ships DevTools and reload only in unpackaged runs', () => {
    const roles = (isPackaged: boolean) =>
      items(build('darwin', isPackaged).template).map((i) => i.role);

    expect(roles(false)).toContain('toggleDevTools');
    expect(roles(true)).not.toContain('toggleDevTools');
    expect(roles(true)).not.toContain('reload');
  });
});
