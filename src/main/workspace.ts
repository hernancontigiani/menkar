import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, shell, type WebContents } from 'electron'
import { now } from '../core/clock'
import { buildCommand, type Start } from '../core/command'
import type { Reading } from '../core/context/types'
import { checkTyped, expandInput } from '../core/files/check'
import { type Key, t } from '../core/i18n'
import { log } from '../core/log'
import { agentPaths } from '../core/paths'
import {
  closeTab as closeLayoutTab,
  holder,
  type Layout,
  type LayoutWindow,
  moveSessionHere,
  newWindowProject,
  nthTab,
  openBeside,
  openSession,
  removeWindow,
  reopen,
  shownTab,
  stepTab,
  switchProject,
  type Tab,
  toSaved,
} from '../core/projects/layout'
import {
  addMember,
  createProject,
  deleteProject,
  joinTarget,
  newGroup,
  type Projects,
  projectOf,
  removeMember,
  renameProject,
  setCurrent,
  setGroup,
} from '../core/projects/model'
import { saveProjects } from '../core/projects/store'
import { remoteControlList, remoteName, setRemoteControl } from '../core/remote'
import type { SessionInfo } from '../core/sessions/info'
import { AGENT_COMMANDS, findOnPath } from '../core/sessions/installed'
import { lookUp, type Pending } from '../core/sessions/join'
import { applyNameLines, emptyNames } from '../core/sessions/names'
import {
  details,
  exportMarkdown,
  replayTurns,
  safeFileName,
  type Turn,
} from '../core/sessions/transcript'
import { type Settings, settingsOf, withSetting } from '../core/settings'
import { setAppName } from '../core/state'
import type {
  Action,
  ActionResult,
  PaneAgent,
  TabEntry,
  TabView,
  WindowState,
} from '../shared/workspace'
import { chooseChatFolder, closeChat, ghosttyInstalled, openInGhostty, startChat } from './chat'
import { contextReading, sessionSettingsFile, trackContext } from './context'
import {
  applyEdit,
  bufferState,
  isDirty,
  keepMine,
  onBufferUpdate,
  openBuffer,
  releaseBuffersExcept,
  reloadBuffer,
  saveBuffer,
} from './files'
import { notifySeen, type PaneHandle, registerAgentPane } from './panes'
import { currentNotices, currentProjects, dismissNotice, setProjects } from './projects'
import { sessions } from './sessions'
import { appMessage, Terminal } from './terminal'
import { sessionTokens } from './usage'
import { openAbout, openMcpServers, openPreferences, openUsage } from './windows'

const LAYOUT_SAVE_DELAY_MS = 500
const JOIN_POLL_MS = 1500
const WINDOW_WIDTH = 1280
const WINDOW_HEIGHT = 800
const TITLE_BAR_HEIGHT = 43
const MAXIMIZE_SETTLE_MS = 500
const lastMaximizeChange = new Map<string, number>()

interface Pane {
  readonly id: string
  tabId: string
  readonly agent: PaneAgent
  sessionId: string | null
  readonly terminal: Terminal
  handle: PaneHandle | undefined
  pending: Pending | undefined
  readonly cwd: string | null
  // Started with `--remote-control`: kept until the pane goes.
  readonly remote: boolean
}

// The sessions in state.json's `remote_control`, kept current from the sessions service.
let remoteIds = new Set<string>()

// The orientation of a tab that is not a session tab in the layout (a transient tab split).
const tabOrientation = new Map<string, 'horizontal' | 'vertical'>()

const newId = () => randomUUID().replaceAll('-', '').slice(0, 12)

let projects: Projects
let layout: Layout = { windows: [] }
let sessionList: readonly SessionInfo[] = []
let settings: Settings
const panes = new Map<string, Pane>()
const tabPanes = new Map<string, string[]>()
const tabLabels = new Map<string, { title: string; tooltip: string }>()
const tabReplays = new Map<string, readonly Turn[]>()
// Chat tabs (plan 14): tab id → chat id.
const tabChats = new Map<string, string>()
const lastDirty = new Map<string, boolean>()
const windows = new Map<string, BrowserWindow>()
const allowedToClose = new Set<string>()
// Windows, the most recently focused first.
let focusOrder: string[] = []
let installedAgents: ('claude' | 'cursor')[] = []
let closingLast = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let joinTimer: ReturnType<typeof setInterval> | undefined

// ---------------------------------------------------------------- lookups

const sessionInfo = (id: string) => sessionList.find((s) => s.id === id)
const sessionName = (id: string) => sessionInfo(id)?.name ?? id.slice(0, 8)
const agentName = (agent: PaneAgent) => (agent === 'cursor' ? t('agent.cursor') : t('agent.claude'))

function windowOfTab(tabId: string): LayoutWindow | undefined {
  return layout.windows.find((w) => w.tabs.some((tab) => tab.id === tabId))
}

function tabById(tabId: string): Tab | undefined {
  return windowOfTab(tabId)?.tabs.find((tab) => tab.id === tabId)
}

function windowIdOf(contents: WebContents): string | undefined {
  for (const [id, window] of windows)
    if (!window.isDestroyed() && window.webContents.id === contents.id) return id
  return undefined
}

function putWindow(w: LayoutWindow): void {
  layout = { windows: layout.windows.map((x) => (x.id === w.id ? w : x)) }
}

function replaceTab(tabId: string, change: (tab: Tab) => Tab): void {
  const w = windowOfTab(tabId)
  if (w) putWindow({ ...w, tabs: w.tabs.map((tab) => (tab.id === tabId ? change(tab) : tab)) })
}

function paneOfSession(sessionId: string): Pane | undefined {
  for (const pane of panes.values()) if (pane.sessionId === sessionId) return pane
  return undefined
}

// ---------------------------------------------------------------- state for the renderer

