// The human's bursts of activity, computed when read (decision 1.180, Q1 and Q2 of topic 56).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  type ActivityEvent,
  batchPath,
  type TaskStateEvent,
} from '../../../src/core/usage/activity'
import {
  type ActivityRows,
  activityDay,
  activityWeek,
  awayPeriods,
  BURST_GAP_SECONDS,
  bursts,
  clipToDay,
  type HumanAction,
  humanActionsOf,
  readActivity,
} from '../../../src/core/usage/bursts'
import { UsageHistory } from '../../../src/core/usage/history'
import { midnight } from '../../../src/core/usage/periods'
import { usageDirs } from '../../factories/usage'

// Nov 18, 2026, local time; `hm(24, 5)` is 00:05 on Nov 19
const hm = (hour: number, minute: number, second = 0) =>
  new Date(2026, 10, 18, hour, minute, second).getTime() / 1000
const NOV_18 = { year: 2026, month: 11, day: 18 }
const NOV_19 = { year: 2026, month: 11, day: 19 }

const act = (at: number, kind: HumanAction['kind'] = 'message'): HumanAction => ({ at, kind })
const span = (b: { start: number; end: number }) => [b.start, b.end]

function rows(parts: Partial<ActivityRows>): ActivityRows {
  return { messages: [], actions: [], presence: [], promptedStarts: [], ...parts }
}

