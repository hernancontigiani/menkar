// Decision 1.211: a bridge Menkar reads as connected puts its session on the Remote Control list.
import { describe, expect, test } from 'vitest'
import { type BridgeSeen, bridgeStep, NOT_SEEN } from '../../../src/core/remote/remember'

const ID = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'
const none = () => false
const all = () => true

describe('bridgeStep', () => {
  test('connected and not listed: the session is remembered', () => {
    expect(bridgeStep(NOT_SEEN, 'on', ID, none).remember).toBe(ID)
    expect(bridgeStep({ last: 'off', owed: false }, 'on', ID, none).remember).toBe(ID)
  })

  test('connected and already listed: nothing is written', () => {
    expect(bridgeStep(NOT_SEEN, 'on', ID, all).remember).toBeNull()
  })

  test('a connection that stays on is not remembered again, so an uncheck holds', () => {
    const first = bridgeStep(NOT_SEEN, 'on', ID, none)
    expect(bridgeStep(first.seen, 'on', ID, none).remember).toBeNull()
  })

  test('an unknown reading in between is not a new connection', () => {
    const first = bridgeStep(NOT_SEEN, 'on', ID, none)
    const blip = bridgeStep(first.seen, 'unknown', ID, none)
    expect(blip.remember).toBeNull()
    expect(bridgeStep(blip.seen, 'on', ID, none).remember).toBeNull()
  })

  test('disconnected: nothing is remembered, and nothing removed', () => {
    const on: BridgeSeen = { last: 'on', owed: false }
    expect(bridgeStep(on, 'off', ID, all).remember).toBeNull()
    expect(bridgeStep(NOT_SEEN, 'off', ID, none).remember).toBeNull()
  })

  test('unknown is not connected', () => {
    expect(bridgeStep(NOT_SEEN, 'unknown', ID, none).remember).toBeNull()
    expect(bridgeStep({ last: 'off', owed: false }, 'unknown', ID, none).remember).toBeNull()
  })

  test('connected again after a disconnect is remembered again', () => {
    const off = bridgeStep({ last: 'on', owed: false }, 'off', ID, none)
    expect(bridgeStep(off.seen, 'on', ID, none).remember).toBe(ID)
  })

  test('a connection seen before the session is known is remembered once it is', () => {
    const early = bridgeStep(NOT_SEEN, 'on', null, none)
    expect(early.remember).toBeNull()
    expect(bridgeStep(early.seen, 'on', ID, none).remember).toBe(ID)
  })
})
