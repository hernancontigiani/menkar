// Builds the .deb with a Debian revision of its own, so `apt install` of a newer build is an
// upgrade rather than "0 upgraded": the app stays 0.1.0, the package is 0.1.0-<revision>. The file
// name keeps only the app's version (release/menkar_0.1.0_amd64.deb), so the install command never
// changes. Run after `electron-vite build`.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
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

function main() {
  const revision = debianRevision({
    count: Number(git('rev-list', '--count', 'HEAD')),
    hash: git('rev-parse', '--short=8', 'HEAD'),
    dirty: git('status', '--porcelain') !== '',
    now: new Date(),
  })
  console.log(`package: Debian revision ${revision}`)
  execFileSync(
    'npx',
    ['electron-builder', '--linux', 'deb', '--x64', `-c.buildNumber=${revision}`],
    { cwd: ROOT, stdio: 'inherit' },
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
