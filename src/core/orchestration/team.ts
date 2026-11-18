// Imports nothing that needs Node: the renderer reads these too.

// What decides whether Menkar may park, count or hide a session: only the orchestrator's own
// children without a role label are workers. Experts, consultants (loose, no parent) and sessions
// the human started are never parked, counted or hidden by Menkar.
export interface WorkerTeam {
  readonly orchestrator: string | null
  // By child id, as `keptParents` gives them.
  readonly parents: Readonly<Record<string, string>>
  readonly roles: Readonly<Record<string, string>>
  // Absent: unlimited.
  readonly cap?: number
}

export const isWorker = (team: WorkerTeam, id: string): boolean =>
  team.orchestrator !== null &&
  team.parents[id] === team.orchestrator &&
  team.roles[id] === undefined

// Whether a worker's tab may leave the strip (decision 1.176): a worker the human took "with you"
// keeps an ordinary tab, like experts and every session that is not a worker.
export const backgroundable = (team: WorkerTeam, withYou: readonly string[], id: string): boolean =>
  isWorker(team, id) && !withYou.includes(id)
