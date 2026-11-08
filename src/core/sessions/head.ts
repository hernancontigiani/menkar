import { type Agent, cursorUserText, messageText, parseLine, role } from './lines'

export const HEAD_LINES = 50
export const HEAD_BYTES = 256 * 1024
const PREVIEW_CHARS = 120

export interface Head {
  readonly cwd: string | null
  readonly preview: string
}

// `head` is the start of the file, at most HEAD_BYTES; only its first HEAD_LINES lines count.
export function readHead(head: string, agent: Agent): Head {
  let cwd: string | null = null
  let preview = ''
  const lines = head.split('\n').slice(0, HEAD_LINES)
  for (const raw of lines) {
    const line = parseLine(raw)
    if (!line) continue
    if (cwd === null && typeof line.cwd === 'string') cwd = line.cwd
    if (!preview && role(line, agent) === 'user') {
      const content = messageText(line)
      const typed = (
        agent === 'cursor' && content !== null ? cursorUserText(content) : content
      )?.trim()
      if (typed && !typed.startsWith('<')) {
        preview = typed.replace(/\s+/g, ' ').slice(0, PREVIEW_CHARS)
      }
    }
    if (preview && (cwd !== null || agent === 'cursor')) break
  }
  return { cwd, preview }
}