function tabView(tab: Tab): TabView {
  const ids = tabPanes.get(tab.id) ?? []
  const paneViews = ids.flatMap((id) => {
    const pane = panes.get(id)
    return pane
      ? [{ id: pane.id, agent: pane.agent, sessionId: pane.sessionId, remote: pane.remote }]
      : []
  })
  const label = tabLabels.get(tab.id)
  let title = label?.title ?? ''
  let tooltip = label?.tooltip ?? ''
  let groupColor: string | null = null
  if (tab.kind === 'file') {
    // A rename lasts while the tab does; it is not saved.
    const name = label?.title ?? basename(tab.path)
    title = tab.preview
      ? t('files.previewTitle', { name })
      : `${name}${isDirty(tab.path) ? ' •' : ''}`
    tooltip = tab.path
  }
  if (tab.kind === 'session') {
    if (!label) title = tab.panes.map(sessionName).join(' │ ')
    const first = tab.panes[0]
    const info = first ? sessionInfo(first) : undefined
    if (!tooltip && first)
      tooltip = t('tab.tooltipSession', {
        folder: basename(info?.cwd ?? info?.folder ?? ''),
        id: first,
      })
    const project = projects.projects.find((p) => p.id === tab.project)
    const colors = tab.panes.map(
      (id) => project?.groups.find((g) => g.members.includes(id))?.color ?? null,
    )
    if (colors.length > 0 && colors.every((c) => c !== null && c === colors[0]))
      groupColor = colors[0] ?? null
  }
  const orientation =
    tab.kind === 'session' ? tab.orientation : (tabOrientation.get(tab.id) ?? 'horizontal')
  return {
    id: tab.id,
    project: tab.project,
    kind: tab.kind,
    title,
    tooltip,
    panes: paneViews,
    orientation,
    groupColor,
    ...(tabReplays.has(tab.id) ? { replay: tabReplays.get(tab.id) ?? [] } : {}),
    ...(tab.kind === 'file' ? { file: { path: tab.path, preview: tab.preview } } : {}),
    ...(tabChats.has(tab.id) ? { chat: tabChats.get(tab.id) ?? '' } : {}),
  }
}

function runningNames(windowId: string): string[] {
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) return []
  return w.tabs.flatMap((tab) =>
    (tabPanes.get(tab.id) ?? []).flatMap((id) => {
      const pane = panes.get(id)
      if (!pane?.terminal.running) return []
      return [pane.sessionId ? sessionName(pane.sessionId) : agentName(pane.agent)]
    }),
  )
}

function stateFor(windowId: string): WindowState | undefined {
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) return undefined
  const heldElsewhere: Record<string, string> = {}
  for (const p of projects.projects) {
    const h = holder(layout, p.id)
    if (h !== undefined && h !== windowId) heldElsewhere[p.id] = h
  }
  return {
    windowId,
    settings,
    shown: w.shown,
    projects: projects.projects.map(({ id, name, members, groups }) => ({
      id,
      name,
      members,
      groups,
    })),
    heldElsewhere,
    tabs: w.tabs.map(tabView),
    selectedTab: shownTab(w),
    tabCount: w.tabs.length,
    sessions: sessionList,
    running: [...panes.values()]
      .filter((p) => p.sessionId && p.terminal.running)
      .map((p) => p.sessionId as string),
    open: [...panes.values()].flatMap((p) => (p.sessionId ? [p.sessionId] : [])),
    readings: readingsOf(w.shown),
    remoteControl: [...remoteIds],
    ghostty: ghosttyInstalled(),
    home: homedir(),
    notices: currentNotices(),
    agents: installedAgents,
  }
}

const tracked = new Set<string>()

// Each member session of a shown project is followed for its context ring, once.
function readingsOf(projectId: string): Record<string, Reading> {
  const out: Record<string, Reading> = {}
  for (const id of projects.projects.find((p) => p.id === projectId)?.members ?? []) {
    const info = sessionInfo(id)
    if (!info) continue
    if (!tracked.has(id)) {
      tracked.add(id)
      trackContext(id, info.file)
    }
    const reading = contextReading(id)
    if (reading) out[id] = reading
  }
  return out
}

export function windowState(contents: WebContents): WindowState | undefined {
  const id = windowIdOf(contents)
  return id ? stateFor(id) : undefined
}

// For modules that change what a window shows (a setting written elsewhere): every window redraws.
export function pushWindowStates(): void {
  push()
}

function push(): void {
  for (const [id, window] of windows) {
    const state = stateFor(id)
    if (state && !window.isDestroyed()) window.webContents.send('window:state', state)
  }
}

// ---------------------------------------------------------------- saving

let lastSave: Promise<void> = Promise.resolve()

function saveProjectsNow(): Promise<void> {
  if (closingLast) return lastSave
  setProjects(projects)
  lastSave = saveProjects(projects, toSaved(layout)).catch((error: unknown) =>
    log.error('projects.json could not be saved', { error }),
  )
  return lastSave
}

// Projects, groups and membership are saved at once; the layout 500 ms after the last change.
function filePaths(): Set<string> {
  return new Set(
    layout.windows.flatMap((w) => w.tabs.flatMap((tab) => (tab.kind === 'file' ? [tab.path] : []))),
  )
}

function changed(options: { projects?: boolean } = {}): void {
  releaseBuffersExcept(filePaths())
  push()
  if (options.projects) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    saveProjectsNow()
    return
  }
  saveTimer ??= setTimeout(() => {
    saveTimer = undefined
    saveProjectsNow()
  }, LAYOUT_SAVE_DELAY_MS)
}

// ---------------------------------------------------------------- panes

interface PaneSpec {
  readonly agent: PaneAgent
  readonly start?: Start
  readonly cwd: string | null
  readonly sessionId: string | null
  readonly pending?: Pending
  // The name to start with `--remote-control=<name>` (Claude Code only).
  readonly remote?: string
}

async function startPane(tabId: string, spec: PaneSpec): Promise<void> {
  const id = newId()
  const tag = t('terminal.tag')
  const messages: string[] = []
  let command: string | undefined
  if (spec.agent !== 'shell' && spec.start) {
    const cliName = AGENT_COMMANDS[spec.agent]
    const cli = await findOnPath(cliName)
    if (cli === null) messages.push(appMessage(tag, t('terminal.notFound', { cli: cliName })))
    else {
      const settingsFile = spec.agent === 'claude' ? await sessionSettingsFile() : undefined
      command = buildCommand(spec.agent, spec.start, {
        cli,
        ...(settingsFile ? { settings: settingsFile } : {}),
        ...(spec.agent === 'claude' && spec.remote ? { remoteControl: spec.remote } : {}),
      })
    }
  }
  const size = { cols: 80, rows: 24 }
  let pane: Pane | undefined
  const terminal = new Terminal(
    {
      cwd: spec.cwd,
      ...size,
      messages,
      folderGone: (cwd) => appMessage(tag, t('terminal.folderGone', { cwd })),
      ...(command ? { command } : {}),
    },
    {
      data: (data, end) => {
        pane?.handle?.write(data)
        const w = pane ? windowOfTab(pane.tabId) : undefined
        const window = w ? windows.get(w.id) : undefined
        if (window && !window.isDestroyed())
          window.webContents.send('pty:data', { pane: id, data, end })
      },
      exit: () => onPaneExit(id),
    },
  )
  pane = {
    id,
    tabId,
    agent: spec.agent,
    sessionId: spec.sessionId,
    terminal,
    handle: undefined,
    pending: spec.pending,
    cwd: spec.cwd,
    remote: spec.agent === 'claude' && spec.remote !== undefined,
  }
  const self = pane
  if (spec.agent !== 'shell') {
    self.handle = registerAgentPane(id, spec.agent, size, {
      sessionId: () => self.sessionId,
      foreground: () => self.terminal.running,
      shellPid: () => self.terminal.pid,
      seen: () => {
        const w = windowOfTab(self.tabId)
        const window = w ? windows.get(w.id) : undefined
        return (
          !!w &&
          shownTab(w) === self.tabId &&
          !!window &&
          !window.isDestroyed() &&
          window.isFocused()
        )
      },
      tabTitle: () => {
        const tab = tabById(self.tabId)
        return tab ? tabView(tab).title : ''
      },
      windowFocused: () => {
        const w = windowOfTab(self.tabId)
        const window = w ? windows.get(w.id) : undefined
        return !!window && !window.isDestroyed() && window.isFocused()
      },
      reveal: () => revealPane(self.id),
    })
    self.handle.write(terminal.buffer)
  }
  panes.set(id, self)
  tabPanes.set(tabId, [...(tabPanes.get(tabId) ?? []), id])
  if (self.pending) ensureJoinPolling()
}

