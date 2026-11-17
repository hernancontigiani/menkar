import { join } from 'node:path'
import { type AgentId, parseAgentId } from './agents/ids'
import { readJson, writeJson } from './jsonstate'
import { appDirs } from './paths'

// Menkar's state.json as far as the areas built so far read it; every other key is carried in
// `rest` untouched, so a later area's (or a newer version's) keys survive a save.
export interface State {
  readonly names: Readonly<Record<string, string>>
  readonly hidden: readonly string[]
  readonly rest: Readonly<Record<string, unknown>>
}

export function statePath(): string {
  return join(appDirs().config, 'state.json')
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseState(value: unknown): State {
  if (!isObject(value)) return { names: {}, hidden: [], rest: {} }
  const { names, hidden, ...rest } = value
  const cleanNames: Record<string, string> = {}
  if (isObject(names)) {
    for (const [id, name] of Object.entries(names)) {
      if (id && typeof name === 'string' && name.trim()) cleanNames[id] = name.trim()
    }
  }
  const cleanHidden = Array.isArray(hidden)
    ? [...new Set(hidden.filter((id): id is string => typeof id === 'string'))].sort()
    : []
  return { names: cleanNames, hidden: cleanHidden, rest }
}

export function setAppName(state: State, id: string, name: string): State {
  const { [id]: _previous, ...names } = state.names
  const trimmed = name.trim()
  return { ...state, names: trimmed ? { ...names, [id]: trimmed } : names }
}

export function setHidden(state: State, ids: readonly string[], hidden: boolean): State {
  const set = new Set(state.hidden)
  for (const id of ids) {
    if (hidden) set.add(id)
    else set.delete(id)
  }
  return { ...state, hidden: [...set].sort() }
}

export function loadState(): Promise<State> {
  return readJson(statePath(), parseState, () => parseState({}))
}

export function saveState(state: State): Promise<void> {
  return writeJson(statePath(), { ...state.rest, names: state.names, hidden: state.hidden })
}

// The sessions the sandbox started, or that bound in its panes: the only ones it acts on.
const STARTED = 'started_sessions'

export function startedSessions(state: State): ReadonlySet<string> {
  const value = state.rest[STARTED]
  return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
}

export function withStarted(state: State, id: string): State {
  const started = startedSessions(state)
  if (started.has(id)) return state
  return { ...state, rest: { ...state.rest, [STARTED]: [...started, id].sort() } }
}

// The agent of each session Menkar started or resumed with an agent other than the default, so a
// saved tab whose session no reader finds is still known for what it was. The default agent's
// sessions are never written: a user of that agent alone keeps the state.json they had.
const AGENTS = 'session_agents'

// Kept as saved: a value this build does not know is another build's agent, never this one's.
export function sessionAgents(state: State): Readonly<Record<string, string>> {
  const value = state.rest[AGENTS]
  if (!isObject(value)) return {}
  const agents: Record<string, string> = {}
  for (const [id, agent] of Object.entries(value))
    if (id && typeof agent === 'string') agents[id] = agent
  return agents
}

// Null forgets the session's entry. The same state when nothing changes, so the caller can skip
// the write.
export function withSessionAgent(state: State, id: string, agent: AgentId | null): State {
  const agents = sessionAgents(state)
  if ((agents[id] ?? null) === agent) return state
  const { [id]: _previous, ...others } = agents
  const next = agent === null ? others : { ...others, [id]: agent }
  const { [AGENTS]: _old, ...rest } = state.rest
  return { ...state, rest: Object.keys(next).length > 0 ? { ...rest, [AGENTS]: next } : rest }
}

// What a saved pane becomes when its tab is restored: its agent's resume when a reader found the
// session; kept and not started when `session_agents` names it (an agent this build knows or one
// it does not); else nothing records it, and it is the default agent's session whose files are gone.
export type Restore =
  | { readonly kind: 'resume'; readonly agent: AgentId }
  | { readonly kind: 'missing'; readonly agent: AgentId }
  | { readonly kind: 'unsupported'; readonly agent: string }
  | { readonly kind: 'unnamed' }

export function restoreOf(found: AgentId | undefined, named: string | undefined): Restore {
  if (found) return { kind: 'resume', agent: found }
  if (named === undefined) return { kind: 'unnamed' }
  const agent = parseAgentId(named)
  return agent ? { kind: 'missing', agent } : { kind: 'unsupported', agent: named }
}
