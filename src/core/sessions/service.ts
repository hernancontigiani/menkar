import { type FSWatcher, watch } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../log'
import { loadState, type State, saveState, setHidden } from '../state'
import type { SessionInfo } from './info'
import { AGENT_COMMANDS, onPath } from './installed'
import { sessionName } from './names'
import { type DiscoveredSession, type Installed, type Roots, SessionScanner } from './scanner'

export const RESCAN_DEBOUNCE_MS = 2000

export type { SessionInfo }

export function toInfo(session: DiscoveredSession, state: State): SessionInfo {
  const hidden = new Set(state.hidden)
  return {
    agent: session.agent,
    id: session.id,
    name: sessionName(session, state.names[session.id]),
    claudeNamed: session.agent === 'claude' && session.customTitle !== null,
    file: session.file,
    folder: session.folder,
    cwd: session.cwd,
    preview: session.preview,
    badge: session.badge,
    mtimeMs: session.mtimeMs,
    size: session.size,
    hidden: hidden.has(session.id),
  }
}

// Runs `work` after `delayMs` of quiet; a request while it runs schedules one more run after it,
// instead of being dropped, so an event during a long scan is never lost.
export class Coalescer {
  readonly #work: () => Promise<void>
  readonly #delayMs: number
  #timer: ReturnType<typeof setTimeout> | undefined
  #running: Promise<void> | undefined
  #again = false

  constructor(work: () => Promise<void>, delayMs: number) {
    this.#work = work
    this.#delayMs = delayMs
  }

  request(delayMs = this.#delayMs): void {
    if (this.#running) {
      this.#again = true
      return
    }
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => void this.now(), delayMs)
  }

  async now(): Promise<void> {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.#running) {
      this.#again = true
      return this.#running
    }
    this.#running = (async () => {
      try {
        do {
          this.#again = false
          await this.#work()
        } while (this.#again)
      } finally {
        this.#running = undefined
      }
    })()
    return this.#running
  }

  stop(): void {
    clearTimeout(this.#timer)
    this.#timer = undefined
  }
}

export interface ServiceOptions {
  readonly roots: () => Roots
  readonly installed?: () => Promise<Installed>
  readonly debounceMs?: number
}

async function installedAgents(): Promise<Installed> {
  const [claude, cursor] = await Promise.all([
    onPath(AGENT_COMMANDS.claude),
    onPath(AGENT_COMMANDS.cursor),
  ])
  return { claude, cursor }
}

async function subdirs(dir: string): Promise<string[]> {
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

// The directories whose changes matter: for Claude the projects directory and each folder in it;
// for Cursor the projects directory, each folder in it and each agent-transcripts inside those.
// Not recursive: a session's subagents/ and tool-results/ churn constantly and are not sessions.
export async function watchedDirs(roots: Roots): Promise<string[]> {
  const claudeFolders = await subdirs(roots.claudeProjects)
  const cursorFolders = await subdirs(roots.cursorProjects)
  const cursorTranscripts = (await Promise.all(cursorFolders.map(subdirs)))
    .flat()
    .filter((dir) => dir.endsWith('/agent-transcripts'))
  return [
    roots.claudeProjects,
    ...claudeFolders,
    roots.cursorProjects,
    ...cursorFolders,
    ...cursorTranscripts,
  ]
}

export class SessionsService {
  readonly #options: ServiceOptions
  readonly #scanner = new SessionScanner()
  readonly #coalescer: Coalescer
  readonly #listeners = new Set<(list: readonly SessionInfo[]) => void>()
  #watchers = new Map<string, FSWatcher>()
  #discovered: DiscoveredSession[] = []
  #state: State | undefined
  #first: Promise<void> | undefined
  #stopped = false

  constructor(options: ServiceOptions) {
    this.#options = options
    this.#coalescer = new Coalescer(() => this.#scan(), options.debounceMs ?? RESCAN_DEBOUNCE_MS)
  }

  start(): Promise<void> {
    this.#first ??= (async () => {
      this.#state = await loadState()
      await this.#coalescer.now()
    })()
    return this.#first
  }

  async list(): Promise<readonly SessionInfo[]> {
    await this.start()
    return this.#infos()
  }

  onChange(listener: (list: readonly SessionInfo[]) => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  // The history's refresh button: at once, or right after the scan that is running.
  refresh(): Promise<void> {
    return this.#coalescer.now()
  }

  async setHidden(ids: readonly string[], hidden: boolean): Promise<void> {
    await this.start()
    this.#state = setHidden(this.#state ?? (await loadState()), ids, hidden)
    await saveState(this.#state)
    this.#emit()
  }

  stop(): void {
    this.#stopped = true
    this.#coalescer.stop()
    for (const watcher of this.#watchers.values()) watcher.close()
    this.#watchers.clear()
  }

  #infos(): SessionInfo[] {
    const state = this.#state
    return state ? this.#discovered.map((session) => toInfo(session, state)) : []
  }

  #emit(): void {
    const list = this.#infos()
    for (const listener of this.#listeners) listener(list)
  }

  async #scan(): Promise<void> {
    if (this.#stopped) return
    const roots = this.#options.roots()
    const installed = await (this.#options.installed ?? installedAgents)()
    this.#discovered = await this.#scanner.scan(roots, installed)
    await this.#rewatch(roots)
    this.#emit()
  }

  // Set again after every scan, so a folder an agent creates later is watched too.
  async #rewatch(roots: Roots): Promise<void> {
    if (this.#stopped) return
    const wanted = new Set(await watchedDirs(roots))
    for (const [dir, watcher] of this.#watchers) {
      if (!wanted.has(dir)) {
        watcher.close()
        this.#watchers.delete(dir)
      }
    }
    for (const dir of wanted) {
      if (this.#watchers.has(dir)) continue
      try {
        const watcher = watch(dir, { persistent: false }, () => this.#coalescer.request())
        watcher.on('error', (error) => {
          log.warn('stopped watching a sessions folder', { dir, error })
          watcher.close()
          this.#watchers.delete(dir)
        })
        this.#watchers.set(dir, watcher)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'EACCES') throw error
      }
    }
  }
}
