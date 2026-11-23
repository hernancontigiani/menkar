// USG-81 in a zone half an hour off the hour: windows still fall on local quarter hours.
process.env.TZ = 'Asia/Kolkata'

import { expect, test } from 'vitest'
import { paneWindows } from '../../../src/core/usage/panes'
import { midnight } from '../../../src/core/usage/periods'
import { isoLocal } from '../../../src/core/usage/report'

test('USG-81 in Kolkata (+05:30) every window starts at a local quarter hour', () => {
  const start = midnight({ year: 2026, month: 11, day: 19 })
  const bounds = { start, end: start + 86_400 }
  const windows = paneWindows(
    [],
    [{ id: 's', at: start + 3 * 3600 + 7, sign: 'start' }],
    bounds,
    bounds.end,
  )
  expect(windows).toHaveLength(84)
  expect(isoLocal(windows[0]?.start ?? 0)).toBe('2026-11-19T03:00:00+05:30')
  for (const w of windows)
    expect(['00', '15', '30', '45']).toContain(isoLocal(w.start).slice(14, 16))
})
