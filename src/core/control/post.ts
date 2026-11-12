import { readdir, readFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { join } from 'node:path'

// Waking a session through Claude Code's cross-session messaging: its registry entry
// (`<pid>.json`, read only) names the socket; one line goes in, nothing is read back. The frame is
// the one measured on Claude Code 2.1.322, whose registry says `peerProtocol: 1`.

export const PEER_PROTOCOL = 1

export function wakeFrame(text: string, msgId: string): string {
  return `${JSON.stringify({
    type: 'user',
    message: { content: `[Menkar] ${text}` },
    from: 'menkar',
    msg_id: msgId,
  })}\n`
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
): Promise<PostOutcome> {
  const peer = await findPeer(sessionsDir, sessionId)
  if (!peer?.socket) return 'no session'
  if (peer.protocol !== PEER_PROTOCOL) return 'protocol'
  await sendLine(peer.socket, wakeFrame(text, msgId))
  return 'posted'
}
