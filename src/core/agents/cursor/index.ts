import type { AgentKit } from '../types'
import { launch, namer } from './launch'

export const kit: AgentKit = { launch, mcp: null, namer, team: null, env: null }
