import type { ShownState } from '../agentstate/shown'

// What decides a tab's input in the mode: the project as main and the window both hold it.
export interface Team {
  readonly parents: Readonly<Record<string, string>>
  readonly orchestration: {
    readonly on: boolean
    readonly orchestrator: string | null
    readonly withYou: readonly string[]
  }
}

function underOrchestrator(session: string, team: Team): boolean {
  const o = team.orchestration
  return o.on && o.orchestrator !== null && team.parents[session] === o.orchestrator
}

export type Banner = 'reports' | 'permission' | 'withYou'

// Decision 1.101: the orchestrator gives a child its work, so keys typed there would cross its
// instructions; the human takes control first. A permission prompt is the human's to answer.
export function bannerOf(
  session: string | null,
  team: Team | undefined,
  shown: ShownState | null | undefined,
): Banner | null {
  if (!session || !team || !underOrchestrator(session, team)) return null
  if (team.orchestration.withYou.includes(session)) return 'withYou'
  return shown === 'blocked' ? 'permission' : 'reports'
}

export function readOnly(
  session: string | null,
  team: Team | undefined,
  shown: ShownState | null | undefined,
): boolean {
  return bannerOf(session, team, shown) === 'reports'
}
