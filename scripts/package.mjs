// Builds the .deb (and with `--targets deb,rpm` the .rpm) with a revision of its own, so `apt
// install` of a newer build is an upgrade rather than "0 upgraded": the app stays 0.1.0, the package
// is 0.1.0-<revision>. The file name keeps only the app's version (release/menkar_0.1.0_amd64.deb),
// so the install command never changes. Run after `electron-vite build`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

/**
 * The revision: the commit count, which only grows on this linear history, then the short hash to
 * name the commit, then for a tree with changes not committed `dirty` and the UTC time. dpkg
 * orders 12.gabc before 12.gabc.dirty.<time> before 13.g…, so every build sorts after the one
 * before it with no state kept anywhere. No `-`: electron-builder turns it into `_`.
 * @param {{ count: number, hash: string, dirty: boolean, now: Date }} tree
 * @returns {string}
 */
export function debianRevision({ count, hash, dirty, now }) {
  const base = `${count}.g${hash}`
  if (!dirty) return base
  const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
  return `${base}.dirty.${stamp}`
}

/** @param {string[]} args */
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

/**
 * The flavour to package: the one the app's code in out/ was built as (`built`, which
 * electron.vite.config.ts writes to out/main/flavor.txt), and `--flavour` when given only as a
 * check of it. A package whose code is the other flavour's would install under one name and write
 * into the other's directories.
 * @param {string[]} argv
 * @param {string | null} built
 * @returns {'menkar' | 'sandbox'}
 */
export function packageFlavour(argv, built) {
  if (built !== 'menkar' && built !== 'sandbox')
    throw new Error('out/ holds no built flavour; run `electron-vite build` first')
  const at = argv.indexOf('--flavour')
  if (at === -1) return built
  const asked = argv[at + 1]
  if (asked !== 'menkar' && asked !== 'sandbox')
    throw new Error(`--flavour is ${asked ?? 'missing its value'}; it is menkar or sandbox`)
  if (asked !== built)
    throw new Error(
      `--flavour ${asked}, but out/ was built as ${built}: build with MENKAR_FLAVOR_BUILD=${asked}`,
    )
  return asked
}

/**
 * The package formats to build, from `--targets deb,rpm`; `deb` alone when absent, so a local
 * build needs no `rpmbuild`. The sandbox is never released, so it builds the `.deb` alone.
 * @param {string[]} argv
 * @param {'menkar' | 'sandbox'} flavour
 * @returns {Array<'deb' | 'rpm'>}
 */
export function packageTargets(argv, flavour) {
  const at = argv.indexOf('--targets')
  if (at === -1) return ['deb']
  const value = argv[at + 1]
  if (!value || value.startsWith('--'))
    throw new Error('--targets is missing its value; it is deb, rpm or deb,rpm')
  /** @type {Array<'deb' | 'rpm'>} */
  const targets = []
  for (const target of value.split(',')) {
    if (target !== 'deb' && target !== 'rpm')
      throw new Error(`--targets names ${target || 'an empty target'}; the targets are deb and rpm`)
    if (!targets.includes(target)) targets.push(target)
  }
  if (flavour === 'sandbox' && targets.includes('rpm'))
    throw new Error('the sandbox is packaged as a .deb only; drop rpm from --targets')
  return targets
}

/** The electron-builder config each flavour builds with. */
export const BUILDER_CONFIG = {
  menkar: 'electron-builder.yml',
  sandbox: 'electron-builder.sandbox.yml',
}

function main() {
  let built = null
  try {
    built = readFileSync(join(ROOT, 'out', 'main', 'flavor.txt'), 'utf8').trim()
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error
  }
  const flavour = packageFlavour(process.argv.slice(2), built)
  const targets = packageTargets(process.argv.slice(2), flavour)
  const revision = debianRevision({
    count: Number(git('rev-list', '--count', 'HEAD')),
    hash: git('rev-parse', '--short=8', 'HEAD'),
    dirty: git('status', '--porcelain') !== '',
    now: new Date(),
  })
  console.log(`package: ${flavour} (${targets.join(', ')}), revision ${revision}`)
  execFileSync(
    'npx',
    [
      'electron-builder',
      '--linux',
      ...targets,
      '--x64',
      '--config',
      BUILDER_CONFIG[flavour],
      `-c.buildNumber=${revision}`,
    ],
    { cwd: ROOT, stdio: 'inherit' },
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
