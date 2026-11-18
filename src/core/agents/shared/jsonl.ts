import { type Dirent, statSync } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Badge, Details } from '../../sessions/details'
import type { DiscoveredSession } from '../../sessions/scanner'
import type { Found, SessionReader, TranscriptReading } from '../types'

export type Line = Readonly<Record<string, unknown>>

export const HEAD_LINES = 50
export const HEAD_BYTES = 256 * 1024
export const TAIL_BYTES = 64 * 1024

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

export function field(value: unknown, key: string): unknown {
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

export const blocks = (line: Line): unknown[] => {
  const content = field(line.message, 'content')
  return Array.isArray(content) ? content : []
}

export const toolUses = (line: Line) => blocks(line).filter((b) => field(b, 'type') === 'tool_use')

// Every line of a whole file's text that parses.
export const textLines = (file: string) =>
  file
    .split('\n')
    .flatMap((raw) => (raw ? [parseLine(raw)].filter((l): l is Line => l !== null) : []))

// Lines of a chunk of a file; `fromStart` false means the chunk began mid-file, so its first
// line may be cut and is dropped.
export function chunkLines(chunk: string, fromStart: boolean): string[] {
  const lines = chunk.split('\n')
  if (!fromStart) lines.shift()
  return lines.filter((line) => line.length > 0)
}

export type ReadRange = (path: string, start: number, end: number) => Promise<Buffer>

// Opened read-only, never written: the transcripts belong to the agents.
export const readRange: ReadRange = async (path, start, end) => {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(Math.max(0, end - start))
    let done = 0
    while (done < buffer.length) {
      const { bytesRead } = await handle.read(buffer, done, buffer.length - done, start + done)
      if (bytesRead === 0) break
      done += bytesRead
    }
    return buffer.subarray(0, done)
  } finally {
    await handle.close()
  }
}

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

const NAME_MARK = Buffer.from('-title"')

// Only the lines of `chunk[0, complete)` that can be name lines, as text: decoding a whole
// transcript to find them cost seconds on a large history, searching its bytes a fraction.
// The same lines `applyNameLines` would look at, in the same order.
export function nameLines(chunk: Buffer, complete: number): string {
  const lines: string[] = []
  let from = 0
  while (from < complete) {
    const hit = chunk.indexOf(NAME_MARK, from)
    if (hit === -1 || hit >= complete) break
    const start = chunk.lastIndexOf(10, hit) + 1
    const newline = chunk.indexOf(10, hit)
    const end = newline === -1 || newline > complete ? complete : newline
    lines.push(chunk.toString('utf8', start, end))
    from = end + 1
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

const CWD_MARK = Buffer.from('"cwd":"')

// The first line of `chunk[0, complete)` with a cwd of its own. A file-history snapshot can push it
// past the head (450 KB of backed-up files before it), and a backed-up file can hold a "cwd" of
// its own, so only a line's top-level one counts.
export function firstCwd(chunk: Buffer, complete: number): string | null {
  let from = 0
  while (from < complete) {
    const hit = chunk.indexOf(CWD_MARK, from)
    if (hit === -1 || hit >= complete) return null
    const start = chunk.lastIndexOf(10, hit) + 1
    const newline = chunk.indexOf(10, hit)
    const end = newline === -1 || newline > complete ? complete : newline
    const cwd = parseLine(chunk.toString('utf8', start, end))?.cwd
    if (typeof cwd === 'string') return cwd
    from = end + 1
  }
  return null
}

export async function entries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return []
    throw error
  }
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false
    throw error
  }
}

export async function subdirs(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return []
    throw error
  }
}

// A directory that does not exist yet (the agent installed after Menkar started) is stood in for
// by its nearest existing ancestor, whose change event reveals it appearing.
export async function nearestExisting(dir: string): Promise<string> {
  let current = dir
  for (;;) {
    try {
      if ((await stat(current)).isDirectory()) return current
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error
    }
    const parent = dirname(current)
    if (parent === current) return current
    current = parent
  }
}

// A folder named after a path with every `/` (and other characters) turned into `-`, so where the
// real dashes were is lost; it is rebuilt against the filesystem, taking at each level the longest
// run of parts that names an existing directory.
export function dashedPath(folder: string, isDirectory: (path: string) => boolean): string {
  const parts = folder.split('-').filter((part) => part.length > 0)
  let path = '/'
  let i = 0
  while (i < parts.length) {
    let found = 0
    for (let end = parts.length; end > i; end -= 1) {
      if (isDirectory(join(path, parts.slice(i, end).join('-')))) {
        found = end
        break
      }
    }
    if (found === 0) return join(path, ...parts.slice(i))
    path = join(path, parts.slice(i, found).join('-'))
    i = found
  }
  return path
}

const NEWLINE = 0x0a
// Titles are read in slices this size, so a first read of a large transcript never holds it whole.
const NAME_SLICE = 4 * 1024 * 1024

