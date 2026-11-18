// Placing Your time's figures: the count axis (1.14's rule, without 2.5) and a day's x.
process.env.TZ = 'America/Santiago'

import { describe, expect, test } from 'vitest'
import { addDays, midnight } from '../../../src/core/usage/periods'
import { along, bandLabel, countAxis } from '../../../src/core/usage/timeline'

describe('countAxis', () => {
  test('3 → top 5 step 1; 12 → 15 step 5; 37 → 40 step 10; 0 → 5 step 1', () => {
    expect(countAxis(3)).toEqual({ top: 5, step: 1 })
    expect(countAxis(12)).toEqual({ top: 15, step: 5 })
    expect(countAxis(37)).toEqual({ top: 40, step: 10 })
    expect(countAxis(0)).toEqual({ top: 5, step: 1 })
    expect(countAxis(5)).toEqual({ top: 5, step: 1 })
    expect(countAxis(6)).toEqual({ top: 6, step: 2 })
    expect(countAxis(240)).toEqual({ top: 250, step: 50 })
  })
})

describe('along', () => {
  // Santiago's clocks go back an hour at midnight on Apr 5, 2026: Apr 4 runs 25 hours.
  test('the middle of a 25-hour day is half the width, not 12/24', () => {
    const d = { year: 2026, month: 4, day: 4 }
    const bounds = { start: midnight(d), end: midnight(addDays(d, 1)) }
    expect(bounds.end - bounds.start).toBe(25 * 3600)
    expect(along(bounds.start + 12.5 * 3600, bounds, 600)).toBe(300)
    expect(along(bounds.start, bounds, 600)).toBe(0)
    expect(along(bounds.end, bounds, 600)).toBe(600)
  })
})

describe('bandLabel', () => {
  test("a band's length, inside when it fits", () => {
    expect(bandLabel(4.1 * 3600, 200)).toEqual({ text: '4.1h', inside: true })
    expect(bandLabel(12 * 60, 20)).toEqual({ text: '12m', inside: false })
  })
})
