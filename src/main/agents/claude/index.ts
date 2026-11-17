import { randomUUID } from 'node:crypto'
import { postToSession } from '../../../core/control/post'
import { agentPaths } from '../../../core/paths'
import { sessionSettingsFile } from '../../context'
import type { MainAgentKit } from '../types'
import { remote } from './remote'

export const mainKit: MainAgentKit = {
  settings: sessionSettingsFile,
  team: {
    tell: (sessionId, text, counts) =>
      postToSession(agentPaths().claudeSessions, sessionId, text, randomUUID(), counts),
  },
  remote,
}
