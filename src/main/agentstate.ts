import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { BrowserWindow, Notification, shell } from 'electron'
import { AGENT_NAMES, notifySettings, plan } from '../core/agentstate/notify'
import {
  type AgentStates,
  afterSeen,
  blockedCounts,
  nextShown,
  notifies,
  type ShownState,
} from '../core/agentstate/shown'
import { NotificationTray } from '../core/agentstate/tray'
import { PaneWatcher } from '../core/agentstate/watch'
import { t } from '../core/i18n'
import { log } from '../core/log'
import { projectOf } from '../core/projects/model'
import { loadState } from '../core/state'
import type { EventChannel, EventChannels } from '../shared/ipc'
import { type AgentPane, agentPanes, onAgentPane } from './panes'
import { currentProjects } from './projects'
import { remoteLive, remoteLiveSoon, startRemoteLive } from './remote-live'

function broadcast<C extends EventChannel>(channel: C, payload: EventChannels[C]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

interface Tracked {
  readonly pane: AgentPane
  readonly watcher: PaneWatcher
  state: ShownState
}

const tracked = new Map<string, Tracked>()
// One desktop notification per session (or unjoined tab): a newer one replaces it, and looking at
// the pane closes it, so the dock's count of unread notifications goes down.
const tray = new NotificationTray<Notification>()
// The key each pane's notification was filed under: a session can join after it was shown.
const notifiedAs = new Map<string, string>()

function withdraw(paneId: string): void {
  const identity = notifiedAs.get(paneId)
  if (identity === undefined) return
  tray.seen(identity)
  notifiedAs.delete(paneId)
}

export function agentStates(): AgentStates {
  const panes = [...tracked.values()].map(({ pane, state }) => ({
    paneId: pane.id,
    sessionId: pane.sessionId(),
    state,
    remoteLive: remoteLive(pane.id),
  }))
  const projects = currentProjects()
  const blocked = blockedCounts(panes, (sessionId) =>
    projects ? projectOf(projects, sessionId)?.id : undefined,
  )
  return { panes, blocked }
}

// Every window learns of any change: the blocked count spans them all.
export function refreshAgentStates(): void {
  broadcast('agentState:changed', agentStates())
}

function playSound(file: string): void {
  if (!existsSync(file)) {
    shell.beep()
    return
  }
  const player = spawn('paplay', [file], { stdio: 'ignore', detached: true })
  player.on('error', () => shell.beep()) // no PulseAudio client: the system beep instead
  player.unref()
}

async function notify(pane: AgentPane, state: 'blocked' | 'done'): Promise<void> {
  const settings = notifySettings((await loadState()).rest)
  const what = plan(state, pane.windowFocused(), settings)
  if (what.sound !== null) playSound(what.sound)
  if (what.show === null) return
  const agent = AGENT_NAMES[pane.provider] ?? pane.provider
  const text =
    state === 'blocked'
      ? t('agentState.needsInput', { agent })
      : t('agentState.finished', { agent })
  if (what.show === 'toast') {
    broadcast('agentState:toast', {
      paneId: pane.id,
      text: t('agentState.toast', { tab: pane.tabTitle(), text }),
    })
    return
  }
  if (!Notification.isSupported()) return
  const identity = pane.sessionId() ?? pane.tabTitle()
  const notification = new Notification({ title: pane.tabTitle(), body: text })
  notification.on('click', () => pane.reveal())
  tray.show(identity, notification)
  notifiedAs.set(pane.id, identity)
  notification.show()
}

function setState(entry: Tracked, next: ShownState): void {
  if (next === entry.state) return
  entry.state = next
  refreshAgentStates()
}

function track(pane: AgentPane): void {
  if (tracked.has(pane.id)) return
  const entry: Tracked = {
    pane,
    state: 'idle',
    watcher: new PaneWatcher(pane, (raw) => {
      const seen = pane.seen()
      const previous = entry.state
      const next = nextShown(previous, raw, seen)
      setState(entry, next)
      if (notifies(previous, next, seen) && (next === 'done' || next === 'blocked')) {
        notify(pane, next).catch((error: unknown) =>
          log.warn('agent notification failed', { error }),
        )
      }
    }),
  }
  tracked.set(pane.id, entry)
  remoteLiveSoon(refreshAgentStates)
  const stopSeen = pane.onSeen(() => {
    if (!pane.seen()) return
    setState(entry, afterSeen(entry.state))
    withdraw(pane.id)
  })
  pane.onClose(() => {
    withdraw(pane.id)
    entry.watcher.dispose()
    stopSeen()
    tracked.delete(pane.id)
    refreshAgentStates()
  })
}

export function startAgentState(): () => void {
  for (const pane of agentPanes()) track(pane)
  const stopTracking = onAgentPane(track)
  const stopRemote = startRemoteLive(refreshAgentStates)
  return () => {
    stopTracking()
    stopRemote()
    tray.closeAll()
    notifiedAs.clear()
  }
}
