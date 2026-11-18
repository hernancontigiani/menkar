// What Your time's plots need to place things: the count axis, a moment's x in a day, a band's
// label. No Node import.
import { formatDuration } from './nodes'
import type { Bounds } from './periods'

// Counts have no 2.5 step: the top is the first multiple of a 1, 2 or 5 × 10^n step at or above
// the tallest bar (never below 5), the step the smallest that leaves at most five intervals.
export function countAxis(tallest: number): { readonly top: number; readonly step: number } {
  const reach = Math.max(tallest, 5)
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const unit of [1, 2, 5]) {
      const step = unit * magnitude
      const top = Math.ceil(reach / step) * step
      if (top / step <= 5) return { top, step }
    }
  }
}

// By the moment's share of the day's seconds, so a 23- or 25-hour day is drawn true.
export function along(at: number, bounds: Bounds, width: number): number {
  const length = bounds.end - bounds.start
  return length <= 0 ? 0 : ((at - bounds.start) / length) * width
}

// A band's length, and whether it fits inside a band that many pixels wide.
export function bandLabel(
  seconds: number,
  pixels: number,
): { readonly text: string; readonly inside: boolean } {
  const text = formatDuration(seconds)
  return { text, inside: pixels > text.length * 6 + 14 }
}