function completeUpTo(buffer: Buffer): number {
  const last = buffer.lastIndexOf(NEWLINE)
  return last === -1 ? 0 : last + 1
}

interface FileState {
  ino: number
  offset: number
  names: Names
  headFinal: boolean
  cwd: string | null
  // The first cwd anywhere in the file, for one the head does not reach.
  laterCwd: string | null
  preview: string
  badge: Badge
  tailSize: number
  tailMtime: number
}

// A transcript read incrementally: titles in slices from where the last read stopped, the head
// until it is final, the tail when the file changed.
export class JsonlReader implements SessionReader {
  readonly #reading: TranscriptReading
  readonly #read: ReadRange
  readonly #files = new Map<string, FileState>()

  constructor(reading: TranscriptReading, read: ReadRange) {
    this.#reading = reading
    this.#read = read
  }

  retain(locators: ReadonlySet<string>): void {
    for (const file of this.#files.keys()) {
      if (!locators.has(file)) this.#files.delete(file)
    }
  }

  async read(item: Found): Promise<DiscoveredSession | null> {
    const file = item.locator
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    if (info.size === 0) return null
    let state = this.#files.get(file)
    if (!state || state.ino !== info.ino || info.size < state.offset) {
      state = {
        ino: info.ino,
        offset: 0,
        names: emptyNames(),
        headFinal: false,
        cwd: null,
        laterCwd: null,
        preview: '',
        badge: null,
        tailSize: -1,
        tailMtime: -1,
      }
      this.#files.set(file, state)
    }

    const titles = this.#reading.titles
    if (titles) {
      while (state.offset < info.size) {
        const end = Math.min(info.size, state.offset + NAME_SLICE)
        const chunk = await this.#read(file, state.offset, end)
        const complete = completeUpTo(chunk)
        if (complete === 0) {
          // A slice with no newline: either the unfinished last line, or one line longer than
          // a slice, which no name line ever is; skip past it only when more follows.
          if (end === info.size) break
          state.offset = end
          continue
        }
        const next = titles.slice(chunk, complete, { names: state.names, laterCwd: state.laterCwd })
        state.names = next.names
        state.laterCwd = next.laterCwd
        state.offset += complete
      }
    }

    if (!state.headFinal) {
      const headEnd = Math.min(info.size, HEAD_BYTES)
      const head = (await this.#read(file, 0, headEnd)).toString('utf8')
      const read = this.#reading.head(head)
      state.cwd = read.cwd
      state.preview = read.preview
      const windowFull = headEnd === HEAD_BYTES || head.split('\n').length > HEAD_LINES
      state.headFinal = windowFull || this.#reading.headFinal(read)
    }

    if (state.tailSize !== info.size || state.tailMtime !== info.mtimeMs) {
      const start = Math.max(0, info.size - TAIL_BYTES)
      const tail = (await this.#read(file, start, info.size)).toString('utf8')
      state.badge = this.#reading.badge(tail, start === 0)
      state.tailSize = info.size
      state.tailMtime = info.mtimeMs
    }

    return {
      agent: item.agent,
      id: item.id,
      file,
      folder: item.folder,
      cwd: item.cwd ?? state.cwd ?? state.laterCwd,
      preview: state.preview,
      badge: state.badge,
      customTitle: state.names.customTitle,
      aiTitle: state.names.aiTitle,
      mtimeMs: info.mtimeMs,
      size: info.size,
    }
  }
}

// A transcript as Markdown: a header from its details, then each message the user typed and each
// assistant line with text or tool calls, under the speaker's name.
export function markdownExport(
  name: string,
  id: string,
  text: string,
  d: Details,
  speaker: string,
  typed: (line: Line) => string | null,
  isAssistant: (line: Line) => boolean,
): string {
  const header = [`# ${name}`, '', `- **Session:** \`${id}\``]
  if (d.cwd) header.push(`- **Project:** \`${d.cwd}\``)
  if (d.created) header.push(`- **Created:** ${d.created}`)
  if (d.lastActivity) header.push(`- **Last activity:** ${d.lastActivity}`)
  const turns: string[] = []
  for (const line of textLines(text)) {
    const userText = typed(line)
    if (userText !== null) {
      turns.push(`### You\n\n${userText}`)
      continue
    }
    if (!isAssistant(line)) continue
    const said = messageText(line)?.trim() ?? ''
    const tools = toolUses(line).map((use) => `\`${String(field(use, 'name'))}\``)
    if (!said && tools.length === 0) continue
    const parts = [`### ${speaker}`]
    if (said) parts.push(said)
    if (tools.length > 0) parts.push(`*Used ${tools.join(', ')}*`)
    turns.push(parts.join('\n\n'))
  }
  const bodyText = turns.length > 0 ? turns.join('\n\n') : '_No messages._'
  return `${header.join('\n')}\n\n---\n\n${bodyText}\n`
}
