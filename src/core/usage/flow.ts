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
  for (const [task, list] of byTask) {
    const sorted = [...list].sort((a, b) => a.at - b.at)
    const first = sorted[0]
    const marked = first?.baseline === true && first.at > bounds.start
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
  return { bounds, tasks, sinceBaseline, states: figures }
}
