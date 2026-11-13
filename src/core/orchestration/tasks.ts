import { basename } from 'node:path'
import { readJsonReport, UnreadableShape, writeJson } from '../jsonstate'
import { tasksPath } from '../paths'
import { localDay, midnight } from '../usage/periods'
import { TASK_STATES, type TaskState } from './taskState'

export type { TaskState }

export interface Task {
  // Per project, never reused.
  readonly number: number
  readonly title: string
  // A session id, shown by its current name.
  readonly assignee: string
  readonly star: boolean
  readonly state: TaskState
  // Set by the assignee; empty while queued.
  readonly steps: readonly string[]
  // 1-based; 0 while queued.
  readonly step: number
  // The latest report, one line.
  readonly note: string
  readonly waitingOn?: string
  readonly created: string
  readonly updated: string
  readonly closed?: string
}

interface ProjectTasks {
  // Higher than every number this project ever had.
  readonly next: number
  readonly tasks: readonly Task[]
}

export interface Tasks {
  readonly projects: Readonly<Record<string, ProjectTasks>>
  // Keys a later version wrote, written back as they came.
  readonly rest: Readonly<Record<string, unknown>>
}

export const TASKS_VERSION = 1
export const MIN_STEPS = 3
export const MAX_STEPS = 7

const CLOSED: readonly TaskState[] = ['done', 'dropped']
export const isOpen = (x: Task): boolean => !CLOSED.includes(x.state)

export function emptyTasks(): Tasks {
  return { projects: {}, rest: {} }
}

export function tasksOf(t: Tasks, projectId: string): readonly Task[] {
  return t.projects[projectId]?.tasks ?? []
}

const withProject = (t: Tasks, projectId: string, p: ProjectTasks): Tasks => ({
  ...t,
  projects: { ...t.projects, [projectId]: p },
})

export interface NewTask {
  readonly title: string
  readonly assignee: string
  readonly star: boolean
}

// `at` is the time, an ISO string from the clock.
export function addTask(
  t: Tasks,
  projectId: string,
  task: NewTask,
  at: string,
): { readonly tasks: Tasks; readonly number: number } {
  const own = t.projects[projectId] ?? { next: 1, tasks: [] }
  const number = own.next
  const added: Task = {
    number,
    ...task,
    state: 'queued',
    steps: [],
    step: 0,
    note: '',
    created: at,
    updated: at,
  }
  return {
    tasks: withProject(t, projectId, { next: number + 1, tasks: [...own.tasks, added] }),
    number,
  }
}

function change(
  t: Tasks,
  projectId: string,
  number: number,
  edit: (task: Task) => Task,
): { readonly tasks: Tasks; readonly task: Task } | null {
  const own = t.projects[projectId]
  const found = own?.tasks.find((x) => x.number === number)
  if (!own || !found) return null
  const task = edit(found)
  return {
    tasks: withProject(t, projectId, {
      ...own,
      tasks: own.tasks.map((x) => (x === found ? task : x)),
    }),
    task,
  }
}

const notWaiting = (task: Task): Task => {
  const { waitingOn: _, ...rest } = task
  return rest
}

export function closeTask(
  t: Tasks,
  projectId: string,
  number: number,
  outcome: 'done' | 'dropped',
  at: string,
): { readonly tasks: Tasks; readonly task: Task } | null {
  return change(t, projectId, number, (task) => ({
    ...notWaiting(task),
    state: outcome,
    updated: at,
    closed: at,
  }))
}

// null when the project has no task with that number.
export function setTaskStar(
  t: Tasks,
  projectId: string,
  number: number,
  star: boolean,
  at: string,
): Tasks | null {
  return change(t, projectId, number, (task) => ({ ...task, star, updated: at }))?.tasks ?? null
}

