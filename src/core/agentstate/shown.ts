import type { RawState } from './detect'

// What a pane shows on top of what its agent is doing: "done" when it finished while nobody was
// looking, until someone looks.
export const SHOWN_STATES = ['working', 'blocked', 'idle', 'done'] as const
export type ShownState = (typeof SHOWN_STATES)[number]

export interface PaneState {
  readonly paneId: string
  readonly sessionId: string | null
  readonly state: ShownState
}

// Every pane's shown state and every project's blocked count, as main sends them to the windows.
export interface AgentStates {
  readonly panes: readonly PaneState[]
  // project id → how many of its member sessions are blocked; projects at 0 are left out
  readonly blocked: Readonly<Record<string, number>>
}

// A raw state arriving for a pane: idle after working or done while unseen is done; otherwise the
// raw state. (Blocked → idle while unseen is idle; a done pane that turns working is working.)
export function nextShown(previous: ShownState, raw: RawState, seen: boolean): ShownState {
  if (raw === 'idle' && !seen && (previous === 'working' || previous === 'done')) return 'done'
  return raw
}

// The pane was looked at: done becomes idle.
export function afterSeen(state: ShownState): ShownState {
  return state === 'done' ? 'idle' : state
}

// A notification fires when an unseen pane's shown state changed to done or blocked.
export function notifies(previous: ShownState, next: ShownState, seen: boolean): boolean {
  return !seen && next !== previous && (next === 'done' || next === 'blocked')
}

// A tab's state: the most urgent of its panes'.
export function rollup(states: readonly ShownState[]): ShownState {
  for (const state of ['blocked', 'working', 'done'] as const)
    if (states.includes(state)) return state
  return 'idle'
}

// Blocked sessions per project; only members count.
export function blockedCounts(
  panes: readonly PaneState[],
  projectOf: (sessionId: string) => string | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {}
  const counted = new Set<string>()
  for (const pane of panes) {
    if (pane.state !== 'blocked' || pane.sessionId === null || counted.has(pane.sessionId)) continue
    const project = projectOf(pane.sessionId)
    if (project === undefined) continue
    counted.add(pane.sessionId)
    counts[project] = (counts[project] ?? 0) + 1
  }
  return counts
}

// The badge on a window's project dropdown: the blocked sessions of every project but the one it
// shows. 0 hides it.
export function faceBadge(blocked: Readonly<Record<string, number>>, shownProject: string): number {
  let sum = 0
  for (const [project, count] of Object.entries(blocked)) if (project !== shownProject) sum += count
  return sum
}
