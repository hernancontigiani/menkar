// Both languages of the site: every page has its Spanish twin, alike in headings, captures and
// sidebar place; and the site, the captures and the app name the same locales.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'
import { LOCALES } from '../../e2e/captures/registry'
import { readPages, twinProblems } from '../../site/scripts/twins.mjs'
import { LANGUAGES } from '../../src/core/i18n'

const SITE = join(__dirname, '..', '..', 'site')
const DOCS = join(SITE, 'src', 'content', 'docs')

const page = (body: string, order = 1) => `---\ntitle: T\nsidebar:\n  order: ${order}\n---\n${body}`

describe("the site's twins", () => {
  test('every page in the tree has its twin, with the same headings, captures and order', () => {
    expect(twinProblems(readPages(DOCS))).toEqual([])
  })

  test('a page with no Spanish twin, or a Spanish page with no English one, fails naming it', () => {
    const pages = new Map([
      ['start/install.md', page('## Install')],
      ['es/start/agents.md', page('## Agentes')],
    ])
    expect(twinProblems(pages)).toEqual([
      'start/install.md has no Spanish twin at es/start/install.md',
      'es/start/agents.md has no English page at start/agents.md',
    ])
  })

  test('twins whose headings differ in count or level fail', () => {
    const en = page('## Open a session\n\n### From the menu\n\n## Close it')
    expect(
      twinProblems(
        new Map([
          ['a.md', en],
          ['es/a.md', page('## Abrir una sesión\n\n## Desde el menú\n\n## Cerrarla')],
        ]),
      ),
    ).toEqual(["a.md: the twins' headings differ in count or level (en h2 h3 h2, es h2 h2 h2)"])
    expect(
      twinProblems(
        new Map([
          ['a.md', en],
          ['es/a.md', page('## Abrir una sesión\n\n### Desde el menú')],
        ]),
      ),
    ).toHaveLength(1)
  })

  test('a heading inside a code block is not a heading', () => {
    const en = page('## Run it\n\n```sh\n# a comment\n```')
    expect(
      twinProblems(
        new Map([
          ['a.md', en],
          ['es/a.md', page('## Correrlo')],
        ]),
      ),
    ).toEqual([])
  })

  test('twins whose captures differ in slug or order fail', () => {
    const en = page('![](shot:board-default)\n\n![](shot:first-time-card)')
    expect(
      twinProblems(
        new Map([
          ['a.md', en],
          ['es/a.md', page('![](shot:first-time-card)\n\n![](shot:board-default)')],
        ]),
      ),
    ).toEqual([
      "a.md: the twins' captures differ (en board-default, first-time-card, es first-time-card, board-default)",
    ])
  })

  test('twins in a different sidebar place fail', () => {
    expect(
      twinProblems(
        new Map([
          ['a.md', page('', 1)],
          ['es/a.md', page('', 2)],
        ]),
      ),
    ).toEqual(["a.md: the twins' sidebar.order differ (en 1, es 2)"])
  })
})

// astro.config.mjs read with a parse, not imported: its locales, `root` by its `lang`.
function configLocales(): string[] {
  const source = readFileSync(join(SITE, 'astro.config.mjs'), 'utf8')
  const file = ts.createSourceFile('astro.config.mjs', source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const nameOf = (property: ts.ObjectLiteralElementLike) =>
    property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ? property.name.text
      : undefined
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      nameOf(node) === 'locales' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const locale of node.initializer.properties) {
        const key = nameOf(locale)
        if (key !== 'root') {
          if (key) found.push(key)
          continue
        }
        if (!ts.isPropertyAssignment(locale) || !ts.isObjectLiteralExpression(locale.initializer))
          continue
        const lang = locale.initializer.properties.find((p) => nameOf(p) === 'lang')
        if (lang && ts.isPropertyAssignment(lang) && ts.isStringLiteral(lang.initializer))
          found.push(lang.initializer.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe("the site's locales", () => {
  test("the site, the captures' registry and the app's catalogs name the same locales", () => {
    const site = configLocales().sort()
    expect(site).toEqual(['en', 'es'])
    expect([...LOCALES].sort()).toEqual(site)
    expect([...LANGUAGES].sort()).toEqual(site)
  })
})
