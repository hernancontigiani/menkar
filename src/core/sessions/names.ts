import { type Agent, chunkLines, parseLine } from './lines'

export interface Names {
  readonly customTitle: string | null
  readonly aiTitle: string | null
}

export const emptyNames = (): Names => ({ customTitle: null, aiTitle: null })

// `complete` holds whole lines only; the last one wins for each kind, trimmed, and a blank one
// does not replace what was there.
export function applyNameLines(names: Names, complete: string): Names {
  let { customTitle, aiTitle } = names
  for (const raw of chunkLines(complete, true)) {
    // Cheap filter first: a transcript is mostly lines that are neither.
    if (!raw.includes('-title"')) continue
    const line = parseLine(raw)
    if (!line) continue
    if (
      line.type === 'custom-title' &&
      typeof line.customTitle === 'string' &&
      line.customTitle.trim()
    ) {
      customTitle = line.customTitle.trim()
    } else if (
      line.type === 'ai-title' &&
      typeof line.aiTitle === 'string' &&
      line.aiTitle.trim()
    ) {
      aiTitle = line.aiTitle.trim()
    }
  }
  return { customTitle, aiTitle }
}

export interface Nameable extends Names {
  readonly agent: Agent
  readonly id: string
  readonly preview: string
}

export function sessionName(session: Nameable, appName: string | undefined): string {
  const claude = session.agent === 'claude'
  return (
    (claude ? session.customTitle : null) ||
    appName?.trim() ||
    (claude ? session.aiTitle : null) ||
    session.preview ||
    session.id.slice(0, 8)
  )
}
