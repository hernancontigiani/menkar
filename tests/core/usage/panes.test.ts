// How many sessions were blocked, working, idle or done, per 15-minute window, over the part of it
// Menkar was watching (decision 1.204 (b)).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { describe, expect, test } from 'vitest'
import type { PaneStateName, WatchSign } from '../../../src/core/usage/activity'
import { UsageHistory } from '../../../src/core/usage/history'
import {
  coverage,
  type PaneWindow,
  paneWindows,
  type StoredPaneState,
  type StoredSign,
  stateAt,
} from '../../../src/core/usage/panes'
import { midnight } from '../../../src/core/usage/periods'
import { historyRows, usageDirs } from '../../factories/usage'

const hm = (hour: number, minute: number, second = 0) =>
  new Date(2026, 10, 19, hour, minute, second).getTime() / 1000
const DAY = {
  start: midnight({ year: 2026, month: 11, day: 19 }),
  end: midnight({ year: 2026, month: 11, day: 20 }),
}

let n = 0
const row = (paneId: string, state: PaneStateName, at: number): StoredPaneState => {
  n += 1
  return { id: `r${n}`, paneId, state, at, seq: n }
}
const sign = (s: WatchSign, at: number): StoredSign => {
  n += 1
  return { id: `s${n}`, sign: s, at }
}
// a start and a tick every quarter hour after it, to `last`
const watched = (from: number, last: number): StoredSign[] => {
  const signs = [sign('start', from)]
  for (let at = from + 900; at <= last; at += 900) signs.push(sign('tick', at))
  return signs
}
const at = (windows: readonly PaneWindow[], start: number) => {
  const found = windows.find((w) => w.start === start)
  if (found === undefined) throw new Error(`no window at ${start}`)
  return found
}

