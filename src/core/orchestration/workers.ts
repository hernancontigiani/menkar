import type { Project } from '../projects/model'
import { isCap, orchestrationInfo } from '../projects/orchestration'
import { keptParents, type Parents } from '../projects/parents'
import type { Task } from './tasks'

// Per project, so two projects' `t42` never collide: cross-session messages go by name across the
// whole machine.
export function workerName(project: string, task: number): string {
  const slug = project
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'project'}-t${task}`
}

// start_session's name: with a task, Menkar's; a name given beside it must be that one.
export function startName(
  args: Readonly<Record<string, unknown>>,
  project: string,
): { readonly name: string; readonly task?: number } | { readonly refusal: string } {
  const task = args.task
  const given = typeof args.name === 'string' ? args.name.trim() : ''
  if (task === undefined) return given ? { name: given } : { refusal: NO_NAME }
  if (typeof task !== 'number' || !Number.isInteger(task) || task < 1)
    return { refusal: "task must be the task's number." }
  const name = workerName(project, task)
  if (given && given !== name)
    return {
      refusal: `A worker for task ${task} is called "${name}"; omit the name or give that one.`,
    }
  return { name, task }
}

const NO_NAME = 'A name is needed to start a session: give name, or task.'

// What decides whether Menkar may park, count or hide a session: only the orchestrator's own
// children without a role label are workers. Experts, consultants (loose, no parent) and sessions
// the human started are never parked, counted or hidden by Menkar.
export interface WorkerTeam {
  readonly orchestrator: string | null
  readonly parents: Parents
  readonly roles: Readonly<Record<string, string>>
  // Absent: unlimited.
  readonly cap?: number
}

// With the mode off nothing is a worker: off is the ordinary Menkar.
export function workerTeam(p: Project): WorkerTeam {
  const o = orchestrationInfo(p)
  const cap = p.orchestration?.workersCap
  return {
    orchestrator: o.on ? o.orchestrator : null,
    parents: keptParents(p),
    roles: o.roles,
    ...(cap !== undefined ? { cap } : {}),
  }
}

// Whether a session start_session is about to start would count against the cap.
export const startsWorker = (
  team: WorkerTeam,
  caller: string,
  placement: { readonly loose: boolean; readonly role: string },
): boolean => team.orchestrator === caller && !placement.loose && placement.role === ''

export const isWorker = (team: WorkerTeam, id: string): boolean =>
  team.orchestrator !== null &&
  team.parents[id] === team.orchestrator &&
  team.roles[id] === undefined

// `running`: the sessions with a tab. Parked and stopped ones have none.
export function runningWorkers(team: WorkerTeam, running: ReadonlySet<string>): number {
  let n = 0
  for (const id of running) if (isWorker(team, id)) n++
  return n
}

export function atCap(team: WorkerTeam, running: ReadonlySet<string>): boolean {
  return team.cap !== undefined && runningWorkers(team, running) >= team.cap
}

// The refusal for a start or resume of a session that would count, written for the agent.
export function capRefusal(team: WorkerTeam, running: ReadonlySet<string>): string | null {
  if (!atCap(team, running) || team.cap === undefined) return null
  const n = runningWorkers(team, running)
  return `This project runs at most ${team.cap} workers at once; ${n} are running. Leave the task queued and start it when one finishes.`
}

// Parking is for per-task workers whose task waits long (a PR under review); null when allowed.
export function mayPark(
  team: WorkerTeam,
  caller: string,
  target: string,
  current: Task | undefined,
): string | null {
  if (team.orchestrator === null || caller !== team.orchestrator)
    return "Only this project's orchestrator parks a session."
  if (!isWorker(team, target))
    return 'Only a worker you started, with no role, is parked: experts, consultants and sessions the human started never are.'
  if (current?.state !== 'waiting')
    return 'Park a worker only while its task is waiting: report it waiting first (task_progress with waiting_on).'
  return null
}

// A closed task's worker goes away at once: only a worker the orchestrator started for that very
// task, by its name, so an expert holding the task is never touched.
export function hideOnClose(
  team: WorkerTeam,
  project: string,
  task: Pick<Task, 'number' | 'assignee'>,
  nameOf: (id: string) => string,
): boolean {
  const id = task.assignee
  if (id === undefined || !isWorker(team, id)) return false
  return nameOf(id) === workerName(project, task.number)
}

// set_workers_cap's answer, for the agent that called; `cap` is what to keep, null unlimited.
export function capTool(
  args: Readonly<Record<string, unknown>>,
  team: WorkerTeam,
  caller: string,
):
  | { readonly ok: true; readonly text: string; readonly cap: number | null }
  | { readonly ok: false; readonly text: string } {
  if (team.orchestrator === null)
    return { ok: false, text: 'The orchestration mode is off in this project.' }
  if (caller !== team.orchestrator)
    return { ok: false, text: "Only this project's orchestrator sets its workers cap." }
  const cap = args.cap
  if (cap === undefined || cap === null)
    return { ok: true, text: 'This project runs any number of workers at once.', cap: null }
  if (!isCap(cap))
    return { ok: false, text: 'cap must be a whole number from 1, or null for unlimited.' }
  return { ok: true, text: `This project runs at most ${cap} workers at once.`, cap }
}
