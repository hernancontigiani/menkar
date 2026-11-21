import type { MainAgentKit } from '../types'

// The server, the proxy and what they give a session (its wake, its team block, its id after a
// `/new`) join this kit with P2.5 of the multi-agent plan.
export const mainKit: MainAgentKit = {
  settings: null,
  team: null,
  remote: null,
  waker: null,
  inbox: null,
  bind: null,
  namer: null,
}
