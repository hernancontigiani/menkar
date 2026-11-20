// Inspects the built .deb without installing it: the files a user needs (the app, the launcher,
// the icon), the post-install that links `menkar` and lets Chromium's sandbox run, and no update
// feed. Run after `npm run package`.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageTargets } from './package.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * What each flavour's package is called and where it installs. Every name of the sandbox's differs
 * from the daily Menkar's, so apt never takes one for an upgrade of the other and neither
 * overwrites the other's files.
 * @typedef {{ name: string, app: string, release: string, builderConfig: string }} Names
 * @type {Readonly<Record<'menkar' | 'sandbox', Names>>}
 */
export const FLAVOURS = {
  menkar: {
    name: 'menkar',
    app: '/opt/Menkar',
    release: 'release',
    builderConfig: 'electron-builder.yml',
  },
  sandbox: {
    name: 'menkar-sandbox',
    app: '/opt/Menkar-sandbox',
    release: 'release/sandbox',
    builderConfig: 'electron-builder.sandbox.yml',
  },
}

/** @param {string} text */
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/**
 * @typedef {{ version: string, control: string, files: string[], postinst: string, profile: string, desktop: string }} Package
 * `version` is the app's (package.json); the package's own is it with a revision of its build.
 * @param {Package} pkg `files` are absolute paths inside the package, `/opt/...`
 * @param {'menkar' | 'sandbox'} [flavour]
 * @returns {string[]} what is wrong, empty when the package is right
 */
export function checkPackage(pkg, flavour = 'menkar') {
  const { name: NAME } = FLAVOURS[flavour]
  /** @type {string[]} */
  const problems = []
  const field = (/** @type {string} */ name) =>
    new RegExp(`^\\s*${name}: (.*)$`, 'm').exec(pkg.control)?.[1]?.trim()
  if (field('Package') !== NAME)
    problems.push(`control: Package is ${field('Package')}, not ${NAME}`)
  if (field('Architecture') !== 'amd64') problems.push('control: Architecture is not amd64')
  const depends = (field('Depends') ?? '').split(',').map((d) => d.trim())
  if (!depends.includes('libasound2t64 | libasound2'))
    problems.push(
      'control: Depends lacks libasound2t64 | libasound2 (the app cannot start without it)',
    )
  const revision = new RegExp(`^${pkg.version.replaceAll('.', '\\.')}-${REVISION}$`)
  if (!revision.test(field('Version') ?? ''))
    problems.push(
      `control: Version is ${field('Version')}, not ${pkg.version}-<commits>.g<hash>[.dirty.<time>]`,
    )
  return [...problems, ...checkContents(pkg, flavour)]
}

// The build revision `package.mjs` hands as the build number: the Debian revision of a .deb, the
// Release of an .rpm.
const REVISION = '\\d+\\.g[0-9a-f]{7,}(\\.dirty\\.\\d{14})?'

/**
 * What a .deb and an .rpm must both hold: the files, the post-install, the profile, the launcher.
 * @param {{ files: string[], postinst: string, profile: string, desktop: string }} pkg
 * @param {'menkar' | 'sandbox'} flavour
 * @returns {string[]}
 */
