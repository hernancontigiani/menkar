// Every line taken out of a decision document since HEAD must be in its mirror under docs/history/.
//
// Usage: node scripts/nothing-lost.mjs [<document> ...]   (no arguments: every mirrored document)
//
// Exits 1 listing each removed line missing from the mirror, and also when a mirror itself lost a
// line: the mirror only grows. Compares against HEAD, so a document with someone else's uncommitted
// edits reads as a loss — check `git diff --quiet HEAD -- <document>` before starting to cut.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HISTORY = 'docs/history/'
// The documents that hold decisions, and where each one's history goes. The mirror keeps the rest
// of the path, so one is computed from the other.
const ROOT_FILES = new Map([['CLAUDE.md', `${HISTORY}root/CLAUDE.md`]])
const PREFIXES = new Map([
  ['plans/00-STATUS.md', `${HISTORY}plans/00-STATUS.md`],
  ['docs/', HISTORY],
])
// Lines that carry no content of their own: blank, a rule, a table separator, a code fence.
const MARKUP = /^(\s*|[-|:\s]+|```[\w-]*)$/
const HUNK = /^@@ -(\d+)(?:,\d+)? /

/** @param {string} path @returns {string | null} */
export function mirrorOf(path) {
  if (path.startsWith(HISTORY)) return null
  const root = ROOT_FILES.get(path)
  if (root) return root
  for (const [source, target] of PREFIXES) {
    if (path === source) return source.endsWith('/') ? target + path.slice(source.length) : target
    if (source.endsWith('/') && path.startsWith(source)) return target + path.slice(source.length)
  }
  return null
}

/** @param {string} root @param {string[]} args */
function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/**
 * The lines a `git diff -U0` removes, with their line number in the old file, markup left out.
 * @param {string} diff
 * @returns {Array<[number, string]>}
 */
export function removedLines(diff) {
  /** @type {Array<[number, string]>} */
  const removed = []
  let oldLine = 0
  // Python's splitlines(), which the original used: a lone CR also ends a line.
  for (const line of diff.split(/\r\n|\r|\n/)) {
    const hunk = HUNK.exec(line)
    if (hunk) {
      oldLine = Number(hunk[1])
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed.push([oldLine, line.slice(1)])
      oldLine += 1
    }
  }
  return removed.filter(([, text]) => !MARKUP.test(text))
}

/** @param {string} root @param {string} path */
function removed(root, path) {
  return removedLines(git(root, 'diff', '--no-color', '--no-ext-diff', '-U0', 'HEAD', '--', path))
}

/** @param {string} root @param {string} path @returns {string[]} */
export function check(root, path) {
  const mirror = mirrorOf(path)
  if (mirror === null) throw new Error(`${path}: not a document this check mirrors`)
  const mirrorPath = join(root, mirror)
  const kept = new Set(
    existsSync(mirrorPath)
      ? readFileSync(mirrorPath, 'utf8')
          .split(/\r\n|\r|\n/)
          .map((line) => line.trim())
      : [],
  )
  const problems = removed(root, path)
    .filter(([, text]) => !kept.has(text.trim()))
    .map(([n, text]) => `${path}:${n}: not in ${mirror}: ${text.trim()}`)
  for (const [n, text] of removed(root, mirror)) {
    problems.push(`${mirror}:${n}: the mirror lost a line: ${text.trim()}`)
  }
  return problems
}

/** @param {string} root @returns {string[]} */
export function mirroredDocuments(root) {
  const tracked = git(root, 'ls-files', '--cached', '--deleted', '*.md')
    .split(/\s+/)
    .filter(Boolean)
  return [...new Set(tracked.filter((path) => mirrorOf(path) !== null))].sort()
}

/** @param {string[]} paths @returns {number} */
export function main(paths) {
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel').trim()
  const documents = paths.length
    ? paths.map((p) => relative(root, resolve(p)).split(sep).join('/'))
    : mirroredDocuments(root)
  const unmirrored = documents.find((path) => mirrorOf(path) === null)
  if (unmirrored !== undefined) {
    console.error(`${unmirrored}: not a document this check mirrors`)
    return 1
  }
  const problems = documents.flatMap((path) => check(root, path))
  for (const problem of problems) console.log(problem)
  console.log(`${documents.length} document(s) checked, ${problems.length} line(s) lost`)
  return problems.length ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}
