import type { Configuration } from 'electron-builder';

/**
 * Installers + auto-update feed. `npm run dist` builds for the current OS;
 * .github/workflows/release.yml builds all three and publishes a draft
 * GitHub Release, which electron-updater reads once you publish it.
 */
const config: Configuration = {
  appId: 'com.quriosapien.template-desktop-electron',
  productName: 'Template Desktop Electron',
  directories: { output: 'release', buildResources: 'build' },
  // Vite and tsdown already bundled everything the app runs; ship only that.
  files: ['dist/renderer/**', 'dist-electron/**', 'package.json'],
  asar: true,
  electronFuses: {
    // Flipping fuses rewrites the Electron binary and voids its signature; Apple
    // silicon refuses to run unsigned code, so re-sign ad hoc. A real identity
    // (CSC_LINK, see README) signs over this afterwards.
    resetAdHocDarwinSignature: true,
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },
  publish: { provider: 'github', owner: 'quriosapien', repo: 'template-desktop-electron' },
  mac: {
    category: 'public.app-category.developer-tools',
    // zip is what electron-updater downloads on macOS; dmg is for humans.
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: { target: 'nsis' },
  nsis: { oneClick: false, perMachine: false },
  linux: { target: ['AppImage', 'deb'], category: 'Development' },
};

export default config;
