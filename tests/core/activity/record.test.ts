import { describe, expect, test } from 'vitest'
import { PromptTracker } from '../../../src/core/activity/prompts'
import { type SessionIdByName, taskEvents, topicEvents } from '../../../src/core/activity/record'
import {
  addTask,
  closeTask,
  emptyTasks,
  followTasks,
  type Task,
  type Tasks,
} from '../../../src/core/orchestration/tasks'
import {
  addTopic,
  closeTopic,
  emptyTopics,
  type Topics,
  updateTopic,
} from '../../../src/core/orchestration/topics'
import { JOURNAL_VERSION, parseJournalLine } from '../../../src/core/usage/activity'

const AT = '2026-11-18T23:59:59.000-03:00'
const P = 'project-a'

// Task 3 in project P, in the state given, with nothing else changed.
function withTask(edit: (task: Task) => Task, base?: Tasks): Tasks {
  let t = base ?? emptyTasks()
  if (!base)
    for (let i = 0; i < 3; i++)
      t = addTask(t, P, { title: `Task title ${i}`, star: false }, AT).tasks
  const own = t.projects[P]
  if (!own) throw new Error('no project')
  return {
    ...t,
    projects: {
      ...t.projects,
      [P]: { ...own, tasks: own.tasks.map((x) => (x.number === 3 ? edit(x) : x)) },
    },
  }
}

const inProgress = withTask((x) => ({
  ...x,
  state: 'in progress',
  steps: ['a', 'b', 'c'],
  step: 1,
}))
const nobody: SessionIdByName = () => undefined

describe('task events', () => {
  test('a task state change is recorded once, with whom it waits on', () => {
    const after = withTask((x) => ({ ...x, state: 'waiting', waitingOn: 'topic 4' }), inProgress)
    expect(taskEvents(inProgress, after, nobody)).toEqual([
      {
        kind: 'task_state',
        projectId: P,
        task: 3,
        state: 'waiting',
        waitKind: 'topic',
        waitRef: '4',
      },
    ])
  })

  test('a typed session name is never stored: it becomes the id of the session it names', () => {
    const after = withTask((x) => ({ ...x, state: 'waiting', waitingOn: 'reviewer' }), inProgress)
    const known: SessionIdByName = (project, name) =>
      project === P && name === 'reviewer' ? 's1' : undefined
    const named = taskEvents(inProgress, after, known)
    expect(named).toEqual([
      {
        kind: 'task_state',
        projectId: P,
        task: 3,
        state: 'waiting',
        waitKind: 'session',
        waitRef: 's1',
      },
    ])
    const unknown = taskEvents(inProgress, after, nobody)
    expect(unknown).toEqual([
      { kind: 'task_state', projectId: P, task: 3, state: 'waiting', waitKind: 'other' },
    ])
    for (const e of [...named, ...unknown]) expect(Object.values(e)).not.toContain('reviewer')
  })

  test('the session name is resolved in the task’s own project', () => {
    const after = withTask((x) => ({ ...x, state: 'waiting', waitingOn: 'reviewer' }), inProgress)
    const elsewhere: SessionIdByName = (project) => (project === 'project-b' ? 's9' : undefined)
    expect(taskEvents(inProgress, after, elsewhere)[0]).toMatchObject({ waitKind: 'other' })
  })

  test('a review’s waiter is recorded; its note is not', () => {
    const after = withTask(
      (x) => ({ ...x, state: 'to review', reviewWait: { on: 'pr-merge', note: '#12' } }),
      inProgress,
    )
    const events = taskEvents(inProgress, after, nobody)
    expect(events).toEqual([
      { kind: 'task_state', projectId: P, task: 3, state: 'to review', waitKind: 'pr-merge' },
    ])
    expect(JSON.stringify(events)).not.toContain('#12')
  })

  test('a change of whom it waits on alone is recorded', () => {
    const waiting = withTask((x) => ({ ...x, state: 'waiting', waitingOn: 'topic 4' }), inProgress)
    const other = withTask((x) => ({ ...x, waitingOn: 'topic 5' }), waiting)
    expect(taskEvents(waiting, other, nobody)).toEqual([
      {
        kind: 'task_state',
        projectId: P,
        task: 3,
        state: 'waiting',
        waitKind: 'topic',
        waitRef: '5',
      },
    ])
    const review = withTask(
      (x) => ({ ...x, state: 'to review', reviewWait: { on: 'orchestrator', note: '' } }),
      inProgress,
    )
    const human = withTask((x) => ({ ...x, reviewWait: { on: 'human', note: '' } }), review)
    expect(taskEvents(review, human, nobody)).toEqual([
      { kind: 'task_state', projectId: P, task: 3, state: 'to review', waitKind: 'human' },
    ])
    const noteOnly = withTask((x) => ({ ...x, reviewWait: { on: 'human', note: '#13' } }), human)
    expect(taskEvents(human, noteOnly, nobody)).toEqual([])
  })

  test('a new task is recorded; a closed one too', () => {
    const before = emptyTasks()
    const added = addTask(before, P, { title: 'Secret title', star: false, assignee: 'w1' }, AT)
    const events = taskEvents(before, added.tasks, nobody)
    expect(events).toEqual([
      { kind: 'task_state', projectId: P, task: 1, state: 'queued', assignee: 'w1' },
    ])
    expect(JSON.stringify(events)).not.toContain('Secret title')
    const review = withTask(
      (x) => ({ ...x, state: 'to review', reviewWait: { on: 'orchestrator', note: '' } }),
      inProgress,
    )
    const done = closeTask(review, P, 3, 'done', AT)
    if (!done) throw new Error('no task')
    expect(taskEvents(review, done.tasks, nobody)).toEqual([
      { kind: 'task_state', projectId: P, task: 3, state: 'done' },
    ])
  })

  test('an assignee change alone is not a state change', () => {
    const assigned = withTask((x) => ({ ...x, assignee: 'old-id' }), inProgress)
    expect(taskEvents(assigned, followTasks(assigned, 'old-id', 'new-id'), nobody)).toEqual([])
  })

  test('a note or step change is not a state change', () => {
    const step2 = withTask((x) => ({ ...x, step: 2, note: 'further on' }), inProgress)
    expect(taskEvents(inProgress, step2, nobody)).toEqual([])
  })

  test('each project is diffed apart: the same number elsewhere is another task', () => {
    const other = addTask(inProgress, 'project-b', { title: 'x', star: false }, AT).tasks
    expect(taskEvents(inProgress, other, nobody)).toEqual([
      { kind: 'task_state', projectId: 'project-b', task: 1, state: 'queued' },
    ])
  })
})

