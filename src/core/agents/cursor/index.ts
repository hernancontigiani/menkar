import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { launch, namer } from './launch'

export const kit: AgentKit = { launch, mcp: null, namer, team: null, env: null, catalog }
