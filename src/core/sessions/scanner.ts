import { type Dirent, statSync } from 'node:fs'
import { open, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { type Badge, badgeOf, TAIL_BYTES } from './badges'
import { cursorCwd } from './cursor'
import { HEAD_BYTES, HEAD_LINES, readHead } from './head'
import type { Agent } from './lines'
import { applyNameLines, emptyNames, type Names } from './names'

export interface Roots {
  readonly claudeProjects: string
  readonly cursorProjects: string
}

export interface Installed {
  readonly claude: boolean
  readonly cursor: boolean
}

export interface DiscoveredSession extends Names {
  readonly agent: Agent
  readonly id: string
  readonly file: string
  // The directory holding the transcript, for a session whose transcript names no cwd.
  readonly folder: string
  readonly cwd: string | null
  readonly preview: string
  readonly badge: Badge
  readonly mtimeMs: number
  readonly size: number
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

const UUID_JSONL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/
const NEWLINE = 0x0a
// Names are read in slices this size, so a first scan of a large transcript never holds it whole.
const NAME_SLICE = 4 * 1024 * 1024

interface Found {
  readonly agent: Agent
  readonly id: string
  readonly file: string
  readonly folder: string
  readonly cwd?: string
}

interface FileState {
  ino: number
  offset: number
  names: Names
  headFinal: boolean
  cwd: string | null
  preview: string
  badge: Badge
  tailSize: number
  tailMtime: number
}

async function entries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return []
    throw error
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false
    throw error
  }
}

async function claudeTranscripts(projects: string): Promise<Found[]> {
  const found: Found[] = []
  for (const folder of await entries(projects)) {
    if (!folder.isDirectory()) continue
    const dir = join(projects, folder.name)
    for (const file of await entries(dir)) {
      if (file.isFile() && UUID_JSONL.test(file.name)) {
        found.push({
          agent: 'claude',
          id: file.name.slice(0, -'.jsonl'.length),
          file: join(dir, file.name),
          folder: dir,
        })
      }
    }
  }
  return found
}

async function cursorTranscripts(projects: string): Promise<Found[]> {
  const found: Found[] = []
  for (const folder of await entries(projects)) {
    if (!folder.isDirectory()) continue
    const transcripts = join(projects, folder.name, 'agent-transcripts')
    let cwd: string | undefined
    for (const session of await entries(transcripts)) {
      if (!session.isDirectory()) continue
      const dir = join(transcripts, session.name)
      const jsonls = (await entries(dir))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map((entry) => entry.name)
        .sort()
      const name = jsonls.includes(`${session.name}.jsonl`) ? `${session.name}.jsonl` : jsonls[0]
      if (name === undefined) continue
      cwd ??= cursorCwd(folder.name, isDir)
      found.push({ agent: 'cursor', id: session.name, file: join(dir, name), folder: dir, cwd })
    }
  }
  return found
}

function completeUpTo(buffer: Buffer): number {
  const last = buffer.lastIndexOf(NEWLINE)
  return last === -1 ? 0 : last + 1
}

export class SessionScanner {
  readonly #read: ReadRange
  readonly #files = new Map<string, FileState>()

  constructor(read: ReadRange = readRange) {
    this.#read = read
  }

  async scan(roots: Roots, installed: Installed): Promise<DiscoveredSession[]> {
    const found = [
      ...(installed.claude ? await claudeTranscripts(roots.claudeProjects) : []),
      ...(installed.cursor ? await cursorTranscripts(roots.cursorProjects) : []),
    ]
    const sessions: DiscoveredSession[] = []
    const seen = new Set<string>()
    for (const item of found) {
      const session = await this.#scanFile(item)
      if (session) {
        sessions.push(session)
        seen.add(item.file)
      }
    }
    for (const file of this.#files.keys()) {
      if (!seen.has(file)) this.#files.delete(file)
    }
    return sessions.sort((a, b) => b.mtimeMs - a.mtimeMs || a.id.localeCompare(b.id))
  }

  async #scanFile(item: Found): Promise<DiscoveredSession | null> {
    let info: Awaited<ReturnType<typeof stat>>
    try {
      info = await stat(item.file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
    if (info.size === 0) return null
    let state = this.#files.get(item.file)
    if (!state || state.ino !== info.ino || info.size < state.offset) {
      state = {
        ino: info.ino,
        offset: 0,
        names: emptyNames(),
        headFinal: false,
        cwd: null,
        preview: '',
        badge: null,
        tailSize: -1,
        tailMtime: -1,
      }
      this.#files.set(item.file, state)
    }

    if (item.agent === 'claude') {
      while (state.offset < info.size) {
        const end = Math.min(info.size, state.offset + NAME_SLICE)
        const chunk = await this.#read(item.file, state.offset, end)
        const complete = completeUpTo(chunk)
        if (complete === 0) {
          // A slice with no newline: either the unfinished last line, or one line longer than
          // a slice, which no name line ever is; skip past it only when more follows.
          if (end === info.size) break
          state.offset = end
          continue
        }
        state.names = applyNameLines(state.names, chunk.subarray(0, complete).toString('utf8'))
        state.offset += complete
      }
    }

    if (!state.headFinal) {
      const headEnd = Math.min(info.size, HEAD_BYTES)
      const head = (await this.#read(item.file, 0, headEnd)).toString('utf8')
      const read = readHead(head, item.agent)
      state.cwd = read.cwd
      state.preview = read.preview
      const windowFull = headEnd === HEAD_BYTES || head.split('\n').length > HEAD_LINES
      state.headFinal =
        windowFull || (read.preview !== '' && (read.cwd !== null || item.agent === 'cursor'))
    }

    if (state.tailSize !== info.size || state.tailMtime !== info.mtimeMs) {
      const start = Math.max(0, info.size - TAIL_BYTES)
      const tail = (await this.#read(item.file, start, info.size)).toString('utf8')
      state.badge = badgeOf(tail, item.agent, start === 0)
      state.tailSize = info.size
      state.tailMtime = info.mtimeMs
    }

    return {
      agent: item.agent,
      id: item.id,
      file: item.file,
      folder: item.folder,
      cwd: item.cwd ?? state.cwd,
      preview: state.preview,
      badge: state.badge,
      customTitle: state.names.customTitle,
      aiTitle: state.names.aiTitle,
      mtimeMs: info.mtimeMs,
      size: info.size,
    }
  }
}
