import { type FSWatcher, watch } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { log } from '../core/log'
import { agentPaths } from '../core/paths'
import {
  type BridgeState,
  bridgeState,
  findAgentPid,
  type ProcReader,
  procStartOf,
} from '../core/remote/live'
import { agentPanes } from './panes'

// Whether each Claude pane's bridge is connected now, from Claude Code's per-process registry
// (read only). The folder is watched and, because a watch can miss events, polled as well.

const DEBOUNCE_MS = 250
const POLL_MS = 5000

const live = new Map<string, BridgeState>()
// A registry file that did not read as expected is logged once per pid, not on every pass.
const reported = new Set<number>()

export function remoteLive(paneId: string): BridgeState {
  return live.get(paneId) ?? 'unknown'
}

async function children(pid: number): Promise<number[]> {
  try {
    const tasks = await readdir(`/proc/${pid}/task`)
    const found: number[] = []
    for (const task of tasks) {
      const text = await readFile(`/proc/${pid}/task/${task}/children`, 'utf8').catch(() => '')
      for (const child of text.trim().split(/\s+/))
        if (/^\d+$/.test(child)) found.push(Number(child))
    }
    return found
  } catch {
    return [] // the process is gone
  }
}

// The finder is pure and synchronous; the tree under a pane's shell is read first, a few levels
// deep, and handed to it.
async function procSnapshot(root: number): Promise<ProcReader> {
  const tree = new Map<number, number[]>()
  const argv = new Map<number, string[]>()
  let level = [root]
  for (let depth = 0; depth < 3 && level.length > 0; depth += 1) {
    const next: number[] = []
    for (const pid of level) {
      const kids = await children(pid)
      tree.set(pid, kids)
      for (const kid of kids) {
        const raw = await readFile(`/proc/${kid}/cmdline`, 'utf8').catch(() => '')
        argv.set(kid, raw.split('\0').filter(Boolean))
        next.push(kid)
      }
    }
    level = next
  }
  return { children: (pid) => tree.get(pid) ?? [], argv: (pid) => argv.get(pid) ?? [] }
}

async function readOne(shellPid: number, sessionId: string | null): Promise<BridgeState> {
  const pid = findAgentPid(shellPid, 'claude', await procSnapshot(shellPid))
  if (pid === null) return 'unknown'
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '')
  let json: unknown
  try {
    json = JSON.parse(await readFile(join(agentPaths().claudeSessions, `${pid}.json`), 'utf8'))
  } catch (error) {
    if (!reported.has(pid)) {
      reported.add(pid)
      log.info('remote control state unreadable; the icon follows the app list', { pid, error })
    }
    return 'unknown'
  }
  const state = bridgeState(json, { pid, sessionId, procStart: procStartOf(stat) })
  if (state === 'unknown' && !reported.has(pid)) {
    reported.add(pid)
    log.info('remote control state not as expected; the icon follows the app list', { pid })
  }
  return state
}

let running: Promise<void> | null = null
let again = false

async function pass(changed: () => void): Promise<void> {
  const seen = new Set<string>()
  let moved = false
  for (const pane of agentPanes()) {
    if (pane.provider !== 'claude') continue
    seen.add(pane.id)
    const state = pane.foreground() ? await readOne(pane.shellPid(), pane.sessionId()) : 'unknown'
    if (live.get(pane.id) !== state) {
      live.set(pane.id, state)
      moved = true
    }
  }
  for (const id of [...live.keys()]) {
    if (!seen.has(id)) {
      live.delete(id)
      moved = true
    }
  }
  if (moved) changed()
}

// One pass at a time; a request during a pass runs once after it. The cleanup is chained after
// the assignment: a pass with nothing to await settles before `running` would otherwise be set.
function refresh(changed: () => void): Promise<void> {
  if (running) {
    again = true
    return running
  }
  const current = pass(changed)
    .catch((error: unknown) => log.warn('remote control state pass failed', { error }))
    .finally(() => {
      running = null
      if (again) {
        again = false
        void refresh(changed)
      }
    })
  running = current
  return current
}

export function startRemoteLive(changed: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void refresh(changed), DEBOUNCE_MS)
  }
  let watcher: FSWatcher | null = null
  const watchFolder = () => {
    if (watcher) return
    try {
      watcher = watch(agentPaths().claudeSessions, soon)
      watcher.on('error', () => {
        watcher?.close()
        watcher = null
      })
    } catch {
      watcher = null // no folder yet: the poll keeps reading, and watches once it exists
    }
  }
  watchFolder()
  const poll = setInterval(() => {
    watchFolder()
    void refresh(changed)
  }, POLL_MS)
  void refresh(changed)
  return () => {
    clearTimeout(timer)
    clearInterval(poll)
    watcher?.close()
  }
}

// A pane that opened or changed its foreground is read soon, without waiting for the poll.
export function remoteLiveSoon(changed: () => void): void {
  setTimeout(() => void refresh(changed), DEBOUNCE_MS)
}
