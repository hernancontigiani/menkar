// The guard against the repair that weakens the assertion. Tests here are written and repaired by
// agents, and the failure mode is documented, not supposed: one rewrote `toBe(5)` into
// `toBeTruthy()`, and faced with a test it could not fix, deleted it and reported success. Both
// look identical to a green run.
//
// Two structural checks against the baseline branch: the number of test declarations never goes
// down, and the diff never removes an `expect(` line. Neither has an override, deliberately: a
// legitimate refactor that trips this is read by a person, not passed with a flag the next agent
// learns.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const BASELINE = process.env.MENKAR_TEST_BASELINE ?? 'main'
const SUITES = ['tests', 'e2e']
const TEST_FILE = /\.(test|spec)\.ts$/
// Members of `test` that take a function and are not a test: hooks, groups and steps.
const NOT_A_TEST = new Set([
  'describe',
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'step',
  'use',
  'extend',
])

/** @param {ts.Expression} callee @returns {string[] | null} the chain of names, root first */
function chain(callee) {
  /** @type {string[]} */
  const names = []
  let node = callee
  for (;;) {
    if (ts.isIdentifier(node)) return [node.text, ...names]
    if (ts.isPropertyAccessExpression(node)) {
      names.unshift(node.name.text)
      node = node.expression
    } else if (ts.isCallExpression(node)) {
      // `test.each(table)(name, fn)`: the declaration is the outer call.
      node = node.expression
    } else {
      return null
    }
  }
}

/**
 * The test declarations in a file: a call to `test` or `it` (or a member such as `test.each(...)`,
 * `test.skip`) that is handed a function.
 * @param {string} source
 */
export function countTests(source) {
  const sf = ts.createSourceFile('t.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let count = 0
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const names = chain(node.expression)
      const isFunction = (/** @type {ts.Node} */ a) =>
        ts.isArrowFunction(a) || ts.isFunctionExpression(a)
      if (
        names &&
        (names[0] === 'test' || names[0] === 'it') &&
        !names.slice(1).some((name) => NOT_A_TEST.has(name)) &&
        node.arguments.some(isFunction)
      ) {
        count += 1
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return count
}

/** @param {string} diff @returns {string[]} */
export function removedExpects(diff) {
  return diff
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---') && line.includes('expect('))
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** @param {string} dir @returns {string[]} */
function filesOnDisk(dir) {
  /** @type {string[]} */
  const out = []
  let entries
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true })
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return out
    throw error
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...filesOnDisk(path))
    else if (TEST_FILE.test(entry.name)) out.push(path)
  }
  return out
}

function main() {
  let base
  try {
    base = git('rev-parse', '--verify', `${BASELINE}^{commit}`).trim()
  } catch (error) {
    console.error(`✗ check-test-integrity: no baseline '${BASELINE}' to compare against`)
    console.error(`  (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`)
    process.exit(1)
  }
  const listed = git('ls-tree', '-r', '--name-only', base, '--', ...SUITES)
  const baseFiles = listed.split('\n').filter((path) => TEST_FILE.test(path))
  const before = baseFiles.reduce((n, path) => n + countTests(git('show', `${base}:${path}`)), 0)
  const current = SUITES.flatMap(filesOnDisk)
  const after = current.reduce(
    (n, path) => n + countTests(readFileSync(join(ROOT, path), 'utf8')),
    0,
  )

  // The baseline is written to a temporary directory and compared with `--no-index`: `git diff
  // <ref>` sees only tracked files, and while a session works its new tests are untracked, so
  // every one of them would read as deleted.
  const mirror = mkdtempSync(join(tmpdir(), 'menkar-integrity-'))
  const live = mkdtempSync(join(tmpdir(), 'menkar-integrity-live-'))
  let removed = []
  try {
    for (const path of baseFiles) {
      mkdirSync(dirname(join(mirror, path)), { recursive: true })
      writeFileSync(join(mirror, path), git('show', `${base}:${path}`))
    }
    for (const path of current) {
      mkdirSync(dirname(join(live, path)), { recursive: true })
      writeFileSync(join(live, path), readFileSync(join(ROOT, path)))
    }
    let diff = ''
    try {
      diff = git('diff', '--no-index', '--no-color', '-U0', mirror, live)
    } catch (error) {
      // `--no-index` exits 1 when the trees differ, which is the normal case here.
      const { status, stdout } = /** @type {{ status?: number, stdout?: string }} */ (error)
      if (status !== 1) throw error
      diff = stdout ?? ''
    }
    removed = removedExpects(diff)
  } finally {
    rmSync(mirror, { recursive: true, force: true })
    rmSync(live, { recursive: true, force: true })
  }

  const problems = []
  if (after < before) {
    problems.push(
      `the suite has ${after} tests and '${BASELINE}' ${before}: ${before - after} gone`,
    )
  }
  if (removed.length) {
    problems.push(`the diff removes ${removed.length} line(s) with \`expect(\`:`)
    for (const line of removed.slice(0, 10)) problems.push(`    ${line.trim()}`)
  }
  if (problems.length) {
    console.error(`✗ check-test-integrity: the suite lost coverage against '${BASELINE}':`)
    for (const problem of problems) console.error(`  ${problem}`)
    console.error(
      '  A test that cannot be fixed goes to e2e/FLAKY.md with a date, or is deleted on',
    )
    console.error(
      '  purpose with a person reading the diff. It is not removed to make a run green.',
    )
    process.exit(1)
  }
  console.log(
    `check-test-integrity: ${after} tests ('${BASELINE}': ${before} in ${baseFiles.length} file(s))`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
