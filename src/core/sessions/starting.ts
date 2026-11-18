import type { AgentId } from '../agents/ids'
import type { SessionInfo } from './info'

export interface StartingPane {
  readonly sessionId: string
  readonly agent: AgentId
  readonly cwd: string | null
}

// A session with a pane whose agent has written no transcript yet (stopped before its first turn,
// at a trust dialog): the catalog lists transcripts, so the row stands in for the catalog's own.
// Its name is only the one it was started with, until its agent has one.
export function startingSessions(
  panes: readonly StartingPane[],
  catalog: readonly SessionInfo[],
  nameOf: (id: string) => string,
): SessionInfo[] {
  const known = new Set(catalog.map((s) => s.id))
  const seen = new Set<string>()
  return panes.flatMap((pane) => {
    if (known.has(pane.sessionId) || seen.has(pane.sessionId)) return []
    seen.add(pane.sessionId)
    return [
      {
        agent: pane.agent,
        id: pane.sessionId,
        name: nameOf(pane.sessionId),
        claudeNamed: false,
        file: '',
        folder: pane.cwd ?? '',
        cwd: pane.cwd,
        preview: '',
        badge: null,
        mtimeMs: 0,
        size: 0,
        hidden: false,
      },
    ]
  })
}

// The catalog's row wins over a stand-in with the same id, wherever the two lists are read.
export function withStarting(
  catalog: readonly SessionInfo[],
  starting: readonly SessionInfo[],
): SessionInfo[] {
  const known = new Set(catalog.map((s) => s.id))
  return [...catalog, ...starting.filter((s) => !known.has(s.id))]
}
