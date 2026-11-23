// USG-81 in a zone with a daylight-saving change: a window is 900 real seconds, keyed by its epoch.
process.env.TZ = 'Europe/Madrid'

import { expect, test } from 'vitest'
import { paneWindows, type StoredSign } from '../../../src/core/usage/panes'
import { isoLocal } from '../../../src/core/usage/report'

// 2026-10-25, 03:00 CEST becomes 02:00 CET: the hour from 02:00 is lived twice.
test('USG-81 the two windows labelled 02:00 in the fall-back hour have different offsets', () => {
  const first = Date.UTC(2026, 9, 25, 0, 0) / 1000 // 02:00+02:00
  const bounds = { start: first - 3600, end: first + 3 * 3600 }
  const signs: StoredSign[] = [{ id: 's', at: bounds.start, sign: 'start' }]
  for (let at = bounds.start + 900; at < bounds.end; at += 900)
    signs.push({ id: `t${at}`, at, sign: 'tick' })
  const windows = paneWindows(
    [{ id: 'r', at: bounds.start, seq: 1, paneId: 'A', state: 'idle' }],
    signs,
    bounds,
    bounds.end,
  )
  const twos = windows.filter((w) => isoLocal(w.start).slice(11, 16) === '02:00')
  expect(twos.map((w) => isoLocal(w.start))).toEqual([
    '2026-10-25T02:00:00+02:00',
    '2026-10-25T02:00:00+01:00',
  ])
  expect((twos[1]?.start ?? 0) - (twos[0]?.start ?? 0)).toBe(3600)
  expect(windows).toHaveLength(16)
  for (const w of windows) expect(w).toMatchObject({ covered: 900 })
  expect(windows.map((w) => w.start % 900)).toEqual(windows.map(() => 0))
})