function onPaneExit(paneId: string): void {
  const pane = panes.get(paneId)
  if (!pane) return
  panes.delete(paneId)
  pane.handle?.close()
  const ids = (tabPanes.get(pane.tabId) ?? []).filter((id) => id !== paneId)
  if (pane.pending) void checkPending([pane])
  if (ids.length === 0) {
    tabPanes.delete(pane.tabId)
    tabLabels.delete(pane.tabId)
    const w = windowOfTab(pane.tabId)
    if (w) layout = closeLayoutTab(layout, w.id, pane.tabId)
  } else {
    tabPanes.set(pane.tabId, ids)
    const sessionId = pane.sessionId
    if (sessionId) {
      const tab = tabById(pane.tabId)
      // With only a shell left the tab keeps the title it had.
      if (tab && tab.kind === 'session' && tab.panes.length === 1)
        tabLabels.set(tab.id, tabView(tab))
      replaceTab(pane.tabId, (t) =>
        t.kind === 'session' ? { ...t, panes: t.panes.filter((s) => s !== sessionId) } : t,
      )
    }
  }
  changed()
}

export function revealPane(paneId: string): void {
  const pane = panes.get(paneId)
  const w = pane ? windowOfTab(pane.tabId) : undefined
  const tab = pane ? tabById(pane.tabId) : undefined
  if (!pane || !w || !tab) return
  putWindow({ ...w, shown: tab.project, selected: { ...w.selected, [tab.project]: tab.id } })
  windows.get(w.id)?.focus()
  notifySeen()
  changed()
}

export function paneInput(paneId: string, data: string): void {
  panes.get(paneId)?.terminal.write(data)
}

export function paneResize(paneId: string, cols: number, rows: number): void {
  const pane = panes.get(paneId)
  pane?.terminal.resize(cols, rows)
  pane?.handle?.resize(cols, rows)
}

export function paneBuffer(paneId: string): { buffer: string; end: number } {
  const terminal = panes.get(paneId)?.terminal
  return { buffer: terminal?.buffer ?? '', end: terminal?.end ?? 0 }
}

function closeTab(tabId: string): void {
  const w = windowOfTab(tabId)
  if (!w) return
  tabReplays.delete(tabId)
  const chat = tabChats.get(tabId)
  if (chat !== undefined) {
    tabChats.delete(tabId)
    closeChat(chat)
  }
  const ids = tabPanes.get(tabId) ?? []
  tabPanes.delete(tabId)
  tabLabels.delete(tabId)
  layout = closeLayoutTab(layout, w.id, tabId)
  for (const id of ids) {
    const pane = panes.get(id)
    if (!pane) continue
    pane.tabId = `closed-${tabId}`
    pane.terminal.hangUp()
  }
  changed()
}

// ---------------------------------------------------------------- a new session joining

function ensureJoinPolling(): void {
  joinTimer ??= setInterval(() => {
    const pending = [...panes.values()].filter((p) => p.pending)
    if (pending.length === 0) {
      clearInterval(joinTimer)
      joinTimer = undefined
      return
    }
    void checkPending(pending)
  }, JOIN_POLL_MS)
}

async function checkPending(list: readonly Pane[]): Promise<void> {
  await sessions.refresh()
  sessionList = await sessions.list()
  for (const pane of list) {
    if (!pane.pending) continue
    const result = lookUp(pane.pending, sessionList)
    if (result.kind === 'joined') joinSession(pane, result.sessionId)
    else pane.pending = result.kind === 'waiting' ? result.pending : undefined
  }
}

function joinSession(pane: Pane, sessionId: string): void {
  const pending = pane.pending
  if (!pending) return
  pane.pending = undefined
  projects = addMember(projects, joinTarget(projects, pending.startedIn), sessionId)
  pane.sessionId = sessionId
  if (panes.has(pane.id)) {
    tabLabels.delete(pane.tabId)
    replaceTab(pane.tabId, (tab) =>
      tab.kind === 'transient'
        ? {
            kind: 'session',
            id: tab.id,
            project: tab.project,
            panes: [sessionId],
            orientation: 'horizontal',
          }
        : tab,
    )
  }
  changed({ projects: true })
}

// ---------------------------------------------------------------- windows

function createBrowserWindow(windowId: string): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: t('window.title'),
    backgroundColor: '#1e1e2e',
    show: false,
    // The header is the title bar; the system draws only its window buttons, over the header's
    // right end, in the colors the window sends once its look is applied.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#1e1e2e', symbolColor: '#cdd6f4', height: TITLE_BAR_HEIGHT },
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  windows.set(windowId, window)
  window.once('ready-to-show', () => window.show())
  window.on('maximize', () => lastMaximizeChange.set(windowId, now()))
  window.on('unmaximize', () => lastMaximizeChange.set(windowId, now()))
  window.on('focus', () => {
    focusOrder = [windowId, ...focusOrder.filter((id) => id !== windowId)]
    notifySeen()
  })
  window.on('close', (event) => {
    if (allowedToClose.has(windowId)) return
    event.preventDefault()
    const unsaved = unsavedHere(windowId)
    if (unsaved.length > 0 && !unsavedAnswered.has(windowId)) {
      window.webContents.send('window:confirm-unsaved', {
        paths: unsaved,
        names: unsaved.map((p) => basename(p)),
      })
      return
    }
    unsavedAnswered.delete(windowId)
    const names = runningNames(windowId)
    if (names.length === 0) void finishClose(windowId)
    else window.webContents.send('window:confirm-close', names)
  })
  window.on('closed', () => {
    windows.delete(windowId)
    lastMaximizeChange.delete(windowId)
    allowedToClose.delete(windowId)
    hangUpWindow(windowId)
    if (layout.windows.some((w) => w.id === windowId) && windows.size > 0) {
      layout = removeWindow(layout, windowId)
      changed()
    }
  })
  const devServer = process.env.ELECTRON_RENDERER_URL
  if (devServer) void window.loadURL(devServer)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  return window
}

