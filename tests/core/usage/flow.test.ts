// How tasks move, read from their recorded states (decision 1.180, plan 43 §2.8).
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { batchPath, type TaskStateEvent } from '../../../src/core/usage/activity'
import { type TaskStateRow, taskFlow } from '../../../src/core/usage/flow'
import { UsageHistory } from '../../../src/core/usage/history'
import type { FlowFigure, TaskFlow } from '../../../src/core/usage/nodes'
import { periodBounds } from '../../../src/core/usage/periods'
import { usageDirs } from '../../factories/usage'

// Nov 18, 2026, local time
const hm = (hour: number, minute: number) => new Date(2026, 10, 18, hour, minute).getTime() / 1000
const MIN = 60
const DAY = { start: hm(0, 0), end: hm(24, 0) }

let n = 0
function row(
  task: number,
  at: number,
  state: string,
  extra: Partial<Omit<TaskStateRow, 'task' | 'at' | 'state'>> = {},
): TaskStateRow {
  n += 1
  return {
    id: `r${n}`,
    at,
    projectId: 'p1',
    task,
    state,
    waitKind: null,
    waitRef: null,
    assignee: null,
    baseline: false,
    ...extra,
  }
}

const state = (flow: TaskFlow, name: string) => flow.states.find((s) => s.state === name)?.figure
const waiter = (flow: TaskFlow, name: string, who: string | null) =>
  flow.states.find((s) => s.state === name)?.waiters.find((w) => w.waiter === who)?.figure
const figure = (tasks: number, median: number, total: number, sinceBaseline = 0): FlowFigure => ({
  tasks,
  medianSeconds: median,
  totalSeconds: total,
  sinceBaseline,
})

describe('taskFlow', () => {
  // Time per state comes from consecutive rows; the open one runs to now.
  test('queued 30 min, in progress 90, to review on a PR merge 60 until now; a window from 10:00 clips in progress to 60', () => {
    const rows = [
      row(1, hm(9, 0), 'queued'),
      row(1, hm(9, 30), 'in progress'),
      row(1, hm(11, 0), 'to review', { waitKind: 'pr-merge' }),
    ]
    const flow = taskFlow(rows, DAY, hm(12, 0))
    expect(state(flow, 'queued')).toEqual(figure(1, 30 * MIN, 30 * MIN))
    expect(state(flow, 'in progress')).toEqual(figure(1, 90 * MIN, 90 * MIN))
    expect(state(flow, 'to review')).toEqual(figure(1, 60 * MIN, 60 * MIN))
    expect(waiter(flow, 'to review', 'pr-merge')).toEqual(figure(1, 60 * MIN, 60 * MIN))
    expect(state(flow, 'waiting')).toEqual(figure(0, 0, 0))
    expect(flow.tasks).toBe(1)

    const clipped = taskFlow(rows, { start: hm(10, 0), end: hm(24, 0) }, hm(12, 0))
    expect(state(clipped, 'queued')).toEqual(figure(0, 0, 0))
    expect(state(clipped, 'in progress')).toEqual(figure(1, 60 * MIN, 60 * MIN))
  })

  test('the four states come in their order, done and dropped never', () => {
    const flow = taskFlow([row(1, hm(9, 0), 'done')], DAY, hm(12, 0))
    expect(flow.states.map((s) => s.state)).toEqual([
      'queued',
      'in progress',
      'waiting',
      'to review',
    ])
    expect(flow.tasks).toBe(0)
  })

  // A task open when recording began is counted from its baseline, never from its creation, and
  // its figure says so; one whose baseline is before the window is whole inside it.
  test('a task whose first row is a baseline inside the window is counted from it and marked', () => {
    const rows = [
      row(2, hm(10, 0), 'waiting', { waitKind: 'topic', waitRef: '4', baseline: true }),
      row(2, hm(10, 45), 'in progress'),
      row(3, hm(10, 0), 'in progress'),
    ]
    const flow = taskFlow(rows, DAY, hm(11, 0))
    expect(state(flow, 'waiting')).toEqual(figure(1, 45 * MIN, 45 * MIN, 1))
    expect(waiter(flow, 'waiting', 'topic')).toEqual(figure(1, 45 * MIN, 45 * MIN, 1))
    expect(state(flow, 'in progress')).toEqual(figure(2, 37.5 * MIN, 75 * MIN, 1))
    expect(flow.sinceBaseline).toBe(1)

    const later = taskFlow(rows, { start: hm(10, 30), end: hm(24, 0) }, hm(11, 0))
    expect(state(later, 'waiting')).toEqual(figure(1, 15 * MIN, 15 * MIN))
    expect(later.sinceBaseline).toBe(0)
  })

  test('two rows in a row in the same state are one stretch, and its task counts once', () => {
    const rows = [
      row(1, hm(9, 0), 'queued'),
      row(1, hm(9, 10), 'queued', { baseline: true }),
      row(1, hm(9, 30), 'in progress'),
    ]
    const flow = taskFlow(rows, DAY, hm(10, 0))
    expect(state(flow, 'queued')).toEqual(figure(1, 30 * MIN, 30 * MIN))
    expect(flow.sinceBaseline).toBe(0)
  })

  test('a task dropped or done while waiting ends its wait there', () => {
    const rows = [
      row(1, hm(9, 0), 'waiting', { waitKind: 'session', waitRef: 's1' }),
      row(1, hm(9, 20), 'dropped'),
      row(2, hm(9, 0), 'waiting', { waitKind: 'other' }),
      row(2, hm(9, 40), 'done'),
    ]
    const flow = taskFlow(rows, DAY, hm(12, 0))
    expect(state(flow, 'waiting')).toEqual(figure(2, 30 * MIN, 60 * MIN))
    expect(waiter(flow, 'waiting', 'session')).toEqual(figure(1, 20 * MIN, 20 * MIN))
    expect(waiter(flow, 'waiting', 'other')).toEqual(figure(1, 40 * MIN, 40 * MIN))
  })

  // The median is per task: a task's whole time in a state in the window, however many stretches.
  test("the median is of each task's time in the state, not of its stretches", () => {
    const rows = [
      row(1, hm(9, 0), 'waiting', { waitKind: 'topic', waitRef: '1' }),
      row(1, hm(9, 10), 'in progress'),
      row(1, hm(9, 20), 'waiting', { waitKind: 'session', waitRef: 's1' }),
      row(1, hm(9, 30), 'done'),
      row(2, hm(9, 0), 'waiting', { waitKind: 'topic', waitRef: '2' }),
      row(2, hm(9, 15), 'done'),
      row(3, hm(9, 0), 'waiting', { waitKind: 'topic', waitRef: '3' }),
      row(3, hm(10, 0), 'done'),
    ]
    const flow = taskFlow(rows, DAY, hm(12, 0))
    expect(state(flow, 'waiting')).toEqual(figure(3, 20 * MIN, 95 * MIN))
    expect(waiter(flow, 'waiting', 'topic')).toEqual(figure(3, 15 * MIN, 85 * MIN))
    expect(waiter(flow, 'waiting', 'session')).toEqual(figure(1, 10 * MIN, 10 * MIN))
  })

  test('tasks are told apart by project; rows out of order are read in time order', () => {
    const rows = [
      row(1, hm(9, 30), 'in progress'),
      row(1, hm(9, 0), 'queued'),
      row(1, hm(9, 0), 'queued', { projectId: 'p2' }),
      row(1, hm(9, 10), 'done', { projectId: 'p2' }),
    ]
    const flow = taskFlow(rows, DAY, hm(10, 0))
    expect(state(flow, 'queued')).toEqual(figure(2, 20 * MIN, 40 * MIN))
    expect(flow.tasks).toBe(2)
  })

  test('nothing runs past now, nor past the window, and a window after now is empty', () => {
    const rows = [row(1, hm(9, 0), 'in progress')]
    expect(
      state(taskFlow(rows, { start: hm(0, 0), end: hm(10, 0) }, hm(12, 0)), 'in progress'),
    ).toEqual(figure(1, 60 * MIN, 60 * MIN))
    expect(taskFlow(rows, { start: hm(13, 0), end: hm(24, 0) }, hm(12, 0)).tasks).toBe(0)
  })

  test('a review with no waiter recorded counts in its state under no waiter', () => {
    const flow = taskFlow([row(1, hm(9, 0), 'to review')], DAY, hm(10, 0))
    expect(state(flow, 'to review')).toEqual(figure(1, 60 * MIN, 60 * MIN))
    expect(waiter(flow, 'to review', null)).toEqual(figure(1, 60 * MIN, 60 * MIN))
  })
})