describe('bursts', () => {
  test("the gap is ten minutes, the human's choice", () => {
    expect(BURST_GAP_SECONDS).toBe(600)
  })

  // Bursts at read time, by the gap: at most G between two actions keeps them in one burst.
  test('10:00 and 10:11 are two bursts, 10:00 and 10:10 one, a single action a burst of length 0', () => {
    expect(bursts([act(hm(10, 0)), act(hm(10, 11))], []).map(span)).toEqual([
      [hm(10, 0), hm(10, 0)],
      [hm(10, 11), hm(10, 11)],
    ])
    expect(bursts([act(hm(10, 10)), act(hm(10, 0))], []).map(span)).toEqual([
      [hm(10, 0), hm(10, 10)],
    ])
    const one = bursts([act(hm(10, 0))], [])
    expect(one.map(span)).toEqual([[hm(10, 0), hm(10, 0)]])
  })

  // Presence marks count as actions: one a minute fills the gaps that messages leave.
  test('marks at 10:00 and 10:09 and a message at 10:18 are one burst 10:00–10:18', () => {
    const found = bursts(
      [act(hm(10, 0), 'present'), act(hm(10, 9), 'present'), act(hm(10, 18))],
      [],
    )
    expect(found.map(span)).toEqual([[hm(10, 0), hm(10, 18)]])
    expect(found[0]).toMatchObject({ messages: 1, prompts: 0 })
  })

  // An away period ends a burst and counts nothing, a Remote Control message inside it included.
  test('away ends a burst inside the gap, and a message sent while away counts nowhere', () => {
    const presence = [
      { at: hm(10, 6), kind: 'away' as const },
      { at: hm(10, 30), kind: 'back' as const },
    ]
    const away = awayPeriods(presence, hm(23, 0))
    expect(away.map(span)).toEqual([[hm(10, 6), hm(10, 30)]])
    const found = bursts([act(hm(10, 0)), act(hm(10, 5)), act(hm(10, 8)), act(hm(10, 31))], away)
    expect(found.map(span)).toEqual([
      [hm(10, 0), hm(10, 5)],
      [hm(10, 31), hm(10, 31)],
    ])
    expect(found.reduce((n, b) => n + b.messages, 0)).toBe(3)
    const day = activityDay(
      rows({
        messages: [hm(10, 0), hm(10, 5), hm(10, 8), hm(10, 31)].map((at, i) => ({
          uuid: `u${i}`,
          sessionId: 's1',
          at,
        })),
        presence,
      }),
      NOV_18,
      hm(23, 0),
    )
    expect(day.messages).toBe(3)
    expect(day.hours[10]?.messages).toBe(3)
  })

  // Even a short away splits a burst: the human left in between.
  test('an away of two minutes between actions two minutes apart still splits them', () => {
    const away = awayPeriods(
      [
        { at: hm(10, 1), kind: 'away' },
        { at: hm(10, 3), kind: 'back' },
      ],
      hm(23, 0),
    )
    expect(bursts([act(hm(10, 0)), act(hm(10, 4))], away).map(span)).toEqual([
      [hm(10, 0), hm(10, 0)],
      [hm(10, 4), hm(10, 4)],
    ])
  })

  test("an away with no back runs to the next start, and with neither to the reading's end", () => {
    expect(
      awayPeriods(
        [
          { at: hm(10, 6), kind: 'away' },
          { at: hm(12, 0), kind: 'app_start' },
        ],
        hm(23, 0),
      ).map(span),
    ).toEqual([[hm(10, 6), hm(12, 0)]])
    // read at 23:59: still away
    expect(awayPeriods([{ at: hm(23, 50), kind: 'away' }], hm(23, 59)).map(span)).toEqual([
      [hm(23, 50), hm(23, 59)],
    ])
    // a second away while away, or a back while present, changes nothing
    expect(
      awayPeriods(
        [
          { at: hm(9, 0), kind: 'back' },
          { at: hm(10, 0), kind: 'away' },
          { at: hm(10, 5), kind: 'away' },
          { at: hm(10, 20), kind: 'back' },
        ],
        hm(23, 0),
      ).map(span),
    ).toEqual([[hm(10, 0), hm(10, 20)]])
  })

  // From the human's hand check (task 104): clicks in Menkar after setting away are journaled as
  // presence marks, and must neither extend nor start a burst.
  test('presence marks journaled while away neither extend nor start a burst', () => {
    const away = awayPeriods([{ at: hm(11, 47), kind: 'away' }], hm(12, 30))
    const found = bursts(
      [
        act(hm(11, 40)),
        act(hm(11, 46), 'present'),
        act(hm(11, 48), 'present'),
        act(hm(11, 49), 'present'),
        act(hm(11, 50), 'present'),
      ],
      away,
    )
    expect(found.map(span)).toEqual([[hm(11, 40), hm(11, 46)]])
  })

  // A burst crossing midnight is one burst; a day clips it, the week counts each day's part.
  test('23:50, 23:58 and 00:05 are one burst; each day shows and counts its own part', () => {
    const r = rows({
      messages: [hm(23, 50), hm(23, 58), hm(24, 5)].map((at, i) => ({
        uuid: `u${i}`,
        sessionId: 's1',
        at,
      })),
    })
    const all = bursts(humanActionsOf(r), [])
    expect(all.map(span)).toEqual([[hm(23, 50), hm(24, 5)]])
    const first = activityDay(r, NOV_18, hm(24, 30))
    expect(first.bursts.map(span)).toEqual([[hm(23, 50), midnight(NOV_19)]])
    expect(first.bursts[0]).toMatchObject({
      fullStart: hm(23, 50),
      fullEnd: hm(24, 5),
      messages: 3,
    })
    expect(first.burstSeconds).toBe(600)
    expect(first.messages).toBe(2)
    expect(activityDay(r, NOV_19, hm(24, 30)).burstSeconds).toBe(300)
    const week = activityWeek(r, NOV_18, hm(24, 30))
    expect(week.days).toHaveLength(7)
    expect(week.days.slice(0, 2).map((d) => [d.burstSeconds, d.messages])).toEqual([
      [600, 2],
      [300, 1],
    ])
    expect(week.bounds).toEqual({ start: midnight(NOV_18), end: midnight({ ...NOV_18, day: 25 }) })
  })

  test('a day is cut into its local hours, messages and prompts apart; an empty day has no burst', () => {
    const r = rows({
      messages: [{ uuid: 'u1', sessionId: 's1', at: hm(9, 15) }],
      actions: [
        { at: hm(9, 20), kind: 'prompt_answered' },
        { at: hm(14, 0), kind: 'topic_closed' },
      ],
    })
    const day = activityDay(r, NOV_18, hm(23, 0))
    expect(day.hours).toHaveLength(24)
    expect(day.hours[9]).toMatchObject({ messages: 1, prompts: 1 })
    expect(day.hours[14]).toMatchObject({ messages: 0, prompts: 0 })
    expect(day.bursts.map(span)).toEqual([
      [hm(9, 15), hm(9, 20)],
      [hm(14, 0), hm(14, 0)],
    ])
    const empty = activityDay(rows({}), NOV_19, hm(23, 0))
    expect(empty).toMatchObject({ bursts: [], burstSeconds: 0, messages: 0, prompts: 0 })
  })

  test("a burst is clipped to a day, and one that ends at the day's first instant is not in it", () => {
    const day = { start: midnight(NOV_19), end: midnight({ ...NOV_19, day: 20 }) }
    expect(clipToDay({ start: hm(23, 50), end: hm(24, 5) }, day)).toEqual({
      start: midnight(NOV_19),
      end: hm(24, 5),
    })
    expect(clipToDay({ start: hm(23, 50), end: midnight(NOV_19) }, day)).toBeNull()
    expect(clipToDay({ start: midnight(NOV_19), end: midnight(NOV_19) }, day)).toEqual({
      start: midnight(NOV_19),
      end: midnight(NOV_19),
    })
  })

  // A command-line prompt is Menkar's text, not the human's message: the first turn of its
  // session opened at or after the start is left out, when it is of origin human.
  test("the turn after a prompted start is not the human's; a peer turn first excludes nothing", () => {
    const messages = [
      { uuid: 'a', sessionId: 's1', at: 103 },
      { uuid: 'b', sessionId: 's1', at: 400 },
    ]
    const counted = (r: ActivityRows) => humanActionsOf(r).map((a) => a.at)
    expect(
      counted(
        rows({
          messages,
          promptedStarts: [{ at: 100, sessionId: 's1', firstTurn: { uuid: 'a', origin: 'human' } }],
        }),
      ),
    ).toEqual([400])
    expect(
      counted(
        rows({
          messages: messages.slice(1),
          promptedStarts: [{ at: 100, sessionId: 's1', firstTurn: { uuid: 'p', origin: 'peer' } }],
        }),
      ),
    ).toEqual([400])
    expect(
      counted(rows({ messages, promptedStarts: [{ at: 500, sessionId: 's1', firstTurn: null }] })),
    ).toEqual([103, 400])
  })
})

