// Every English page has its Spanish twin at the same path under `es/`, with the same headings
// (count and levels), the same capture slugs in the same order and the same sidebar place. Read by
// `npm run ci` (tests/site) and by `npm run site:check`, so neither can pass a page the other fails.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** @param {string} dir @returns {string[]} */
function pagesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? pagesUnder(join(dir, entry.name))
      : /\.mdx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )
}

/**
 * What the parity compares in one page's source.
 * @param {string} source
 * @returns {{ headings: number[], shots: string[], uiKeys: string[], headingTexts: string[], order: string | null }}
 */
export function pageShape(source) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  const body = frontmatter ? source.slice(frontmatter[0].length) : source
  const order = frontmatter
    ? (/^sidebar:\s*\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+order:\s*(\S+)/m.exec(
        `${frontmatter[1]}\n`,
      )?.[1] ?? null)
    : null
  /** @type {number[]} */
  const headings = []
  /** @type {string[]} */
  const headingTexts = []
  /** @type {string[]} */
  const prose = []
  let fence = ''
  for (const line of body.split(/\r?\n/)) {
    const opens = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (opens && opens[1][0] === fence[0] && opens[1].length >= fence.length) fence = ''
      continue
    }
    if (opens) {
      fence = opens[1]
      continue
    }
    prose.push(line)
    const heading = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t#]*$/.exec(line)
    if (heading) {
      headings.push(heading[1].length)
      headingTexts.push(heading[2])
    }
  }
  const text = prose.join('\n').replace(/`[^`\n]*`/g, '')
  const shots = [...text.matchAll(/!\[[^\]]*\]\(\s*shot:([^)\s]+)\s*\)/g)].map((m) => m[1])
  const uiKeys = [...text.matchAll(/:ui\[([^\]]*)\]/g)].map((m) => m[1])
  return { headings, shots, uiKeys, headingTexts, order }
}

/**
 * Every page under `docsDir`, by its path relative to it, `/`-separated.
 * @param {string} docsDir
 * @returns {Map<string, string>}
 */
export function readPages(docsDir) {
  return new Map(
    pagesUnder(docsDir).map((file) => [
      relative(docsDir, file).split(sep).join('/'),
      readFileSync(file, 'utf8'),
    ]),
  )
}

/**
 * Each way the twins differ, one sentence naming the page.
 * @param {Map<string, string>} pages path relative to the docs folder → source
 * @returns {string[]}
 */
export function twinProblems(pages) {
  /** @type {string[]} */
  const problems = []
  const english = [...pages.keys()].filter((path) => !path.startsWith('es/')).sort()
  const spanish = new Set(
    [...pages.keys()].filter((path) => path.startsWith('es/')).map((path) => path.slice(3)),
  )
  for (const path of english) {
    const twin = pages.get(`es/${path}`)
    if (twin === undefined) {
      problems.push(`${path} has no Spanish twin at es/${path}`)
      continue
    }
    const en = pageShape(pages.get(path) ?? '')
    const es = pageShape(twin)
    if (en.headings.join(',') !== es.headings.join(','))
      problems.push(
        `${path}: the twins' headings differ in count or level (en ${fmt(en.headings)}, es ${fmt(es.headings)})`,
      )
    if (en.shots.join(',') !== es.shots.join(','))
      problems.push(
        `${path}: the twins' captures differ (en ${en.shots.join(', ') || 'none'}, es ${es.shots.join(', ') || 'none'})`,
      )
    if (en.order !== es.order)
      problems.push(`${path}: the twins' sidebar.order differ (en ${en.order}, es ${es.order})`)
  }
  for (const path of [...spanish].sort())
    if (!pages.has(path)) problems.push(`es/${path} has no English page at ${path}`)
  return problems
}

/** @param {number[]} levels */
const fmt = (levels) => (levels.length ? levels.map((level) => `h${level}`).join(' ') : 'none')
