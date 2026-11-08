// Periods are built from calendar dates in local time, never by adding 24 hours, which is an hour
// off across a daylight-saving change. A period is [start, end) in Unix seconds.

export interface Bounds {
  readonly start: number
  readonly end: number
}

export type Period = 'today' | '7d' | '30d' | 'all'
export type Bucket = 'hour' | 'day' | 'month'

const DAYS: Readonly<Record<Exclude<Period, 'all'>, number>> = { today: 1, '7d': 7, '30d': 30 }

export interface Day {
  readonly year: number
  readonly month: number // 1–12
  readonly day: number
}

export function midnight(d: Day): number {
  return new Date(d.year, d.month - 1, d.day).getTime() / 1000
}

export function localDay(seconds: number): Day {
  const d = new Date(seconds * 1000)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

export function addDays(d: Day, days: number): Day {
  const moved = new Date(d.year, d.month - 1, d.day + days)
  return { year: moved.getFullYear(), month: moved.getMonth() + 1, day: moved.getDate() }
}

function nextMonth(year: number, month: number): Day {
  return month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 }
}

export function periodBounds(period: Exclude<Period, 'all'>, nowSeconds: number): Bounds {
  const today = localDay(nowSeconds)
  return { start: midnight(addDays(today, 1 - DAYS[period])), end: midnight(addDays(today, 1)) }
}

export function monthBounds(year: number, month: number): Bounds {
  return { start: midnight({ year, month, day: 1 }), end: midnight(nextMonth(year, month)) }
}

// From the 1st of the month of the history's first turn (today, when it is empty) to tomorrow.
export function allBounds(firstOpened: number | null, nowSeconds: number): Bounds {
  const today = periodBounds('today', nowSeconds)
  if (firstOpened === null) return today
  const first = localDay(firstOpened)
  return { start: midnight({ year: first.year, month: first.month, day: 1 }), end: today.end }
}

// `--to` is included: [from 00:00, the day after to 00:00).
export function rangeBounds(from: Day, to: Day): Bounds {
  return { start: midnight(from), end: midnight(addDays(to, 1)) }
}

// [start, end) cut into local hours (3,600 s each from start, the last clipped), days or months
// (the last clipped to end); `start` is a boundary of that unit.
export function buckets(bounds: Bounds, unit: Bucket): Bounds[] {
  const found: Bounds[] = []
  if (unit === 'hour') {
    for (let at = bounds.start; at < bounds.end; at += 3600) {
      found.push({ start: at, end: Math.min(at + 3600, bounds.end) })
    }
    return found
  }
  let day = localDay(bounds.start)
  const stop = localDay(bounds.end)
  const before = (a: Day, b: Day) => midnight(a) < midnight(b)
  while (before(day, stop)) {
    let following = unit === 'day' ? addDays(day, 1) : nextMonth(day.year, day.month)
    if (!before(following, stop)) following = stop
    found.push({ start: midnight(day), end: midnight(following) })
    day = following
  }
  return found
}
