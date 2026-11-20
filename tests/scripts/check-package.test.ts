import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  asarEntries,
  checkPackage,
  checkRpm,
  FLAVOURS,
  type Package,
  type Rpm,
  sharedPaths,
} from '../../scripts/check-package.mjs'
import {
  debianRevision,
  packageFlavour,
  packageTargets,
  packageVersion,
} from '../../scripts/package.mjs'

// The post-install, profile and launcher recorded from a real `npm run package`
// (electron-builder 26.18.0), so a template change upstream shows here as a red, not as a broken
// install on the human's machine.
const data = (name: string) => readFileSync(join(__dirname, '..', 'data', 'package', name), 'utf8')

// What app.asar must hold: the app, and the programs agents run through Electron's binary.
const PROGRAMS = ['index', 'statusline', 'mcp-server', 'codex-notify'].map(
  (name) => `/out/main/${name}.js`,
)

const good = (): Package => ({
  version: '0.1.0',
  control:
    ' Package: menkar\n Version: 0.1.0-12.gabcdef12\n Architecture: amd64\n' +
    ' Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0, libasound2t64 | libasound2\n',
  files: [
    '/opt/Menkar/menkar',
    '/opt/Menkar/chrome-sandbox',
    '/opt/Menkar/resources/app.asar',
    '/opt/Menkar/resources/apparmor-profile',
    '/opt/Menkar/resources/plugin/.claude-plugin/plugin.json',
    '/opt/Menkar/resources/plugin/guide/orchestration-mode.md',
    '/opt/Menkar/resources/plugin/team/common.md',
    '/opt/Menkar/resources/plugin/team/claude.md',
    '/opt/Menkar/resources/plugin/team/codex.md',
    '/opt/Menkar/resources/plugin/skills/orchestrator/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/worker/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/distill/SKILL.md',
    '/opt/Menkar/resources/plugin/skills/specialize/SKILL.md',
    '/opt/Menkar/resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node',
    '/usr/share/applications/menkar.desktop',
    '/usr/share/icons/hicolor/512x512/apps/menkar.png',
  ],
  asar: PROGRAMS,
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
      'the team instructions',
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('team/common.md')) }),
    ],
    [
      "Codex's team part",
      (p: Package) => ({ ...p, files: p.files.filter((f) => !f.endsWith('team/codex.md')) }),
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
      "Codex's notify program",
      (p: Package) => ({ ...p, asar: p.asar.filter((f) => !f.endsWith('codex-notify.js')) }),
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
      'its sound library (Electron does not start without libasound.so.2)',
      (p: Package) => ({ ...p, control: p.control.replace(', libasound2t64 | libasound2', '') }),
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

  test("the version the app is told is the package's whole Version, as dpkg shows it", () => {
    expect(packageVersion('0.1.0', clean(412, '0d1bd1a2'))).toBe('0.1.0-412.g0d1bd1a2')
    const control = good().control.replace('12.gabcdef12', clean(412, '0d1bd1a2'))
    expect(control).toContain(` Version: ${packageVersion('0.1.0', clean(412, '0d1bd1a2'))}\n`)
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

// 1.155 Q3, 1.157 P1, 1.158: the sandbox is a package of its own beside the daily Menkar. Its
// post-install, profile, launcher and file list are recorded from a real `npm run package:sandbox`
// by packager, and the daily package's file list beside them.
describe('the sandbox package', () => {
  const sandboxData = (name: string) =>
    readFileSync(join(__dirname, '..', 'data', 'package', 'sandbox', name), 'utf8')
  // `dpkg-deb -c` lines: a directory's mode starts with d; its path is the sixth field on.
  const listing = (text: string) => {
    const entries = text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const fields = line.split(/\s+/)
        const path = fields.slice(5).join(' ').replace(/^\./, '').replace(/\/$/, '')
        return { path, directory: fields[0]?.startsWith('d') === true }
      })
    return {
      files: entries.map((e) => e.path),
      directories: entries.filter((e) => e.directory).map((e) => e.path),
    }
  }
  const sandbox = (): Package => {
    const { files } = listing(sandboxData('files.txt'))
    return {
      version: '0.1.0',
      control:
        ' Package: menkar-sandbox\n Version: 0.1.0-12.gabcdef12\n Architecture: amd64\n' +
        ' Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0, libasound2t64 | libasound2\n',
      files,
      asar: PROGRAMS,
      postinst: sandboxData('postinst'),
      profile: sandboxData('apparmor-profile'),
      desktop: sandboxData('menkar-sandbox.desktop'),
    }
  }

  test('the sandbox package as built passes as a sandbox, and fails as the daily Menkar', () => {
    expect(checkPackage(sandbox(), 'sandbox')).toEqual([])
    expect(checkPackage(sandbox(), 'menkar').length).toBeGreaterThan(0)
    expect(checkPackage(good(), 'sandbox').length).toBeGreaterThan(0)
  })

  test('Package: menkar-sandbox, or apt installs it as an upgrade replacing the daily Menkar', () => {
    const asDaily = { ...sandbox(), control: sandbox().control.replace('menkar-sandbox', 'menkar') }
    expect(checkPackage(asDaily, 'sandbox')).toEqual([
      'control: Package is menkar, not menkar-sandbox',
    ])
  })

  test('its launcher, command, folder and profile are its own', () => {
    const { files } = listing(sandboxData('files.txt'))
    expect(files).toContain('/usr/share/applications/menkar-sandbox.desktop')
    expect(files).toContain('/opt/Menkar-sandbox/menkar-sandbox')
    expect(files.filter((f) => f.startsWith('/opt/Menkar/'))).toEqual([])
    expect(sandboxData('postinst')).toContain(
      "APPARMOR_PROFILE_TARGET='/etc/apparmor.d/menkar-sandbox'",
    )
    expect(sandboxData('menkar-sandbox.desktop')).toMatch(/^Name=Menkar Sandbox$/m)
  })

  test('no path it installs is one the daily package installs', () => {
    const mine = listing(sandboxData('files.txt'))
    const daily = listing(sandboxData('menkar-files.txt'))
    expect(daily.files).toContain('/opt/Menkar/menkar')
    expect(
      sharedPaths(mine.files, daily.files, [...mine.directories, ...daily.directories]),
    ).toEqual([])
    expect(sharedPaths(['/opt/Menkar/menkar'], ['/opt/Menkar/menkar'], [])).toEqual([
      '/opt/Menkar/menkar',
    ])
  })

  // The names electron-builder does not derive from executableName and the product name.
  test('its builder config sets the four names that do not follow', () => {
    const config = readFileSync(join(__dirname, '..', '..', FLAVOURS.sandbox.builderConfig), 'utf8')
    expect(config).toMatch(/^extends: \.\/electron-builder\.yml$/m)
    expect(config).toMatch(/^ {2}packageName: menkar-sandbox$/m)
    expect(config).toMatch(/^ {2}desktopName: menkar-sandbox\.desktop$/m)
    expect(config).toMatch(/^ {2}artifactName: menkar-sandbox_/m)
    expect(config).toMatch(/^appId: \S+Sandbox$/m)
    expect(config).not.toMatch(/^appId: io\.github\.hernancontigiani\.Menkar$/m)
  })

  test('a package holds the flavour its code was built as', () => {
    expect(packageFlavour([], 'sandbox')).toBe('sandbox')
    expect(packageFlavour([], 'menkar')).toBe('menkar')
    expect(packageFlavour(['--flavour', 'sandbox'], 'sandbox')).toBe('sandbox')
    expect(() => packageFlavour(['--flavour', 'menkar'], 'sandbox')).toThrow(/built as sandbox/)
    expect(() => packageFlavour([], null)).toThrow(/electron-vite build/)
    expect(() => packageFlavour(['--flavour', 'daily'], 'menkar')).toThrow(/daily/)
  })
})

describe('the package formats to build', () => {
  test('the .deb alone unless --targets says, so a local build needs no rpmbuild', () => {
    expect(packageTargets([], 'menkar')).toEqual(['deb'])
    expect(packageTargets(['--targets', 'deb,rpm'], 'menkar')).toEqual(['deb', 'rpm'])
    expect(packageTargets(['--targets', 'rpm'], 'menkar')).toEqual(['rpm'])
    expect(packageTargets(['--targets', 'deb,deb'], 'menkar')).toEqual(['deb'])
    expect(packageTargets(['--targets', 'deb'], 'sandbox')).toEqual(['deb'])
  })

  test('an unknown target, a missing value, and an .rpm of the sandbox are refused', () => {
    expect(() => packageTargets(['--targets', 'deb,appimage'], 'menkar')).toThrow(/appimage/)
    expect(() => packageTargets(['--targets', 'deb,'], 'menkar')).toThrow(/empty target/)
    expect(() => packageTargets(['--targets'], 'menkar')).toThrow(/missing its value/)
    expect(() => packageTargets(['--targets', '--flavour'], 'menkar')).toThrow(/missing/)
    expect(() => packageTargets(['--targets', 'deb,rpm'], 'sandbox')).toThrow(/\.deb only/)
  })
})

// `rpm -qp --info`, `--requires` and `--scripts` recorded from a real `--targets deb,rpm` build
// (electron-builder 26.18.0, in an Ubuntu 24.04 container; the packager's email scrubbed).
const rpmData = (name: string) => data(join('rpm', name))

const goodRpm = (): Rpm => ({
  ...good(),
  files: [...good().files, '/opt/Menkar'],
  info: rpmData('info').replace(/^Release {5}: .*$/m, 'Release     : 12.gabcdef12'),
  requires: rpmData('requires').split('\n').filter(Boolean),
  postinst: rpmData('scripts'),
})

describe('package:check on the .rpm', () => {
  test('the .rpm as built passes, with the same post-install as the .deb', () => {
    expect(checkRpm(goodRpm())).toEqual([])
    expect(rpmData('scripts')).toContain(data('postinst').trim())
  })

  test('a dirty build passes too: its Release is the same revision as the .deb', () => {
    expect(checkRpm({ ...goodRpm(), info: rpmData('info') })).toEqual([])
  })

  test.each([
    [
      'its ALSA library (the app cannot start without it)',
      (r: Rpm) => ({ ...r, requires: r.requires.filter((line) => line !== 'alsa-lib') }),
    ],
    [
      'its build revision',
      (r: Rpm) => ({ ...r, info: r.info.replace(/^Release {5}: .*$/m, 'Release     : 1') }),
    ],
    [
      "the app's version",
      (r: Rpm) => ({ ...r, info: r.info.replace('Version     : 0.1.0', 'Version     : 0.2.0') }),
    ],
    [
      'its name (dnf would take it for another package)',
      (r: Rpm) => ({ ...r, info: r.info.replace('Name        : menkar', 'Name        : Menkar') }),
    ],
    [
      'its folder (dnf remove would leave /opt/Menkar behind)',
      (r: Rpm) => ({ ...r, files: r.files.filter((f) => f !== '/opt/Menkar') }),
    ],
    ['the launcher', (r: Rpm) => ({ ...r, files: r.files.filter((f) => !f.endsWith('.desktop')) })],
    [
      "Codex's notify program",
      (r: Rpm) => ({ ...r, asar: r.asar.filter((f) => !f.endsWith('codex-notify.js')) }),
    ],
    [
      'the profile install in its post-install',
      (r: Rpm) => ({ ...r, postinst: r.postinst.replace('APPARMOR_PROFILE_TARGET=', 'X=') }),
    ],
  ])('an .rpm that lost %s fails', (_what, mutate) => {
    expect(checkRpm(mutate(goodRpm()))).toHaveLength(1)
  })

  test('an update feed in the .rpm fails', () => {
    const r = goodRpm()
    expect(checkRpm({ ...r, files: [...r.files, '/opt/Menkar/resources/app-update.yml'] })).toEqual(
      ['an update feed is packaged: /opt/Menkar/resources/app-update.yml'],
    )
  })

  test('its builder config adds alsa-lib to the .rpm and owns /opt/Menkar', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'electron-builder.yml'), 'utf8')
    const rpm = config.slice(config.indexOf('\nrpm:'))
    expect(rpm).toMatch(/^ {4}- alsa-lib$/m)
    expect(rpm).toMatch(/fpm: \['--directories', '\/opt\/Menkar'\]/)
  })
})