function hangUpWindow(windowId: string): void {
  const w = layout.windows.find((x) => x.id === windowId)
  for (const tab of w?.tabs ?? [])
    for (const id of tabPanes.get(tab.id) ?? []) panes.get(id)?.terminal.hangUp()
}

// The last window keeps its layout in the file for the next start; another window leaves it.
// The last window waits for its save: the app quits right after it, and a write cut short would
// leave its temporary file instead of the new projects.json.
async function finishClose(windowId: string): Promise<void> {
  const last = windows.size <= 1
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (last) {
    const saved = saveProjectsNow()
    closingLast = true
    await saved
  } else {
    layout = removeWindow(layout, windowId)
    saveProjectsNow()
    push()
  }
  hangUpWindow(windowId)
  allowedToClose.add(windowId)
  windows.get(windowId)?.close()
}

let quitAnswer: ((confirmed: boolean) => void) | undefined

// Quitting the whole app (F27, "Restart now"): one question listing the running sessions of every
// window, then the layout saved and every pty hung up; false when the user cancels.
export async function quitApp(): Promise<boolean> {
  if (quitAnswer) return false
  const names = layout.windows.flatMap((w) => runningNames(w.id))
  if (names.length > 0) {
    const asking = windows.get(focusOrder[0] ?? '') ?? [...windows.values()][0]
    if (!asking || asking.isDestroyed()) return false
    const confirmed = await new Promise<boolean>((resolve) => {
      quitAnswer = resolve
      asking.webContents.send('window:confirm-close', names)
    })
    quitAnswer = undefined
    if (!confirmed) return false
  }
  clearTimeout(saveTimer)
  saveTimer = undefined
  const saved = saveProjectsNow()
  closingLast = true
  await saved
  for (const w of layout.windows) {
    hangUpWindow(w.id)
    allowedToClose.add(w.id)
  }
  app.quit()
  return true
}

const unsavedAnswered = new Set<string>()

// The edited files whose every editor tab is in this window: a file also open elsewhere keeps its
// edits there and is not asked about.
function unsavedHere(windowId: string): string[] {
  const here = new Set<string>()
  const elsewhere = new Set<string>()
  for (const w of layout.windows) {
    for (const tab of w.tabs) {
      if (tab.kind !== 'file' || tab.preview || !isDirty(tab.path)) continue
      if (w.id === windowId) here.add(tab.path)
      else elsewhere.add(tab.path)
    }
  }
  return [...here].filter((p) => !elsewhere.has(p))
}

function editorTabsOf(path: string): number {
  return layout.windows.reduce(
    (n, w) =>
      n + w.tabs.filter((tab) => tab.kind === 'file' && !tab.preview && tab.path === path).length,
    0,
  )
}

async function openFileTab(windowId: string, path: string): Promise<Key | null> {
  const opened = await openBuffer(path)
  if ('refusal' in opened) return opened.refusal
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) return null
  const existing = w.tabs.find(
    (tab) =>
      tab.kind === 'file' && !tab.preview && tab.path === opened.path && tab.project === w.shown,
  )
  if (existing) putWindow({ ...w, selected: { ...w.selected, [w.shown]: existing.id } })
  else {
    const tab: Tab = {
      kind: 'file',
      id: newId(),
      project: w.shown,
      path: opened.path,
      preview: false,
    }
    putWindow({ ...w, tabs: [...w.tabs, tab], selected: { ...w.selected, [w.shown]: tab.id } })
  }
  changed()
  return null
}

// The preview goes right after its editor tab; one per project; from the preview, back to the editor.
function togglePreview(windowId: string, tabId: string): void {
  const w = layout.windows.find((x) => x.id === windowId)
  const tab = w?.tabs.find((x) => x.id === tabId)
  if (!w || tab?.kind !== 'file') return
  const twin = w.tabs.find(
    (x) =>
      x.kind === 'file' &&
      x.project === tab.project &&
      x.path === tab.path &&
      x.preview !== tab.preview,
  )
  if (twin) {
    putWindow({ ...w, selected: { ...w.selected, [tab.project]: twin.id } })
  } else if (!tab.preview) {
    const preview: Tab = {
      kind: 'file',
      id: newId(),
      project: tab.project,
      path: tab.path,
      preview: true,
    }
    const index = w.tabs.findIndex((x) => x.id === tabId)
    const tabs = [...w.tabs.slice(0, index + 1), preview, ...w.tabs.slice(index + 1)]
    putWindow({ ...w, tabs, selected: { ...w.selected, [tab.project]: preview.id } })
  }
  changed()
}

