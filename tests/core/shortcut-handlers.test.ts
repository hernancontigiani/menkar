// The window's command keys are the shortcuts table's (decision 1.37): the modules that act on
// them compare no key to a literal of their own, so a key cannot act without being listed in
// Settings. The few left name why. Read from the source with the TypeScript compiler.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { expect, test } from 'vitest'

const HANDLERS = ['main.ts', 'keys.ts', 'terminals.ts', 'switcher.ts', 'chat.ts']

// file: literal — why it is not a row.
const ALLOWED: Readonly<Record<string, string>> = {
  // Ctrl+B begins the prefix; the table lists what follows it, and Ctrl+B Ctrl+B.
  'keys.ts:b': 'starts the prefix',
  // Letting Ctrl go is how a held switcher chooses, not a key that runs a command.
  'switcher.ts:Control': 'the release of a held switcher',
  // Which way the table's switcherMove row moves.
  'switcher.ts:ArrowDown': 'the direction of switcherMove',
}

function keyLiterals(source: string): string[] {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const isKeyRead = (node: ts.Expression): boolean => {
    if (ts.isPropertyAccessExpression(node)) return ['key', 'code'].includes(node.name.text)
    // event.key.toLowerCase()
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression))
      return isKeyRead(node.expression.expression)
    return false
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(
        node.operatorToken.kind,
      )
    ) {
      const [a, b] = [node.left, node.right]
      if (isKeyRead(a) && ts.isStringLiteral(b)) found.push(b.text)
      if (isKeyRead(b) && ts.isStringLiteral(a)) found.push(a.text)
    }
    if (ts.isSwitchStatement(node) && isKeyRead(node.expression))
      for (const clause of node.caseBlock.clauses)
        if (ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression))
          found.push(clause.expression.text)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

test('the command handlers compare no key of their own: every key they act on is a row of the table', () => {
  const unlisted: string[] = []
  let read = 0
  for (const file of HANDLERS) {
    const source = readFileSync(join('src/renderer', file), 'utf8')
    read += source.length
    for (const literal of keyLiterals(source))
      if (!ALLOWED[`${file}:${literal}`]) unlisted.push(`${file}: '${literal}'`)
  }
  expect(read).toBeGreaterThan(10_000)
  expect(unlisted).toEqual([])
})

test('the check sees a key compared to a literal, lowered or switched on', () => {
  expect(
    keyLiterals(`
      if (event.key === 'F9') a()
      if ('x' !== e.code) b()
      if (event.key.toLowerCase() === 't') c()
      switch (event.key) { case 'v': break }
      if (event.shiftKey) d()
    `),
  ).toEqual(['F9', 'x', 't', 'v'])
})
