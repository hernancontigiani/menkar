// Decision 1.180: a key, a click or a scroll in a focused main window is a presence mark, at most
// one a minute, with no content; the listeners that see them only observe.
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, test } from 'vitest'
import { markDue } from '../../../src/core/activity/marks'

test('a presence mark is due at the first event, then once a minute', () => {
  expect(markDue(null, 0)).toBe(true)
  expect(markDue(0, 59_999)).toBe(false)
  expect(markDue(0, 60_000)).toBe(true)
})

// A clock set back must not silence the marks until it catches up again.
test('a clock jumping back gives a mark, and the next one a minute after it', () => {
  expect(markDue(500_000, 100_000)).toBe(true)
  expect(markDue(100_000, 159_999)).toBe(false)
  expect(markDue(100_000, 160_000)).toBe(true)
})

interface Listener {
  readonly event: string
  readonly passive: boolean
  readonly capture: boolean
}

function read(source: string): { listeners: Listener[]; blocking: string[] } {
  const sf = ts.createSourceFile('presence.ts', source, ts.ScriptTarget.Latest, true)
  const listeners: Listener[] = []
  const blocking: string[] = []
  const flag = (options: ts.Expression | undefined, name: string): boolean =>
    options !== undefined &&
    ts.isObjectLiteralExpression(options) &&
    options.properties.some(
      (p) =>
        ts.isPropertyAssignment(p) &&
        p.name.getText(sf) === name &&
        p.initializer.kind === ts.SyntaxKind.TrueKeyword,
    )
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text
      if (['preventDefault', 'stopPropagation', 'stopImmediatePropagation'].includes(name))
        blocking.push(name)
      if (name === 'addEventListener') {
        const [event, , options] = node.arguments
        listeners.push({
          event: event && ts.isStringLiteral(event) ? event.text : (event?.getText(sf) ?? ''),
          passive: flag(options, 'passive'),
          capture: flag(options, 'capture'),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { listeners, blocking }
}

// xterm's key handler and the app's shortcuts must see every event as before: presence handles none.
test('the presence listeners only observe: passive, and never stopping or cancelling an event', () => {
  const { listeners, blocking } = read(readFileSync('src/renderer/presence.ts', 'utf8'))
  expect(blocking).toEqual([])
  expect(listeners.map((l) => l.event).sort()).toEqual(['keydown', 'pointerdown', 'wheel'])
  for (const listener of listeners) expect(listener).toMatchObject({ passive: true, capture: true })
})
