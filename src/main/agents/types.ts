import type { PostOutcome } from '../../core/control/post'
import type { WorkCounts } from '../../core/orchestration/counts'

// The team block's delivery on main's side: how a change is told to a running session.
export interface MainTeamDelivery {
  tell(sessionId: string, text: string, counts: WorkCounts | undefined): Promise<PostOutcome>
}

export interface MainAgentKit {
  // The settings file the agent's sessions are started with, written when it changed; null when
  // the agent takes none.
  readonly settings: (() => Promise<string>) | null
  readonly team: MainTeamDelivery | null
}
