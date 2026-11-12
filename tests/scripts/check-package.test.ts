import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { checkPackage, type Package } from '../../scripts/check-package.mjs'
import { debianRevision } from '../../scripts/package.mjs'

// The post-install, profile and launcher recorded from a real `npm run package`
// (electron-builder 26.18.0), so a template change upstream shows here as a red, not as a broken
// install on the human's machine.
const data = (name: string) => readFileSync(join(__dirname, '..', 'data', 'package', name), 'utf8')

const good = (): Package => ({
  version: '0.1.0',
  control: ' Package: menkar\n Version: 0.1.0-12.gabcdef12\n Architecture: amd64\n',
  files: [
    '/opt/Menkar/menkar',
    '/opt/Menkar/chrome-sandbox',
    '/opt/Menkar/resources/app.asar',
    '/opt/Menkar/resources/apparmor-profile',
    '/opt/Menkar/resources/plugin/.claude-plugin/plugin.json',
    '/opt/Menkar/resources/plugin/guide/orchestration-mode.md',
    '/opt/Menkar/resources/plugin/skills/orchestrator/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/worker/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/distill/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/specialize/SKILL.md',
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
      'a skill of the plugin',
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('worker/SKILL.md')) }),
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
    [
      'its build revision (apt would see a rebuild as the same version)',
      (p: Package) => ({ ...p, control: p.control.replace('0.1.0-12.gabcdef12', '0.1.0') }),
    ],
    [
      "the app's version",
      (p: Package) => ({ ...p, control: p.control.replace('0.1.0-', '0.2.0-') }),
    ],
  ])('a package that lost %s fails', (_what, mutate) => {
    expect(checkPackage(mutate(good()))).toHaveLength(1)
  })
})

describe('the Debian revision of a build', () => {
  const at = new Date('2026-11-10T23:59:07Z')
  const clean = (count: number, hash: string) =>
    debianRevision({ count, hash, dirty: false, now: at })

  test('a clean tree is <commits>.g<hash>; one with changes adds dirty and the UTC time', () => {
    expect(clean(412, '0d1bd1a2')).toBe('412.g0d1bd1a2')
    expect(debianRevision({ count: 412, hash: '0d1bd1a2', dirty: true, now: at })).toBe(
      '412.g0d1bd1a2.dirty.20261110235907',
    )
    const dirty = { ...good(), control: ' Version: 0.1.0-412.g0d1bd1a2.dirty.20261110235907\n' }
    expect(
      checkPackage({
        ...good(),
        control: good().control.replace('12.gabcdef12', clean(412, '0d1bd1a2')),
      }),
    ).toEqual([])
    expect(checkPackage(dirty).filter((p) => p.includes('Version'))).toEqual([])
  })

  // dpkg is the judge of the order apt upgrades in; a machine without it has no apt either.
  test.skipIf(!existsSync('/usr/bin/dpkg'))(
    'each build sorts after the one before it, as dpkg orders them, and after the plain 0.1.0',
    () => {
      const builds = [
        '0.1.0',
        `0.1.0-${clean(9, 'ffffffff')}`,
        `0.1.0-${debianRevision({ count: 9, hash: 'ffffffff', dirty: true, now: at })}`,
        `0.1.0-${debianRevision({ count: 9, hash: 'ffffffff', dirty: true, now: new Date('2026-11-11T00:00:01Z') })}`,
        `0.1.0-${clean(10, '00000000')}`,
        `0.1.0-${clean(100, '11111111')}`,
      ]
      expect(builds).toHaveLength(6)
      for (let i = 1; i < builds.length; i++)
        expect(
          () =>
            execFileSync('dpkg', [
              '--compare-versions',
              builds[i - 1] ?? '',
              'lt',
              builds[i] ?? '',
            ]),
          `${builds[i - 1]} < ${builds[i]}`,
        ).not.toThrow()
    },
  )
})
