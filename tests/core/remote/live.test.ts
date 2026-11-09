// The phone icon's live source (plan 18, decision 1.18): Claude Code's per-process registry, read
// best-effort, and the agent's pid under the pane's shell.
import { describe, expect, test } from 'vitest'
import {
  bridgeState,
  findAgentPid,
  type ProcReader,
  procStartOf,
} from '../../../src/core/remote/live'

const registry = (extra: Record<string, unknown> = {}) => ({
  pid: 4242,
  sessionId: '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c',
  procStart: '778652',
  status: 'idle',
  ...extra,
})
const expected = {
  pid: 4242,
  sessionId: '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c',
  procStart: '778652',
}

describe('bridgeState', () => {
  test.each([
    ['a bridge id: on', registry({ bridgeSessionId: 'session_01Abc' }), 'on'],
    ['null after a disconnect: off', registry({ bridgeSessionId: null }), 'off'],
    ['no key, never connected: off', registry(), 'off'],
    ['an empty id: unknown', registry({ bridgeSessionId: '  ' }), 'unknown'],
    ['an id of another type: unknown', registry({ bridgeSessionId: 7 }), 'unknown'],
    ['another pid: unknown', registry({ pid: 4243, bridgeSessionId: 'session_01Abc' }), 'unknown'],
    [
      'another session: unknown',
      registry({ sessionId: 'other', bridgeSessionId: 'session_01Abc' }),
      'unknown',
    ],
    [
      'the pid reused by a later process: unknown',
      registry({ procStart: '999999', bridgeSessionId: 'session_01Abc' }),
      'unknown',
    ],
    ['not an object: unknown', '{"pid":4242', 'unknown'],
    ['null: unknown', null, 'unknown'],
  ] as const)('%s', (_, json, state) => {
    expect(bridgeState(json, expected)).toBe(state)
  })

  test('before the session is known, the pid and its start decide', () => {
    const json = registry({ sessionId: 'whatever-it-is', bridgeSessionId: 'session_01Abc' })
    expect(bridgeState(json, { pid: 4242, sessionId: null, procStart: '778652' })).toBe('on')
  })

  test('a registry without procStart is matched by pid and session', () => {
    const json = { pid: 4242, sessionId: expected.sessionId, bridgeSessionId: 'session_01Abc' }
    expect(bridgeState(json, expected)).toBe('on')
  })
})

describe('procStartOf', () => {
  test('field 22, counted after the command even when the command holds spaces and parentheses', () => {
    const fields = Array.from({ length: 40 }, (_, i) => String(i + 3))
    fields[19] = '778652'
    expect(procStartOf(`396218 (claude (x) y) ${fields.join(' ')}`)).toBe('778652')
    expect(procStartOf('garbage')).toBeNull()
  })
})

describe('findAgentPid', () => {
  // shell 100 → 200 (claude) ; shell 300 → 310 (npx) → 320 (node …/claude) ; 400 → 410 (vim)
  const tree: Record<number, number[]> = { 100: [200], 300: [310], 310: [320], 400: [410] }
  const argv: Record<number, string[]> = {
    200: ['/home/u/.local/bin/claude', '--resume', 'x'],
    310: ['npx', 'something'],
    320: ['node', '/opt/tools/claude', '--resume', 'y'],
    410: ['vim', 'claude'],
  }
  const proc: ProcReader = { children: (pid) => tree[pid] ?? [], argv: (pid) => argv[pid] ?? [] }

  test("the shell's child named after the agent", () => {
    expect(findAgentPid(100, 'claude', proc)).toBe(200)
  })

  test('a descendant run by an interpreter, a level down', () => {
    expect(findAgentPid(300, 'claude', proc)).toBe(320)
  })

  test('an argument further along that merely names the agent does not count; none found', () => {
    expect(findAgentPid(400, 'claude', proc)).toBeNull()
    expect(findAgentPid(999, 'claude', proc)).toBeNull()
  })
})
