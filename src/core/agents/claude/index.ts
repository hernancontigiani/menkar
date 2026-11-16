import type { AgentKit } from '../types'
import { catalog } from './catalog'
import { env } from './env'
import { launch, namer } from './launch'
import { mcp } from './mcp'
import { team } from './team'

export const kit: AgentKit = { launch, mcp, namer, team, env, catalog }
