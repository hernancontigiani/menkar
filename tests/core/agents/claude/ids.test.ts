// §2.3 of the multi-agent architecture (S4): IdBinding is two concerns of the kit. Claude Code
// takes a new session's id from Menkar; Cursor picks its own. How a pane's session changing id is
// followed is read from Claude Code's SessionStart record, as followPaneStart read it before.
import { describe, expect, test } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("a new session's id", () => {
  test('Claude starts a new session with a fresh UUID each time', () => {
    const first = kitOf('claude').ids.newId()
    const second = kitOf('claude').ids.newId()
    expect(first).toMatch(UUID)
    expect(second).toMatch(UUID)
    expect(first).not.toBe(second)
  })

  test('Cursor picks its own: Menkar starts it with none', () => {
    expect(kitOf('cursor').ids.newId()).toBeNull()
  })
})

describe("a pane's session changing id", () => {
  test('Claude: a clear takes the old session’s place, a resume or start is another session, a compaction keeps it', () => {
    const follow = kitOf('claude').follow
    expect(follow?.classify('clear')).toBe('clear')
    expect(follow?.classify('resume')).toBe('resume')
    expect(follow?.classify('compact')).toBeNull()
  })

  test('Claude: a turn ending under another id follows nothing; its start record already did', () => {
    expect(kitOf('claude').follow?.classify(null, { to: 'x', paneStartedAt: 0 })).toBeNull()
  })
})
