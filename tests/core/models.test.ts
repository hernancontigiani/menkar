// Decision 1.108: Menkar remembers the model a session was started with (`models` in state.json)
// and passes it again when the session renews; it follows the session to a new id.
import { describe, expect, test } from 'vitest'
import { buildCommand } from '../../src/core/command'
import { followModel, modelOf, setModel } from '../../src/core/models'
import { parseState } from '../../src/core/state'

const opts = { cli: '/usr/bin/claude', settings: '/s.json' }

describe("a session's model", () => {
  test('started with sonnet, then renewed: the new command has --model sonnet', () => {
    const started = setModel(parseState({}), 'old', 'sonnet')
    const renewed = followModel(started, 'old', 'new')
    const model = modelOf(renewed, 'new')
    expect(
      buildCommand(
        'claude',
        { kind: 'new', id: 'new', name: 'w', ...(model ? { model } : {}) },
        opts,
      ),
    ).toBe('/usr/bin/claude --session-id new -n w --model sonnet --settings /s.json && exit\n')
  })

  test('started without a model: nothing is written, and a renew passes none', () => {
    const state = parseState({ settings: { x: 1 } })
    const renewed = followModel(state, 'old', 'new')
    expect(renewed).toBe(state)
    expect(modelOf(renewed, 'new')).toBeUndefined()
    expect(renewed.rest).toEqual({ settings: { x: 1 } })
  })

  test('/clear X → Y: Y keeps the model, X drops it; other sessions and keys stay', () => {
    const state = parseState({ models: { X: 'sonnet', Z: 'haiku' }, settings: { x: 1 } })
    const followed = followModel(state, 'X', 'Y')
    expect(followed.rest).toEqual({ models: { Y: 'sonnet', Z: 'haiku' }, settings: { x: 1 } })
    expect(modelOf(followed, 'X')).toBeUndefined()
  })

  test('read leniently: a value that is not a non-empty string is dropped; no key is no models', () => {
    const state = parseState({ models: { a: 'sonnet', b: 3, c: null, d: '' } })
    expect(modelOf(state, 'a')).toBe('sonnet')
    for (const id of ['b', 'c', 'd']) expect(modelOf(state, id)).toBeUndefined()
    expect(modelOf(parseState({ models: ['sonnet'] }), '0')).toBeUndefined()
    expect(modelOf(parseState({}), 'a')).toBeUndefined()
    expect(setModel(state, 'e', 'opus').rest).toEqual({ models: { a: 'sonnet', e: 'opus' } })
  })
})
