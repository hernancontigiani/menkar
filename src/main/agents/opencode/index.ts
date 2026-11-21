import type { MainAgentKit } from '../types'
import { OpenCodeProxies } from './proxy'

// The `_meta` key OpenCode's server names the calling session under in a tool call.
const SESSION_META = 'ai.opencode/sessionID'

export const proxies = new OpenCodeProxies()

// The server, and what it gives a session (its wake, its team block, its id after a `/new`), join
// this kit with P2.5 of the multi-agent plan.
export const mainKit: MainAgentKit = {
  settings: null,
  team: null,
  remote: null,
  waker: null,
  inbox: null,
  bind: null,
  namer: null,
  callers: { meta: SESSION_META, paneOf: (sessionId) => proxies.paneOf(sessionId) },
}
