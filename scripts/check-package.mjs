// Inspects the built .deb without installing it: the files a user needs (the app, the launcher,
// the icon), the post-install that links `menkar` and lets Chromium's sandbox run, and no update
// feed. Run after `npm run package`.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const APP = '/opt/Menkar'

/**
 * @typedef {{ version: string, control: string, files: string[], postinst: string, profile: string, desktop: string }} Package
 * `version` is the app's (package.json); the package's own is it with a revision of its build.
 * @param {Package} pkg `files` are absolute paths inside the package, `/opt/...`
 * @returns {string[]} what is wrong, empty when the package is right
 */
export function checkPackage(pkg) {
  /** @type {string[]} */
  const problems = []
  const field = (/** @type {string} */ name) =>
    new RegExp(`^\\s*${name}: (.*)$`, 'm').exec(pkg.control)?.[1]?.trim()
  if (field('Package') !== 'menkar')
    problems.push(`control: Package is ${field('Package')}, not menkar`)
  if (field('Architecture') !== 'amd64') problems.push('control: Architecture is not amd64')
  const revision = new RegExp(
    `^${pkg.version.replaceAll('.', '\\.')}-\\d+\\.g[0-9a-f]{7,}(\\.dirty\\.\\d{14})?$`,
  )
  if (!revision.test(field('Version') ?? ''))
    problems.push(
      `control: Version is ${field('Version')}, not ${pkg.version}-<commits>.g<hash>[.dirty.<time>]`,
    )

  const files = new Set(pkg.files)
  for (const path of [
    `${APP}/menkar`,
    `${APP}/chrome-sandbox`,
    `${APP}/resources/app.asar`,
    `${APP}/resources/apparmor-profile`,
    `${APP}/resources/plugin/.claude-plugin/plugin.json`,
    ...['orchestrator', 'worker', 'distill', 'specialize'].map(
      (skill) => `${APP}/resources/plugin/skills/${skill}/SKILL.md`,
    ),
    `${APP}/resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node`,
    '/usr/share/applications/menkar.desktop',
    '/usr/share/icons/hicolor/512x512/apps/menkar.png',
  ]) {
    if (!files.has(path)) problems.push(`missing from the package: ${path}`)
  }
  for (const path of files) {
    if (path.endsWith('/app-update.yml')) problems.push(`an update feed is packaged: ${path}`)
  }

  /** @type {Array<[RegExp, string]>} */
  const postinst = [
    [
      /update-alternatives --install '\/usr\/bin\/menkar' 'menkar' '\/opt\/Menkar\/menkar'/,
      'links /usr/bin/menkar',
    ],
    [/chmod 0755 '\/opt\/Menkar\/chrome-sandbox'/, 'leaves chrome-sandbox 0755, not setuid'],
    [/APPARMOR_PROFILE_SOURCE='\/opt\/Menkar\/resources\/apparmor-profile'/, 'names the profile'],
    [
      /APPARMOR_PROFILE_TARGET='\/etc\/apparmor.d\/menkar'/,
      'installs it as /etc/apparmor.d/menkar',
    ],
    [
      /apparmor_parser --replace --write-cache --skip-read-cache "\$APPARMOR_PROFILE_TARGET"/,
      'loads it',
    ],
  ]
  for (const [pattern, what] of postinst) {
    if (!pattern.test(pkg.postinst)) problems.push(`postinst no longer ${what}`)
  }

  if (!/^profile "menkar" "\/opt\/Menkar\/menkar" flags=\(unconfined\) \{$/m.test(pkg.profile)) {
    problems.push('apparmor-profile does not cover /opt/Menkar/menkar')
  }
  if (!/^\s*userns,$/m.test(pkg.profile)) problems.push('apparmor-profile does not grant userns')

  if (!/^Exec=\/opt\/Menkar\/menkar %U$/m.test(pkg.desktop)) {
    problems.push('menkar.desktop does not start /opt/Menkar/menkar (or passes extra flags)')
  }
  if (!/^Icon=menkar$/m.test(pkg.desktop)) problems.push('menkar.desktop has no menkar icon')
  return problems
}

/** @param {string[]} args */
const run = (...args) =>
  execFileSync(args[0] ?? '', args.slice(1), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })

function main() {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const name = `menkar_${version}_amd64.deb`
  const deb = join(ROOT, 'release', name)
  let present = []
  try {
    present = readdirSync(join(ROOT, 'release'))
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error
  }
  if (!present.includes(name)) {
    console.error(`✗ package:check: release/${name} not found; run \`npm run package\` first`)
    process.exit(1)
  }
  const fileFromData = (/** @type {string} */ path) =>
    execFileSync('sh', ['-c', `dpkg-deb --fsys-tarfile "$1" | tar -xO ".${path}"`, 'sh', deb], {
      encoding: 'utf8',
    })
  const pkg = {
    version,
    control: run('dpkg-deb', '-I', deb),
    files: run('dpkg-deb', '-c', deb)
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(/\s+/).slice(5).join(' ').replace(/^\./, '').replace(/\/$/, '')),
    postinst: run('dpkg-deb', '-I', deb, 'postinst'),
    profile: fileFromData(`${APP}/resources/apparmor-profile`),
    desktop: fileFromData('/usr/share/applications/menkar.desktop'),
  }
  const problems = checkPackage(pkg)
  for (const problem of problems) console.error(`✗ package:check: ${problem}`)
  if (problems.length) process.exit(1)
  console.log(
    `package:check: release/${name} — version ${/^\s*Version: (.*)$/m.exec(pkg.control)?.[1]}, ${pkg.files.length} entries, launcher, command and sandbox profile in place`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
