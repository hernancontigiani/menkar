import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { env, envPatterns } from './env'
import { ids } from './ids'
import { launch, namer } from './launch'
import { state } from './state'

export const kit: AgentKit = {
  launch,
  mcp: null,
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
  writes: { created: [], changed: [] },
}
