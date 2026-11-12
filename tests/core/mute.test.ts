// Mute (decision 1.104): `muted` in state.json, ids only, sorted; a session that takes a new id
// (a clear, a resume, a renew, a reused name) keeps its mute under the new one.
import { describe, expect, test } from 'vitest'
import { followMuted, mutedList, setMuted } from '../../src/core/mute'
import { parseState } from '../../src/core/state'

describe('mute', () => {
  test('only string ids are muted; no key is an empty list', () => {
    expect(mutedList(parseState({ muted: ['a', 3, null] }))).toEqual(['a'])
    expect(mutedList(parseState({}))).toEqual([])
  })

  test('toggling keeps the list sorted and once; other keys stay', () => {
    let state = parseState({ muted: ['c'], settings: { x: 1 } })
    state = setMuted(state, 'b', true)
    state = setMuted(state, 'b', true)
    expect(state.rest).toEqual({ muted: ['b', 'c'], settings: { x: 1 } })
    expect(mutedList(setMuted(state, 'c', false))).toEqual(['b'])
  })

  test('X muted, X takes the new id Y: Y is muted and X is not', () => {
    const state = parseState({ muted: ['X', 'z'] })
    const followed = followMuted(state, 'X', 'Y')
    expect(mutedList(followed)).toEqual(['Y', 'z'])
    expect(mutedList(followed)).not.toContain('X')
    expect(followMuted(state, 'plain', 'other')).toBe(state)
  })
})
