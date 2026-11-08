import { type Agent, chunkLines, cursorUserText, messageText, parseLine, role } from './lines'

export const TAIL_BYTES = 64 * 1024
export type Badge = 'waiting' | 'interrupted' | null

const INTERRUPTED = '[Request interrupted by user'

// `tail` is the last TAIL_BYTES of the file; `fromStart` says whether that is the whole file.
export function badgeOf(tail: string, agent: Agent, fromStart: boolean): Badge {
  let latest: 'interrupted' | 'assistant' | 'user' | null = null
  let assistantText = ''
  for (const raw of chunkLines(tail, fromStart)) {
    const line = parseLine(raw)
    if (!line) continue
    const content = messageText(line)
    if (content === null) continue
    const kind = role(line, agent)
    if (agent === 'claude' && content.includes(INTERRUPTED)) {
      latest = 'interrupted'
    } else if (kind === 'assistant') {
      latest = 'assistant'
      assistantText = content
    } else if (kind === 'user') {
      const typed = (agent === 'cursor' ? cursorUserText(content) : content).trim()
      if (!typed.startsWith('<')) latest = 'user'
    }
  }
  if (latest === 'interrupted') return 'interrupted'
  if (latest === 'assistant' && assistantText.trimEnd().endsWith('?')) return 'waiting'
  return null
}
