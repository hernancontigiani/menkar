import { SHOWN_STATES, type ShownState } from '../agentstate/shown'
import type { PaneStateName, WatchSign } from './activity'

// A start or a tick covers until the next sign, at most this long: the next tick is due 900 s
// later, and the rest absorbs a busy main thread. So a crash overstates coverage by at most this.
export const COVER_SECONDS = 960
export const WINDOW_SECONDS = 900

export interface StoredPaneState {
  readonly id: string
  readonly at: number
  readonly seq: number
  readonly paneId: string
  readonly state: PaneStateName
}

export interface StoredSign {
  readonly id: string
  readonly at: number
  readonly sign: WatchSign
}

// What a reading needs: the rows and signs of its range, and before it each pane's last row since
// the latest start, the last sign and the latest start.
export interface PaneReading {
  readonly rows: readonly StoredPaneState[]
  readonly signs: readonly StoredSign[]
}

export interface Interval {
  readonly start: number
  readonly end: number
}

export type StateCounts = Record<ShownState, number>

export interface PaneWindow {
  readonly start: number
  readonly covered: number
  // null when no part of the window was covered: not measured, never "nothing happened"
  readonly counts: Record<ShownState, { max: number; seconds: number }> | null
}

const covers = (sign: WatchSign) => sign === 'start' || sign === 'tick'

// By time; at one instant a sign that covers goes before one that ends coverage, so a quit or a
// suspend at a tick's very second is not covered past.
function sortedSigns(signs: readonly StoredSign[]): StoredSign[] {
  return [...signs].sort(
    (a, b) =>
      a.at - b.at || Number(covers(b.sign)) - Number(covers(a.sign)) || (a.id < b.id ? -1 : 1),
  )
}

// The covered intervals, disjoint and in order. Read by time, a tick a clock set back wrote early
// can only cut a coverage short.
export function coverage(signs: readonly StoredSign[]): Interval[] {
  const sorted = sortedSigns(signs)
  const out: { start: number; end: number }[] = []
  sorted.forEach((s, i) => {
    if (!covers(s.sign)) return
    const next = sorted[i + 1]
    const end = Math.min(
      next === undefined ? Number.POSITIVE_INFINITY : next.at,
      s.at + COVER_SECONDS,
    )
    if (end <= s.at) return
    const last = out.at(-1)
    if (last !== undefined && last.end >= s.at) last.end = Math.max(last.end, end)
    else out.push({ start: s.at, end })
  })
  return out
}

export function covered(signs: readonly StoredSign[], t: number): boolean {
  return coverage(signs).some((c) => c.start <= t && t < c.end)
}

type Step =
  | { readonly at: number; readonly start: true }
  | { readonly at: number; readonly start: false; readonly row: StoredPaneState }

// The rows and the starts in the order they happened; a start goes before a row of its own
// second, which is after it.
function steps(rows: readonly StoredPaneState[], signs: readonly StoredSign[]): Step[] {
  const all: Step[] = [
    ...signs.filter((s) => s.sign === 'start').map((s) => ({ at: s.at, start: true as const })),
    ...rows.map((row) => ({ at: row.at, start: false as const, row })),
  ]
  return all.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at
    if (a.start || b.start) return Number(b.start) - Number(a.start)
    return a.row.seq - b.row.seq
  })
}

interface Segment {
  readonly state: ShownState
  readonly start: number
  readonly end: number
}

// Each pane's states as intervals: a row ends the one before it, a start ends every pane, and a
// closed pane has none. The last ones run to `end`.
function segments(
  rows: readonly StoredPaneState[],
  signs: readonly StoredSign[],
  end: number,
): Segment[] {
  const out: Segment[] = []
  const open = new Map<string, { state: ShownState; since: number }>()
  const close = (paneId: string, at: number) => {
    const current = open.get(paneId)
    if (current === undefined) return
    out.push({ state: current.state, start: current.since, end: at })
    open.delete(paneId)
  }
  for (const step of steps(rows, signs)) {
    if (step.at > end) break
    if (step.start) {
      for (const paneId of [...open.keys()]) close(paneId, step.at)
      continue
    }
    close(step.row.paneId, step.at)
    if (step.row.state !== 'closed') {
      open.set(step.row.paneId, { state: step.row.state, since: step.at })
    }
  }
  for (const paneId of [...open.keys()]) close(paneId, end)
  return out
}

const zeroCounts = (): StateCounts => ({ blocked: 0, working: 0, idle: 0, done: 0 })

