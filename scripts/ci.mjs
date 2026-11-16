// The local gate: each step in order, stopping at the first red. `node scripts/ci.mjs '<step>'`
// runs that step alone.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const R10 = 'tests/core/r10'

/** @param {string[]} args */
const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 })

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

// R10's files are written on `main` only: anywhere else each must hold `main`'s bytes, none may be
// missing and none added.
function r10Unchanged() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').toString().trim()
  if (branch === 'main') {
    console.log('R10 unchanged: on main, where its files are written; nothing to compare')
    return 0
  }
  const onMain = git('ls-tree', '-r', '--name-only', 'main', '--', R10)
    .toString()
    .split('\n')
    .filter(Boolean)
  if (onMain.length === 0) {
    console.error(`✗ R10 unchanged: main has no ${R10}/`)
    return 1
  }
  const problems = []
  for (const path of onMain) {
    if (!existsSync(join(ROOT, path))) problems.push(`missing: ${path}`)
    else if (!readFileSync(join(ROOT, path)).equals(git('show', `main:${path}`)))
      problems.push(`differs from main: ${path}`)
  }
  const listed = new Set(onMain)
  for (const file of filesUnder(join(ROOT, R10))) {
    const path = relative(ROOT, file)
    if (!listed.has(path)) problems.push(`not on main: ${path}`)
  }
  if (problems.length > 0) {
    console.error(`✗ R10 unchanged: ${problems.length} file(s) are not main's:`)
    for (const problem of problems) console.error(`  ${problem}`)
    console.error('  R10 is written on main only; a change to it lands there first.')
    return 1
  }
  console.log(`R10 unchanged: ${onMain.length} file(s) equal main's`)
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