describe('the 15-minute windows', () => {
  // USG-76: a window's counts are the peak at once and the pane-seconds over its covered part.
  test('USG-76 a window holds each state’s peak and pane-seconds over its covered part', () => {
    const signs = watched(hm(9, 0), hm(10, 0))
    const rows = [
      row('A', 'idle', hm(9, 0)),
      row('B', 'idle', hm(9, 0)),
      row('B', 'working', hm(9, 50)),
      row('A', 'working', hm(10, 3)),
      row('A', 'blocked', hm(10, 5)),
      row('B', 'done', hm(10, 6)),
      row('A', 'working', hm(10, 8)),
      row('A', 'done', hm(10, 12)),
    ]
    const w = at(paneWindows(rows, signs, DAY, hm(10, 20)), hm(10, 0))
    expect(w).toEqual({
      start: hm(10, 0),
      covered: 900,
      counts: {
        blocked: { max: 1, seconds: 180 },
        working: { max: 2, seconds: 720 },
        idle: { max: 1, seconds: 180 },
        done: { max: 2, seconds: 720 },
      },
    })
  })

  // USG-77: with no sign after a crash, coverage ends 960 s after the last one.
  test('USG-77 a crash ends coverage 960 s after the last sign', () => {
    const signs = watched(hm(9, 0), hm(11, 0))
    const rows = [row('A', 'idle', hm(9, 0)), row('A', 'working', hm(10, 50))]
    const windows = paneWindows(rows, signs, DAY, hm(12, 0))
    expect(at(windows, hm(11, 0))).toMatchObject({
      covered: 900,
      counts: { working: { max: 1, seconds: 900 }, idle: { max: 0, seconds: 0 } },
    })
    expect(at(windows, hm(11, 15))).toMatchObject({
      covered: 60,
      counts: { working: { max: 1, seconds: 60 } },
    })
    expect(at(windows, hm(11, 30))).toEqual({ start: hm(11, 30), covered: 0, counts: null })
  })

  // USG-78: a quit ends coverage; the panes it left are void at the next start.
  test('USG-78 a quit ends coverage; the next start voids the panes', () => {
    const signs = [
      ...watched(hm(9, 0), hm(10, 0)),
      sign('quit', hm(10, 7)),
      sign('start', hm(10, 30)),
    ]
    const rows = [
      row('A', 'idle', hm(9, 0)),
      row('A', 'working', hm(9, 55)),
      row('B', 'idle', hm(10, 30)),
    ]
    const windows = paneWindows(rows, signs, DAY, hm(10, 50))
    expect(at(windows, hm(10, 0))).toMatchObject({
      covered: 420,
      counts: { working: { max: 1, seconds: 420 } },
    })
    expect(at(windows, hm(10, 15))).toEqual({ start: hm(10, 15), covered: 0, counts: null })
    expect(at(windows, hm(10, 30))).toMatchObject({
      covered: 900,
      counts: { working: { max: 0, seconds: 0 }, idle: { max: 1, seconds: 900 } },
    })
  })

  // USG-79: a start voids every pane before it; a row at the start's own second is after it.
  test('USG-79 a start voids every earlier pane, and a row at its moment counts', () => {
    const signs = [...watched(hm(11, 0), hm(11, 45)), sign('start', hm(12, 0))]
    const rows = [
      row('A', 'idle', hm(11, 0)),
      row('A', 'working', hm(11, 50)),
      row('B', 'idle', hm(12, 0)),
    ]
    expect(at(paneWindows(rows, signs, DAY, hm(12, 20)), hm(12, 0))).toEqual({
      start: hm(12, 0),
      covered: 900,
      counts: {
        blocked: { max: 0, seconds: 0 },
        working: { max: 0, seconds: 0 },
        idle: { max: 1, seconds: 900 },
        done: { max: 0, seconds: 0 },
      },
    })
  })

  // USG-86: a suspend ends coverage at once; the tick written on resume starts it again.
  test('USG-86 a suspend ends coverage; the resume tick starts it again', () => {
    const signs = [
      ...watched(hm(9, 0), hm(10, 0)),
      sign('suspend', hm(10, 5)),
      sign('tick', hm(13, 0)),
      sign('tick', hm(13, 15)),
    ]
    const rows = [row('A', 'idle', hm(9, 0)), row('A', 'blocked', hm(9, 58))]
    const windows = paneWindows(rows, signs, DAY, hm(13, 40))
    expect(at(windows, hm(10, 0))).toMatchObject({
      covered: 300,
      counts: { blocked: { max: 1, seconds: 300 } },
    })
    for (let w = hm(10, 15); w <= hm(12, 45); w += 900) {
      expect(at(windows, w)).toEqual({ start: w, covered: 0, counts: null })
    }
    expect(at(windows, hm(13, 0))).toMatchObject({
      covered: 900,
      counts: { blocked: { max: 1, seconds: 900 } },
    })
  })

  // A clock set back writes a tick earlier than one before it: read by time, coverage can only
  // shorten, and no pane's state changes.
  test('a tick written after a clock set back changes no pane and only shortens coverage', () => {
    const signs = [...watched(hm(9, 0), hm(10, 15))]
    const rows = [row('A', 'idle', hm(9, 0)), row('A', 'working', hm(9, 50))]
    const before = paneWindows(rows, signs, DAY, hm(10, 40))
    const after = paneWindows(rows, [...signs, sign('tick', hm(10, 7))], DAY, hm(10, 40))
    expect(after).toEqual(before)
    const late = paneWindows(rows, [...signs, sign('quit', hm(10, 10))], DAY, hm(10, 40))
    expect(at(late, hm(10, 0))).toMatchObject({
      covered: 600,
      counts: { working: { max: 1, seconds: 600 } },
    })
    expect(at(late, hm(10, 15))).toEqual(at(before, hm(10, 15)))
  })

  test('the window holding now is partial, and none is after now', () => {
    const signs = watched(hm(9, 0), hm(10, 0))
    const windows = paneWindows([row('A', 'working', hm(9, 0))], signs, DAY, hm(10, 14))
    expect(windows.at(-1)).toMatchObject({
      start: hm(10, 0),
      covered: 840,
      counts: { working: { max: 1, seconds: 840 } },
    })
  })

  test('the pane-seconds of a covered window add up to the panes times its covered seconds', () => {
    const signs = watched(hm(9, 0), hm(10, 0))
    const rows = [
      row('A', 'idle', hm(9, 0)),
      row('B', 'idle', hm(9, 0)),
      row('A', 'working', hm(10, 3)),
      row('B', 'blocked', hm(10, 6)),
    ]
    const w = at(paneWindows(rows, signs, DAY, hm(10, 20)), hm(10, 0))
    const total = Object.values(w.counts ?? {}).reduce((sum, c) => sum + c.seconds, 0)
    expect(total).toBe(2 * 900)
  })
})

