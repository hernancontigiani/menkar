// 38 §3.6 / D16: a saved or received string becomes an agent only through parseAgentId, and a value
// no build knows is never read as another agent.
import { describe, expect, test } from 'vitest'
import { AGENT_IDS, parseAgentId } from '../../../src/core/agents/ids'

describe('agent ids', () => {
  test('the agents are offered Claude first, then Cursor, then Codex, then OpenCode', () => {
    expect(AGENT_IDS).toEqual(['claude', 'cursor', 'codex', 'opencode'])
  })

  test.each(AGENT_IDS.map((id) => [id]))('a known id parses as itself: %s', (id) => {
    expect(parseAgentId(id)).toBe(id)
  })

  test.each([[''], ['gemini'], ['Claude'], ['cursor-agent'], [1], [null], [undefined], [{}]])(
    'an unknown value is no agent at all: %j',
    (value) => {
      expect(parseAgentId(value)).toBeNull()
    },
  )
})
