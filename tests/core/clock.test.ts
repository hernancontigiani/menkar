import { afterEach, expect, test, vi } from 'vitest'
import { now } from '../../src/core/clock'

afterEach(() => {
  vi.useRealTimers()
})

test('the clock reads the time a test sets, across midnight', () => {
  vi.useFakeTimers()
  const beforeMidnight = Date.UTC(2026, 10, 8, 23, 59, 30)
  vi.setSystemTime(beforeMidnight)
  expect(now()).toBe(beforeMidnight)
  vi.advanceTimersByTime(60_000)
  expect(now()).toBe(Date.UTC(2026, 10, 9, 0, 0, 30))
})
