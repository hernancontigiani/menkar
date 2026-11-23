import { type FSWatcher, watch } from 'node:fs'
import { descriptorOf } from '../agents/descriptors'
import { AGENT_IDS } from '../agents/ids'
import { kitOf } from '../agents/registry'
import { log } from '../log'
import { loadState, type State, saveState, setHidden } from '../state'
import type { SessionInfo } from './info'
import { onPath } from './installed'
import { sessionName, titled } from './names'
import {
  type DiscoveredSession,
  type Installed,
  type Roots,
  rootOf,
  SessionScanner,
} from './scanner'

export const RESCAN_DEBOUNCE_MS = 2000

export type { SessionInfo }

export function toInfo(session: DiscoveredSession, state: State): SessionInfo {
  const hidden = new Set(state.hidden)
  return {
    agent: session.agent,
    id: session.id,
    name: sessionName(session, state.names[session.id]),
    claudeNamed: titled(session.agent) && session.customTitle !== null,
    file: session.file,
    folder: session.folder,
    cwd: session.cwd,
    preview: session.preview,
    badge: session.badge,
    mtimeMs: session.mtimeMs,
    size: session.size,
    hidden: hidden.has(session.id),
    ...(session.compactions === undefined ? {} : { compactions: session.compactions }),
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
  // Where each agent's sessions are; by default, where its catalog keeps them.
  readonly roots?: () => Roots
  readonly installed?: () => Promise<Installed>
  readonly debounceMs?: number
}

async function installedAgents(): Promise<Installed> {
  const found = await Promise.all(
    AGENT_IDS.map(async (id) => [id, await onPath(descriptorOf(id).command)] as const),
  )
  return Object.fromEntries(found)
}

// The directories whose changes matter, each agent's as its catalog says, every agent's whether
// installed or not: one installed later is seen appearing.
export async function watchedDirs(roots: Roots): Promise<string[]> {
  const dirs = await Promise.all(
    AGENT_IDS.map((id) => {
      const catalog = kitOf(id).catalog
      return catalog.watchTargets(rootOf(roots, id, catalog))
    }),
  )
  return dirs.flat()
}

export class SessionsService {
  readonly #options: ServiceOptions
  readonly #scanner = new SessionScanner()
  readonly #coalescer: Coalescer
  readonly #listeners = new Set<(list: readonly SessionInfo[]) => void>()
  #watchers = new Map<string, FSWatcher>()
  #discovered: DiscoveredSession[] = []
  #state: State | undefined
  #stateLoaded: Promise<void> | undefined
  #first: Promise<void> | undefined
  // No list is announced before the first scan ends: an empty one would read as "no sessions".
  #scanned = false
  #stopped = false

  constructor(options: ServiceOptions) {
    this.#options = options
    this.#coalescer = new Coalescer(() => this.#scan(), options.debounceMs ?? RESCAN_DEBOUNCE_MS)
  }

  start(): Promise<void> {
    this.#first ??= (async () => {
      await this.#loadState()
      await this.#coalescer.now()
    })()
    return this.#first
  }

  // state.json alone, without waiting for the scan of the agents' folders.
  #loadState(): Promise<void> {
    this.#stateLoaded ??= loadState().then((state) => {
      this.#state = state
    })
    return this.#stateLoaded
  }

  async list(): Promise<readonly SessionInfo[]> {
    await this.start()
    return this.#infos()
  }

  // What is known now: empty until the first scan ends (see `scanned`).
  listNow(): readonly SessionInfo[] {
    return this.#infos()
  }

  get scanned(): boolean {
    return this.#scanned
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
    await this.updateState((state) => setHidden(state, ids, hidden))
  }

  // The one holder of state.json in memory: every writer (names, hidden, settings) goes through
  // here, so two of them never save from different copies.
  async updateState(change: (state: State) => State): Promise<void> {
    void this.start()
    await this.#loadState()
    this.#state = change(this.#state ?? (await loadState()))
    await saveState(this.#state)
    this.#emit()
  }

  async currentState(): Promise<State> {
    void this.start()
    await this.#loadState()
    return this.#state ?? (await loadState())
  }

  stop(): void {
    this.#stopped = true
    this.#coalescer.stop()
    this.#scanner.close()
    for (const watcher of this.#watchers.values()) watcher.close()
    this.#watchers.clear()
  }

  #infos(): SessionInfo[] {
    const state = this.#state
    return state ? this.#discovered.map((session) => toInfo(session, state)) : []
  }

  #emit(): void {
    if (!this.#scanned) return
    const list = this.#infos()
    for (const listener of this.#listeners) listener(list)
  }

  async #scan(): Promise<void> {
    if (this.#stopped) return
    const roots = this.#options.roots?.() ?? {}
    const installed = await (this.#options.installed ?? installedAgents)()
    this.#discovered = await this.#scanner.scan(roots, installed)
    this.#scanned = true
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
