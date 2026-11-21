import type { State } from './state'

// The sessions Menkar named through their agent's own call (decision 1.195: the Codex sessions the
// orchestrator starts): `agent_named` in state.json, a sorted list of ids. A renew names its new
// session too, so the team's name holds across a restart; a session not listed is never named.
const KEY = 'agent_named'

export function agentNamedList(state: State): string[] {
  const raw = state.rest[KEY]
  return Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === 'string'))].sort()
    : []
}

// The same state when the session is already listed, so the caller can skip the write.
export function withAgentNamed(state: State, id: string): State {
  const list = agentNamedList(state)
  if (list.includes(id)) return state
  return { ...state, rest: { ...state.rest, [KEY]: [...list, id].sort() } }
}