// A session that took a new id keeps its tasks.
export function followTasks(t: Tasks, from: string, to: string): Tasks {
  if (!Object.values(t.projects).some((p) => p.tasks.some((x) => x.assignee === from))) return t
  const projects: Record<string, ProjectTasks> = {}
  for (const [id, p] of Object.entries(t.projects))
    projects[id] = {
      ...p,
      tasks: p.tasks.map((x) => (x.assignee === from ? { ...x, assignee: to } : x)),
    }
  return { ...t, projects }
}

// Open ones, ★ first, then by number.
export function openTasks(list: readonly Task[]): Task[] {
  return list.filter(isOpen).sort((a, b) => Number(b.star) - Number(a.star) || a.number - b.number)
}

// Its task in progress or waiting, else its oldest queued one.
export function currentTask(list: readonly Task[], sessionId: string): Task | undefined {
  const own = list.filter((x) => x.assignee === sessionId).sort((a, b) => a.number - b.number)
  return (
    own.find((x) => x.state === 'in progress' || x.state === 'waiting') ??
    own.find((x) => x.state === 'queued')
  )
}

// Whether the session's current task has the ★: its row shows it, and its wakes come first.
export function onStarredTask(list: readonly Task[], sessionId: string): boolean {
  return currentTask(list, sessionId)?.star === true
}

// The numbers of the open tasks with the ★.
export function starredTasks(list: readonly Task[]): Set<number> {
  return new Set(list.filter((x) => x.star && isOpen(x)).map((x) => x.number))
}

// Closed tasks, done or dropped, split at the local midnight before `nowMs`; each part newest
// first. A close later than `nowMs`'s day counts as today.
export function closedOn(
  list: readonly Task[],
  nowMs: number,
): { readonly today: Task[]; readonly before: Task[] } {
  const start = midnight(localDay(nowMs / 1000)) * 1000
  const closed = list
    .flatMap((x) => (!isOpen(x) && x.closed ? [{ x, at: Date.parse(x.closed) }] : []))
    .sort((a, b) => b.at - a.at)
  return {
    today: closed.filter(({ at }) => at >= start).map(({ x }) => x),
    before: closed.filter(({ at }) => !(at >= start)).map(({ x }) => x),
  }
}

