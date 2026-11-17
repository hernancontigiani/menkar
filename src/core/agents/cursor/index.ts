import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { ids } from './ids'
import { launch, namer } from './launch'
import { state } from './state'

export const kit: AgentKit = {
  launch,
  mcp: null,
  namer,
  team: null,
  env: null,
  catalog,
  state,
  ids,
  follow: null,
  fork: null,
}
