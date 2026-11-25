import { join } from 'node:path'
import { findRollout } from '../../../core/agents/codex/binding'
import { codexHome } from '../../../core/agents/codex/config'
import { descriptor } from '../../../core/agents/codex/descriptor'
import { type PostOutcome, wakeText } from '../../../core/control/post'
import { log } from '../../../core/log'
import type { WorkCounts } from '../../../core/orchestration/counts'
import { runWakeCommand } from '../shared/wake'
import type { MainTeamDelivery, Waker } from '../types'

// `codex queue` returns once the message is in the queue, in well under a second; the session
// takes it as its own turn once the current one is over, never while an approval waits, so nothing
// it sends can answer one.
export const QUEUE_WAIT_MS = 10_000

// Codex's own channel into a running thread: no keystroke reaches the terminal. `--disable plugins`
// keeps the command from syncing Codex's plugin marketplace over the network and leaving a git
// folder in its home on every wake. Codex's shared daemon, when it runs, refuses any override; the
// plain call then goes through the daemon, which syncs nothing here.
// A thread with no rollout (before its first message) fails exactly as an unknown id does, so the
// rollout is looked for first.
export const DAEMON_REFUSAL =
  'cannot queue through an embedded app server while a local app-server daemon is running'

async function queue(
  sessionId: string,
  text: string,
  counts: WorkCounts | undefined,
): Promise<PostOutcome> {
  if ((await findRollout(join(codexHome(), 'sessions'), sessionId)) === null) return 'no session'
  const message = ['--thread', sessionId, '--message', wakeText(text, counts)]
  let end = await runWakeCommand(
    descriptor.command,
    ['queue', '--disable', 'plugins', ...message],
    QUEUE_WAIT_MS,
  )
  if (end.code !== 0 && end.stderr.includes(DAEMON_REFUSAL))
    end = await runWakeCommand(descriptor.command, ['queue', ...message], QUEUE_WAIT_MS)
  if (end.code === 0) return 'posted'
  log.warn('codex queue failed', { session: sessionId, code: end.code, stderr: end.stderr })
  throw new Error(`codex queue ended with ${end.code ?? 'a signal'}`)
}

export const waker: Waker = { wake: queue, release: null }

// A change is told as any wake is.
export const teller: MainTeamDelivery = { tell: queue, withdraw: null }
