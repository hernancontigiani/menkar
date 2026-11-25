import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { chat } from './chat'
import { env } from './env'
import { fork } from './fork'
import { follow, ids } from './ids'
import { launch, namer } from './launch'
import { mcp } from './mcp'
import { messaging } from './messaging'
import { state } from './state'
import { team } from './team'
import { context, usage } from './usage'
import { writes } from './writes'

export const kit: AgentKit = {
  launch,
  mcp,
  messaging,
  namer,
  team,
  env,
  envPatterns: null,
  catalog,
  state,
  ids,
  follow,
  fork,
  chat,
  writes,
  usage,
  context,
  integrations: null,
}