// Closed as done since the local midnight before `nowMs`, newest first.
export function doneToday(list: readonly Task[], nowMs: number): Task[] {
  return closedOn(list, nowMs).today.filter((x) => x.state === 'done')
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseTask(value: unknown): Task | null {
  if (!isObject(value)) return null
  const { number, title, assignee, star, state, steps, step, note, created, updated, closed } =
    value
  const waitingOn = value.waiting_on
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return null
  if (typeof title !== 'string' || typeof assignee !== 'string') return null
  const known = TASK_STATES.find((s) => s === state) ?? 'queued'
  const lines = Array.isArray(steps) ? steps.filter((x): x is string => typeof x === 'string') : []
  const at = typeof step === 'number' && Number.isInteger(step) ? step : 0
  return {
    number,
    title,
    assignee,
    star: star === true,
    state: known,
    steps: lines,
    step: Math.max(0, Math.min(at, lines.length)),
    note: typeof note === 'string' ? note : '',
    ...(typeof waitingOn === 'string' && known === 'waiting' ? { waitingOn } : {}),
    created: typeof created === 'string' ? created : '',
    updated: typeof updated === 'string' ? updated : '',
    ...(typeof closed === 'string' ? { closed } : {}),
  }
}

// Version 1: a file of another shape is unreadable (moved aside); within it, a task that is not
// one is dropped, a number seen twice keeps its first, and `next` never falls to a number in use.
export function parseTasks(value: unknown): Tasks {
  if (!isObject(value)) throw new UnreadableShape('not an object')
  const { version, projects, ...rest } = value
  if (version !== TASKS_VERSION) throw new UnreadableShape('not version 1')
  const read: Record<string, ProjectTasks> = {}
  for (const [id, raw] of Object.entries(isObject(projects) ? projects : {})) {
    if (!isObject(raw)) continue
    const seen = new Set<number>()
    const tasks: Task[] = []
    for (const entry of Array.isArray(raw.tasks) ? raw.tasks : []) {
      const task = parseTask(entry)
      if (!task || seen.has(task.number)) continue
      seen.add(task.number)
      tasks.push(task)
    }
    const highest = Math.max(0, ...seen)
    const next = typeof raw.next === 'number' && Number.isInteger(raw.next) ? raw.next : 1
    read[id] = { next: Math.max(next, highest + 1), tasks }
  }
  return { projects: read, rest }
}

export function serializeTasks(t: Tasks): Record<string, unknown> {
  const projects: Record<string, unknown> = {}
  for (const [id, p] of Object.entries(t.projects))
    projects[id] = {
      next: p.next,
      tasks: p.tasks.map(({ waitingOn, ...x }) => ({
        ...x,
        ...(waitingOn !== undefined ? { waiting_on: waitingOn } : {}),
      })),
    }
  return { ...t.rest, version: TASKS_VERSION, projects }
}

export async function loadTasks(): Promise<{
  readonly tasks: Tasks
  readonly movedTo: string | null
}> {
  const report = await readJsonReport(tasksPath(), parseTasks, emptyTasks)
  return {
    tasks: report.value,
    movedTo: report.movedTo === null ? null : basename(report.movedTo),
  }
}

export function saveTasks(t: Tasks): Promise<void> {
  return writeJson(tasksPath(), serializeTasks(t))
}

export type TaskTool =
  | 'task_add'
  | 'task_steps'
  | 'task_progress'
  | 'task_review'
  | 'task_close'
  | 'task_list'

export interface TaskCall {
  readonly tasks: Tasks
  readonly projectId: string
  // The calling session's id.
  readonly caller: string
  // The project's orchestrator while the mode is on; null otherwise.
  readonly orchestrator: string | null
  readonly nameOf: (id: string) => string
  readonly idOf: (name: string) => { readonly id: string } | { readonly refusal: string }
  readonly at: string
}

const MODE_OFF = 'The orchestration mode is off in this project.'
const NOT_ASSIGNEE = 'Only the session the task is assigned to reports on it.'

// A task tool's answer, in English for the agent that called, and the tasks to keep when they
// changed. Who may call is part of the decision (1.113): the orchestrator adds and closes, the
// assignee reports; a task closed only after the orchestrator reviewed it keeps "done" meaning
// reviewed.
export function taskTool(
  tool: TaskTool,
  args: Readonly<Record<string, unknown>>,
  call: TaskCall,
): { readonly ok: boolean; readonly text: string; readonly tasks?: Tasks } {
  const refuse = (text: string) => ({ ok: false, text })
  const text = (key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '')
  const list = tasksOf(call.tasks, call.projectId)
  if (tool === 'task_list') {
    const shown =
      args.all === true ? [...openTasks(list), ...list.filter((x) => !isOpen(x))] : openTasks(list)
    if (shown.length === 0) return { ok: true, text: 'No open tasks.' }
    return { ok: true, text: shown.map((x) => taskLines(x, call.nameOf)).join('\n') }
  }
  if (tool === 'task_add') {
    if (call.orchestrator === null) return refuse(MODE_OFF)
    if (call.caller !== call.orchestrator) return refuse('Only the orchestrator adds tasks.')
    if (!text('title')) return refuse('A task needs a title.')
    if (!text('assignee')) return refuse('Name the session the task is for.')
    if (args.star !== undefined && typeof args.star !== 'boolean')
      return refuse('star must be true or false.')
    const found = call.idOf(text('assignee'))
    if ('refusal' in found) return refuse(found.refusal)
    const added = addTask(
      call.tasks,
      call.projectId,
      { title: text('title'), assignee: found.id, star: args.star === true },
      call.at,
    )
    return { ok: true, text: `Task ${added.number} added.`, tasks: added.tasks }
  }
  const number = args.number
  if (typeof number !== 'number' || !Number.isInteger(number))
    return refuse("Give the task's number.")
  const task = list.find((x) => x.number === number)
  if (!task) return refuse(`This project has no task ${number}.`)
  const closed = `Task ${number} is closed.`
  const edit = (next: (x: Task) => Task, answer: string) => {
    const changed = change(call.tasks, call.projectId, number, (x) => ({
      ...next(x),
      updated: call.at,
    }))
    return changed ? { ok: true, text: answer, tasks: changed.tasks } : refuse(closed)
  }
  if (tool === 'task_close') {
    if (call.orchestrator === null) return refuse(MODE_OFF)
    if (call.caller !== call.orchestrator)
      return refuse('Only the orchestrator closes a task, after reviewing it.')
    const outcome = args.outcome
    if (outcome !== 'done' && outcome !== 'dropped')
      return refuse('outcome must be "done" or "dropped".')
    if (!isOpen(task)) return refuse(closed)
    const done = closeTask(call.tasks, call.projectId, number, outcome, call.at)
    return done
      ? { ok: true, text: `Task ${number} closed as ${outcome}.`, tasks: done.tasks }
      : refuse(closed)
  }
  if (call.caller !== task.assignee) return refuse(NOT_ASSIGNEE)
  if (!isOpen(task)) return refuse(closed)
  if (tool === 'task_steps') {
    const steps = args.steps
    if (!Array.isArray(steps) || steps.some((x) => typeof x !== 'string' || !x.trim()))
      return refuse('steps must be a list of short, non-empty lines.')
    if (steps.length < MIN_STEPS || steps.length > MAX_STEPS)
      return refuse(`A task has ${MIN_STEPS} to ${MAX_STEPS} steps; you gave ${steps.length}.`)
    const lines = steps.map((x) => String(x).trim())
    return edit(
      (x) => ({ ...notWaiting(x), steps: lines, step: 1, state: 'in progress' }),
      `Task ${number} has ${lines.length} steps; it is in progress at step 1.`,
    )
  }
  if (task.steps.length === 0) return refuse("Set the task's steps first, with task_steps.")
  if (!text('note')) return refuse('Give a one-line note of where the task is.')
  const note = text('note').split('\n')[0] ?? ''
  if (tool === 'task_review')
    return edit(
      (x) => ({ ...notWaiting(x), state: 'to review', note }),
      `Task ${number} is to review: the orchestrator closes it.`,
    )
  const step = args.step
  if (
    step !== undefined &&
    (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > task.steps.length)
  )
    return refuse(`step must be a number from 1 to ${task.steps.length}.`)
  if (args.waiting_on !== undefined && (typeof args.waiting_on !== 'string' || !text('waiting_on')))
    return refuse('waiting_on must name a topic ("topic 4") or a session.')
  const waitingOn = text('waiting_on')
  const at = typeof step === 'number' ? step : task.step
  return edit(
    (x) =>
      waitingOn
        ? { ...x, step: at, note, state: 'waiting', waitingOn }
        : { ...notWaiting(x), step: at, note, state: 'in progress' },
    waitingOn
      ? `Task ${number} is waiting on ${waitingOn}, at step ${at} of ${task.steps.length}.`
      : `Task ${number} is at step ${at} of ${task.steps.length}.`,
  )
}

function taskLines(x: Task, nameOf: (id: string) => string): string {
  const star = x.star ? '★ ' : ''
  const where =
    x.steps.length > 0 && isOpen(x) && x.state !== 'queued'
      ? `${x.state} ${x.step}/${x.steps.length}`
      : x.state
  const parts = [
    `${x.number}. ${star}${x.title}`,
    nameOf(x.assignee),
    where,
    ...(x.waitingOn !== undefined ? [`on ${x.waitingOn}`] : []),
    ...(x.note ? [x.note] : []),
  ]
  const steps = isOpen(x)
    ? x.steps.map((s, i) => `${i + 1 === x.step ? ' → ' : '   '}${i + 1}. ${s}`)
    : []
  return [parts.join(' · '), ...steps].join('\n')
}
