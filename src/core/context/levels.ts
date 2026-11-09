// The context ring's levels: the one definition the ring, the reading and the settings share. No
// Node import: the window and Preferences use it as is.

export type Level = 'ok' | 'warn' | 'full'

// Yellow from `warn` %, red from `full` %; green is everything below yellow.
export interface Thresholds {
  readonly warn: number
  readonly full: number
}

export const DEFAULT_THRESHOLDS: Thresholds = { warn: 60, full: 90 }

const valid = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 100

// Two edges are kept only together: whole numbers from 1 to 100, yellow below red. Anything else
// is the defaults, both of them, so the three ranges always cover 0–100 without a gap.
export function thresholdsOf(warn: unknown, full: unknown): Thresholds {
  return valid(warn) && valid(full) && warn < full ? { warn, full } : DEFAULT_THRESHOLDS
}

export function level(percentage: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): Level {
  return percentage >= thresholds.full ? 'full' : percentage >= thresholds.warn ? 'warn' : 'ok'
}
