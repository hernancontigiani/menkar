import { type FSWatcher, mkdirSync, watch } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { now } from '../core/clock'
import {
  type ControlAnswer,
  type ControlRequest,
  controlPaths,
  type Snapshot,
  writeAtomic,
} from '../core/control/files'
import { sweepPrompts } from '../core/control/prompt'
import { RequestQueue } from '../core/control/requests'
import { log } from '../core/log'

// Main's side of Menkar's MCP server: it says Menkar runs, answers the request files,
// publishes each project's sessions, and hears each pane's turn end. What a tool does is the
// window's: `start` takes the handlers from it.

export interface ControlHandlers {
  handle(request: ControlRequest): Promise<ControlAnswer>
  // A pane's agent ended a turn, under this session id (the Stop hook's record).
  turnEnded(pane: string, sessionId: string): void
}

// Beside the main bundle, as the statusline is: Electron's binary runs it as plain Node.
export const mcpServerScript = (): string => join(import.meta.dirname, 'mcp-server.js')

const PASS_MS = 1000
const SNAPSHOT_DELAY_MS = 250
const SWEEP_MS = 60 * 60 * 1000

let running: { stop(): Promise<void> } | null = null

export async function startControl(handlers: ControlHandlers): Promise<void> {
  const paths = controlPaths()
  for (const dir of [paths.requests, paths.responses, paths.turnEnds, paths.snapshots])
    mkdirSync(dir, { recursive: true })
  await writeAtomic(paths.root, 'alive.json', { pid: process.pid, started: now() })

  const queue = new RequestQueue((request) => handlers.handle(request), now)
  let passing = false
  const pass = () => {
    if (passing) return
    passing = true
    queue
      .pass()
      .catch((error: unknown) => log.warn('control requests could not be read', { error }))
      .finally(() => {
        passing = false
      })
  }

  const seenTurnEnds = new Map<string, string>()
  // `act` false: records left by an earlier run name panes that no longer exist, seen, never acted on.
  const readTurnEnds = async (act: boolean) => {
    for (const name of await readdir(paths.turnEnds)) {
      if (!name.endsWith('.json')) continue
      const pane = name.slice(0, -'.json'.length)
      let record: { session_id?: unknown; at?: unknown }
      try {
        record = JSON.parse(await readFile(join(paths.turnEnds, name), 'utf8'))
      } catch (error) {
        // Rewritten while read: its change event comes next.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError)
          continue
        throw error
      }
      if (typeof record.session_id !== 'string' || typeof record.at !== 'string') continue
      if (seenTurnEnds.get(pane) === record.at) continue
      seenTurnEnds.set(pane, record.at)
      if (act) handlers.turnEnded(pane, record.session_id)
    }
  }
  const turnEnds = () => {
    readTurnEnds(true).catch((error: unknown) => log.warn('turn ends could not be read', { error }))
  }
  await readTurnEnds(false)

  const watchers: FSWatcher[] = [watch(paths.requests, pass), watch(paths.turnEnds, turnEnds)]
  const timer = setInterval(() => {
    pass()
    turnEnds()
  }, PASS_MS)
  const sweep = () =>
    sweepPrompts(now()).catch((error: unknown) => log.warn('prompt copies not swept', { error }))
  void sweep()
  const sweeper = setInterval(sweep, SWEEP_MS)
  pass()

  running = {
    async stop() {
      clearInterval(timer)
      clearInterval(sweeper)
      for (const w of watchers) w.close()
      for (const t of snapshotTimers.values()) clearTimeout(t)
      snapshotTimers.clear()
      await rm(paths.alive, { force: true })
    },
  }
}

export async function stopControl(): Promise<void> {
  const stopping = running
  running = null
  await stopping?.stop()
}

const snapshotTimers = new Map<string, NodeJS.Timeout>()

// Who publishes every project's snapshot: the window's state. Agent state and context readings
// change without it knowing, so they call snapshotsChanged().
let snapshotSource: () => void = () => {}
export function setSnapshotSource(publish: () => void): void {
  snapshotSource = publish
}
export function snapshotsChanged(): void {
  if (running) snapshotSource()
}

// A project's sessions as list_sessions reads them, written once changes settle.
export function publishSnapshot(projectId: string, snapshot: () => Snapshot): void {
  if (!running) return
  clearTimeout(snapshotTimers.get(projectId))
  snapshotTimers.set(
    projectId,
    setTimeout(() => {
      snapshotTimers.delete(projectId)
      writeAtomic(controlPaths().snapshots, `${projectId}.json`, snapshot()).catch(
        (error: unknown) =>
          log.warn('a project snapshot could not be written', { projectId, error }),
      )
    }, SNAPSHOT_DELAY_MS),
  )
}

// A project that is gone leaves no snapshot behind.
export function dropSnapshot(projectId: string): void {
  clearTimeout(snapshotTimers.get(projectId))
  snapshotTimers.delete(projectId)
  rm(join(controlPaths().snapshots, `${projectId}.json`), { force: true }).catch((error: unknown) =>
    log.warn('a project snapshot could not be removed', { projectId, error }),
  )
}
