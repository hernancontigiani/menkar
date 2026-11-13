// The tasks the orchestrator delegates (decision 1.113): numbered per project and never reused,
// split into 3 to 7 steps by their assignee, moved by the assignee up to "to review" and closed only
// by the orchestrator after reviewing.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  addTask,
  closeTask,
  currentTask,
  doneToday,
  emptyTasks,
  followTasks,
  loadTasks,
  onStarredTask,
  openTasks,
  parseTasks,
  saveTasks,
  serializeTasks,
  setTaskStar,
  type TaskCall,
  type Tasks,
  tasksOf,
  taskTool,
} from '../../../src/core/orchestration/tasks'
import { tasksPath, topicsPath } from '../../../src/core/paths'

const AT = '2026-11-13T10:00:00.000-03:00'
const LATER = '2026-11-13T11:00:00.000-03:00'

const add = (t: Tasks, title: string, assignee = 'W', star = false, project = 'p1') =>
  addTask(t, project, { title, assignee, star }, AT).tasks

const names: Record<string, string> = { O: 'set', W: 'b1', V: 'b2' }

const call = (tasks: Tasks, caller: string, orchestrator: string | null = 'O'): TaskCall => ({
  tasks,
  projectId: 'p1',
  caller,
  orchestrator,
  nameOf: (id) => names[id] ?? id,
  idOf: (name) => {
    const id = Object.keys(names).find((k) => names[k] === name)
    return id ? { id } : { refusal: `No session of your project is called "${name}".` }
  },
  at: AT,
})

beforeEach(async () => {
  await rm(dirname(tasksPath()), { recursive: true, force: true })
  await mkdir(dirname(tasksPath()), { recursive: true })
})

