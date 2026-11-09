import { describe, expect, it } from 'vitest'
import { RING_COLORS, RING_RADIUS, RING_SIZE, RING_STROKE, ringOf } from '../../src/core/ring'

const reading = (
  percentage: number,
  source: 'statusline' | 'estimate' = 'statusline',
  window = 200_000,
) => ({
  percentage,
  window,
  source,
})

describe('the context ring', () => {
  it('LOOK-18 green below 60 %, yellow from 60 to 89, red from 90 (decision 1.22); full at 100 and above', () => {
    expect(RING_COLORS).toEqual({
      ok: 'rgb(102,191,115)',
      warn: 'rgb(242,191,64)',
      full: 'rgb(235,84,84)',
    })
    expect([59, 60, 89, 90, 100, 130].map((p) => ringOf(reading(p)).color)).toEqual([
      RING_COLORS.ok,
      RING_COLORS.warn,
      RING_COLORS.warn,
      RING_COLORS.full,
      RING_COLORS.full,
      RING_COLORS.full,
    ])
    expect(ringOf(reading(100)).fraction).toBe(1)
    const custom = { warn: 30, full: 50 }
    expect([29, 30, 49, 50].map((p) => ringOf(reading(p), custom).color)).toEqual([
      RING_COLORS.ok,
      RING_COLORS.warn,
      RING_COLORS.warn,
      RING_COLORS.full,
    ])
    expect(ringOf(reading(130)).fraction).toBe(1)
  })

  it('LOOK-19 at 25 %: track at 25 % opacity, a quarter arc at full, 2.5 px stroke, radius 5.5 in 14 × 14', () => {
    const r = ringOf(reading(25))
    expect([r.trackOpacity, r.arcOpacity, r.fraction]).toEqual([0.25, 1, 0.25])
    expect([RING_STROKE, RING_RADIUS, RING_SIZE]).toEqual([2.5, 5.5, 14])
    expect(r.title).toEqual({ key: 'ring.reported', values: { pct: '25', window: '200k' } })
  })

  it('LOOK-19 an estimate draws at 45 % of those opacities and says so; a million-token window reads 1M', () => {
    const r = ringOf(reading(25, 'estimate'))
    expect([r.trackOpacity, r.arcOpacity]).toEqual([0.25 * 0.45, 0.45])
    expect(r.title).toEqual({ key: 'ring.estimate', values: { pct: '25', window: '200k' } })
    expect(ringOf(reading(25, 'statusline', 1_000_000)).title.values.window).toBe('1M')
  })
})
