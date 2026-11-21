import type { AgentKit, Launcher, Namer, StateRules } from '../types'
import { catalog } from './catalog'
import { env, envPatterns } from './env'
import { ids } from './ids'

// Interim until P2.5 of the multi-agent plan, which starts a session on Menkar's server (its
// Preparer and Launcher) and names it at its creation: the bare TUI, unnamed, with no first prompt.
const launch: Launcher = { plan: (_start, ctx) => ({ words: [ctx.cli], env: {} }) }
const namer: Namer = { atStart: () => null }

// Interim until P2.5 reads OpenCode's screen and its server's events: always idle.
const state: StateRules = { detect: () => 'idle' }

export const kit: AgentKit = {
  launch,
  mcp: null,
  messaging: null,
  namer,
  team: null,
  env,
  envPatterns,
  catalog,
  state,
  ids,
  follow: null,
  fork: null,
  chat: null,
  // Reading its database writes nothing beside it; the session rows and inbox rows Menkar's calls
  // make its server write join with P2.5.
  writes: { created: [], changed: [] },
  usage: null,
  context: null,
}