// An archive's first bytes as electron/asar writes them: a pickle holding the header pickle's size,
// then that pickle, its payload size and the JSON's length before the JSON.
function asarHead(tree: unknown, extra = 0): Buffer {
  const json = Buffer.from(JSON.stringify(tree))
  const head = Buffer.alloc(16)
  head.writeUInt32LE(4, 0)
  head.writeUInt32LE(json.length + 8, 4)
  head.writeUInt32LE(json.length + 4, 8)
  head.writeUInt32LE(json.length, 12)
  return Buffer.concat([head, json, Buffer.alloc(extra)])
}

describe("app.asar's files, from its header", () => {
  test('each file by its path inside the archive, folders walked', () => {
    const tree = {
      files: {
        out: {
          files: {
            main: {
              files: {
                'index.js': { size: 1, offset: '0' },
                'codex-notify.js': { size: 1, offset: '1' },
                chunks: { files: { 'a.js': { size: 1, offset: '2' } } },
              },
            },
          },
        },
        'package.json': { size: 1, offset: '3' },
      },
    }
    expect(asarEntries(asarHead(tree, 64))).toEqual([
      '/out/main/index.js',
      '/out/main/codex-notify.js',
      '/out/main/chunks/a.js',
      '/package.json',
    ])
  })

  test('a file that is not an archive, or a header longer than what was read, is refused', () => {
    const bad = asarHead({ files: {} })
    bad.writeUInt32LE(5, 0)
    expect(() => asarEntries(bad)).toThrow(/not an asar archive/)
    expect(() => asarEntries(asarHead({ files: { x: { size: 1 } } }).subarray(0, 20))).toThrow(
      /longer than/,
    )
  })
})
