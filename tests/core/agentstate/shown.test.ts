// From raw to shown state, the roll-up, the blocked count, the check timing and the notification
// plan (docs/spec/agent-state.md, AST-17 to AST-31).
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { RawState } from '../../../src/core/agentstate/detect'
import { notifySettings, plan, SOUNDS } from '../../../src/core/agentstate/notify'
import {
  afterSeen,
  blockedCounts,
  faceBadge,
  groupState,
  nextShown,
  notifies,
  type PaneState,
  rollup,
  type ShownState,
} from '../../../src/core/agentstate/shown'
import { CHECK_DELAY_MS, PaneWatcher } from '../../../src/core/agentstate/watch'
import { now } from '../../../src/core/clock'

// A pane's raw states in order, with whether it was seen at each, through the shown-state rules;
// the shown states and the notifications that fired.
function walk(steps: readonly [RawState, boolean][]) {
  let state: ShownState = 'idle'
  const shown: ShownState[] = []
  const fired: ShownState[] = []
  for (const [raw, seen] of steps) {
    const next = nextShown(state, raw, seen)
    if (notifies(state, next, seen)) fired.push(next)
    state = next
    shown.push(state)
  }
  return { shown, fired }
}

function fakePane(foreground = true) {
  let listener = () => {}
  const pane = {
    provider: 'claude',
    title: '✳ Ready',
    screen: '',
    fg: foreground,
    reads: 0,
  }
  return {
    pane,
    watched: {
      provider: pane.provider,
      foreground: () => pane.fg,
      mirror: {
        title: () => pane.title,
        screen: () => {
          pane.reads += 1
          return pane.screen
        },
        onChange: (l: () => void) => {
          listener = l
          return () => {}
        },
      },
    },
    change: () => listener(),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('when the state is read', () => {
  test('AST-17 back at the shell prompt the pane is idle, whatever the screen shows', () => {
    vi.useFakeTimers()
    const { pane, watched, change } = fakePane()
    const reports: RawState[] = []
    new PaneWatcher(watched, (raw) => reports.push(raw))
    pane.screen = 'Do you want to proceed?'
    change()
    vi.advanceTimersByTime(CHECK_DELAY_MS)
    pane.fg = false
    change()
    vi.advanceTimersByTime(CHECK_DELAY_MS)
    expect(reports).toEqual(['blocked', 'idle'])
  })

  test('AST-19 output at 0, 100 and 200 ms makes one check, at 250 ms', () => {
    vi.useFakeTimers()
    const { pane, watched, change } = fakePane()
    const reports: number[] = []
    const started = now()
    new PaneWatcher(watched, () => reports.push(now() - started))
    pane.title = '⠋ Working'
    change()
    vi.advanceTimersByTime(100)
    change()
    vi.advanceTimersByTime(100)
    change()
    vi.advanceTimersByTime(49)
    expect(reports).toEqual([])
    vi.advanceTimersByTime(1)
    expect(reports).toEqual([250])
    expect(pane.reads).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(reports).toHaveLength(1)
    expect(pane.reads).toBe(1)
  })

  test('a state equal to the last one reported is not reported again; a new pane starts idle', () => {
    vi.useFakeTimers()
    const { pane, watched, change } = fakePane()
    const reports: RawState[] = []
    new PaneWatcher(watched, (raw) => reports.push(raw))
    change()
    vi.advanceTimersByTime(CHECK_DELAY_MS)
    pane.title = '⠋ Busy'
    change()
    vi.advanceTimersByTime(CHECK_DELAY_MS)
    change()
    vi.advanceTimersByTime(CHECK_DELAY_MS)
    expect(reports).toEqual(['working'])
  })
})

describe('done and seen', () => {
  test('AST-20 working then idle while unseen is done and notifies; seeing it makes it idle', () => {
    const { shown, fired } = walk([
      ['working', false],
      ['idle', false],
    ])
    expect(shown).toEqual(['working', 'done'])
    expect(fired).toEqual(['done'])
    expect(afterSeen('done')).toBe('idle')
  })

  test('AST-21 the same in the tab being looked at is idle, with no notification', () => {
    expect(
      walk([
        ['working', true],
        ['idle', true],
      ]),
    ).toEqual({ shown: ['working', 'idle'], fired: [] })
  })

  test('AST-22 the window not focused counts as unseen: done, then idle once focused', () => {
    expect(
      walk([
        ['working', false],
        ['idle', false],
      ]).shown.at(-1),
    ).toBe('done')
    expect(afterSeen('done')).toBe('idle')
    expect(afterSeen('working')).toBe('working')
    expect(afterSeen('blocked')).toBe('blocked')
  })

  test('a pane that becomes blocked while looked at notifies nothing', () => {
    expect(walk([['blocked', true]])).toEqual({ shown: ['blocked'], fired: [] })
  })

  test('AST-23 blocked then idle while unseen is idle, not done, and notifies nothing for it', () => {
    expect(
      walk([
        ['blocked', false],
        ['idle', false],
      ]),
    ).toEqual({ shown: ['blocked', 'idle'], fired: ['blocked'] })
  })

  test('AST-24 becoming blocked notifies once; blocked again notifies nothing', () => {
    expect(
      walk([
        ['idle', false],
        ['blocked', false],
        ['blocked', false],
      ]).fired,
    ).toEqual(['blocked'])
  })

  test('a done pane that turns working is working; idle again while unseen is done again', () => {
    expect(
      walk([
        ['working', false],
        ['idle', false],
        ['working', false],
        ['idle', false],
      ]).shown,
    ).toEqual(['working', 'done', 'working', 'done'])
  })
})

describe('notifications', () => {
  test('AST-24 a blocked pane plays the warning sound; a done one the completion sound', () => {
    const on = { notifyIdle: true, notifySound: true }
    expect(plan('blocked', false, on)).toEqual({
      sound: SOUNDS.blocked,
      show: 'desktop',
      kind: 'blocked',
    })
    expect(plan('done', false, on).sound).toBe('/usr/share/sounds/freedesktop/stereo/complete.oga')
    expect(SOUNDS.blocked).toBe('/usr/share/sounds/freedesktop/stereo/dialog-warning.oga')
  })

  test('AST-25 in the focused window the notice is a toast; elsewhere a desktop notification', () => {
    const on = { notifyIdle: true, notifySound: true }
    expect(plan('blocked', true, on).show).toBe('toast')
    expect(plan('blocked', false, on).show).toBe('desktop')
  })

  test.each([
    [{ notify_sound: false }, null, 'desktop'],
    [{ notify_idle: false }, SOUNDS.done, null],
    [{ notify_idle: false, notify_sound: false }, null, null],
    [{}, SOUNDS.done, 'desktop'],
  ])('AST-26, PRF-19 settings %j: sound %s, notice %s', (settings, sound, show) => {
    const what = plan('done', false, notifySettings({ settings }))
    expect([what.sound, what.show]).toEqual([sound, show])
  })

  test('both settings default to on when state.json has none', () => {
    expect(notifySettings({})).toEqual({ notifyIdle: true, notifySound: true })
    expect(notifySettings({ settings: 'odd' })).toEqual({ notifyIdle: true, notifySound: true })
  })
})

describe('roll-up and counts', () => {
  test('AST-29 a tab shows its most urgent pane', () => {
    expect(rollup(['working', 'blocked'])).toBe('blocked')
    expect(rollup(['done', 'idle'])).toBe('done')
    expect(rollup(['idle', 'idle'])).toBe('idle')
    expect(rollup(['done', 'working'])).toBe('working')
    expect(rollup([])).toBe('idle')
  })

  const panes: PaneState[] = [
    { paneId: 'p1', sessionId: 'a1', state: 'blocked', remoteLive: 'unknown' },
    { paneId: 'p2', sessionId: 'b1', state: 'blocked', remoteLive: 'unknown' },
    { paneId: 'p3', sessionId: 'b2', state: 'blocked', remoteLive: 'unknown' },
    { paneId: 'p4', sessionId: 'b3', state: 'working', remoteLive: 'unknown' },
    { paneId: 'p5', sessionId: 'unjoined', state: 'blocked', remoteLive: 'unknown' },
    { paneId: 'p6', sessionId: null, state: 'blocked', remoteLive: 'unknown' },
  ]
  const member: Record<string, string> = { a1: 'A', b1: 'B', b2: 'B', b3: 'B' }

  test('AST-30 each project counts its blocked members, across every window', () => {
    const blocked = blockedCounts(panes, (id) => member[id])
    expect(blocked).toEqual({ A: 1, B: 2 })
    expect(faceBadge(blocked, 'A')).toBe(2)
    expect(faceBadge(blocked, 'B')).toBe(1)
  })

  test('AST-31 nothing blocked anywhere: no count at all', () => {
    const quiet = panes.map((p) => ({ ...p, state: 'idle' as const }))
    expect(blockedCounts(quiet, (id) => member[id])).toEqual({})
    expect(faceBadge({}, 'A')).toBe(0)
  })
})

describe('a collapsed group', () => {
  // Its one row shows the most urgent state of its running members, so a collapsed group never
  // hides one that needs the human; none running is stopped (null).
  test.each<[ShownState[], ShownState | null]>([
    [[], null],
    [['idle'], 'idle'],
    [['idle', 'done'], 'done'],
    [['done', 'working'], 'working'],
    [['working', 'blocked', 'idle'], 'blocked'],
  ])('AST-32 the running members %j show as %s', (states, expected) => {
    expect(groupState(states)).toBe(expected)
  })
})
