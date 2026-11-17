// §2.4 of the multi-agent architecture (1.155 Q4, 1.159 B3): `session_agents` records the agent of
// each session Menkar starts that is not the default's, and a saved tab is restored by it: a known
// agent's session not found keeps its tab with one line, an agent this build does not know too,
// and a session nothing records and no reader finds is dropped as before.
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { isDefault } from '../../src/core/agents/registry'
import {
  parseState,
  restoreOf,
  saveState,
  sessionAgents,
  statePath,
  withSessionAgent,
} from '../../src/core/state'

afterEach(() => vi.unstubAllEnvs())

// What main records when a session's pane starts: nothing for the default agent.
const recorded = (state: ReturnType<typeof parseState>, id: string, agent: 'claude' | 'cursor') =>
  isDefault(agent) ? state : withSessionAgent(state, id, agent)

describe('session_agents', () => {
  test('a Claude-only start writes no session_agents: state.json keeps its bytes', async () => {
    const config = join(process.env.MENKAR_TEST_ROOT ?? '', 'session-agents', 'config')
    mkdirSync(config, { recursive: true })
    vi.stubEnv('XDG_CONFIG_HOME', config)
    const state = parseState({ names: { s0: 'api' }, settings: { reopen_tabs: true } })
    await saveState(state)
    const before = readFileSync(statePath(), 'utf8')
    const after = recorded(recorded(state, 's1', 'claude'), 's2', 'claude')
    expect(after).toBe(state)
    await saveState(after)
    expect(readFileSync(statePath(), 'utf8')).toBe(before)
    expect(before).not.toContain('session_agents')
  })

  test("a Cursor start writes { id: 'cursor' }, beside what was there", () => {
    const state = parseState({ settings: {}, session_agents: { s0: 'gemini' } })
    const next = recorded(state, 's1', 'cursor')
    expect(sessionAgents(next)).toEqual({ s0: 'gemini', s1: 'cursor' })
    expect(recorded(next, 's1', 'cursor')).toBe(next)
  })

  test('pruned with the session; the key goes with its last entry', () => {
    const state = parseState({ session_agents: { s1: 'cursor' }, muted: ['s1'] })
    const pruned = withSessionAgent(state, 's1', null)
    expect(pruned.rest).toEqual({ muted: ['s1'] })
    expect(withSessionAgent(pruned, 's1', null)).toBe(pruned)
  })

  test('an entry that is not a string is no entry', () => {
    expect(
      sessionAgents(parseState({ session_agents: { s1: 3, '': 'cursor', s2: 'cursor' } })),
    ).toEqual({
      s2: 'cursor',
    })
    expect(sessionAgents(parseState({ session_agents: ['cursor'] }))).toEqual({})
  })
})

describe('restoring a saved pane', () => {
  test('a reader found it: its agent resumes it, whatever was recorded', () => {
    expect(restoreOf('cursor', undefined)).toEqual({ kind: 'resume', agent: 'cursor' })
    expect(restoreOf('claude', 'gemini')).toEqual({ kind: 'resume', agent: 'claude' })
  })

  test('B3: not found, recorded with an agent this build knows → kept, not started', () => {
    expect(restoreOf(undefined, 'cursor')).toEqual({ kind: 'missing', agent: 'cursor' })
  })

  test('Q4: not found, recorded with an agent this build does not know → kept, not started', () => {
    expect(restoreOf(undefined, 'gemini')).toEqual({ kind: 'unsupported', agent: 'gemini' })
  })

  test('not found and not recorded → dropped, as before', () => {
    expect(restoreOf(undefined, undefined)).toEqual({ kind: 'unnamed' })
  })
})
