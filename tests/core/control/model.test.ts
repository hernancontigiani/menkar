// Decision 1.106: start_session's optional model becomes a command-line argument, so only a
// non-empty word that cannot be read as an option is taken.
import { describe, expect, test } from 'vitest'
import { readModel } from '../../../src/core/control/model'

describe("start_session's model", () => {
  test('a model named as the agent names it is taken as it is', () => {
    expect(readModel('sonnet')).toEqual({ model: 'sonnet' })
    expect(readModel('claude-opus-4-1[1m]')).toEqual({ model: 'claude-opus-4-1[1m]' })
  })

  test('no model is the default: nothing is passed', () => {
    expect(readModel(undefined)).toEqual({})
  })

  test.each([
    ['a space', 'son net'],
    ['a tab', 'sonnet\t'],
    ['a newline', 'sonnet\nrm'],
    ['a leading dash', '-p'],
    ['nothing', ''],
    ['not a string', 42],
  ])('a model with %s is refused, in our own sentence', (_, value) => {
    expect(readModel(value)).toEqual({
      refusal: 'The model must be one word, as the agent names it, not starting with "-".',
    })
  })
})