// The panes in each state at `t`: each pane's last row at or before t, since the latest start at
// or before t, unless it closed.
export function stateAt(
  rows: readonly StoredPaneState[],
  signs: readonly StoredSign[],
  t: number,
): StateCounts {
  const open = new Map<string, PaneStateName>()
  for (const step of steps(rows, signs)) {
    if (step.at > t) break
    if (step.start) open.clear()
    else open.set(step.row.paneId, step.row.state)
  }
  const counts = zeroCounts()
  for (const state of open.values()) if (state !== 'closed') counts[state] += 1
  return counts
}

// One row per window from the one holding the range's start, or the first sign if later, to the
// last one starting before the range's end or now, whichever is first.
export function paneWindows(
  rows: readonly StoredPaneState[],
  signs: readonly StoredSign[],
  bounds: Interval,
  nowSeconds: number,
): PaneWindow[] {
  if (signs.length === 0) return []
  const firstSign = Math.min(...signs.map((s) => s.at))
  const end = Math.min(bounds.end, nowSeconds)
  const first = Math.floor(Math.max(bounds.start, firstSign) / WINDOW_SECONDS) * WINDOW_SECONDS
  if (first >= end) return []
  const count = Math.ceil((end - first) / WINDOW_SECONDS)
  const sums = Array.from({ length: count }, () => ({
    covered: 0,
    seconds: zeroCounts(),
    max: zeroCounts(),
  }))
  // Between two consecutive moments of change nothing changes: walk them once.
  const changes = new Map<number, { cover: number; states: StateCounts }>()
  const at = (t: number) => {
    let change = changes.get(t)
    if (change === undefined) {
      change = { cover: 0, states: zeroCounts() }
      changes.set(t, change)
    }
    return change
  }
  for (const c of coverage(signs)) {
    at(c.start).cover += 1
    at(c.end).cover -= 1
  }
  for (const s of segments(rows, signs, end)) {
    at(s.start).states[s.state] += 1
    at(s.end).states[s.state] -= 1
  }
  for (let w = first; w <= end; w += WINDOW_SECONDS) at(w)
  at(end)
  const times = [...changes.keys()].sort((a, b) => a - b)
  let cover = 0
  const now = zeroCounts()
  times.forEach((t, i) => {
    const change = changes.get(t)
    if (change === undefined) return
    cover += change.cover
    for (const state of SHOWN_STATES) now[state] += change.states[state]
    const next = times[i + 1]
    if (next === undefined || cover <= 0 || t < first || t >= end) return
    const length = Math.min(next, end) - t
    const sum = sums[Math.floor((t - first) / WINDOW_SECONDS)]
    if (sum === undefined || length <= 0) return
    sum.covered += length
    for (const state of SHOWN_STATES) {
      sum.seconds[state] += now[state] * length
      sum.max[state] = Math.max(sum.max[state], now[state])
    }
  })
  return sums.map((sum, i) => ({
    start: first + i * WINDOW_SECONDS,
    covered: sum.covered,
    counts:
      sum.covered === 0
        ? null
        : {
            blocked: { max: sum.max.blocked, seconds: sum.seconds.blocked },
            working: { max: sum.max.working, seconds: sum.seconds.working },
            idle: { max: sum.max.idle, seconds: sum.seconds.idle },
            done: { max: sum.max.done, seconds: sum.seconds.done },
          },
  }))
}

// The files' rows and signs laid over the history's, by id: a row read twice is one row.
export function mergeReadings(
  history: PaneReading,
  files: {
    readonly panes: ReadonlyMap<string, StoredPaneState>
    readonly signs: ReadonlyMap<string, StoredSign>
  },
): PaneReading {
  const rows = new Map(history.rows.map((r) => [r.id, r]))
  for (const r of files.panes.values()) rows.set(r.id, r)
  const signs = new Map(history.signs.map((s) => [s.id, s]))
  for (const s of files.signs.values()) signs.set(s.id, s)
  return { rows: [...rows.values()], signs: [...signs.values()] }
}

// What the history answers for a reading of [low, high), with the rows not imported yet.
export interface PaneHistory {
  paneReading(low: number, high: number): PaneReading
}

type PaneFiles = Parameters<typeof mergeReadings>[1]

// The files must be read before this is called: a row only moves journal → batch → history.
export function panesBetween(
  history: PaneHistory,
  files: PaneFiles,
  low: number,
  high: number,
): PaneReading {
  return mergeReadings(history.paneReading(low, high), files)
}

export function panesNow(history: PaneHistory, files: PaneFiles, nowSeconds: number): PaneReading {
  return panesBetween(history, files, nowSeconds, Number.MAX_VALUE)
}