function checkContents(pkg, flavour) {
  const { name: NAME, app: APP } = FLAVOURS[flavour]
  const quoted = { app: literal(APP), name: literal(NAME) }
  /** @type {string[]} */
  const problems = []
  const files = new Set(pkg.files)
  for (const path of [
    `${APP}/${NAME}`,
    `${APP}/chrome-sandbox`,
    `${APP}/resources/app.asar`,
    `${APP}/resources/apparmor-profile`,
    `${APP}/resources/plugin/.claude-plugin/plugin.json`,
    `${APP}/resources/plugin/guide/orchestration-mode.md`,
    `${APP}/resources/plugin/team/common.md`,
    `${APP}/resources/plugin/team/claude.md`,
    ...['orchestrator', 'worker', 'distill', 'specialize'].map(
      (skill) => `${APP}/resources/plugin/skills/${skill}/SKILL.md`,
    ),
    `${APP}/resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node`,
    `/usr/share/applications/${NAME}.desktop`,
    `/usr/share/icons/hicolor/512x512/apps/${NAME}.png`,
  ]) {
    if (!files.has(path)) problems.push(`missing from the package: ${path}`)
  }
  for (const path of files) {
    if (path.endsWith('/app-update.yml')) problems.push(`an update feed is packaged: ${path}`)
  }

  /** @type {Array<[RegExp, string]>} */
  const postinst = [
    [
      new RegExp(
        `update-alternatives --install '/usr/bin/${quoted.name}' '${quoted.name}' '${quoted.app}/${quoted.name}'`,
      ),
      `links /usr/bin/${NAME}`,
    ],
    [
      new RegExp(`chmod 0755 '${quoted.app}/chrome-sandbox'`),
      'leaves chrome-sandbox 0755, not setuid',
    ],
    [
      new RegExp(`APPARMOR_PROFILE_SOURCE='${quoted.app}/resources/apparmor-profile'`),
      'names the profile',
    ],
    [
      new RegExp(`APPARMOR_PROFILE_TARGET='/etc/apparmor\\.d/${quoted.name}'`),
      `installs it as /etc/apparmor.d/${NAME}`,
    ],
    [
      /apparmor_parser --replace --write-cache --skip-read-cache "\$APPARMOR_PROFILE_TARGET"/,
      'loads it',
    ],
  ]
  for (const [pattern, what] of postinst) {
    if (!pattern.test(pkg.postinst)) problems.push(`postinst no longer ${what}`)
  }

  if (
    !new RegExp(
      `^profile "${quoted.name}" "${quoted.app}/${quoted.name}" flags=\\(unconfined\\) \\{$`,
      'm',
    ).test(pkg.profile)
  ) {
    problems.push(`apparmor-profile does not cover ${APP}/${NAME}`)
  }
  if (!/^\s*userns,$/m.test(pkg.profile)) problems.push('apparmor-profile does not grant userns')

  if (!new RegExp(`^Exec=${quoted.app}/${quoted.name} %U$`, 'm').test(pkg.desktop)) {
    problems.push(`${NAME}.desktop does not start ${APP}/${NAME} (or passes extra flags)`)
  }
  if (!new RegExp(`^Icon=${quoted.name}$`, 'm').test(pkg.desktop))
    problems.push(`${NAME}.desktop has no ${NAME} icon`)
  return problems
}

/**
 * @typedef {{ version: string, info: string, requires: string[], files: string[], postinst: string, profile: string, desktop: string }} Rpm
 * The .rpm, read with `rpm -qp`: `info` is `--info`, `requires` the lines of `--requires`,
 * `postinst` the `--scripts` output; `files` as for the .deb. Only the daily Menkar has one.
 * @param {Rpm} rpm
 * @returns {string[]} what is wrong, empty when the package is right
 */
export function checkRpm(rpm) {
  /** @type {string[]} */
  const problems = []
  const field = (/** @type {string} */ name) =>
    new RegExp(`^${name}\\s*: (.*)$`, 'm').exec(rpm.info)?.[1]?.trim()
  if (field('Name') !== 'menkar') problems.push(`rpm: Name is ${field('Name')}, not menkar`)
  if (field('Architecture') !== 'x86_64') problems.push('rpm: Architecture is not x86_64')
  if (field('Version') !== rpm.version)
    problems.push(`rpm: Version is ${field('Version')}, not ${rpm.version}`)
  if (!new RegExp(`^${REVISION}$`).test(field('Release') ?? ''))
    problems.push(`rpm: Release is ${field('Release')}, not <commits>.g<hash>[.dirty.<time>]`)
  if (!rpm.requires.some((line) => /^alsa-lib\b/.test(line.trim())))
    problems.push('rpm: Requires lacks alsa-lib (the app cannot start without it)')
  if (!rpm.files.includes('/opt/Menkar'))
    problems.push("rpm: /opt/Menkar is not the package's, so removing it leaves its folders behind")
  return [...problems, ...checkContents(rpm, 'menkar')]
}

