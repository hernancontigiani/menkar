import { BrowserWindow } from 'electron'
import { flavorFacts } from '../core/flavor'
import { log } from '../core/log'
import { agentPaths } from '../core/paths'
import type { SessionInfo } from '../core/sessions/info'
import { SessionsService } from '../core/sessions/service'
import { startedSessions, withStarted } from '../core/state'

// One scan and one set of watches serve every window.
export const sessions = new SessionsService({
  roots: () => {
    const paths = agentPaths()
    return { claudeProjects: paths.claudeProjects, cursorProjects: paths.cursorProjects }
  },
})

// What the sandbox started, kept in memory beside state.json so the guard asks synchronously.
let started: ReadonlySet<string> = new Set()

export function startedIds(): ReadonlySet<string> {
  return started
}

async function loadStarted(): Promise<void> {
  if (!flavorFacts().ownsOnly) return
  // A union: an id noted a moment ago may not have reached the state read here yet.
  started = new Set([...started, ...startedSessions(await sessions.currentState())])
}

// A session the sandbox started, or that bound in one of its panes. The daily Menkar keeps no
// such list: its state.json stays as it was.
export function noteStarted(id: string): void {
  if (!flavorFacts().ownsOnly || started.has(id)) return
  started = new Set([...started, id])
  sessions
    .updateState((state) => withStarted(state, id))
    .catch((error: unknown) => log.error('a started session could not be recorded', { error }))
}

// The windows see only what this flavour may act on. The scan itself sees everything: a new
// session's late id is found in it before it is recorded as started.
export function shownSessions(list: readonly SessionInfo[]): readonly SessionInfo[] {
  return flavorFacts().ownsOnly ? list.filter((s) => started.has(s.id)) : list
}

export async function sessionsForWindows(): Promise<readonly SessionInfo[]> {
  const list = await sessions.list()
  await loadStarted()
  return shownSessions(list)
}

export function broadcastSessions(): () => void {
  return sessions.onChange((list) => {
    const send = () => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('sessions:changed', shownSessions(list))
      }
    }
    if (flavorFacts().ownsOnly) void loadStarted().then(send)
    else send()
  })
}
