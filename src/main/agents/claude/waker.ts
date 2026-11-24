import { randomUUID } from 'node:crypto'
import { postToSession } from '../../../core/control/post'
import type { WorkCounts } from '../../../core/orchestration/counts'
import { agentPaths } from '../../../core/paths'
import type { MainTeamDelivery, Waker } from '../types'

// A line posted to the messaging socket Claude Code publishes for the session.
const post = (sessionId: string, text: string, counts: WorkCounts | undefined) =>
  postToSession(agentPaths().claudeSessions, sessionId, text, randomUUID(), counts)

export const waker: Waker = { wake: post, release: null }

// A change is told as any wake is.
export const teller: MainTeamDelivery = { tell: post, withdraw: null }
