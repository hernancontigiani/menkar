import { randomUUID } from 'node:crypto'
import { postToSession } from '../../../core/control/post'
import { agentPaths } from '../../../core/paths'
import type { Waker } from '../types'

// A line posted to the messaging socket Claude Code publishes for the session.
export const waker: Waker = {
  wake: (sessionId, text, counts) =>
    postToSession(agentPaths().claudeSessions, sessionId, text, randomUUID(), counts),
}
