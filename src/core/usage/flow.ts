import type { FlowFigure, FlowState, FlowStateFigure, TaskFlow } from './nodes'
import type { Bounds } from './periods'

// One row of the task_states table, as stored.
export interface TaskStateRow {
  readonly id: string
  readonly at: number
  readonly projectId: string
  readonly task: number
  readonly state: string
  readonly waitKind: string | null
  readonly waitRef: string | null
  readonly assignee: string | null
  readonly baseline: boolean
}

export const FLOW_STATES: readonly FlowState[] = ['queued', 'in progress', 'waiting', 'to review']
const WITH_WAITERS: ReadonlySet<string> = new Set(['waiting', 'to review'])
export const REVIEW_WAITERS: readonly string[] = [
  'orchestrator',
  'human',
  'pr-approval',
  'pr-merge',
]
const WAITING_WAITERS: readonly string[] = ['topic', 'session']
const WAITER_ORDER = [
  'topic',
  'session',
  'other',
  'orchestrator',
  'human',
  'pr-approval',
  'pr-merge',
]

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length === 0) return 0
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

// Per key, each task's seconds, and which of those tasks are counted from a baseline.
class Tally {
  readonly seconds = new Map<string, number>()
  readonly marked = new Set<string>()

  add(task: string, seconds: number, marked: boolean): void {
    this.seconds.set(task, (this.seconds.get(task) ?? 0) + seconds)
    if (marked) this.marked.add(task)
  }

  figure(): FlowFigure {
    const values = [...this.seconds.values()]
    return {
      tasks: values.length,
      medianSeconds: median(values),
      totalSeconds: values.reduce((s, v) => s + v, 0),
      sinceBaseline: this.marked.size,
    }
  }
}

const waiterRank = (w: string | null) => {
  const i = w === null ? -1 : WAITER_ORDER.indexOf(w)
  return i === -1 ? WAITER_ORDER.length + (w === null ? 1 : 0) : i
}

// How long tasks spent in each state inside `bounds`, from their rows: each row holds until the
// task's next row, the last one until `now`. `rows` must hold each task's last row before the
// window, which says what it was in when the window began (`UsageHistory.taskStateRows`).
//
// A stretch crossing the window's edge counts only its part inside, for the median as for the
// total, so the two describe the same time. A task whose first row is a baseline inside the window
// is counted from it, and marked: what it did before recording began is not known.
export function taskFlow(rows: readonly TaskStateRow[], bounds: Bounds, now: number): TaskFlow {
  const byTask = new Map<string, TaskStateRow[]>()
  for (const r of rows) {
    const key = JSON.stringify([r.projectId, r.task])
    const list = byTask.get(key) ?? []
    list.push(r)
    byTask.set(key, list)
  }
  const end = Math.min(bounds.end, now)
  const states = new Map<string, Tally>()
  const waiters = new Map<string, Map<string | null, Tally>>()
  const all = new Tally()
  const lastState = new Map<string, string>()
  const markedAt = new Map<string, number>()
  for (const [task, list] of byTask) {
    const sorted = [...list].sort((a, b) => a.at - b.at)
    const first = sorted[0]
    const marked = first?.baseline === true && first.at > bounds.start
    if (marked) markedAt.set(task, first.at)
    const last = sorted.filter((r) => r.at <= end).at(-1)
    if (last !== undefined) lastState.set(task, last.state)
    sorted.forEach((r, i) => {
      if (!(FLOW_STATES as readonly string[]).includes(r.state)) return
      const from = Math.max(r.at, bounds.start)
      const to = Math.min(sorted[i + 1]?.at ?? now, end)
      if (to <= from) return
      const tally = states.get(r.state) ?? new Tally()
      states.set(r.state, tally)
      tally.add(task, to - from, marked)
      all.add(task, to - from, marked)
      if (!WITH_WAITERS.has(r.state)) return
      const ofState = waiters.get(r.state) ?? new Map<string | null, Tally>()
      waiters.set(r.state, ofState)
      const ofWaiter = ofState.get(r.waitKind) ?? new Tally()
      ofState.set(r.waitKind, ofWaiter)
      ofWaiter.add(task, to - from, marked)
    })
  }
  const figures: FlowStateFigure[] = FLOW_STATES.map((state) => ({
    state,
    figure: (states.get(state) ?? new Tally()).figure(),
    waiters: [...(waiters.get(state) ?? new Map<string | null, Tally>())]
      .sort(([a], [b]) => waiterRank(a) - waiterRank(b) || String(a ?? '').localeCompare(String(b)))
      .map(([waiter, tally]) => ({ waiter, figure: tally.figure() })),
  }))
  const { tasks, sinceBaseline } = all.figure()
  let done = 0
  let dropped = 0
  const baselines: number[] = []
  for (const task of all.seconds.keys()) {
    const now = lastState.get(task)
    if (now === 'done') done += 1
    if (now === 'dropped') dropped += 1
    const at = all.marked.has(task) ? markedAt.get(task) : undefined
    if (at !== undefined) baselines.push(at)
  }
  return {
    bounds,
    tasks,
    done,
    dropped,
    open: tasks - done - dropped,
    sinceBaseline,
    baselineAt: baselines.length === 0 ? null : Math.min(...baselines),
    states: figures,
  }
}

export type FlowRow =
  | {
      readonly kind: 'state'
      readonly state: FlowState
      readonly figure: FlowFigure
      // of the largest state's total; 0 when every total is 0
      readonly share: number
    }
  | {
      readonly kind: 'waiter'
      readonly state: FlowState
      readonly waiter: string | null
      readonly figure: FlowFigure
      readonly share: number
    }

const NOTHING: FlowFigure = { tasks: 0, medianSeconds: 0, totalSeconds: 0, sinceBaseline: 0 }

// The rows the flow's table draws: each state, then whom it waits on. To review lists its four
// waiters and waiting its topic and session even when they hold no task, so the table keeps its
// shape from one period to the next.
export function flowTable(flow: TaskFlow): FlowRow[] {
  const largest = Math.max(0, ...flow.states.map((s) => s.figure.totalSeconds))
  const share = (f: FlowFigure) => (largest === 0 ? 0 : f.totalSeconds / largest)
  const rows: FlowRow[] = []
  for (const { state, figure, waiters } of flow.states) {
    rows.push({ kind: 'state', state, figure, share: share(figure) })
    if (!WITH_WAITERS.has(state)) continue
    const always = state === 'to review' ? REVIEW_WAITERS : WAITING_WAITERS
    const listed: { waiter: string | null; figure: FlowFigure }[] = always.map((waiter) => ({
      waiter,
      figure: waiters.find((w) => w.waiter === waiter)?.figure ?? NOTHING,
    }))
    for (const w of waiters) {
      if (w.waiter === null || !always.includes(w.waiter)) listed.push(w)
    }
    listed.sort((a, b) => waiterRank(a.waiter) - waiterRank(b.waiter))
    for (const w of listed) rows.push({ kind: 'waiter', state, ...w, share: share(w.figure) })
  }
  return rows
}
