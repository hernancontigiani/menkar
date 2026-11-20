// Decision 1.195: `agent_named` in state.json lists the sessions Menkar named through their
// agent's own call, sorted, ids only; a renew of one names its new session too, after a restart
// as well, since the list is saved.
import { describe, expect, test } from 'vitest'
import { agentNamedList, withAgentNamed } from '../../src/core/agent-named'
import { loadState, parseState, saveState } from '../../src/core/state'

describe('agent_named', () => {
  test('only string ids are listed, once and sorted; no key is an empty list', () => {
    expect(agentNamedList(parseState({ agent_named: ['b', 3, 'a', 'b', null] }))).toEqual([
      'a',
      'b',
    ])
    expect(agentNamedList(parseState({}))).toEqual([])
  })

  test('a session named is added once, other keys untouched; adding it again is the same state', () => {
    const state = withAgentNamed(parseState({ agent_named: ['c'], muted: ['x'] }), 'a')
    expect(state.rest).toEqual({ agent_named: ['a', 'c'], muted: ['x'] })
    expect(withAgentNamed(state, 'a')).toBe(state)
  })

  test('the list survives a save and a load, as a restart reads it', async () => {
    await saveState(withAgentNamed(parseState({}), '019a4c2e-7b1d-7e3f-9a5b-0c1d2e3f4a5b'))
    expect(agentNamedList(await loadState())).toEqual(['019a4c2e-7b1d-7e3f-9a5b-0c1d2e3f4a5b'])
  })
})
