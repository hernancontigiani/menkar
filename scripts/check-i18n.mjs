// Every `t('key')` under src/ names a key of the English catalog, and the translations hold no key
// English lacks. The catalogs are imported for real, so one that does not evaluate fails here.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CATALOGS = 'src/core/i18n'

/**
 * @typedef {{ file: string, line: number, key: string | null }} Use
 * @param {string} file
 * @param {string} source
 * @returns {Use[]} each call to `t`, with its key or null when the key is not a literal
 */
export function findUses(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  /** @type {Use[]} */
  const uses = []
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't'
    ) {
      const [arg] = node.arguments
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      uses.push({ file, line: line + 1, key: arg && ts.isStringLiteralLike(arg) ? arg.text : null })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return uses
}

/**
 * Every string literal in a file: a key written as a literal (a refusal `core` returns for the UI
 * to translate) counts as used.
 * @param {string} source
 * @returns {string[]}
 */
export function findLiterals(source) {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  /** @type {string[]} */
  const found = []
  /** @param {ts.Node} node */
  const visit = (node) => {
    if (ts.isStringLiteralLike(node)) found.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/**
 * @param {Use[]} uses
 * @param {Record<string, string>} en
 * @param {Record<string, Record<string, string>>} translations
 * @param {string[]} [literals] string literals found outside the catalogs
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function compare(uses, en, translations, literals = []) {
  /** @type {string[]} */
  const errors = []
  /** @type {string[]} */
  const warnings = []
  const used = new Set(literals.filter((literal) => literal in en))
  for (const use of uses) {
    if (use.key === null) errors.push(`${use.file}:${use.line}: t() takes a literal key`)
    else if (!(use.key in en)) errors.push(`${use.file}:${use.line}: '${use.key}' is not in en`)
    else used.add(use.key)
  }
  for (const [language, messages] of Object.entries(translations)) {
    for (const key of Object.keys(messages)) {
      if (!(key in en)) errors.push(`${language}: '${key}' is not in en`)
    }
    for (const key of Object.keys(en)) {
      if (!(key in messages)) warnings.push(`${language}: '${key}' has no translation`)
    }
  }
  for (const key of Object.keys(en)) {
    if (!used.has(key)) warnings.push(`en: '${key}' is not used under src/`)
  }
  return { errors, warnings }
}

/** @param {string} dir @returns {string[]} */
function sources(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sources(path)
    return /\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })
}

async function main() {
  const files = sources('src')
  const texts = new Map(files.map((file) => [file, readFileSync(join(ROOT, file), 'utf8')]))
  const uses = files.flatMap((file) => findUses(file, texts.get(file) ?? ''))
  const literals = files
    .filter((file) => !file.startsWith(`${CATALOGS}/`))
    .flatMap((file) => findLiterals(texts.get(file) ?? ''))
  if (uses.length === 0) {
    console.error(
      '✗ check-i18n: no t() call found under src/; the scan is looking in the wrong place',
    )
    process.exit(1)
  }
  /** @type {Record<string, Record<string, string>>} */
  const translations = {}
  let en = {}
  for (const name of readdirSync(join(ROOT, CATALOGS)).filter((n) => /^[a-z]{2}\.ts$/.test(n))) {
    const language = name.slice(0, 2)
    const module = await import(pathToFileURL(join(ROOT, CATALOGS, name)).href)
    if (language === 'en') en = module.en
    else translations[language] = module[language]
  }
  const { errors, warnings } = compare(uses, en, translations, literals)
  for (const warning of warnings) console.log(`! check-i18n: ${warning}`)
  for (const error of errors) console.error(`✗ check-i18n: ${error}`)
  if (errors.length) process.exit(1)
  console.log(
    `check-i18n: ${uses.length} t() call(s), ${Object.keys(en).length} key(s), ` +
      `${Object.keys(translations).length} translation(s), ${warnings.length} warning(s)`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
