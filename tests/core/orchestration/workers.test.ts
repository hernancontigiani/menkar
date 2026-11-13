// A worker per task (decision 1.118): named after its project and task, bounded by a per-project
// cap on how many run at once; experts, consultants and sessions the human started are never
// counted.
import { describe, expect, test } from 'vitest'
import type { Task } from '../../../src/core/orchestration/tasks'
import {
  atCap,
  capRefusal,
  capTool,
  hideOnClose,
  mayPark,
  startName,
  type WorkerTeam,
  workerName,
} from '../../../src/core/orchestration/workers'

describe('workers', () => {
  // The project's name lowercased, every run of other characters one dash: names are unique across
  // the machine, so two projects' `t42` never collide.
  test.each([
    ['Confidential AI', 42, 'confidential-ai-t42'],
    ['menkar', 7, 'menkar-t7'],
    ['  Two  --  Words!! ', 3, 'two-words-t3'],
  ])('%s, task %i → %s', (project, n, name) => {
    expect(workerName(project, n)).toBe(name)
  })

  // The cap counts the orchestrator's running children without a role label; an expert, a loose
  // consultant, a session the human started and a parked worker do not count.
  test('cap 2; running W1, W2, expert E, consultant C, human H, parked W3 → at cap; W2 stops → not', () => {
    const team: WorkerTeam = {
      orchestrator: 'O',
      parents: { W1: 'O', W2: 'O', W3: 'O', E: 'O' },
      roles: { E: 'Fabric expert' },
      cap: 2,
    }
    const running = new Set(['O', 'W1', 'W2', 'E', 'C', 'H'])
    expect(atCap(team, running)).toBe(true)
    expect(capRefusal(team, running)).toBe(
      'This project runs at most 2 workers at once; 2 are running. Leave the task queued and start it when one finishes.',
    )
    running.delete('W2')
    expect(atCap(team, running)).toBe(false)
    expect(capRefusal(team, running)).toBeNull()
  })

  test('no cap is unlimited', () => {
    const team: WorkerTeam = { orchestrator: 'O', parents: { W1: 'O', W2: 'O' }, roles: {} }
    expect(atCap(team, new Set(['W1', 'W2']))).toBe(false)
  })
})

// Decision 1.123: the orchestrator sets the project's cap when the human asks; nobody else does.
describe('set_workers_cap', () => {
  const team: WorkerTeam = { orchestrator: 'O', parents: {}, roles: {} }

  test('refused: not the orchestrator, the mode off, a cap that is not a positive integer', () => {
    expect(capTool({ cap: 2 }, team, 'W')).toEqual({
      ok: false,
      text: "Only this project's orchestrator sets its workers cap.",
    })
    expect(capTool({ cap: 2 }, { ...team, orchestrator: null }, 'O')).toEqual({
      ok: false,
      text: 'The orchestration mode is off in this project.',
    })
    for (const cap of [0, -1, 2.5, '2', true])
      expect(capTool({ cap }, team, 'O')).toEqual({
        ok: false,
        text: 'cap must be a whole number from 1, or null for unlimited.',
      })
  })

  test('a number sets it; null or absent is unlimited', () => {
    expect(capTool({ cap: 3 }, team, 'O')).toEqual({
      ok: true,
      text: 'This project runs at most 3 workers at once.',
      cap: 3,
    })
    for (const args of [{ cap: null }, {}])
      expect(capTool(args, team, 'O')).toEqual({
        ok: true,
        text: 'This project runs any number of workers at once.',
        cap: null,
      })
  })
})

// Decision 1.118: with a task, Menkar names the worker; without a task, a name is needed.
describe("start_session's name", () => {
  test.each([
    [{ name: ' api ' }, { name: 'api' }],
    [{ task: 42 }, { name: 'confidential-ai-t42', task: 42 }],
    [
      { task: 42, name: 'confidential-ai-t42' },
      { name: 'confidential-ai-t42', task: 42 },
    ],
    [{}, { refusal: 'A name is needed to start a session: give name, or task.' }],
    [{ name: '  ' }, { refusal: 'A name is needed to start a session: give name, or task.' }],
    [
      { task: 42, name: 'b1' },
      {
        refusal:
          'A worker for task 42 is called "confidential-ai-t42"; omit the name or give that one.',
      },
    ],
    [{ task: '42' }, { refusal: "task must be the task's number." }],
    [{ task: 0 }, { refusal: "task must be the task's number." }],
  ])('%j → %j', (args, expected) => {
    expect(startName(args, 'Confidential AI')).toEqual(expected)
  })
})

// Decisions 1.118 and 1.120: only a per-task worker the orchestrator started is parked, and only
// while its task waits; experts, consultants and sessions the human started never are.
describe('parking', () => {
  const team: WorkerTeam = {
    orchestrator: 'O',
    parents: { W: 'O', E: 'O' },
    roles: { E: 'Fabric expert' },
  }
  const task = (state: Task['state'], assignee = 'W'): Task => ({
    number: 1,
    title: 't',
    assignee,
    star: false,
    state,
    steps: ['a', 'b', 'c'],
    step: 1,
    note: '',
    created: '',
    updated: '',
  })

  test('in progress → refused; waiting → allowed; caller not orchestrator → refused', () => {
    expect(mayPark(team, 'O', 'W', task('in progress'))).toBe(
      'Park a worker only while its task is waiting: report it waiting first (task_progress with waiting_on).',
    )
    expect(mayPark(team, 'O', 'W', task('waiting'))).toBeNull()
    expect(mayPark(team, 'W', 'W', task('waiting'))).toBe(
      "Only this project's orchestrator parks a session.",
    )
    expect(mayPark({ ...team, orchestrator: null }, 'O', 'W', task('waiting'))).not.toBeNull()
  })

  test('an expert, a consultant and a session the human started are never parked', () => {
    for (const id of ['E', 'C', 'H'])
      expect(mayPark(team, 'O', id, task('waiting', id))).toBe(
        'Only a worker you started, with no role, is parked: experts, consultants and sessions the human started never are.',
      )
  })
})

// Decision 1.120: a closed task's worker is hidden at once, only when it is the orchestrator's
// child named for that very task.
describe('closing hides only the task worker', () => {
  const team: WorkerTeam = {
    orchestrator: 'O',
    parents: { a: 'O', b: 'O', c: 'O', d: 'O' },
    roles: { d: 'Fabric expert' },
  }
  const names: Record<string, string> = {
    a: 'p-t42',
    b: 'controlplane',
    c: 'p-t41',
    d: 'p-t42',
    h: 'p-t42',
  }
  const nameOf = (id: string) => names[id] ?? id

  test.each([
    ['a', true],
    ['b', false],
    ['c', false],
    ['d', false],
    ['h', false],
  ])('task 42 of "P", assignee %s → %s', (assignee, hide) => {
    expect(hideOnClose(team, 'P', { number: 42, assignee }, nameOf)).toBe(hide)
  })

  test('an unassigned task hides nothing', () => {
    expect(hideOnClose(team, 'P', { number: 42 }, nameOf)).toBe(false)
  })
})
