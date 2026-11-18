import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flavorFacts } from '../../src/core/flavor'
import { en } from '../../src/core/i18n/en'
import { es } from '../../src/core/i18n/es'

// 1.166: Menkar Sandbox shows its own name wherever the app shows one, so the human never works in
// the wrong Menkar. Each place reads the name from the flavour; the flavour picks the string.
afterEach(() => {
  vi.unstubAllGlobals()
})

const parse = (path: string) =>
  ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)

function find(file: ts.Node, match: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (match(node)) found.push(node)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const callTo = (node: ts.Node, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) && node.expression.getText() === name

const isAppName = (node: ts.Node | undefined) =>
  node !== undefined && callTo(node, 'appName') && node.arguments.length === 0

// An `el(...)` call whose attributes hold `key: value` and whose children include `appName()`.
const elShowingName = (tag: string, key: string, value: string) => (node: ts.Node) =>
  callTo(node, 'el') &&
  node.arguments[0]?.getText() === `'${tag}'` &&
  ts.isObjectLiteralExpression(node.arguments[1] ?? node) &&
  (node.arguments[1] as ts.ObjectLiteralExpression).properties.some(
    (p) =>
      ts.isPropertyAssignment(p) &&
      p.name.getText().replace(/'/g, '') === key &&
      p.initializer.getText() === `'${value}'`,
  ) &&
  node.arguments.slice(2).some(isAppName)

describe("each place that shows the app's name reads it from the flavour", () => {
  test("the header's title", () => {
    const file = parse('src/renderer/app.ts')
    expect(find(file, elShowingName('span', 'class', 'title-text'))).toHaveLength(1)
  })

  test("the main window's title, before and after its page loads", () => {
    const page = parse('src/renderer/main.ts')
    const assigned = find(
      page,
      (n) =>
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        n.left.getText() === 'document.title' &&
        isAppName(n.right),
    )
    expect(assigned).toHaveLength(1)

    const workspace = parse('src/main/workspace.ts')
    const titles = find(
      workspace,
      (n) =>
        ts.isNewExpression(n) &&
        n.expression.getText() === 'BrowserWindow' &&
        n.arguments?.[0] !== undefined &&
        ts.isObjectLiteralExpression(n.arguments[0]) &&
        n.arguments[0].properties.some(
          (p) =>
            ts.isPropertyAssignment(p) &&
            p.name.getText() === 'title' &&
            p.initializer.getText() === 'translate(flavorFacts().titleKey)',
        ),
    )
    expect(titles).toHaveLength(1)
  })

  test("About's name", () => {
    const file = parse('src/renderer/about.ts')
    expect(find(file, elShowingName('h1', 'data-key', 'name'))).toHaveLength(1)
  })

  test("appName() turns the flavour's key into the same key's string, case by case", () => {
    const file = parse('src/renderer/about.ts')
    const clauses = find(file, ts.isCaseClause) as ts.CaseClause[]
    expect(clauses.map((c) => c.expression.getText())).toEqual([
      "'window.title'",
      "'window.titleSandbox'",
    ])
    for (const clause of clauses) {
      const calls = find(clause, (n) => callTo(n, 't')) as ts.CallExpression[]
      expect(calls.map((c) => c.arguments[0]?.getText())).toEqual([clause.expression.getText()])
    }
  })

  test("no other code names either title's key, so no place shows a fixed name", () => {
    const keyed = (path: string) =>
      find(
        parse(path),
        (n) =>
          ts.isStringLiteral(n) && (n.text === 'window.title' || n.text === 'window.titleSandbox'),
      ).length
    expect(keyed('src/renderer/app.ts')).toBe(0)
    expect(keyed('src/renderer/main.ts')).toBe(0)
    expect(keyed('src/main/workspace.ts')).toBe(0)
    // The two case labels and the two t() calls.
    expect(keyed('src/renderer/about.ts')).toBe(4)
  })
})

describe('the name each flavour shows', () => {
  test('the daily Menkar is "Menkar" in every catalog', () => {
    const key = flavorFacts().titleKey
    expect(en[key]).toBe('Menkar')
    expect(es[key]).toBe('Menkar')
  })

  test('the sandbox is "Menkar Sandbox" in every catalog', () => {
    vi.stubGlobal('__MENKAR_FLAVOR__', 'sandbox')
    const key = flavorFacts().titleKey
    expect(en[key]).toBe('Menkar Sandbox')
    expect(es[key]).toBe('Menkar Sandbox')
  })
})
