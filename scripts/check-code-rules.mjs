// Rules about the shape of the code, checked by parsing the sources with the TypeScript compiler
// API: a grep would miss `globalThis.Date.now` spelled over two lines and flag the words inside a
// comment or a string.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CLOCK = 'src/core/clock.ts'
const LOG = 'src/core/log.ts'
const ANY_REASON = /biome-ignore lint\/suspicious\/noExplicitAny: \S/

/**
 * @typedef {{ file: string, line: number, rule: string, message: string }} Violation
 */

/**
 * @param {string} file path relative to the repository root, with forward slashes
 * @param {string} source
 * @returns {Violation[]}
 */
export function findViolations(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const lines = source.split('\n')
  const inCore = file.startsWith('src/core/')
  const readsTime = file !== CLOCK && (file.startsWith('src/') || file.startsWith('tests/'))
  /** @type {Violation[]} */
  const found = []

  /** @param {ts.Node} node @param {string} rule @param {string} message */
  const report = (node, rule, message) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    found.push({ file, line: line + 1, rule, message })
  }

  /** @param {ts.Node} node */
  const isDate = (node) => {
    const inner =
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'globalThis'
        ? node.name
        : node
    return ts.isIdentifier(inner) && inner.text === 'Date'
  }

  /** @param {ts.Node} node @param {string} specifier */
  const checkImport = (node, specifier) => {
    if (!inCore) return
    if (specifier === 'electron' || specifier.startsWith('electron/')) {
      report(node, 'core-imports-electron', `src/core imports '${specifier}'`)
    } else if (specifier.startsWith('.')) {
      const target = join(file, '..', specifier).split(sep).join('/')
      if (!target.startsWith('src/core/') && target !== 'src/core') {
        report(node, 'core-imports-outside', `src/core imports '${specifier}', outside src/core`)
      }
    }
  }

  /** @param {ts.Node} node */
  const visit = (node) => {
    if (readsTime) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'now' &&
        isDate(node.expression.expression)
      ) {
        report(node, 'time-outside-clock', `Date.now() outside ${CLOCK}`)
      }
      if (
        ts.isNewExpression(node) &&
        isDate(node.expression) &&
        (node.arguments ?? []).length === 0
      ) {
        report(node, 'time-outside-clock', `new Date() outside ${CLOCK}`)
      }
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      checkImport(node, node.moduleSpecifier.text)
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [arg] = node.arguments
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if ((isDynamicImport || isRequire) && arg && ts.isStringLiteralLike(arg))
        checkImport(node, arg.text)
    }
    if (
      file !== LOG &&
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'console'
    ) {
      report(node, 'console-outside-log', `console.${node.name.text} outside ${LOG}`)
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      const justified = ANY_REASON.test(lines[line] ?? '') || ANY_REASON.test(lines[line - 1] ?? '')
      if (!justified) report(node, 'no-any', '`any` without a line-scoped reason')
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/** @param {string} dir @returns {string[]} */
function sources(dir) {
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
    if (entry.isDirectory()) out.push(...sources(path))
    else if (/\.(ts|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

function main() {
  const files = ['src', 'tests', 'e2e'].flatMap(sources)
  if (!files.includes(CLOCK)) {
    console.error(`check-code-rules: ${CLOCK} not found; the scan is looking in the wrong place`)
    process.exit(1)
  }
  const violations = files.flatMap((file) =>
    findViolations(file, readFileSync(join(ROOT, file), 'utf8')),
  )
  for (const v of violations) console.error(`${v.file}:${v.line}: [${v.rule}] ${v.message}`)
  if (violations.length > 0) {
    console.error(`check-code-rules: ${violations.length} violation(s) in ${files.length} file(s)`)
    process.exit(1)
  }
  console.log(`check-code-rules: ${files.length} file(s) clean`)
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') main()
