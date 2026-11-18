// Decision 1.176: the first time ever a worker's tab is closed into the background, a toast says it
// keeps running; `background_toast: true` in state.json then says it was shown.
import { describe, expect, test } from 'vitest'
import { backgroundToastShown, markBackgroundToast } from '../../src/core/background-toast'
import { parseState } from '../../src/core/state'

describe('the background toast', () => {
  test('not shown yet when the key is absent or anything but true', () => {
    expect(backgroundToastShown(parseState({}))).toBe(false)
    expect(backgroundToastShown(parseState({ background_toast: 'yes' }))).toBe(false)
    expect(backgroundToastShown(parseState({ background_toast: true }))).toBe(true)
  })

  test('marking it keeps every other key, and is shown from then on', () => {
    const state = markBackgroundToast(parseState({ muted: ['a'], settings: { x: 1 } }))
    expect(state.rest).toEqual({ muted: ['a'], settings: { x: 1 }, background_toast: true })
    expect(backgroundToastShown(state)).toBe(true)
  })
})