// Files handed over by `menkar open`: one window opens them; with several, the active one asks
// which; with none, a window on the current project opens. A plain second start comes forward.
export function deliverFiles(paths: readonly string[]): void {
  if (windows.size === 0) openWindowOn(projects.current)
  const ordered = [...layout.windows].sort((a, b) => rank(a.id) - rank(b.id))
  const active = ordered[0]
  const win = active ? windows.get(active.id) : undefined
  if (!active || !win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  if (paths.length === 0) return
  if (ordered.length === 1) {
    void openFilesIn(active.id, paths)
    return
  }
  const choices = ordered.map((w) => ({
    window: w.id,
    label: projects.projects.find((p) => p.id === w.shown)?.name ?? '',
  }))
  const send = () =>
    win.webContents.send('files:which-window', {
      paths,
      names: paths.map((p) => basename(p)),
      choices,
    })
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

async function openFilesIn(windowId: string, paths: readonly string[]): Promise<void> {
  const refused: { name: string; reason: Key }[] = []
  for (const path of paths) {
    const refusal = await openFileTab(windowId, path)
    if (refusal) refused.push({ name: basename(path), reason: refusal })
  }
  const win = windows.get(windowId)
  win?.focus()
  if (refused.length > 0 && win && !win.isDestroyed())
    win.webContents.send('files:refused', refused)
}

// A chat tab in the window's current project, selected. Not saved, not reopened, its session not
// added to the project, its dot idle, and no confirmation counts it.
export function openChatTab(
  window: BrowserWindow,
  tab: { chatId: string; title: string; tooltip: string },
): void {
  const windowId = [...windows].find(([, w]) => w === window)?.[0]
  if (!windowId) return
  const id = addTransientTab(windowId, tab.title, tab.tooltip)
  tabChats.set(id, tab.chatId)
  changed()
}

function openWindowOn(projectId: string): void {
  const id = newId()
  layout = { windows: [...layout.windows, { id, shown: projectId, tabs: [], selected: {} }] }
  createBrowserWindow(id)
  changed()
}

const isFile = (path: string) => {
  try {
    return statSync(path).isFile()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false
    throw error
  }
}

function resumeSpec(sessionId: string): PaneSpec {
  const info = sessionInfo(sessionId)
  const agent = info?.agent ?? 'claude'
  const remote =
    agent === 'claude' && remoteIds.has(sessionId)
      ? remoteName(info?.name ?? '', info?.cwd ?? null, sessionId)
      : undefined
  return {
    agent,
    start: { kind: 'resume', id: sessionId },
    cwd: info?.cwd ?? null,
    sessionId,
    ...(remote ? { remote } : {}),
  }
}

// Reopens the saved windows (or one window on `current`) once the first scan knows the sessions;
// a session the scan does not know is skipped.
export async function startWorkspace(): Promise<void> {
  const loaded = currentProjects()
  if (!loaded) throw new Error('projects were not loaded before the workspace started')
  projects = loaded
  sessionList = await sessions.list()
  settings = settingsOf(await sessions.currentState())
  remoteIds = new Set(remoteControlList(await sessions.currentState()))
  installedAgents = []
  if (await findOnPath(AGENT_COMMANDS.claude)) installedAgents.push('claude')
  if (await findOnPath(AGENT_COMMANDS.cursor)) installedAgents.push('cursor')
  sessions.onChange((list) => {
    sessionList = list
    void sessions.currentState().then((state) => {
      settings = settingsOf(state)
      remoteIds = new Set(remoteControlList(state))
      push()
    })
  })
  const known = new Set(sessionList.map((s) => s.id))
  const reopened = reopen(projects, { reopenTabs: settings.reopen_tabs, isFile, newId })
  layout = {
    windows: reopened.windows.map((w) => ({
      ...w,
      tabs: w.tabs.flatMap((tab): Tab[] => {
        if (tab.kind !== 'session') return [tab]
        const panesKnown = tab.panes.filter((id) => known.has(id))
        return panesKnown.length > 0 ? [{ ...tab, panes: panesKnown }] : []
      }),
    })),
  }
  // Files are checked off the UI path first, keeping their order; one that fails is dropped.
  for (const w of layout.windows) {
    const kept: Tab[] = []
    for (const tab of w.tabs) {
      if (tab.kind !== 'file') kept.push(tab)
      else {
        const opened = await openBuffer(tab.path)
        if ('refusal' in opened)
          log.info('a saved file tab was not reopened', { path: tab.path, reason: opened.refusal })
        else kept.push({ ...tab, path: opened.path })
      }
    }
    putWindow({ ...w, tabs: kept })
  }
  onBufferUpdate((update) => {
    const markChanged = lastDirty.get(update.path) !== update.dirty || update.changes === undefined
    lastDirty.set(update.path, update.dirty)
    for (const lw of layout.windows) {
      if (!lw.tabs.some((tab) => tab.kind === 'file' && tab.path === update.path)) continue
      const win = windows.get(lw.id)
      if (win && !win.isDestroyed()) win.webContents.send('file:update', update)
    }
    if (markChanged) push()
  })
  for (const w of layout.windows) {
    createBrowserWindow(w.id)
    for (const tab of w.tabs)
      if (tab.kind === 'session')
        for (const id of tab.panes) await startPane(tab.id, resumeSpec(id))
  }
  changed()
}

export function openFirstWindowIfNone(): void {
  if (windows.size === 0) openWindowOn(projects.current)
}

// ---------------------------------------------------------------- actions

async function pickFolder(): Promise<string | null> {
  const start = settings.new_session_dir
  const result = await dialog.showOpenDialog({
    title: t('dialog.chooseProjectDir'),
    properties: ['openDirectory'],
    ...(start && statSafeDir(start) ? { defaultPath: start } : {}),
  })
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

const statSafeDir = (path: string) => {
  try {
    return statSync(path).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false
    throw error
  }
}

async function rememberFolder(folder: string): Promise<void> {
  await sessions.updateState((state) => withSetting(state, 'new_session_dir', folder))
  settings = { ...settings, new_session_dir: folder }
}

function addTransientTab(windowId: string, title: string, tooltip: string): string {
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) throw new Error(`no window ${windowId}`)
  const tab: Tab = { kind: 'transient', id: newId(), project: w.shown }
  putWindow({ ...w, tabs: [...w.tabs, tab], selected: { ...w.selected, [w.shown]: tab.id } })
  tabLabels.set(tab.id, { title, tooltip })
  return tab.id
}

function newSessionPending(windowId: string, folder: string, expectedId: string | null): Pending {
  const shown = layout.windows.find((x) => x.id === windowId)?.shown ?? projects.current
  return { startedIn: shown, expectedId, folder, startedAt: now(), tries: 0 }
}

export async function runAction(contents: WebContents, action: Action): Promise<ActionResult> {
  const windowId = windowIdOf(contents)
  if (!windowId) return {}
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) return {}
  switch (action.type) {
    case 'switchProject': {
      const outcome = switchProject(layout, windowId, action.project)
      if (outcome.kind === 'focus') windows.get(outcome.window)?.focus()
      if (outcome.kind === 'shown') {
        layout = outcome.layout
        projects = setCurrent(projects, action.project)
        changed({ projects: true })
      }
      return {}
    }
    case 'createProject': {
      const result = createProject(projects, action.name, newId())
      if (!result.ok) return { refusal: result.refusal }
      projects = result.projects
      putWindow({ ...w, shown: projects.current })
      changed({ projects: true })
      return {}
    }
    case 'renameProject': {
      const result = renameProject(projects, action.project, action.name)
      if (!result.ok) return { refusal: result.refusal }
      projects = result.projects
      changed({ projects: true })
      return {}
    }
    case 'deleteProject': {
      const result = deleteProject(projects, action.project)
      if (!result.ok) return { refusal: result.refusal }
      for (const lw of layout.windows)
        for (const tab of lw.tabs) if (tab.project === action.project) closeTab(tab.id)
      projects = result.projects
      const first = projects.projects[0]?.id ?? projects.current
      layout = {
        windows: layout.windows.map((lw) =>
          lw.shown === action.project ? { ...lw, shown: first } : lw,
        ),
      }
      changed({ projects: true })
      return {}
    }
    case 'openSession': {
      const before = new Set(layout.windows.flatMap((lw) => lw.tabs.map((tab) => tab.id)))
      const opened = openSession(layout, projects, windowId, action.session, newId)
      layout = opened.layout
      projects = opened.projects
      if (!before.has(opened.tab)) await startPane(opened.tab, resumeSpec(action.session))
      if (opened.window !== windowId) windows.get(opened.window)?.focus()
      notifySeen()
      changed({ projects: true })
      return {}
    }
    case 'openBeside': {
      const existing = paneOfSession(action.session)
      const outcome = openBeside(layout, projects, windowId, action.session)
      if (outcome.kind === 'refused') return { refusal: outcome.refusal }
      if (outcome.kind === 'open')
        return runAction(contents, { type: 'openSession', session: action.session })
      if (outcome.kind === 'noop') return {}
      layout = outcome.layout
      projects = outcome.projects
      const target = shownTab(layout.windows.find((x) => x.id === windowId) as LayoutWindow)
      if (target) {
        if (existing) {
          const from = existing.tabId
          tabPanes.delete(from)
          tabLabels.delete(from)
          existing.tabId = target
          tabPanes.set(target, [...(tabPanes.get(target) ?? []), existing.id])
        } else await startPane(target, resumeSpec(action.session))
      }
      changed({ projects: true })
      // The session's pane, which takes the focus.
      return { value: target ? ([...(tabPanes.get(target) ?? [])].pop() ?? null) : null }
    }
    case 'stopSession': {
      const pane = paneOfSession(action.session)
      if (!pane) return {}
      if ((tabPanes.get(pane.tabId) ?? []).length <= 1) closeTab(pane.tabId)
      else pane.terminal.hangUp()
      return {}
    }
    case 'setGroup': {
      const project = projectOf(projects, action.session)
      if (!project) return {}
      projects = setGroup(projects, project.id, action.session, action.group)
      changed({ projects: true })
      return {}
    }
    case 'newGroup': {
      const project = projectOf(projects, action.session)
      if (!project) return {}
      const result = newGroup(projects, project.id, action.session, action.name)
      if (!result.ok) return { refusal: result.refusal }
      projects = result.projects
      changed({ projects: true })
      return {}
    }
    case 'removeMember': {
      const pane = paneOfSession(action.session)
      if (pane) await runAction(contents, { type: 'stopSession', session: action.session })
      projects = removeMember(projects, action.session)
      changed({ projects: true })
      return {}
    }
    case 'renameSession':
      await sessions.updateState((state) => setAppName(state, action.session, action.name))
      return {}
    case 'renameTab': {
      const tab = tabById(action.tab)
      const title = action.title.trim()
      if (!tab || !title) return {}
      tabLabels.set(action.tab, { title, tooltip: tabView(tab).tooltip })
      changed()
      return {}
    }
    case 'selectTab': {
      const tab = w.tabs.find((x) => x.id === action.tab)
      if (tab) putWindow({ ...w, selected: { ...w.selected, [tab.project]: tab.id } })
      notifySeen()
      changed()
      return {}
    }
    case 'closeTab': {
      const tab = tabById(action.tab)
      if (
        !action.force &&
        tab?.kind === 'file' &&
        !tab.preview &&
        isDirty(tab.path) &&
        editorTabsOf(tab.path) <= 1
      ) {
        return { unsaved: [basename(tab.path)], value: tab.path }
      }
      closeTab(action.tab)
      return {}
    }
    case 'openFile': {
      const expanded = expandInput(action.input, homedir())
      if ('refusal' in expanded) return { refusal: expanded.refusal }
      const typed = await checkTyped(expanded.path)
      if (typed) return { refusal: typed }
      const refusal = await openFileTab(windowId, expanded.path)
      return refusal ? { refusal } : {}
    }
    case 'openFilePath': {
      const refusal = await openFileTab(windowId, action.path)
      return refusal ? { refusal } : {}
    }
    case 'pickFile': {
      const members = projects.projects.find((p) => p.id === w.shown)?.members ?? []
      const folders = new Set(members.map((id) => sessionInfo(id)?.cwd ?? null))
      const only = folders.size === 1 ? [...folders][0] : null
      const chosen = await dialog.showOpenDialog({
        title: t('files.chooseFile'),
        properties: ['openFile'],
        ...(only && statSafeDir(only) ? { defaultPath: only } : {}),
      })
      return { value: chosen.canceled ? null : (chosen.filePaths[0] ?? null) }
    }
    case 'fileState': {
      const state = bufferState(action.path)
      return state ? { file: state } : {}
    }
    case 'fileEdit':
      applyEdit(action.path, action.base, action.changes, action.tab)
      return {}
    case 'saveFile': {
      const refusal = await saveBuffer(action.path)
      return refusal ? { refusal } : {}
    }
    case 'reloadFile':
      await reloadBuffer(action.path)
      return {}
    case 'keepMine':
      keepMine(action.path)
      return {}
    case 'saveFiles': {
      for (const path of action.paths) {
        const refusal = await saveBuffer(path)
        if (refusal) return { refusal, value: path }
      }
      return {}
    }
    case 'discardFiles':
      for (const path of action.paths) await reloadBuffer(path)
      return {}
    case 'closeWindowNow':
      unsavedAnswered.add(windowId)
      windows.get(windowId)?.close()
      return {}
    case 'openFilesIn':
      await openFilesIn(action.window, action.paths)
      return {}
    case 'togglePreview':
      togglePreview(windowId, action.tab)
      return {}
    case 'openExternal':
      if (/^https?:\/\//.test(action.url)) await shell.openExternal(action.url)
      return {}
    case 'closeAllTabs':
      for (const tab of w.tabs) closeTab(tab.id)
      return {}
    case 'stepTab':
    case 'nthTab': {
      const id = action.type === 'stepTab' ? stepTab(w, action.direction) : nthTab(w, action.n)
      if (id) return runAction(contents, { type: 'selectTab', tab: id })
      return {}
    }
    case 'newWindow': {
      const project = newWindowProject(layout, projects)
      if (project === null) return { value: 'needsProject' }
      openWindowOn(project)
      return {}
    }
    case 'newWindowWithProject': {
      const result = createProject(projects, action.name, newId())
      if (!result.ok) return { refusal: result.refusal }
      projects = { ...result.projects, current: projects.current }
      const created = result.projects.current
      changed({ projects: true })
      openWindowOn(created)
      return {}
    }
    case 'setSidebarWidth':
      if (action.width >= 150) {
        await sessions.updateState((state) =>
          withSetting(state, 'sidebar_width', Math.round(action.width)),
        )
        settings = { ...settings, sidebar_width: Math.round(action.width) }
      }
      return {}
    case 'startNew': {
      if (!statSafeDir(action.folder)) return { refusal: 'newSession.folderGone' }
      const name = action.name.trim()
      const id = action.agent === 'claude' ? randomUUID() : null
      const tab = addTransientTab(
        windowId,
        name || basename(action.folder),
        t('tab.tooltipNew', { agent: agentName(action.agent), cwd: action.folder }),
      )
      await rememberFolder(action.folder)
      // With the switch on, the id joins the list at once, before Claude has created the session.
      if (action.remoteControl && id) {
        await sessions.updateState((state) => setRemoteControl(state, id, true))
        remoteIds.add(id)
      }
      const start: Start = {
        kind: 'new',
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(action.model ? { model: action.model } : {}),
        ...(action.mode ? { mode: action.mode } : {}),
        ...(action.addDir && action.agent === 'claude' ? { addDir: action.addDir } : {}),
      }
      await startPane(tab, {
        agent: action.agent,
        start,
        cwd: action.folder,
        sessionId: null,
        pending: newSessionPending(windowId, action.folder, id),
        ...(action.remoteControl && id ? { remote: remoteName(name, action.folder, id) } : {}),
      })
      changed()
      return {}
    }
    case 'newChat': {
      const win = windows.get(windowId)
      if (!win) return {}
      const folder = await chooseChatFolder(win)
      if (folder === null) return {}
      const chat = startChat(action.agent, action.key, { folder })
      if (chat) openChatTab(win, chat)
      return {}
    }
    case 'continueInChat': {
      const win = windows.get(windowId)
      const info = sessionInfo(action.session)
      if (!win || !info) return {}
      const chat = startChat(info.agent, action.key, {
        folder: info.cwd ?? homedir(),
        resume: { id: info.id, name: info.name },
      })
      if (chat) openChatTab(win, chat)
      return {}
    }
    case 'openInGhostty': {
      const info = sessionInfo(action.session)
      if (info) openInGhostty(info.agent, info.id, info.cwd)
      return {}
    }
    case 'openMcpServers': {
      const win = windows.get(windowId)
      if (win) openMcpServers(win)
      return {}
    }
    case 'setRemoteControl': {
      await sessions.updateState((state) => setRemoteControl(state, action.session, action.on))
      if (action.on) remoteIds.add(action.session)
      else remoteIds.delete(action.session)
      const pane = paneOfSession(action.session)
      changed()
      // Nothing is typed: a running session connects at its next start, or when the user types /rc.
      return action.on && pane?.terminal.running && !pane.remote ? { value: 'toast' } : {}
    }
    case 'continueLast': {
      const folder = await pickFolder()
      if (!folder) return {}
      await rememberFolder(folder)
      const tab = addTransientTab(
        windowId,
        basename(folder),
        t('tab.tooltipContinue', { agent: agentName(action.agent), cwd: folder }),
      )
      await startPane(tab, {
        agent: action.agent,
        start: { kind: 'continue' },
        cwd: folder,
        sessionId: null,
        pending: newSessionPending(windowId, folder, null),
      })
      changed()
      return {}
    }
    case 'forkSession': {
      const info = sessionInfo(action.session)
      if (info?.agent !== 'claude') return {}
      const id = randomUUID()
      const tab = addTransientTab(
        windowId,
        t('tab.fork', { name: info.name }),
        t('tab.tooltipSession', { folder: basename(info.cwd ?? info.folder), id: action.session }),
      )
      await startPane(tab, {
        agent: 'claude',
        start: { kind: 'fork', source: action.session, id },
        cwd: info.cwd,
        sessionId: null,
        pending: newSessionPending(windowId, info.cwd ?? '', id),
      })
      changed()
      return {}
    }
    case 'pickFolder':
      return { value: await pickFolder() }
    case 'dismissNotice':
      dismissNotice(action.index)
      push()
      return {}
    case 'confirmClose':
      if (quitAnswer) {
        quitAnswer(true)
        return {}
      }
      await finishClose(windowId)
      return {}
    case 'cancelClose':
      quitAnswer?.(false)
      return {}
    case 'copyText':
      clipboard.writeText(action.text)
      return {}
    case 'splitPane': {
      const ids = tabPanes.get(action.tab) ?? []
      const tab = tabById(action.tab)
      if (!tab || tab.kind === 'file' || ids.length === 0) return {}
      if (ids.length >= 2) return { refusal: 'layout.twoPanesMax' }
      setOrientation(action.tab, action.orientation)
      // Menkar types nothing into a shell pane.
      await startPane(action.tab, {
        agent: 'shell',
        cwd: panes.get(ids[0] ?? '')?.cwd ?? null,
        sessionId: null,
      })
      changed()
      return { value: [...(tabPanes.get(action.tab) ?? [])].pop() ?? null }
    }
    case 'closePane': {
      const pane = panes.get(action.pane)
      if (!pane) return {}
      if ((tabPanes.get(pane.tabId) ?? []).length <= 1) closeTab(pane.tabId)
      else pane.terminal.hangUp()
      return {}
    }
    case 'refreshSessions':
      await sessions.refresh()
      return {}
    case 'sessionDetails': {
      const info = sessionInfo(action.session)
      if (!info) return {}
      const [read, tokens] = await Promise.all([
        readFile(info.file, 'utf8'),
        sessionTokens(info.id),
      ])
      return {
        details: details(read, info.agent),
        ...(tokens
          ? { tokens: { input: tokens.input, output: tokens.output, cacheRead: tokens.cacheRead } }
          : {}),
      }
    }
    case 'exportSession': {
      const info = sessionInfo(action.session)
      if (!info) return {}
      const target = await dialog.showSaveDialog({
        title: t('export.title'),
        defaultPath: safeFileName(info.name),
      })
      if (target.canceled || !target.filePath) return {}
      try {
        await writeFile(
          target.filePath,
          exportMarkdown(info.name, info.id, await readFile(info.file, 'utf8'), info.agent),
          'utf8',
        )
      } catch (error) {
        log.error('a session could not be exported', { path: target.filePath, error })
        return { refusal: 'export.failed' }
      }
      return {}
    }
    case 'revealTranscript': {
      const info = sessionInfo(action.session)
      if (info) shell.showItemInFolder(info.file)
      return {}
    }
    case 'trashSession':
    case 'deleteSession': {
      // The only writes under ~/.claude, each started and confirmed by the user: the .jsonl alone;
      // its sibling directory (subagents/, tool-results/) stays.
      const info = sessionInfo(action.session)
      if (!info) return { refusal: 'sessions.gone' }
      try {
        if (action.type === 'trashSession') await shell.trashItem(info.file)
        else await unlink(info.file)
      } catch (error) {
        log.error('a transcript could not be removed', {
          path: info.file,
          action: action.type,
          error,
        })
        return {
          refusal:
            action.type === 'trashSession' ? 'sessions.trashFailed' : 'sessions.deleteFailed',
        }
      }
      const pane = paneOfSession(action.session)
      if (pane) await runAction(contents, { type: 'stopSession', session: action.session })
      await sessions.refresh()
      return {}
    }
    case 'replaySession': {
      const info = sessionInfo(action.session)
      if (!info) return {}
      openReplay(windowId, info.name, await readFile(info.file, 'utf8'), info.agent)
      return {}
    }
    case 'openSessionFile': {
      const claudeDir = dirname(agentPaths().claudeProjects)
      const chosen = await dialog.showOpenDialog({
        title: t('replay.chooserTitle'),
        ...(statSafeDir(claudeDir) ? { defaultPath: claudeDir } : {}),
        properties: ['openFile'],
        filters: [{ name: 'JSONL', extensions: ['jsonl'] }],
      })
      const path = chosen.filePaths[0]
      if (chosen.canceled || !path) return {}
      let text: string
      try {
        text = await readFile(path, 'utf8')
      } catch (error) {
        // Gone, or unreadable, between the chooser and the read.
        log.warn('a chosen transcript could not be read', { path, error })
        return { refusal: 'replay.unreadable' }
      }
      const title = applyNameLines(emptyNames(), text.endsWith('\n') ? text : `${text}\n`)
      openReplay(
        windowId,
        title.customTitle ?? title.aiTitle ?? basename(path, '.jsonl'),
        text,
        agentOfFile(text, path),
      )
      return {}
    }
    case 'checkFolder':
      return { value: statSafeDir(action.folder) ? action.folder : null }
    case 'pickSession': {
      const before = paneOfSession(action.session)
      const fromTab = before?.tabId
      const moved = moveSessionHere(layout, projects, windowId, action.session, newId)
      if (!moved.ok) return { refusal: moved.refusal }
      layout = moved.layout
      projects = moved.projects
      // A pane taken alone out of a two-pane tab now lives in a new tab of this window.
      if (before && fromTab) {
        const target = layout.windows
          .flatMap((lw) => lw.tabs)
          .find(
            (tab) =>
              tab.kind === 'session' && tab.panes.includes(action.session) && tab.id !== fromTab,
          )
        if (target) {
          tabPanes.set(
            fromTab,
            (tabPanes.get(fromTab) ?? []).filter((id) => id !== before.id),
          )
          before.tabId = target.id
          tabPanes.set(target.id, [before.id])
        }
      }
      changed({ projects: true })
      return {}
    }
    case 'listTabs':
      return { tabs: listTabs() }
    case 'revealTab': {
      const tw = windowOfTab(action.tab)
      const tab = tabById(action.tab)
      if (!tw || !tab) return {}
      putWindow({ ...tw, shown: tab.project, selected: { ...tw.selected, [tab.project]: tab.id } })
      windows.get(tw.id)?.focus()
      notifySeen()
      changed()
      return {}
    }
    case 'toggleMaximize': {
      const win = windows.get(windowId)
      // The system may toggle on its own for a double click on the header; a second toggle right
      // after would undo it.
      if (!win || now() - (lastMaximizeChange.get(windowId) ?? 0) < MAXIMIZE_SETTLE_MS) return {}
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
      return {}
    }
    case 'titleBar':
      windows.get(windowId)?.setTitleBarOverlay({
        color: action.color,
        symbolColor: action.symbolColor,
        height: action.height,
      })
      return {}
    case 'openPreferences':
    case 'openUsage':
    case 'openAbout': {
      const parent = windows.get(windowId)
      if (!parent) return {}
      if (action.type === 'openPreferences') openPreferences(parent)
      else if (action.type === 'openUsage') openUsage(parent)
      else openAbout(parent)
      return {}
    }
    case 'swapOrientation': {
      const tab = tabById(action.tab)
      if (!tab || (tabPanes.get(action.tab) ?? []).length < 2) return {}
      setOrientation(
        action.tab,
        tabView(tab).orientation === 'horizontal' ? 'vertical' : 'horizontal',
      )
      changed()
      return {}
    }
  }
}

function listTabs(): TabEntry[] {
  const ordered = [...layout.windows].sort((a, b) => rank(a.id) - rank(b.id))
  return ordered.flatMap((w) => {
    const projectOrder: string[] = []
    for (const tab of w.tabs)
      if (!projectOrder.includes(tab.project)) projectOrder.push(tab.project)
    return projectOrder.flatMap((projectId) =>
      w.tabs
        .filter((tab) => tab.project === projectId)
        .map((tab) => {
          const view = tabView(tab)
          return {
            window: w.id,
            tab: tab.id,
            projectName: projects.projects.find((p) => p.id === projectId)?.name ?? '',
            title: view.title,
            kind: tab.kind,
            agent:
              view.panes.find((p) => p.agent !== 'shell')?.agent ?? view.panes[0]?.agent ?? null,
            panes: view.panes.map((p) => p.id),
          }
        }),
    )
  })
}

function rank(windowId: string): number {
  const i = focusOrder.indexOf(windowId)
  return i < 0 ? focusOrder.length : i
}

// The first non-empty line decides: a top-level `type` is Claude's, a `role` Cursor's; otherwise
// a path under .cursor is Cursor's.
function agentOfFile(text: string, path: string): 'claude' | 'cursor' {
  const first = text.split('\n').find((line) => line.trim())
  try {
    const value: unknown = first ? JSON.parse(first) : null
    if (typeof value === 'object' && value !== null) {
      if ('type' in value) return 'claude'
      if ('role' in value) return 'cursor'
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }
  return path.includes('.cursor') ? 'cursor' : 'claude'
}

// A replay tab: the transcript read once, whole, as turns; never saved, never reopened.
function openReplay(
  windowId: string,
  name: string,
  text: string,
  agent: 'claude' | 'cursor',
): void {
  const tab = addTransientTab(windowId, t('replay.title', { name }), name)
  tabReplays.set(tab, replayTurns(text, agent))
  changed()
}

function setOrientation(tabId: string, orientation: 'horizontal' | 'vertical'): void {
  const tab = tabById(tabId)
  if (tab?.kind === 'session')
    replaceTab(tabId, (t) => (t.kind === 'session' ? { ...t, orientation } : t))
  else tabOrientation.set(tabId, orientation)
}
