import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { chat } from './chat'
import { ids } from './ids'
import { launch, namer } from './launch'
import { state } from './state'

export const kit: AgentKit = {
  launch,
  mcp: null,
  messaging: null,
  namer,
  team: null,
  env: null,
  envPatterns: null,
  catalog,
  state,
  ids,
  follow: null,
  fork: null,
  chat,
  writes: { created: [], changed: [] },
  usage: null,
  context: null,
}
