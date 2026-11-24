// D1: an idle Cursor session is ended and resumed to take a wake only while its box is empty, since
// ending it loses whatever the box holds. The screens are as `cursor` measured them on
// 2026.11.13-eacade1 (2026-11-23).
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { quiet, takeHeld } from '../../../../src/core/agents/cursor/wakes'

const FOOTER = '\n\n  Auto · 4.1%\n  /home/demo/api · main\n'

test.each([
  ['idle, its box empty', `  Done: the tests pass.\n\n  → Add a follow-up${FOOTER}`, true],
  [
    'a new chat, its box empty',
    `  Cursor Agent\n\n  → Plan, search, build anything${FOOTER}`,
    true,
  ],
  ['idle with a draft', `  Done: the tests pass.\n\n  → also update the READ${FOOTER}`, false],
  [
    'an interrupted prompt put back in the box',
    `  Interrupted.\n\n  → Write a 300-line poem about tides${FOOTER}`,
    false,
  ],
  [
    'a reply quoting the placeholder, a draft in the box',
    `  The box says → Add a follow-up when empty.\n\n  → do it${FOOTER}`,
    false,
  ],
  [
    'a turn running, its box empty',
    `  ⠠⠛ Working 1200 tokens\n\n  → Add a follow-up\n  ctrl+c to stop${FOOTER}`,
    false,
  ],
  [
    'an approval card in place of the box',
    '  Run this command?\n  Not in allowlist: touch\n  → Run (once) (y)\n    Skip & tell the agent what to do instead (esc or n)\n',
    false,
  ],
  ['nothing of the agent on screen', '', false],
])('%s: quiet is %s', (_name, screen, expected) => {
  expect(quiet(screen)).toBe(expected)
})

test('what is held is taken whole, in order, and once', () => {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'held-'))
  mkdirSync(join(root, 'p1'))
  writeFileSync(join(root, 'p1', 'b-wake-2.txt'), 'second')
  writeFileSync(join(root, 'p1', 'b-wake-1.txt'), 'first')
  writeFileSync(join(root, 'p1', '.tmp-x'), 'not a held text')
  expect(takeHeld(root, 'p1')).toBe('first\n\nsecond')
  expect(readdirSync(root)).toEqual([])
  expect(takeHeld(root, 'p1')).toBeNull()
  expect(takeHeld(root, 'p2')).toBeNull()
})
