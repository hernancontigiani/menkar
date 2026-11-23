import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { chat } from './chat'
import { ids } from './ids'
import { integrations } from './integrations'
import { launch, namer } from './launch'
import { state } from './state'
import { writes } from './writes'

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
  writes,
  usage: null,
  context: null,
  integrations,
}
