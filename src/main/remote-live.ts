import { type FSWatcher, watch } from 'node:fs'
import { AGENT_IDS } from '../core/agents/ids'
import { log } from '../core/log'
import type { BridgeState } from '../core/remote/live'
import { mainKitOf } from './agents/registry'
import { agentPanes } from './panes'

// Whether each pane's Remote Control bridge is connected now, for the agents that have one, read
// by the agent's kit. Each kit's folder is watched and, because a watch can miss events, polled as
// well.

const DEBOUNCE_MS = 250
const POLL_MS = 5000

const live = new Map<string, BridgeState>()

export function remoteLive(paneId: string): BridgeState {
  return live.get(paneId) ?? 'unknown'
}

let running: Promise<void> | null = null
let again = false

async function pass(changed: () => void): Promise<void> {
  const seen = new Set<string>()
  let moved = false
  for (const pane of agentPanes()) {
    const remote = mainKitOf(pane.provider).remote
    if (remote === null) continue
    seen.add(pane.id)
    const state = pane.foreground() ? await remote.live(pane) : 'unknown'
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

function remoteFolders(): Set<string> {
  const folders = new Set<string>()
  for (const id of AGENT_IDS) {
    const remote = mainKitOf(id).remote
    if (remote !== null) folders.add(remote.folder())
  }
  return folders
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
  const watchers = new Map<string, FSWatcher>()
  const watchFolders = () => {
    for (const folder of remoteFolders()) {
      if (watchers.has(folder)) continue
      try {
        const watcher = watch(folder, soon)
        watcher.on('error', () => {
          watcher.close()
          watchers.delete(folder)
        })
        watchers.set(folder, watcher)
      } catch {
        // no folder yet: the poll keeps reading, and watches once it exists
      }
    }
  }
  watchFolders()
  const poll = setInterval(() => {
    watchFolders()
    void refresh(changed)
  }, POLL_MS)
  void refresh(changed)
  return () => {
    clearTimeout(timer)
    clearInterval(poll)
    for (const watcher of watchers.values()) watcher.close()
  }
}

// A pane that opened or changed its foreground is read soon, without waiting for the poll.
export function remoteLiveSoon(changed: () => void): void {
  setTimeout(() => void refresh(changed), DEBOUNCE_MS)
}