function topics(): Topics {
  return addTopic(
    emptyTopics(),
    P,
    { title: 'Topic title', context: 'Topic context', from: 'orch', blocking: false, task: 7 },
    AT,
  ).topics
}

describe('topic events', () => {
  test('discussing and closing a topic are recorded; other edits are not', () => {
    const open = topics()
    const discussing = updateTopic(open, P, 1, { status: 'discussing' }, AT)?.topics
    if (!discussing) throw new Error('no topic')
    expect(topicEvents(open, discussing)).toEqual([
      { kind: 'topic_discussed', projectId: P, topic: 1, task: 7 },
    ])
    const closed = closeTopic(discussing, P, 1, 'Decided', AT)?.topics
    if (!closed) throw new Error('no topic')
    expect(topicEvents(discussing, closed)).toEqual([
      { kind: 'topic_closed', projectId: P, topic: 1, task: 7 },
    ])
    const retitled = updateTopic(open, P, 1, { title: 'Other title' }, AT)?.topics
    if (!retitled) throw new Error('no topic')
    expect(topicEvents(open, retitled)).toEqual([])
    const closedFromOpen = closeTopic(open, P, 1, 'Decided', AT)?.topics
    if (!closedFromOpen) throw new Error('no topic')
    const events = topicEvents(open, closedFromOpen)
    expect(events).toEqual([{ kind: 'topic_closed', projectId: P, topic: 1, task: 7 }])
    expect(JSON.stringify(events)).not.toMatch(/Topic title|Topic context|Decided/)
  })

  test('a topic raised is not an event, and a topic with no task carries none', () => {
    const before = emptyTopics()
    const raised = addTopic(before, P, { title: 't', context: 'c', from: 'w', blocking: true }, AT)
    expect(topicEvents(before, raised.topics)).toEqual([])
    const closed = closeTopic(raised.topics, P, 1, 'd', AT)?.topics
    if (!closed) throw new Error('no topic')
    expect(topicEvents(raised.topics, closed)).toEqual([
      { kind: 'topic_closed', projectId: P, topic: 1 },
    ])
  })

  // Its answer is already a prompt answered; recording it again would count one act twice.
  test('a permission topic is not recorded', () => {
    const before = emptyTopics()
    const raised = addTopic(
      before,
      P,
      { title: 't', context: 'c', from: 'w', blocking: true, kind: 'permission' },
      AT,
    ).topics
    const closed = closeTopic(raised, P, 1, 'answered', AT)?.topics
    if (!closed) throw new Error('no topic')
    expect(topicEvents(before, raised)).toEqual([])
    expect(topicEvents(raised, closed)).toEqual([])
  })
})

// Main journals each event with its version, id and time; a field named apart from the line's
// would be dropped as a bad line at import.
test('every event, stamped, is a line the importer keeps', () => {
  const waiting = withTask((x) => ({ ...x, state: 'waiting', waitingOn: 'topic 4' }), inProgress)
  const open = topics()
  const discussing = updateTopic(open, P, 1, { status: 'discussing' }, AT)?.topics
  if (!discussing) throw new Error('no topic')
  const tracker = new PromptTracker()
  tracker.change('p1', 's1', 'idle', 'blocked', 100)
  const events = [
    ...taskEvents(inProgress, waiting, nobody),
    ...taskEvents(
      emptyTasks(),
      addTask(emptyTasks(), P, { title: 't', star: false, assignee: 'w1' }, AT).tasks,
      nobody,
    ),
    ...topicEvents(open, discussing),
    tracker.change('p1', 's1', 'blocked', 'working', 101),
  ]
  expect(events).toHaveLength(4)
  for (const e of events) {
    const line = JSON.stringify({ v: JOURNAL_VERSION, id: 'x1', at: 1000, ...e })
    expect(parseJournalLine(line)).toEqual(JSON.parse(line))
  }
})