describe('tasks', () => {
  test('numbers are never reused: add 1, 2; close 2; add → 3', () => {
    let t = add(add(emptyTasks(), 'one'), 'two')
    t = closeTask(t, 'p1', 2, 'dropped', LATER)?.tasks ?? t
    const third = addTask(t, 'p1', { title: 'three', assignee: 'W', star: false }, AT)
    expect(third.number).toBe(3)
    expect(tasksOf(third.tasks, 'p1').map((x) => x.number)).toEqual([1, 2, 3])
    expect(addTask(t, 'p2', { title: 'x', assignee: 'W', star: false }, AT).number).toBe(1)
  })

  test('a new task is queued, with no steps, at step 0', () => {
    expect(tasksOf(add(emptyTasks(), 'one'), 'p1')[0]).toMatchObject({
      state: 'queued',
      steps: [],
      step: 0,
      note: '',
      created: AT,
      updated: AT,
    })
  })

  // A session's current task: its task in progress or waiting, else its oldest queued one.
  test('the current task: queued 5, in progress 3 → 3; none in progress → oldest queued', () => {
    let t = emptyTasks()
    for (const title of ['1', '2', '3', '4', '5']) t = add(t, title, title === '2' ? 'V' : 'W')
    t = closeTask(t, 'p1', 1, 'done', LATER)?.tasks ?? t
    const steps = (tasks: Tasks, n: number) =>
      taskTool('task_steps', { number: n, steps: ['a', 'b', 'c'] }, call(tasks, 'W')).tasks ?? tasks
    expect(currentTask(tasksOf(steps(t, 3), 'p1'), 'W')?.number).toBe(3)
    expect(currentTask(tasksOf(t, 'p1'), 'W')?.number).toBe(3)
    const queuedFiveFirst = closeTask(t, 'p1', 3, 'dropped', LATER)?.tasks ?? t
    expect(currentTask(tasksOf(queuedFiveFirst, 'p1'), 'W')?.number).toBe(4)
    expect(currentTask(tasksOf(t, 'p1'), 'nobody')).toBeUndefined()
  })

  // A done task counts in "Done today" from its close until the next local midnight.
  test('done today at midnight: done at 23:58 → in "today" at 23:59, not at 00:01', () => {
    let t = add(add(emptyTasks(), 'one'), 'two')
    t = closeTask(t, 'p1', 1, 'done', '2026-11-13T23:58:00.000-03:00')?.tasks ?? t
    t = closeTask(t, 'p1', 2, 'dropped', '2026-11-13T23:58:30.000-03:00')?.tasks ?? t
    const list = tasksOf(t, 'p1')
    expect(
      doneToday(list, Date.parse('2026-11-13T23:59:00.000-03:00')).map((x) => x.number),
    ).toEqual([1])
    expect(doneToday(list, Date.parse('2026-11-14T00:01:00.000-03:00'))).toEqual([])
  })

  test('done today is newest first', () => {
    let t = add(add(emptyTasks(), 'one'), 'two')
    t = closeTask(t, 'p1', 1, 'done', '2026-11-13T09:00:00.000-03:00')?.tasks ?? t
    t = closeTask(t, 'p1', 2, 'done', '2026-11-13T10:00:00.000-03:00')?.tasks ?? t
    const shown = doneToday(tasksOf(t, 'p1'), Date.parse('2026-11-13T12:00:00.000-03:00'))
    expect(shown.map((x) => x.number)).toEqual([2, 1])
  })

  // Tasks follow a session to a new id (/clear, resume, renew, a reused name) as the other marks do.
  test('tasks follow a new id: assignee X → Y, in every project', () => {
    let t = add(add(emptyTasks(), 'one', 'X'), 'two', 'Z')
    t = add(t, 'three', 'X', false, 'p2')
    const followed = followTasks(t, 'X', 'Y')
    expect(tasksOf(followed, 'p1').map((x) => x.assignee)).toEqual(['Y', 'Z'])
    expect(tasksOf(followed, 'p2').map((x) => x.assignee)).toEqual(['Y'])
    expect(followTasks(t, 'nobody', 'Y')).toBe(t)
  })

  test('on a ★ task: only while its current task has the ★', () => {
    let t = add(add(emptyTasks(), 'calm', 'W'), 'urgent', 'W', true)
    expect(onStarredTask(tasksOf(t, 'p1'), 'W')).toBe(false)
    t = closeTask(t, 'p1', 1, 'done', LATER)?.tasks ?? t
    expect(onStarredTask(tasksOf(t, 'p1'), 'W')).toBe(true)
    expect(onStarredTask(tasksOf(t, 'p1'), 'nobody')).toBe(false)
  })

  test('open tasks: ★ first, then by number; closed ones left out', () => {
    let t = add(add(add(emptyTasks(), 'one'), 'two', 'W', true), 'three')
    t = closeTask(t, 'p1', 3, 'done', LATER)?.tasks ?? t
    t = add(t, 'four')
    expect(openTasks(tasksOf(t, 'p1')).map((x) => x.number)).toEqual([2, 1, 4])
    t = setTaskStar(t, 'p1', 4, true, LATER) ?? t
    expect(openTasks(tasksOf(t, 'p1')).map((x) => x.number)).toEqual([2, 4, 1])
  })

  test('the file round-trips; a task of the wrong shape is dropped, and next never goes back', async () => {
    let t = add(add(emptyTasks(), 'one'), 'two', 'V', true)
    t = taskTool('task_steps', { number: 1, steps: ['a', 'b', 'c'] }, call(t, 'W')).tasks ?? t
    t = closeTask(t, 'p1', 2, 'done', LATER)?.tasks ?? t
    await saveTasks(t)
    expect((await loadTasks()).tasks).toEqual(t)
    const raw = serializeTasks(t) as { projects: Record<string, { tasks: unknown[] }> }
    const p1 = raw.projects.p1
    if (!p1) throw new Error('no p1')
    const read = parseTasks({
      ...raw,
      projects: { p1: { next: 1, tasks: [...p1.tasks, { number: 'x' }, 7, { number: 1 }] } },
    })
    expect(tasksOf(read, 'p1').map((x) => x.number)).toEqual([1, 2])
    expect(addTask(read, 'p1', { title: 'n', assignee: 'W', star: false }, AT).number).toBe(3)
  })

  test('an unreadable file is moved aside, never deleted, and an empty store starts', async () => {
    await writeFile(tasksPath(), '{ broken')
    const loaded = await loadTasks()
    expect(loaded.tasks).toEqual(emptyTasks())
    expect(loaded.movedTo).toMatch(/^tasks\.json\.broken-/)
    expect(await readFile(`${dirname(tasksPath())}/${loaded.movedTo}`, 'utf8')).toBe('{ broken')
    expect(await readdir(dirname(tasksPath()))).toEqual([loaded.movedTo])
  })

  test('tasks have a file of their own beside the topics', () => {
    expect(dirname(tasksPath())).toBe(dirname(topicsPath()))
    expect(tasksPath()).not.toBe(topicsPath())
  })
})

