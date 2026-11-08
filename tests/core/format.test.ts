import { describe, expect, test, vi } from 'vitest'
import { formatSize, formatTimestamp, formatTokens } from '../../src/core/format'

describe('formats shown', () => {
  test.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [37_274, '36.4 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [3.5 * 1024 ** 3, '3.5 GB'],
    [2048 * 1024 ** 3, '2048.0 GB'],
  ])('size %d is %s', (bytes, shown) => {
    expect(formatSize(bytes)).toBe(shown)
  })

  test.each([
    [999, '999'],
    [1000, '1.0k'],
    [15_400, '15.4k'],
    [1_000_000, '1.0M'],
    [2_345_678, '2.3M'],
  ])('tokens %d are %s', (n, shown) => {
    expect(formatTokens(n)).toBe(shown)
  })

  test('a timestamp is local YYYY-MM-DD HH:MM; one that does not parse is shown as written; none is —', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    try {
      expect(formatTimestamp('2026-11-09T02:59:30.511Z')).toBe('2026-11-08 23:59')
      expect(formatTimestamp('yesterday')).toBe('yesterday')
      expect(formatTimestamp(undefined)).toBe('—')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
