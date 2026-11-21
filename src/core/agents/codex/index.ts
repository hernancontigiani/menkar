import type { AgentKit } from '../types'
import { follow } from './binding'
import { catalog } from './catalog'
import { context } from './context'
import { env, envPatterns } from './env'
import { ids } from './ids'
import { launch, namer } from './launch'
import { mcp } from './mcp'
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
  env,
  envPatterns,
  catalog,
  state,
  ids,
  follow,
  fork: null,
  chat: null,
  writes,
  usage,
  context,
}