describe('a state at a moment', () => {
  test('the panes by state at t: closed ones and those before the latest start are not counted', () => {
    const signs = [sign('start', hm(9, 0)), sign('start', hm(10, 0)), sign('tick', hm(10, 15))]
    const rows = [
      row('F', 'working', hm(9, 30)),
      row('A', 'blocked', hm(10, 1)),
      row('B', 'working', hm(10, 2)),
      row('C', 'done', hm(10, 3)),
      row('D', 'idle', hm(10, 4)),
      row('E', 'working', hm(10, 5)),
      row('E', 'closed', hm(10, 6)),
    ]
    expect(stateAt(rows, signs, hm(10, 20))).toEqual({ blocked: 1, working: 1, idle: 1, done: 1 })
    expect(stateAt(rows, signs, hm(10, 1, 30))).toEqual({
      blocked: 1,
      working: 0,
      idle: 0,
      done: 0,
    })
  })

  test('coverage: a start or a tick covers to the next sign or 960 s; a quit covers nothing', () => {
    expect(
      coverage([sign('start', 100), sign('tick', 1000), sign('quit', 1100), sign('tick', 5000)]),
    ).toEqual([
      { start: 100, end: 1100 },
      { start: 5000, end: 5960 },
    ])
  })
})

describe('the rows read from the history', () => {
  // USG-83: every window gets a row, covered or not; none before recording began; an app_start of
  // an older Menkar, stored long before any pane row, is not a sign.
  test('USG-83 every window gets a row; none before recording began; old app_starts are not signs', () => {
    const dirs = usageDirs('panes-usg83')
    const history = new UsageHistory(dirs.history)
    historyRows(history).activity('old', hm(8, 10), 'app_start')
    const raw = history.handle?.raw
    raw?.prepare("INSERT INTO watch_signs VALUES ('s1', ?, 'start')").run(hm(9, 0))
    raw?.prepare("INSERT INTO watch_signs VALUES ('s2', ?, 'tick')").run(hm(9, 45))
    const bounds = { start: hm(8, 0), end: hm(10, 0) }
    const read = history.paneReading(bounds.start, bounds.end)
    const windows = paneWindows(read.rows, read.signs, bounds, hm(12, 0))
    expect(windows.map((w) => [w.start, w.covered])).toEqual([
      [hm(9, 0), 900],
      [hm(9, 15), 60],
      [hm(9, 30), 0],
      [hm(9, 45), 900],
    ])
    history.close()
  })

  // Before the range only what the range needs: each pane's last row since the latest start, the
  // last sign and the latest start.
  test('before the range: each pane’s last row since the latest start, the last sign and that start', () => {
    const dirs = usageDirs('panes-before')
    const history = new UsageHistory(dirs.history)
    const raw = history.handle?.raw
    const pane = raw?.prepare('INSERT INTO pane_states VALUES (?, ?, ?, ?, ?)')
    const watch = raw?.prepare('INSERT INTO watch_signs VALUES (?, ?, ?)')
    watch?.run('s0', hm(8, 0), 'start')
    pane?.run('old', hm(8, 5), 1, 'A', 'working')
    watch?.run('s1', hm(9, 0), 'start')
    watch?.run('s2', hm(9, 15), 'tick')
    watch?.run('s3', hm(9, 45), 'tick')
    pane?.run('b1', hm(9, 10), 1, 'B', 'idle')
    pane?.run('b2', hm(9, 20), 2, 'B', 'working')
    pane?.run('b3', hm(9, 20), 3, 'B', 'blocked')
    pane?.run('c1', hm(9, 0), 4, 'C', 'idle')
    pane?.run('in', hm(10, 5), 5, 'B', 'working')
    pane?.run('after', hm(11, 5), 6, 'B', 'idle')
    watch?.run('s4', hm(10, 0), 'tick')
    watch?.run('s5', hm(11, 0), 'tick')
    const read = history.paneReading(hm(10, 0), hm(11, 0))
    expect(read.rows.map((r) => r.id).sort()).toEqual(['b3', 'c1', 'in'])
    expect(read.signs.map((s) => s.id).sort()).toEqual(['s1', 's3', 's4'])
    history.close()
  })
})
