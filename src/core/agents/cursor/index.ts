import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { chat } from './chat'
import { follow } from './follow'
import { ids } from './ids'
import { integrations } from './integrations'
import { launch } from './launch'
import { mcp } from './mcp'
import { namer } from './names'
import { state } from './state'
import { team } from './team'
import { usage } from './usage'
import { writes } from './writes'

export const kit: AgentKit = {
  launch,
  mcp,
  messaging: null,
  namer,
  team,
  env: null,
  envPatterns: null,
  catalog,
  state,
  ids,
  follow,
  fork: null,
  chat,
  writes,
  usage,
  context: null,
  integrations,
}