/** @param {string[]} args */
const run = (...args) =>
  execFileSync(args[0] ?? '', args.slice(1), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

/**
 * Every path the sandbox installs that the daily Menkar's package also installs: none may be
 * shared, or removing one package would take the other's file with it. Directories both create
 * (`/usr`, `/usr/share/applications`) are not files of either.
 * @param {string[]} sandbox the sandbox package's paths, `dpkg-deb -c`
 * @param {string[]} menkar the daily package's
 * @param {string[]} directories the paths of either that are directories
 * @returns {string[]}
 */
export function sharedPaths(sandbox, menkar, directories) {
  const daily = new Set(menkar)
  const dirs = new Set(directories)
  return sandbox.filter((path) => daily.has(path) && !dirs.has(path))
}

/** @param {string[]} argv */
function flavourArg(argv) {
  const at = argv.indexOf('--flavour')
  if (at === -1) return 'menkar'
  const value = argv[at + 1]
  if (value === 'menkar' || value === 'sandbox') return value
  throw new Error(`--flavour is ${value ?? 'missing its value'}; it is menkar or sandbox`)
}

function main() {
  const argv = process.argv.slice(2)
  const flavour = flavourArg(argv)
  const targets = packageTargets(argv, flavour)
  const { name: NAME, app: APP, release } = FLAVOURS[flavour]
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  let present = []
  try {
    present = readdirSync(join(ROOT, release))
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error
  }
  let failed = false
  for (const target of targets) {
    const name = target === 'deb' ? `${NAME}_${version}_amd64.deb` : `${NAME}-${version}.x86_64.rpm`
    const file = join(ROOT, release, name)
    if (!present.includes(name)) {
      const command = flavour === 'menkar' ? 'package' : 'package:sandbox'
      const flag = target === 'rpm' ? ' -- --targets deb,rpm' : ''
      console.error(
        `✗ package:check: ${release}/${name} not found; run \`npm run ${command}${flag}\` first`,
      )
      failed = true
      continue
    }
    if (target === 'rpm' && !onPath('rpm2cpio')) {
      console.error(
        '✗ package:check: reading the .rpm needs rpm and cpio: sudo apt-get install rpm cpio',
      )
      failed = true
      continue
    }
    const { problems, summary } =
      target === 'deb' ? readDeb(file, version, flavour, NAME, APP) : readRpm(file, version, APP)
    for (const problem of problems) console.error(`✗ package:check: ${problem}`)
    if (problems.length) failed = true
    else
      console.log(
        `package:check: ${release}/${name} — ${summary}, launcher, command and sandbox profile in place`,
      )
  }
  if (failed) process.exit(1)
}

/** @param {string} command */
function onPath(command) {
  return (process.env.PATH ?? '')
    .split(':')
    .some((dir) => dir !== '' && existsSync(join(dir, command)))
}

/**
 * @param {string} deb
 * @param {string} version
 * @param {'menkar' | 'sandbox'} flavour
 * @param {string} NAME
 * @param {string} APP
 */
function readDeb(deb, version, flavour, NAME, APP) {
  const fileFromData = (/** @type {string} */ path) =>
    execFileSync('sh', ['-c', `dpkg-deb --fsys-tarfile "$1" | tar -xO ".${path}"`, 'sh', deb], {
      encoding: 'utf8',
    })
  const pkg = {
    version,
    control: run('dpkg-deb', '-I', deb),
    files: listed(run('dpkg-deb', '-c', deb), 5),
    postinst: run('dpkg-deb', '-I', deb, 'postinst'),
    profile: fileFromData(`${APP}/resources/apparmor-profile`),
    desktop: fileFromData(`/usr/share/applications/${NAME}.desktop`),
  }
  const shown = /^\s*Version: (.*)$/m.exec(pkg.control)?.[1]
  return {
    problems: checkPackage(pkg, flavour),
    summary: `version ${shown}, ${pkg.files.length} entries`,
  }
}

/**
 * @param {string} file
 * @param {string} version
 * @param {string} APP
 */
function readRpm(file, version, APP) {
  const fileFromData = (/** @type {string} */ path) =>
    execFileSync(
      'sh',
      ['-c', `rpm2cpio "$1" | cpio --quiet -i --to-stdout ".${path}"`, 'sh', file],
      {
        encoding: 'utf8',
      },
    )
  const rpm = {
    version,
    info: run('rpm', '-qp', '--info', file),
    requires: run('rpm', '-qp', '--requires', file).split('\n').filter(Boolean),
    files: listed(
      execFileSync('sh', ['-c', 'rpm2cpio "$1" | cpio --quiet -t', 'sh', file], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      }),
      0,
    ),
    postinst: run('rpm', '-qp', '--scripts', file),
    profile: fileFromData(`${APP}/resources/apparmor-profile`),
    desktop: fileFromData('/usr/share/applications/menkar.desktop'),
  }
  const field = (/** @type {string} */ name) =>
    new RegExp(`^${name}\\s*: (.*)$`, 'm').exec(rpm.info)?.[1]?.trim()
  return {
    problems: checkRpm(rpm),
    summary: `version ${field('Version')}-${field('Release')}, ${rpm.files.length} entries`,
  }
}

/**
 * Absolute paths from a listing: `dpkg-deb -c` (the path is its sixth column) or `cpio -t` (the
 * whole line), each `./opt/...` or `./opt/.../`.
 * @param {string} text
 * @param {number} column
 */
function listed(text, column) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(/\s+/).slice(column).join(' ').replace(/^\./, '').replace(/\/$/, ''))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