describe('reading the task states from the history', () => {
  function setup(name: string) {
    const dirs = usageDirs(name)
    const history = new UsageHistory(dirs.history)
    const events = (lines: readonly Omit<TaskStateEvent, 'v' | 'id' | 'kind'>[]) => {
      const path = batchPath(join(dirs.root, 'data'), 0)
      writeFileSync(
        path,
        lines
          .map((e, i) => JSON.stringify({ v: 1, id: `t${i}`, kind: 'task_state', ...e }))
          .join('\n'),
      )
      history.importActivity(path)
    }
    return { history, events }
  }

  // The 30-day window: a task in progress since before it counts from the window's start, read
  // from its last row before the window; a task closed before the window counts nothing.
  test('over 30 days a task begun 40 days ago counts from the window start; 7 days counts less', () => {
    const { history, events } = setup('flow-read')
    try {
      const now = hm(12, 0)
      const days = (d: number) => now - d * 86_400
      events([
        { at: days(41), projectId: 'p1', task: 1, state: 'queued' },
        { at: days(40), projectId: 'p1', task: 1, state: 'in progress', assignee: 's9' },
        { at: days(45), projectId: 'p1', task: 2, state: 'in progress' },
        { at: days(44), projectId: 'p1', task: 2, state: 'done' },
        {
          at: days(2),
          projectId: 'p2',
          task: 1,
          state: 'waiting',
          waitKind: 'other',
          baseline: true,
        },
      ])
      const month = periodBounds('30d', now)
      const read = history.taskStateRows(month.start, month.end)
      expect(read.map((r) => [r.projectId, r.task, r.state])).toEqual([
        ['p1', 2, 'done'],
        ['p1', 1, 'in progress'],
        ['p2', 1, 'waiting'],
      ])
      expect(read[1]).toMatchObject({ assignee: 's9', baseline: false, waitKind: null })
      const flow = taskFlow(read, month, now)
      expect(state(flow, 'in progress')).toEqual(figure(1, now - month.start, now - month.start))
      expect(state(flow, 'waiting')?.totalSeconds).toBe(2 * 86_400)
      expect(read[2]).toMatchObject({ waitKind: 'other', baseline: true })
      expect(flow.sinceBaseline).toBe(1)

      const week = periodBounds('7d', now)
      const scoped = history.taskStateRows(week.start, week.end, 'p1')
      expect(scoped.map((r) => r.task)).toEqual([2, 1])
      expect(state(taskFlow(scoped, week, now), 'in progress')?.totalSeconds).toBe(now - week.start)
    } finally {
      history.close()
    }
  })
})
