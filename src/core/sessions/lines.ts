export type Agent = 'claude' | 'cursor'
export type Line = Readonly<Record<string, unknown>>

export function parseLine(raw: string): Line | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    // A line that is not JSON is skipped everywhere; a transcript being written may end in one.
    if (error instanceof SyntaxError) return null
    throw error
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Line)
    : null
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined
}

// A string content, or the `text` blocks of a list joined by one space; null when there is none.
export function messageText(line: Line): string | null {
  const content = field(line.message, 'content')
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const texts = content
    .filter((block) => field(block, 'type') === 'text' && typeof field(block, 'text') === 'string')
    .map((block) => field(block, 'text') as string)
  return texts.length > 0 ? texts.join(' ') : null
}

export function role(line: Line, agent: Agent): unknown {
  return agent === 'claude' ? line.type : line.role
}

const USER_QUERY = /<\/?user_query>/g

export function cursorUserText(value: string): string {
  return value.replace(USER_QUERY, '')
}

// Lines of a chunk of a file; `fromStart` false means the chunk began mid-file, so its first
// line may be cut and is dropped.
export function chunkLines(chunk: string, fromStart: boolean): string[] {
  const lines = chunk.split('\n')
  if (!fromStart) lines.shift()
  return lines.filter((line) => line.length > 0)
}
