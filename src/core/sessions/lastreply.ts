import { open } from 'node:fs/promises'
import { TEAM_MARKER } from '../team/posts'
import { type Line, messageText, parseLine } from './lines'

// A session's last reply (1.73): its transcript read backwards from the end in chunks,
// lines split on bytes so a character cut by a chunk is whole again, opened read only. A
// transcript runs to tens of MB, and the reply is near its end.

const CHUNK = 64 * 1024
// Further back than this, the session's reply is not the one an orchestrator asks for.
const MAX_BACK = 8 * 1024 * 1024

async function* backwards(file: string): AsyncGenerator<Line> {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    let end = size
    let carry = Buffer.alloc(0)
    while (end > 0 && size - end < MAX_BACK) {
      const start = Math.max(0, end - CHUNK)
      const chunk = Buffer.alloc(end - start)
      await handle.read(chunk, 0, chunk.length, start)
      let bytes = Buffer.concat([chunk, carry])
      end = start
      // Complete lines are those after the first newline, unless the chunk starts the file.
      for (let nl = bytes.lastIndexOf(0x0a); ; nl = bytes.lastIndexOf(0x0a)) {
        if (nl === -1 && start > 0) break
        const raw = bytes.subarray(nl + 1).toString('utf8')
        bytes = nl === -1 ? Buffer.alloc(0) : bytes.subarray(0, nl)
        const line = raw ? parseLine(raw) : null
        if (line) yield line
        if (nl === -1) break
      }
      carry = bytes
    }
  } finally {
    await handle.close()
  }
}

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

const blocks = (line: Line): unknown[] => {
  const content = field(line.message, 'content')
  return Array.isArray(content) ? content : []
}

// A message that starts a turn: the human's, or one another session (or Menkar) sent. Tool
// results, and the meta lines Claude Code adds itself (a loaded skill, a caveat), are the turn's.
function opener(line: Line): boolean {
  if (line.type !== 'user') return false
  if (blocks(line).some((b) => field(b, 'type') === 'tool_result')) return false
  return line.isMeta !== true || field(line.origin, 'kind') === 'peer'
}

// Claude Code delivers a peer's text after one line of its own; the marker opens what Menkar sent.
function teamUpdate(line: Line): boolean {
  if (field(line.origin, 'kind') !== 'peer' || field(line.origin, 'from') !== 'menkar') return false
  const text = messageText(line) ?? ''
  const sent = text.startsWith('[Menkar]') ? text : text.slice(text.indexOf('\n') + 1)
  return sent.startsWith(TEAM_MARKER)
}

const isMessage = (line: Line) => line.type === 'user' || line.type === 'assistant'

// Reads back to the start of the turn the reader is in: the messages that opened it, from any
// that arrived during it to the first, which follows the previous turn's last assistant line.
// That line is left unread, for the caller.
class Reader {
  private held: Line | null = null
  constructor(private readonly lines: AsyncGenerator<Line>) {}

  async next(): Promise<Line | null> {
    if (this.held) {
      const line = this.held
      this.held = null
      return line
    }
    const { value, done } = await this.lines.next()
    return done ? null : value
  }

  async openers(): Promise<Line[]> {
    const found: Line[] = []
    let afterOpener = false
    for (let line = await this.next(); line; line = await this.next()) {
      if (!isMessage(line)) continue
      if (line.type === 'assistant' && afterOpener) {
        this.held = line
        break
      }
      afterOpener = opener(line)
      if (afterOpener) found.push(line)
    }
    return found
  }
}

const onlyUpdates = (openers: Line[]) => openers.length > 0 && openers.every(teamUpdate)

// The last reply, passing over a turn that only answered Menkar's team updates: a worker's report
// stays its last reply.
export async function lastReply(file: string): Promise<string | null> {
  const reader = new Reader(backwards(file))
  for (let line = await reader.next(); line; line = await reader.next()) {
    if (line.type !== 'assistant') continue
    const text = messageText(line)?.trim()
    if (!text) continue
    if (!onlyUpdates(await reader.openers())) return text
  }
  return null
}

// Whether every message that opened the transcript's last turn is a team update: such a turn is
// Menkar's own doing, and wakes no parent.
export async function onlyTeamUpdates(file: string): Promise<boolean> {
  return onlyUpdates(await new Reader(backwards(file)).openers())
}
