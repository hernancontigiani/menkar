// §2.5.1 of the multi-agent architecture: one turn-end record format, written by every agent's
// producer, read by main alone. The parity: what each writer leaves is what main's reader takes.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import {
  parseTurnEnd,
  TURN_END_KEYS,
  writeTurnEnd,
} from '../../../../src/core/agents/shared/turn-end'
import { TURN_END_ARG } from '../../../../src/core/context/statusline'

const temp = () => mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'turn-end-'))

test('the shared writer leaves its keys, in order, and main reads the session and the time', () => {
  const dir = temp()
  expect(writeTurnEnd(dir, 'pane-1', 'thread-a')).toBe(true)
  const text = readFileSync(join(dir, 'pane-1.json'), 'utf8')
  expect(Object.keys(JSON.parse(text))).toEqual([...TURN_END_KEYS])
  const record = parseTurnEnd(text)
  expect(record?.sessionId).toBe('thread-a')
  expect(record?.at).toBe(JSON.parse(text).at)
  expect(readdirSync(dir)).toEqual(['pane-1.json'])
})

test("Claude's Stop hook writes a record main reads the same way", () => {
  const root = temp()
  const result = spawnSync(
    process.execPath,
    [resolve('src/core/context/statusline.ts'), TURN_END_ARG],
    {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's7' }),
      env: {
        PATH: process.env.PATH ?? '',
        HOME: join(root, 'home'),
        XDG_CACHE_HOME: join(root, 'cache'),
        MENKAR_PANE: 'pane-4',
      },
      encoding: 'utf8',
    },
  )
  expect(result.status).toBe(0)
  const text = readFileSync(
    join(root, 'cache', 'menkar', 'control', 'turn-ends', 'pane-4.json'),
    'utf8',
  )
  expect(parseTurnEnd(text)?.sessionId).toBe('s7')
  // Every key Claude's writes is one of the format's.
  for (const key of Object.keys(JSON.parse(text))) expect(TURN_END_KEYS).toContain(key)
})

test('a pane id that is not a plain word, or an id with a path in it, writes nothing', () => {
  const dir = temp()
  expect(writeTurnEnd(dir, '../x', 'thread-a')).toBe(false)
  expect(writeTurnEnd(dir, 'pane-1', 'a/b')).toBe(false)
  expect(writeTurnEnd(dir, 'pane-1', '')).toBe(false)
  expect(readdirSync(dir)).toEqual([])
})

test('a record cut short, or without its session or time, is not read', () => {
  expect(parseTurnEnd('{"session_id":"s')).toBeNull()
  expect(parseTurnEnd('{"at":"x"}')).toBeNull()
  expect(parseTurnEnd('{"session_id":"s"}')).toBeNull()
  expect(parseTurnEnd('[]')).toBeNull()
})
