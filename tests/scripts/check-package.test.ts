import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { checkPackage, type Package } from '../../scripts/check-package.mjs'

// The post-install, profile and launcher recorded from a real `npm run package`
// (electron-builder 26.18.0), so a template change upstream shows here as a red, not as a broken
// install on the human's machine.
const data = (name: string) => readFileSync(join(__dirname, '..', 'data', 'package', name), 'utf8')

const good = (): Package => ({
  control: ' Package: menkar\n Version: 0.0.0\n Architecture: amd64\n',
  files: [
    '/opt/Menkar/menkar',
    '/opt/Menkar/chrome-sandbox',
    '/opt/Menkar/resources/app.asar',
    '/opt/Menkar/resources/apparmor-profile',
    '/opt/Menkar/resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node',
    '/usr/share/applications/menkar.desktop',
    '/usr/share/icons/hicolor/512x512/apps/menkar.png',
  ],
  postinst: data('postinst'),
  profile: data('apparmor-profile'),
  desktop: data('menkar.desktop'),
})

describe('package:check', () => {
  test('the package as built passes', () => {
    expect(checkPackage(good())).toEqual([])
  })

  test.each([
    [
      'the launcher',
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('.desktop')) }),
    ],
    [
      'the native pty',
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('pty.node')) }),
    ],
    [
      'the sandbox helper',
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('chrome-sandbox')) }),
    ],
    [
      'the command',
      (p: Package) => ({
        ...p,
        postinst: p.postinst.replaceAll('update-alternatives --install', 'true'),
      }),
    ],
    [
      'the profile install',
      (p: Package) => ({ ...p, postinst: p.postinst.replace('/etc/apparmor.d/', '/tmp/') }),
    ],
    [
      'userns in the profile',
      (p: Package) => ({ ...p, profile: p.profile.replace('userns,', '') }),
    ],
    [
      'a launcher without extra flags',
      (p: Package) => ({ ...p, desktop: p.desktop.replace('%U', '--no-sandbox %U') }),
    ],
    [
      'no update feed',
      (p: Package) => ({ ...p, files: [...p.files, '/opt/Menkar/resources/app-update.yml'] }),
    ],
    [
      'a setuid-free helper',
      (p: Package) => ({
        ...p,
        postinst: p.postinst.replace(
          "chmod 0755 '/opt/Menkar/chrome-sandbox'",
          "chmod 4755 '/opt/Menkar/chrome-sandbox'",
        ),
      }),
    ],
  ])('a package that lost %s fails', (_what, mutate) => {
    expect(checkPackage(mutate(good()))).toHaveLength(1)
  })
})
