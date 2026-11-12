import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { BrowserWindow, Notification, shell, type WebContents } from 'electron'
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
import { mutedList } from '../core/mute'
import { closeStaleTopicNotices, topicKey } from '../core/orchestration/notices'
import { notifiesFor } from '../core/orchestration/notifies'
import type { Topics } from '../core/orchestration/topics'
import { projectOf } from '../core/projects/model'
import { loadState } from '../core/state'
import type { EventChannel, EventChannels } from '../shared/ipc'
import { snapshotsChanged } from './control'
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

export function paneShown(paneId: string): ShownState | undefined {
  return tracked.get(paneId)?.state
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
  snapshotsChanged()
}

function playSound(file: string): void {
  log.info('a notification sound played', { file })
  if (!existsSync(file)) {
    shell.beep()
    return
  }
  const player = spawn('paplay', [file], { stdio: 'ignore', detached: true })
  player.on('error', () => shell.beep()) // no PulseAudio client: the system beep instead
  player.unref()
}

async function notify(pane: AgentPane, state: 'blocked' | 'done'): Promise<void> {
  const saved = await loadState()
  const session = pane.sessionId()
  const projects = currentProjects()
  if (
    session !== null &&
    !notifiesFor(session, projects ? projectOf(projects, session) : undefined, mutedList(saved))
  )
    return
  const settings = notifySettings(saved.rest)
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

export interface TopicNotice {
  readonly project: string
  readonly number: number
  readonly title: string
  // False while the human is discussing another topic of the project.
  readonly sound: boolean
  // The focused window showing the topic's project, if any: the notice is a toast there.
  readonly focused: WebContents | null
  readonly onClick: () => void
}

// A topic is raised by Menkar, not by a session, so no session's mute applies (decision 1.103).
export async function notifyTopic(notice: TopicNotice): Promise<void> {
  const settings = notifySettings((await loadState()).rest)
  const what = plan('blocked', notice.focused !== null, settings)
  if (what.sound !== null && notice.sound) playSound(what.sound)
  const title = t('topics.noticeTitle', { n: String(notice.number) })
  if (what.show === 'toast' && notice.focused) {
    notice.focused.send('topics:toast', {
      project: notice.project,
      number: notice.number,
      text: `${title}: ${notice.title}`,
    })
    return
  }
  if (what.show === null || !Notification.isSupported()) return
  const notification = new Notification({ title, body: notice.title })
  notification.on('click', notice.onClick)
  tray.show(topicKey(notice.project, notice.number), notification)
  notification.show()
}

// After any change: a notice whose topic was seen, closed, or left the mode leaves the tray.
export function syncTopicNotices(topics: Topics, on: (projectId: string) => boolean): void {
  closeStaleTopicNotices(tray, topics, on)
}

type ShownChange = (
  paneId: string,
  sessionId: string | null,
  previous: ShownState,
  next: ShownState,
) => void
const shownChanges = new Set<ShownChange>()

// A pane's shown state changed: what wakes a parent session listens here.
export function onShownChange(listener: ShownChange): () => void {
  shownChanges.add(listener)
  return () => shownChanges.delete(listener)
}

function setState(entry: Tracked, next: ShownState): void {
  if (next === entry.state) return
  const previous = entry.state
  entry.state = next
  for (const listener of shownChanges)
    listener(entry.pane.id, entry.pane.sessionId(), previous, next)
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
