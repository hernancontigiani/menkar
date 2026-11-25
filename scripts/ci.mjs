// The local gate: each step in order, stopping at the first red. `node scripts/ci.mjs '<step>'`
// runs that step alone.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const R10 = 'tests/core/r10'

/** @param {string} root @param {string[]} args */
const git = (root, ...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

// Cursor's rows guarded its start until the multi-agent branch completed Cursor there: from then
// the branch writes them, with the orchestrator's sign-off, and a merge of main keeps the branch's.
const CURSOR_ROW = /(^|-)cursor-/
const branchOwns = (path) => CURSOR_ROW.test(basename(path))

/**
 * R10's files are written on `main` only: anywhere else each must hold `main`'s bytes (Cursor's
 * rows aside), none may be missing and none added. A checkout with no local `main` (the hosted CI) names the ref to compare
 * with in `base`, MENKAR_R10_BASE; then nothing is skipped, since the checkout may be `main` itself
 * checked against another ref.
 * @param {string} root
 * @param {string | undefined} base
 * @returns {{ skipped: true } | { ref: string, count: number, problems: string[] }}
 */
export function r10Problems(root, base) {
  if (!base && git(root, 'rev-parse', '--abbrev-ref', 'HEAD').toString().trim() === 'main')
    return { skipped: true }
  const ref = base || 'main'
  const onMain = git(root, 'ls-tree', '-r', '--name-only', ref, '--', R10)
    .toString()
    .split('\n')
    .filter(Boolean)
  if (onMain.length === 0) return { ref, count: 0, problems: [`${ref} has no ${R10}/`] }
  const problems = []
  for (const path of onMain) {
    if (!existsSync(join(root, path))) problems.push(`missing: ${path}`)
    else if (
      !branchOwns(path) &&
      !readFileSync(join(root, path)).equals(git(root, 'show', `${ref}:${path}`))
    )
      problems.push(`differs from ${ref}: ${path}`)
  }
  const listed = new Set(onMain)
  for (const file of filesUnder(join(root, R10))) {
    const path = relative(root, file)
    if (!listed.has(path)) problems.push(`not on ${ref}: ${path}`)
  }
  return { ref, count: onMain.length, problems }
}

function r10Unchanged() {
  const result = r10Problems(ROOT, process.env.MENKAR_R10_BASE)
  if ('skipped' in result) {
    console.log('R10 unchanged: on main, where its files are written; nothing to compare')
    return 0
  }
  const { ref, count, problems } = result
  if (problems.length > 0) {
    console.error(`✗ R10 unchanged: ${problems.length} problem(s) against ${ref}:`)
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('  R10 is written on main only; a change to it lands there first.')
    return 1
  }
  console.log(`R10 unchanged: ${count} file(s) equal ${ref}'s, Cursor's rows aside`)
  return 0
}

/** @type {[string, string[] | (() => number), Record<string, string>?][]} */
const steps = [
  ['biome', ['npx', 'biome', 'ci', '.']],
  ['tsc', ['npm', 'run', '--silent', 'typecheck']],
  // CI=1: Vitest writes no missing snapshot and fails on it instead.
  ['vitest', ['npx', 'vitest', 'run'], { CI: '1' }],
  ['R10 unchanged', r10Unchanged],
  ['code rules', ['node', 'scripts/check-code-rules.mjs']],
  ['i18n', ['node', 'scripts/check-i18n.mjs']],
  ['test integrity', ['node', 'scripts/check-test-integrity.mjs']],
  ['flaky quarantine', ['node', 'scripts/check-flaky.mjs']],
  ['history', ['node', 'scripts/nothing-lost.mjs']],
]

function main() {
  const only = process.argv[2]
  if (only !== undefined && !steps.some(([name]) => name === only)) {
    console.error(`✗ ci: no step '${only}'`)
    process.exit(2)
  }
  for (const [name, run, env] of steps) {
    if (only !== undefined && name !== only) continue
    console.log(`\n▶ ${name}`)
    const status =
      typeof run === 'function'
        ? run()
        : spawnSync(run[0] ?? '', run.slice(1), {
            stdio: 'inherit',
            env: { ...process.env, ...env },
          }).status
    if (status !== 0) {
      console.error(`\n✗ ci: '${name}' failed`)
      process.exit(status ?? 1)
    }
  }
  console.log(only === undefined ? '\n✓ ci: every step passed' : `\n✓ ci: '${only}' passed`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