describe('reading the history', () => {
  function setup(name: string) {
    const dirs = usageDirs(name)
    const history = new UsageHistory(dirs.history)
    const raw = history.handle?.raw
    if (raw === undefined) throw new Error('no history')
    const turn = (
      uuid: string,
      sessionId: string,
      origin: string,
      opened: number,
      project?: string,
    ) =>
      raw
        .prepare(
          'INSERT INTO turns (uuid, session_id, origin, opened, project_id) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuid, sessionId, origin, opened, project ?? null)
    let n = 0
    const events = (
      lines: readonly (Omit<ActivityEvent, 'v' | 'id'> | Omit<TaskStateEvent, 'v' | 'id'>)[],
    ) => {
      const path = batchPath(join(dirs.root, 'data'), 0)
      writeFileSync(
        path,
        lines.map((e, i) => JSON.stringify({ v: 1, id: `e${n + i}`, ...e })).join('\n'),
      )
      n += lines.length
      history.importActivity(path)
    }
    return { history, turn, events }
  }

  test('the human turns, the less prompted, and the activity join into one reading', () => {
    const { history, turn, events } = setup('bursts-read')
    try {
      turn('t1', 's1', 'human', hm(10, 0, 5), 'p1')
      turn('t2', 's1', 'human', hm(10, 4), 'p1')
      turn('t3', 's1', 'peer', hm(10, 5), 'p1')
      turn('t4', 's2', 'human', hm(10, 6), 'p2')
      events([
        { at: hm(10, 0), kind: 'prompted_start', sessionId: 's1' },
        { at: hm(10, 2), kind: 'prompt_answered', projectId: 'p1', next: 'working' },
        { at: hm(10, 3), kind: 'present', projectId: 'p1' },
        { at: hm(10, 3, 30), kind: 'task_state', projectId: 'p1', task: 1, state: 'queued' },
        { at: hm(10, 7), kind: 'topic_discussed', projectId: 'p2', topic: 4 },
      ])
      const r = history.humanActions(hm(9, 0), hm(11, 0))
      expect(r.messages.map((m) => m.uuid)).toEqual(['t1', 't2', 't4'])
      expect(r.actions.map((a) => a.kind)).toEqual([
        'prompt_answered',
        'present',
        'topic_discussed',
      ])
      expect(r.promptedStarts).toEqual([
        { at: hm(10, 0), sessionId: 's1', firstTurn: { uuid: 't1', origin: 'human' } },
      ])
      expect(humanActionsOf(r).map((a) => a.at)).toEqual([
        hm(10, 2),
        hm(10, 3),
        hm(10, 4),
        hm(10, 6),
        hm(10, 7),
      ])
      const p1 = history.humanActions(hm(9, 0), hm(11, 0), 'p1')
      expect(p1.messages.map((m) => m.uuid)).toEqual(['t1', 't2'])
      expect(p1.actions.map((a) => a.kind)).toEqual(['prompt_answered', 'present'])
    } finally {
      history.close()
    }
  })

  // An away begun before the read range still holds inside it, and a burst begun the day before
  // is read whole.
  test('the reading reaches back for an away and for the start of a burst before the day', () => {
    const { history, turn, events } = setup('bursts-back')
    try {
      events([{ at: hm(-30, 0), kind: 'away' }])
      turn('w', 's1', 'human', hm(1, 0))
      events([{ at: hm(2, 0), kind: 'back' }])
      for (let m = 0; m <= 35; m += 5) turn(`u${m}`, 's1', 'human', hm(23, 30 + m))
      const day = { start: midnight(NOV_19), end: midnight({ ...NOV_19, day: 20 }) }
      const r = readActivity(history, day, hm(24, 30))
      const second = activityDay(r, NOV_19, hm(24, 30))
      expect(second.bursts).toEqual([
        expect.objectContaining({ start: day.start, fullStart: hm(23, 30), fullEnd: hm(24, 5) }),
      ])
      const first = activityDay(
        readActivity(
          history,
          {
            start: midnight(NOV_18),
            end: midnight(NOV_19),
          },
          hm(24, 30),
        ),
        NOV_18,
        hm(24, 30),
      )
      expect(first.messages).toBe(6)
    } finally {
      history.close()
    }
  })

  test('a burst begun more than a day before the day read is read from its first action', () => {
    const { history, events } = setup('bursts-long')
    try {
      const marks = []
      for (let at = hm(-26, 0); at <= hm(24, 5); at += 300)
        marks.push({ at, kind: 'present' as const })
      events(marks)
      const day = { start: midnight(NOV_19), end: midnight({ ...NOV_19, day: 20 }) }
      const shown = activityDay(readActivity(history, day, hm(24, 30)), NOV_19, hm(24, 30))
      expect(shown.bursts).toEqual([
        expect.objectContaining({ fullStart: hm(-26, 0), fullEnd: hm(24, 5) }),
      ])
    } finally {
      history.close()
    }
  })
})