describe('the task tools', () => {
  // Decision 1.113: the orchestrator adds and closes; the assignee sets steps, reports progress and
  // hands it to review; it never closes its own task.
  test('a task\'s life: add → 4 steps → in progress 1/4 → waiting on "topic 4" → to review → assignee close refused → orchestrator close done', () => {
    const added = taskTool(
      'task_add',
      { title: 'Release 0.2', assignee: 'b1' },
      call(emptyTasks(), 'O'),
    )
    expect(added).toMatchObject({ ok: true, text: 'Task 1 added.' })
    let t = added.tasks ?? emptyTasks()
    expect(tasksOf(t, 'p1')[0]).toMatchObject({ assignee: 'W', state: 'queued', star: false })

    const steps = taskTool('task_steps', { number: 1, steps: ['a', 'b', 'c', 'd'] }, call(t, 'W'))
    expect(steps.ok).toBe(true)
    t = steps.tasks ?? t
    expect(tasksOf(t, 'p1')[0]).toMatchObject({
      state: 'in progress',
      step: 1,
      steps: ['a', 'b', 'c', 'd'],
    })

    const progress = taskTool(
      'task_progress',
      { number: 1, step: 2, note: 'building .deb' },
      call(t, 'W'),
    )
    t = progress.tasks ?? t
    expect(tasksOf(t, 'p1')[0]).toMatchObject({
      state: 'in progress',
      step: 2,
      note: 'building .deb',
    })

    const waiting = taskTool(
      'task_progress',
      { number: 1, note: 'needs a name', waiting_on: 'topic 4' },
      call(t, 'W'),
    )
    t = waiting.tasks ?? t
    expect(tasksOf(t, 'p1')[0]).toMatchObject({ state: 'waiting', step: 2, waitingOn: 'topic 4' })

    const back = taskTool('task_progress', { number: 1, step: 3, note: 'named' }, call(t, 'W'))
    t = back.tasks ?? t
    expect(tasksOf(t, 'p1')[0]?.state).toBe('in progress')
    expect(tasksOf(t, 'p1')[0]?.waitingOn).toBeUndefined()

    const review = taskTool('task_review', { number: 1, note: 'built and installed' }, call(t, 'W'))
    t = review.tasks ?? t
    expect(tasksOf(t, 'p1')[0]).toMatchObject({ state: 'to review', note: 'built and installed' })

    expect(taskTool('task_close', { number: 1, outcome: 'done' }, call(t, 'W'))).toEqual({
      ok: false,
      text: 'Only the orchestrator closes a task, after reviewing it.',
    })
    const closed = taskTool('task_close', { number: 1, outcome: 'done' }, call(t, 'O'))
    expect(closed.text).toBe('Task 1 closed as done.')
    expect(tasksOf(closed.tasks ?? t, 'p1')[0]).toMatchObject({ state: 'done', closed: AT })
  })

  test('steps are 3 to 7 non-empty lines: 2 → refused, 8 → refused, a blank one → refused', () => {
    const t = add(emptyTasks(), 'one')
    const steps = (list: unknown) =>
      taskTool('task_steps', { number: 1, steps: list }, call(t, 'W'))
    expect(steps(['a', 'b']).ok).toBe(false)
    expect(steps(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).ok).toBe(false)
    expect(steps(['a', ' ', 'c']).ok).toBe(false)
    expect(steps('a, b, c').ok).toBe(false)
    expect(steps(['a', 'b', 'c']).ok).toBe(true)
    expect(steps(['a', 'b', 'c', 'd', 'e', 'f', 'g']).ok).toBe(true)
  })

  test('who may call: add and close only the orchestrator, and only in the mode; steps, progress and review only the assignee', () => {
    const t = add(emptyTasks(), 'one')
    expect(taskTool('task_add', { title: 'x', assignee: 'b1' }, call(t, 'W')).text).toBe(
      'Only the orchestrator adds tasks.',
    )
    expect(taskTool('task_add', { title: 'x', assignee: 'b1' }, call(t, 'O', null)).text).toBe(
      'The orchestration mode is off in this project.',
    )
    expect(taskTool('task_close', { number: 1, outcome: 'done' }, call(t, 'O', null)).ok).toBe(
      false,
    )
    for (const [tool, args] of [
      ['task_steps', { number: 1, steps: ['a', 'b', 'c'] }],
      ['task_progress', { number: 1, note: 'n' }],
      ['task_review', { number: 1, note: 'n' }],
    ] as const) {
      expect(taskTool(tool, args, call(t, 'V'))).toEqual({
        ok: false,
        text: 'Only the session the task is assigned to reports on it.',
      })
      expect(taskTool(tool, args, call(t, 'O')).ok).toBe(false)
    }
  })

  test('refusals: no title, an unknown assignee, no number, progress before steps, a step out of range, a closed task, an outcome it cannot be', () => {
    let t = add(emptyTasks(), 'one')
    expect(taskTool('task_add', { assignee: 'b1' }, call(t, 'O')).ok).toBe(false)
    expect(taskTool('task_add', { title: 'x', assignee: 'nobody' }, call(t, 'O')).text).toBe(
      'No session of your project is called "nobody".',
    )
    expect(taskTool('task_progress', { note: 'n' }, call(t, 'W')).ok).toBe(false)
    expect(taskTool('task_progress', { number: 9, note: 'n' }, call(t, 'W')).text).toBe(
      'This project has no task 9.',
    )
    expect(taskTool('task_progress', { number: 1, note: 'n' }, call(t, 'W')).text).toBe(
      "Set the task's steps first, with task_steps.",
    )
    expect(taskTool('task_review', { number: 1, note: 'n' }, call(t, 'W')).ok).toBe(false)
    t = taskTool('task_steps', { number: 1, steps: ['a', 'b', 'c'] }, call(t, 'W')).tasks ?? t
    expect(taskTool('task_progress', { number: 1, step: 4, note: 'n' }, call(t, 'W')).ok).toBe(
      false,
    )
    expect(taskTool('task_progress', { number: 1, step: 2 }, call(t, 'W')).ok).toBe(false)
    expect(taskTool('task_close', { number: 1, outcome: 'finished' }, call(t, 'O')).ok).toBe(false)
    t = taskTool('task_close', { number: 1, outcome: 'dropped' }, call(t, 'O')).tasks ?? t
    expect(taskTool('task_progress', { number: 1, note: 'n' }, call(t, 'W')).text).toBe(
      'Task 1 is closed.',
    )
    expect(taskTool('task_close', { number: 1, outcome: 'done' }, call(t, 'O')).text).toBe(
      'Task 1 is closed.',
    )
  })

  test('the orchestrator may add a task with the ★', () => {
    const added = taskTool(
      'task_add',
      { title: 'x', assignee: 'b1', star: true },
      call(emptyTasks(), 'O'),
    )
    expect(tasksOf(added.tasks ?? emptyTasks(), 'p1')[0]?.star).toBe(true)
  })

  test('task_list: anyone; open tasks, ★ first; all adds the closed ones', () => {
    let t = add(add(emptyTasks(), 'Docs', 'V'), 'Release 0.2', 'W', true)
    t =
      taskTool('task_steps', { number: 2, steps: ['a', 'b', 'c', 'd', 'e'] }, call(t, 'W')).tasks ??
      t
    t =
      taskTool('task_progress', { number: 2, step: 3, note: 'building .deb' }, call(t, 'W'))
        .tasks ?? t
    t = add(t, 'Old')
    t = closeTask(t, 'p1', 3, 'done', LATER)?.tasks ?? t
    expect(taskTool('task_list', {}, call(t, 'V')).text).toBe(
      [
        '2. ★ Release 0.2 · b1 · in progress 3/5 · building .deb',
        '   1. a\n   2. b\n → 3. c\n   4. d\n   5. e',
        '1. Docs · b2 · queued',
      ].join('\n'),
    )
    expect(taskTool('task_list', { all: true }, call(t, 'V')).text).toContain('3. Old · b1 · done')
    expect(taskTool('task_list', {}, call(emptyTasks(), 'V')).text).toBe('No open tasks.')
  })
})
