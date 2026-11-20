import { readdir, readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { now, timeOfDay } from '../clock'
import type { WorkCounts } from '../orchestration/counts'

// Waking a session through Claude Code's cross-session messaging: its registry entry
// (`<pid>.json`, read only) names the socket; one line goes in, nothing is read back. The frame is
// the one measured on Claude Code 2.1.322, whose registry says `peerProtocol: 1`.

export const PEER_PROTOCOL = 1

// The time closes every text: Claude Code drops a message identical to the sender's previous one,
// so a child that finished two turns in a row would wake its parent once.
export function wakeFrame(text: string, msgId: string, counts?: WorkCounts): string {
  return `${JSON.stringify({
    type: 'user',
    message: { content: wakeText(text, counts) },
    from: 'menkar',
    msg_id: msgId,
  })}\n`
}

// What every agent's session reads when Menkar wakes it, whatever carries it there.
export function wakeText(text: string, counts?: WorkCounts): string {
  const tail = counts ? ` · ${countsText(counts)}` : ''
  return `[Menkar] ${text} (${timeOfDay(now())})${tail}`
}

// A message one session sends another through Menkar: nothing else tells the receiver who wrote
// it, and a receiver would answer with its own messaging tool, which cannot reach the sender.
export function bridgedText(
  from: { readonly name: string; readonly agent: string },
  replyWith: string,
  text: string,
): string {
  return `from ${from.name} (${from.agent}); reply with ${replyWith}: ${text}`
}

// English, like the rest of the frame: it is read by an agent, not shown in the UI.
function countsText(c: WorkCounts): string {
  return `${c.topics} topic${c.topics === 1 ? '' : 's'} · ${c.working} working · ${c.waiting} waiting`
}

interface Peer {
  readonly socket: string | null
  readonly protocol: unknown
}

async function findPeer(sessionsDir: string, sessionId: string): Promise<Peer | null> {
  let names: string[]
  try {
    names = await readdir(sessionsDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  for (const name of names) {
    if (!/^\d+\.json$/.test(name)) continue
    let entry: Record<string, unknown>
    try {
      entry = JSON.parse(await readFile(join(sessionsDir, name), 'utf8')) as Record<string, unknown>
    } catch (error) {
      // An entry rewritten or removed while read: its session is ending or changing.
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || error instanceof SyntaxError) continue
      throw error
    }
    if (entry.sessionId !== sessionId) continue
    return {
      socket: typeof entry.messagingSocketPath === 'string' ? entry.messagingSocketPath : null,
      protocol: entry.peerProtocol,
    }
  }
  return null
}

export function sendLine(socket: string, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const connection = createConnection(socket, () => connection.end(line))
    connection.on('close', () => resolve())
    connection.on('error', reject)
  })
}

export type PostOutcome = 'posted' | 'no session' | 'protocol'

export async function postToSession(
  sessionsDir: string,
  sessionId: string,
  text: string,
  msgId: string,
  counts?: WorkCounts,
): Promise<PostOutcome> {
  const peer = await findPeer(sessionsDir, sessionId)
  if (!peer?.socket) return 'no session'
  if (peer.protocol !== PEER_PROTOCOL) return 'protocol'
  await sendLine(peer.socket, wakeFrame(text, msgId, counts))
  return 'posted'
}
