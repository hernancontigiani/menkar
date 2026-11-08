import type { Reading } from './context/types'
import type { Key } from './i18n'

// The context ring, drawn the same in every theme and style.
export const RING_COLORS = {
  ok: 'rgb(102,191,115)',
  warn: 'rgb(242,191,64)',
  full: 'rgb(235,84,84)',
} as const
export const RING_SIZE = 14
export const RING_RADIUS = 5.5
export const RING_STROKE = 2.5
const TRACK_OPACITY = 0.25
const ESTIMATE_SCALE = 0.45

export interface Ring {
  readonly color: string
  readonly trackOpacity: number
  readonly arcOpacity: number
  // The arc's share of the circle, 0 to 1, from 12 o'clock clockwise.
  readonly fraction: number
  readonly title: { readonly key: Key; readonly values: Readonly<Record<string, string>> }
}

export function ringOf(reading: Reading): Ring {
  const color =
    reading.percentage >= 80
      ? RING_COLORS.full
      : reading.percentage >= 60
        ? RING_COLORS.warn
        : RING_COLORS.ok
  const scale = reading.source === 'estimate' ? ESTIMATE_SCALE : 1
  const windowText =
    reading.window >= 1_000_000
      ? `${Math.round(reading.window / 1_000_000)}M`
      : `${Math.round(reading.window / 1000)}k`
  return {
    color,
    trackOpacity: TRACK_OPACITY * scale,
    arcOpacity: scale,
    fraction: Math.max(0, Math.min(100, reading.percentage)) / 100,
    title: {
      key: reading.source === 'estimate' ? 'ring.estimate' : 'ring.reported',
      values: { pct: String(Math.round(reading.percentage)), window: windowText },
    },
  }
}
