import { describe, expect, test } from 'vitest'
import { localDay, readQuarantine } from '../../scripts/check-flaky.mjs'

const table = (rows: string[]) =>
  ['# Quarantine', '', '| test | reason | expires |', '|---|---|---|', ...rows].join('\n')

describe('check-flaky', () => {
  test('a row is due the day after the date it names, not on it', () => {
    const markdown = table(['| terminal opens | xvfb race | 2026-11-08 |'])
    expect(readQuarantine(markdown, '2026-11-08').expired).toEqual([])
    expect(readQuarantine(markdown, '2026-11-09').expired.map((r) => r.test)).toEqual([
      'terminal opens',
    ])
  })

  test('the header and separator are not rows, and an empty table has none', () => {
    expect(readQuarantine(table([]), '2026-11-08')).toEqual({ rows: [], expired: [], errors: [] })
  })

  test('a row whose expiry is not a date is an error', () => {
    const { errors } = readQuarantine(table(['| a | b | next month |']), '2026-11-08')
    expect(errors).toEqual(["FLAKY.md line 5: 'next month' is not a date (YYYY-MM-DD)"])
  })

  test('the day is the local one, also just before midnight', () => {
    expect(localDay(new Date(2026, 10, 8, 23, 59, 59))).toBe('2026-11-08')
    expect(localDay(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01')
  })
})
