// The Usage window's month stepper (docs/spec/usage.md, USG-45, USG-46).
import { expect, test } from 'vitest'
import { arrows, step } from '../../../src/core/usage/stepper'

const nov = { year: 2026, month: 11 }
const oct = { year: 2026, month: 10 }
const sep = { year: 2026, month: 9 }

test('USG-45 at the current month › is off; ‹ works down to the first month with data', () => {
  expect(arrows({ month: nov, all: false }, sep, nov)).toEqual({ previous: true, next: false })
  expect(arrows({ month: oct, all: false }, sep, nov)).toEqual({ previous: true, next: true })
  expect(arrows({ month: sep, all: false }, sep, nov)).toEqual({ previous: false, next: true })
})

test('with an empty history ‹ stays on', () => {
  expect(arrows({ month: { year: 2020, month: 1 }, all: false }, null, nov).previous).toBe(true)
})

test('USG-46 All turns both arrows off; an arrow turns All off and steps the month', () => {
  expect(arrows({ month: oct, all: true }, sep, nov)).toEqual({ previous: false, next: false })
  expect(step({ month: oct, all: true }, -1)).toEqual({ month: sep, all: false })
  expect(step({ month: { year: 2026, month: 12 }, all: false }, 1)).toEqual({
    month: { year: 2027, month: 1 },
    all: false,
  })
})
