// Read-only tabs (decision 1.101): with the mode on, a session under the orchestrator takes no
// input until the human takes control of it ("with you"), except while it waits at a permission
// prompt; loose sessions and the orchestrator stay writable, and the mode off changes nothing.
import { describe, expect, test } from 'vitest'
import { bannerOf, readOnly, type Team } from '../../../src/core/orchestration/readonly'

const team = (on: boolean, withYou: string[] = []): Team => ({
  parents: { W: 'O', Y: 'O', G: 'L' },
  orchestration: { on, orchestrator: 'O', withYou },
})

describe('read-only tabs', () => {
  test('a child of the orchestrator, not with you, is read only', () => {
    expect(readOnly('W', team(true), 'working')).toBe(true)
    expect(readOnly('W', team(true), null)).toBe(true)
  })

  test('with you, it is writable', () => {
    expect(readOnly('Y', team(true, ['Y']), 'working')).toBe(false)
  })

  test('at a permission prompt (blocked), it is writable while it waits', () => {
    expect(readOnly('W', team(true), 'blocked')).toBe(false)
  })

  test('a loose session, a child of another session and the orchestrator are writable', () => {
    expect(readOnly('L', team(true), 'idle')).toBe(false)
    expect(readOnly('G', team(true), 'idle')).toBe(false)
    expect(readOnly('O', team(true), 'idle')).toBe(false)
  })

  test('mode off: nothing is read only', () => {
    expect(readOnly('W', team(false), 'idle')).toBe(false)
  })

  test('no session or no project: writable', () => {
    expect(readOnly(null, team(true), 'idle')).toBe(false)
    expect(readOnly('W', undefined, 'idle')).toBe(false)
  })

  test('the banners: yellow for a child, saying so at a prompt; blue with you; none for the rest', () => {
    expect(bannerOf('W', team(true), 'working')).toBe('reports')
    expect(bannerOf('W', team(true), 'blocked')).toBe('permission')
    expect(bannerOf('Y', team(true, ['Y']), 'blocked')).toBe('withYou')
    expect(bannerOf('L', team(true, ['L']), 'idle')).toBeNull()
    expect(bannerOf('O', team(true), 'idle')).toBeNull()
    expect(bannerOf('W', team(false), 'idle')).toBeNull()
  })
})
