// Each agent pane's shown state, journaled with no content: what the counts of sessions blocked and
// working are read from.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { describe, expect, test } from 'vitest'
import { nextTick, type PaneRow, PaneStateRecorder } from '../../../src/core/activity/panes'

function recorder() {
  const rows: PaneRow[] = []
  return { rows, r: new PaneStateRecorder((row) => rows.push(row)) }
}

describe('the pane rows', () => {
  // USG-82: every shown change is one row stamped at its moment, with no hold; the open and the
  // close are rows, so an idle pane is known to exist and a closed one ends.
  test('USG-82 every shown change is one row at its moment; the open and the close are rows', () => {
    const { rows, r } = recorder()
    const t = 1000
    r.opened('A', 'idle', t)
    expect(rows).toEqual([{ paneId: 'A', state: 'idle', at: t, seq: 1 }])
    r.changed('A', 'working', t + 1)
    expect(rows).toHaveLength(2)
    r.changed('A', 'working', t + 2)
    expect(rows).toHaveLength(2)
    r.changed('A', 'done', t + 5)
    r.changed('A', 'idle', t + 9)
    r.closed('A', t + 10)
    expect(rows.slice(2)).toEqual([
      { paneId: 'A', state: 'done', at: t + 5, seq: 3 },
      { paneId: 'A', state: 'idle', at: t + 9, seq: 4 },
      { paneId: 'A', state: 'closed', at: t + 10, seq: 5 },
    ])
    r.changed('A', 'working', t + 11)
    r.closed('A', t + 12)
    expect(rows).toHaveLength(5)
  })

  test('two changes stamped the same second keep their order by sequence', () => {
    const { rows, r } = recorder()
    r.opened('B', 'working', 2000)
    r.changed('B', 'blocked', 2001)
    r.changed('B', 'working', 2001)
    const same = rows.filter((row) => row.at === 2001)
    expect(same.map((row) => [row.state, row.seq])).toEqual([
      ['blocked', 2],
      ['working', 3],
    ])
  })

  test('a pane opened in another state starts there; one never opened writes nothing', () => {
    const { rows, r } = recorder()
    r.opened('C', 'blocked', 3000)
    r.opened('C', 'idle', 3001)
    r.changed('X', 'working', 3002)
    r.closed('X', 3003)
    expect(rows).toEqual([{ paneId: 'C', state: 'blocked', at: 3000, seq: 1 }])
  })
})

describe('the quarter-hour tick', () => {
  const ms = (hour: number, minute: number, second = 0, milli = 0) =>
    new Date(2026, 10, 19, hour, minute, second, milli).getTime()

  test('the next tick is the next quarter hour strictly after now', () => {
    expect(nextTick(ms(10, 15))).toBe(ms(10, 30))
    expect(nextTick(ms(10, 14, 59, 999))).toBe(ms(10, 15))
    expect(nextTick(ms(10, 15, 0, 1))).toBe(ms(10, 30))
    expect(nextTick(ms(23, 50))).toBe(new Date(2026, 10, 20, 0, 0).getTime())
  })

  // The clock set back: the schedule is taken from the new time, never from the last tick.
  test('a clock set back gives the next boundary after the new time', () => {
    expect(nextTick(ms(9, 2))).toBe(ms(9, 15))
  })
})
