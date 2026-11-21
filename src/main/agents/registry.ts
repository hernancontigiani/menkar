import { AGENT_IDS, type AgentId } from '../../core/agents/ids'
import { mainKit as claude } from './claude'
import { mainKit as codex } from './codex'
import { mainKit as cursor } from './cursor'
import { mainKit as opencode } from './opencode'
import type { MainAgentKit } from './types'

const MAIN_KITS: Readonly<Record<AgentId, MainAgentKit>> = { claude, cursor, codex, opencode }

export function mainKitOf(id: AgentId): MainAgentKit {
  return MAIN_KITS[id]
}

// The pane showing the session an agent's server names under `meta` in a tool call: only a pane
// of that agent that runs that very session (or the one a subagent's session descends from), so a
// call is never taken as another session's.
export async function paneOfCaller(
  meta: string,
  sessionId: string,
  paneSession: (
    pane: string,
  ) => { readonly agent: string; readonly sessionId: string | null } | undefined,
): Promise<string | null> {
  for (const agent of AGENT_IDS) {
    const callers = mainKitOf(agent).callers
    if (callers?.meta !== meta) continue
    const found = await callers.paneOf(sessionId)
    const shown = found === null ? undefined : paneSession(found.pane)
    return found && shown?.agent === agent && shown.sessionId === found.sessionId
      ? found.pane
      : null
  }
  return null
}
