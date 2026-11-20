import { randomUUID } from 'node:crypto'
import { statSync } from 'node:fs'
import { stat, unlink, writeFile } from 'node:fs/promises'
import { homedir, hostname } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, clipboard, dialog, shell, type WebContents } from 'electron'
import { descriptorOf, paneAgentLabel } from '../core/agents/descriptors'
import { AGENT_IDS, type AgentId, DEFAULT_AGENT } from '../core/agents/ids'
import { isDefault, kitOf } from '../core/agents/registry'
import type { FollowKind } from '../core/agents/types'
import { backgroundToastShown, markBackgroundToast } from '../core/background-toast'
import { now } from '../core/clock'
import { commandLine, mcpConfig, type Start } from '../core/command'
import { PANE_ENV, type PaneStartSource } from '../core/context/statusline'
import type { Reading } from '../core/context/types'
import { type Route, route, WakeBatcher, type WakeEntry, wakesParent } from '../core/control/events'
import {
  type ControlAnswer,
  type ControlRequest,
  controlPaths,
  type Snapshot,
  sessionsAnswer,
  writeTextAtomic,
} from '../core/control/files'
import { lastReplyAnswer, sessionOfProject } from '../core/control/lastreply'
import { readModel } from '../core/control/model'
import { promptText, readPromptFile, savePrompt } from '../core/control/prompt'
import { trashCheck } from '../core/control/trash'
import { type DrawerPane, DrawerRegistry, drawerFolder } from '../core/drawers'
import { askName } from '../core/files/ask'
import { checkFile, checkTyped, expandInput } from '../core/files/check'
import { terminalOpensIn, terminalPathExists } from '../core/files/exists'
import { flavorFacts, paneFlavorEnv, refusalFor } from '../core/flavor'
import { type Key, t, translate } from '../core/i18n'
import { linkTarget } from '../core/links'
import { log } from '../core/log'
import { followModel, modelOf, setModel } from '../core/models'
import { followMuted, mutedList, setMuted } from '../core/mute'
import { adopt } from '../core/orchestration/adopt'
import { askTool, inboxTool, type WakeOutcome } from '../core/orchestration/ask'
import { postCounts } from '../core/orchestration/counts'
import {
  isAbsoluteFolder,
  membersFolders,
  missingFolders,
  type ProjectFolder,
  presentFolders,
  startFolder,
} from '../core/orchestration/folders'
import { mayStart } from '../core/orchestration/mayStart'
import {
  openPermissionTopic,
  PERMISSION_ANSWERED,
  type PermissionSubject,
  PermissionTopics,
  permissionTopic,
} from '../core/orchestration/permission'
import { readOnly } from '../core/orchestration/readonly'
import { placeStarted, readPlacement } from '../core/orchestration/started'
import {
  assignTask,
  closedOn,
  currentTask,
  doneToday,
  followTasks,
  onStarredTask,
  openTasks,
  parkingTask,
  setTaskStar,
  starredTasks,
  type Task,
  type TaskTool,
  tasksOf,
  taskTool,
  untakenRefusal,
} from '../core/orchestration/tasks'
import {
  addTopic,
  closedTopicsToday,
  closeTopic,
  markSeen,
  shownTopics,
  type Topic,
  type Topics,
  type TopicTool,
  topicNotice,
  topicsOf,
  topicTool,
  updateTopic,
} from '../core/orchestration/topics'
import {
  backgroundable,
  capRefusal,
  capTool,
  hideOnClose,
  isWorker,
  mayPark,
  startName,
  startsWorker,
  workerTeam,
} from '../core/orchestration/workers'
import { agentPaths } from '../core/paths'
import {
  awayTool,
  backTool,
  HERE,
  noticed,
  notYet,
  type Presence,
  type PresenceView,
  postRecipients,
  presenceAsked,
  presencePost,
  presenceView,
  quietDue,
  quieted,
  topicNoticeNow,
} from '../core/presence'
import { earlierIds, forgetSession, keptEarlier, releaseEarlier } from '../core/projects/earlier'
import {
  bringProject,
  closeTab as closeLayoutTab,
  holder,
  insertTabAfter,
  type Layout,
  type LayoutWindow,
  moveSessionHere,
  moveTab,
  newWindowProject,
  nthTab,
  openBeside,
  openSession,
  ordinaryUnless,
  pin,
  removeWindow,
  reopen,
  select,
  setMaximized,
  shownTab,
  stepTab,
  switchProject,
  type Tab,
  toBackground,
  toSaved,
} from '../core/projects/layout'
import {
  addMember,
  createProject,
  deleteProject,
  hideMember,
  joinTarget,
  moveMember,
  newGroup,
  type Project,
  type Projects,
  projectOf,
  removeMember,
  renameProject,
  setCollapsed,
  setCurrent,
  setFilesCollapsed,
  setFilesFolder,
  setGroup,
  showMember,
} from '../core/projects/model'
import {
  addFolder,
  orchestrationInfo,
  removeFolder,
  sessionMarks,
  setBoard,
  setConsultantsCollapsed,
  setDoneTodayOpen,
  setMode,
  setOrchestrator,
  setOrchestratorCollapsed,
  setOthersCollapsed,
  setParked,
  setRole,
  setSkills,
  setTopicsCollapsed,
  setWithYou,
  setWorkersCap,
  tabGroupColor,
} from '../core/projects/orchestration'
import { clearParent, keptParents, setParent } from '../core/projects/parents'
import {
  followNewId,
  followNewIdInLayout,
  followResume,
  takeOverName,
} from '../core/projects/rekey'
import { saveProjects } from '../core/projects/store'
import { activeProjects, touched } from '../core/projects/switching'
import {
  followRemoteControl,
  remoteControlList,
  remoteName,
  setRemoteControl,
} from '../core/remote'
import type { SessionInfo } from '../core/sessions/info'
import { findOnPath } from '../core/sessions/installed'
import { lookUp, type Pending } from '../core/sessions/join'
import { startingSessions } from '../core/sessions/starting'
import { safeFileName } from '../core/sessions/transcript'
import { type Settings, settingsOf, withSetting } from '../core/settings'
import { restoreOf, sessionAgents, setAppName, withSessionAgent } from '../core/state'
import { teamInput } from '../core/team/input'
import { type FoundSkill, listSkills } from '../core/team/skills'
import type { RoleSkills } from '../shared/ipc'
import type {
  Action,
  ActionResult,
  DoneView,
  PaneAgent,
  TabEntry,
  TabView,
  TasksView,
  TaskView,
  TopicView,
  WindowState,
} from '../shared/workspace'
import { recordPresence, recordPromptedStart } from './activity'
import { mainKitOf } from './agents/registry'
import {
  agentStates,
  notifyTopic,
  onShownChange,
  paneShown,
  refreshAgentStates,
  syncTopicNotices,
} from './agentstate'
import { closeChat, ghosttyInstalled, openInGhostty, startChat } from './chat'
import { contextReading, trackContext, turnEndedContext } from './context'
import {
  type ControlHandlers,
  mcpServerScript,
  publishSnapshot,
  setSnapshotSource,
  skillsPluginDir,
} from './control'
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
import { Inboxes, type OrchestratorPane } from './inbox'
import { notifySeen, type PaneHandle, registerAgentPane } from './panes'
import {
  bringIn,
  chooseIncoming,
  dragProjectFile,
  ensureFolder,
  ensurePrivateFolder,
  filesOf,
  incomingFolder,
  newestIncoming,
  openFolder,
  openProjectFolder,
  openWithSystem,
  projectFilePath,
  renameFolder,
  startProjectFiles,
  syncShown,
  trashNamed,
  trashProjectFile,
  undoBring,
} from './project-files'
import { currentNotices, currentProjects, dismissNotice, setProjects } from './projects'
import { noteStarted, sessions, shownSessions, startedIds } from './sessions'
import { firstScanDone, startPhase, startShown } from './startup'
import { currentTasks, setTasks } from './tasks'
import {
  forgetTeam,
  setTeamSource,
  startTeam,
  teamChanged,
  teamFoundChanged,
  teamPaneChanged,
  teamStartRecord,
  teamTurnEnded,
} from './team'
import { appMessage, Terminal } from './terminal'
import { currentTopics, setTopics, topicsNow } from './topics'
import { sessionTokens } from './usage'
import { openSettings, openUsage } from './windows'
import { uiZoom } from './zoom'

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
  readonly startedAt: number
  // Started with `--remote-control`: kept until the pane goes.
  readonly remote: boolean
}

// The sessions in state.json's `remote_control`, kept current from the sessions service.
let remoteIds = new Set<string>()
// The sessions in state.json's `muted`, kept the same way.
let mutedIds = new Set<string>()
// state.json's `session_agents`, kept the same way.
let savedAgents: Readonly<Record<string, string>> = {}

// The orientation of a tab that is not a session tab in the layout (a transient tab split).
const tabOrientation = new Map<string, 'horizontal' | 'vertical'>()

const newId = () => randomUUID().replaceAll('-', '').slice(0, 12)

// Each tab's drawer shell (decision 1.29): kept apart from `panes`, so it is never in the layout,
// in Usage or in agent state. Its id travels on the pty channels as a pane's does.
const drawers = new DrawerRegistry<Terminal>(newId)
const drawerShown = new Set<string>()
const drawerLabels = new Map<string, string>()

let projects: Projects
let layout: Layout = { windows: [] }
let sessionList: readonly SessionInfo[] = []
let settings: Settings
const panes = new Map<string, Pane>()
const tabPanes = new Map<string, string[]>()
const tabLabels = new Map<string, { title: string; tooltip: string }>()
// Chat tabs (plan 14): tab id → chat id.
const tabChats = new Map<string, string>()
const lastDirty = new Map<string, boolean>()
const windows = new Map<string, BrowserWindow>()
const allowedToClose = new Set<string>()
// Windows, the most recently focused first.
let focusOrder: string[] = []
let installedAgents: AgentId[] = []
let closingLast = false
let saveTimer: ReturnType<typeof setTimeout> | undefined
let joinTimer: ReturnType<typeof setInterval> | undefined

// ---------------------------------------------------------------- lookups

const sessionInfo = (id: string) => sessionList.find((s) => s.id === id)
// The name a session another one started has until its transcript gives Claude's.
const startedNames = new Map<string, string>()
const sessionName = (id: string) => sessionInfo(id)?.name ?? startedNames.get(id) ?? id.slice(0, 8)
// A name of its own: Claude's custom title, or the one Menkar started it with; not a derived title.
const ownName = (id: string): string | undefined => {
  const info = sessionInfo(id)
  return info?.claudeNamed ? info.name : startedNames.get(id)
}
const agentName = (agent: PaneAgent) => translate(paneAgentLabel(agent))
// The pane's agent; null for a shell.
const agentOf = (pane: Pane | undefined): AgentId | null =>
  !pane || pane.agent === 'shell' ? null : pane.agent
// Whether Menkar can wake the session the pane runs.
const wakeable = (pane: Pane | undefined): boolean => {
  const agent = agentOf(pane)
  return agent !== null && mainKitOf(agent).waker !== null
}

// Its tab is its window's selected tab and that window is focused: the human is looking at it.
function paneSeen(pane: Pane): boolean {
  const w = windowOfTab(pane.tabId)
  const window = w ? windows.get(w.id) : undefined
  return (
    !!w && shownTab(w) === pane.tabId && !!window && !window.isDestroyed() && window.isFocused()
  )
}

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

// The projects most recently shown or come back to, first: the project switcher's order.
let recentProjects: string[] = []

function putWindow(w: LayoutWindow): void {
  const before = layout.windows.find((x) => x.id === w.id)
  if (before?.shown !== w.shown) recentProjects = touched(recentProjects, w.shown)
  layout = { windows: layout.windows.map((x) => (x.id === w.id ? w : x)) }
}

function replaceTab(tabId: string, change: (tab: Tab) => Tab): void {
  const w = windowOfTab(tabId)
  if (w) putWindow({ ...w, tabs: w.tabs.map((tab) => (tab.id === tabId ? change(tab) : tab)) })
}

// The one way main selects a tab: a worker's background tab becomes its project's peek.
function selectTabIn(windowId: string, tabId: string): void {
  const w = select(layout, windowId, tabId).windows.find((x) => x.id === windowId)
  if (w) putWindow(w)
}

// Whether a session's tab leaves the strip instead of ending when closed (decision 1.176).
function mayHide(sessionId: string): boolean {
  const project = projectOf(projects, sessionId)
  return (
    project !== undefined &&
    backgroundable(workerTeam(project), orchestrationInfo(project).withYou, sessionId)
  )
}

// A tab may stay in the background or the peek only while it holds one pane, a split shell
// included, of a session that may still be hidden.
const staysPlaced = (tab: Tab & { kind: 'session' }): boolean =>
  (tabPanes.get(tab.id) ?? tab.panes).length === 1 && tab.panes.every(mayHide)

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
      ? [
          {
            id: pane.id,
            agent: pane.agent,
            sessionId: pane.sessionId,
            remote: pane.remote,
            cwd: pane.cwd,
          },
        ]
      : []
  })
  const label = tabLabels.get(tab.id)
  let title = label?.title ?? ''
  let tooltip = label?.tooltip ?? ''
  let groupColor: string | null = null
  if (tab.kind === 'file') {
    // A rename lasts while the tab does; it is not saved.
    const name = label?.title ?? basename(tab.path)
    title = tab.preview ? t('files.previewTitle', { name }) : name
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
    groupColor = tabGroupColor(
      projects.projects.find((p) => p.id === tab.project),
      tab.panes,
    )
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
    ...(tab.kind === 'file'
      ? {
          file: {
            path: tab.path,
            preview: tab.preview,
            unsaved: !tab.preview && isDirty(tab.path),
          },
        }
      : {}),
    ...(tabChats.has(tab.id) ? { chat: tabChats.get(tab.id) ?? '' } : {}),
    ...(tab.kind === 'session' && tab.place !== undefined ? { place: tab.place } : {}),
    ...drawerView(tab.id),
  }
}

function drawerView(tabId: string): { drawer?: NonNullable<TabView['drawer']> } {
  const id = drawers.ofTab(tabId)
  if (id === undefined) return {}
  return { drawer: { id, shown: drawerShown.has(tabId), label: drawerLabels.get(id) ?? '' } }
}

// A tab's panes as the drawer's folder rule reads them.
function drawerPanes(tabId: string): DrawerPane[] {
  return (tabPanes.get(tabId) ?? []).flatMap((id) => {
    const pane = panes.get(id)
    return pane ? [{ id, agent: pane.agent !== 'shell', cwd: pane.cwd }] : []
  })
}

// The tab a pane is in.
function tabOfPane(paneId: string): string | undefined {
  for (const [tabId, ids] of tabPanes) if (ids.includes(paneId)) return tabId
  return undefined
}

// The names a new session of the project may not take: its sessions with a tab, and the new
// sessions still starting in one.
function takenNames(projectId: string): Set<string> {
  const starting = layout.windows.flatMap((w) =>
    w.tabs.flatMap((t) =>
      t.kind === 'transient' && t.project === projectId ? [tabLabels.get(t.id)?.title ?? ''] : [],
    ),
  )
  return new Set([...namesWithTab(projectId), ...starting])
}

function openDrawer(tabId: string, focused: string | null, chosen?: string): void {
  const tab = tabById(tabId)
  const tabPaneList = drawerPanes(tabId)
  const folder =
    chosen ?? drawerFolder(tabPaneList, focused, tab?.kind === 'file' ? dirname(tab.path) : null)
  const tag = t('terminal.tag')
  let id = ''
  const opened = drawers.open(
    tabId,
    () =>
      new Terminal(
        {
          cwd: folder,
          cols: 80,
          rows: 24,
          folderGone: (cwd) => appMessage(tag, t('terminal.folderGone', { cwd })),
        },
        {
          data: (data, end) => {
            const w = windowOfTab(tabId)
            const window = w ? windows.get(w.id) : undefined
            if (id && window && !window.isDestroyed())
              window.webContents.send('pty:data', { pane: id, data, end })
          },
          exit: () => {
            const closed = drawers.exited(id)
            drawerLabels.delete(id)
            if (closed === undefined) return
            drawerShown.delete(closed)
            changed()
          },
        },
      ),
    chosen,
  )
  id = opened.id
  if (opened.fresh)
    drawerLabels.set(id, t('drawer.label', { folder: basename(folder ?? homedir()) }))
}

function closeDrawer(tabId: string): void {
  for (const id of drawers.idsOf(tabId)) drawerLabels.delete(id)
  drawerShown.delete(tabId)
  drawers.closeTab(tabId)
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
    projects: projects.projects.map((p) => ({
      id: p.id,
      name: p.name,
      members: p.members,
      hidden: p.hidden ?? [],
      groups: p.groups,
      earlier: keptEarlier(p),
      parents: keptParents(p),
      orchestration: orchestrationInfo(p),
      topicsCollapsed: p.topicsCollapsed === true,
      consultantsCollapsed: p.consultantsCollapsed === true,
      orchestratorCollapsed: p.orchestratorOpen !== true,
      othersCollapsed: p.othersCollapsed === true,
      doneTodayOpen: p.doneTodayOpen === true,
      board: { open: p.boardOpen === true, height: p.boardHeight ?? null },
    })),
    heldElsewhere,
    tabs: w.tabs.map(tabView),
    selectedTab: shownTab(w),
    sessions: shownSessions(sessionList),
    starting: startingSessions(
      [...panes.values()].flatMap((p) =>
        p.sessionId && p.agent !== 'shell'
          ? [{ sessionId: p.sessionId, agent: p.agent, cwd: p.cwd }]
          : [],
      ),
      sessionList,
      sessionName,
    ),
    running: [...panes.values()]
      .filter((p) => p.sessionId && p.terminal.running)
      .map((p) => p.sessionId as string),
    open: [...panes.values()].flatMap((p) => (p.sessionId ? [p.sessionId] : [])),
    readings: readingsOf(w.shown),
    remoteControl: [...remoteIds],
    muted: [...mutedIds],
    ghostty: ghosttyInstalled(),
    missingFolders: goneFolders,
    home: homedir(),
    notices: currentNotices(),
    agents: installedAgents,
    maximized: filled(windows.get(windowId)),
    sessionsLoading: sessionsLoading(),
    files: {
      items: filesOf(w.shown),
      collapsed: projects.projects.find((p) => p.id === w.shown)?.filesCollapsed === true,
    },
    topics: topicViews(w.shown),
    tasks: tasksView(w.shown),
    doneToday: doneTodayView(w.shown),
    guidePath: join(skillsPluginDir(), 'guide', 'orchestration-mode.md'),
    presence: presenceNow(),
  }
}

function topicViews(projectId: string): TopicView[] {
  const project = projects.projects.find((p) => p.id === projectId)
  if (!project) return []
  const starred = starredTasks(tasksOf(currentTasks(), projectId))
  return shownTopics(starred, topicsOf(currentTopics(), projectId)).flatMap((x) =>
    x.status === 'closed'
      ? []
      : [
          {
            number: x.number,
            ...permissionTopicText(x),
            from: sessionName(x.from),
            blocking: x.blocking,
            status: x.status,
            star: x.task !== undefined && starred.has(x.task),
          },
        ],
  )
}

function doneTodayView(projectId: string): DoneView[] {
  const at = now()
  // A prompt answered is no work done: its topic is kept out.
  const closed = closedTopicsToday(topicsOf(currentTopics(), projectId), at)
  const topics = closed
    .filter((x) => x.kind !== 'permission')
    .map((x) => ({
      kind: 'topic' as const,
      number: x.number,
      title: x.title,
      at: Date.parse(x.updated),
    }))
  const tasks = doneToday(tasksOf(currentTasks(), projectId), at).map((x) => ({
    kind: 'task' as const,
    number: x.number,
    title: x.title,
    at: Date.parse(x.closed ?? ''),
  }))
  return [...topics, ...tasks]
    .sort((a, b) => b.at - a.at)
    .map(({ kind, number, title }) => ({ kind, number, title }))
}

function tasksView(projectId: string): TasksView {
  const list = tasksOf(currentTasks(), projectId)
  const view = (x: Task): TaskView => ({
    number: x.number,
    title: x.title,
    assignee: x.assignee ?? null,
    assigneeName: x.assignee === undefined ? '' : sessionName(x.assignee),
    star: x.star,
    state: x.state,
    steps: x.steps,
    step: x.step,
    note: x.note,
    ...(x.waitingOn !== undefined ? { waitingOn: x.waitingOn } : {}),
    ...(x.reviewWait !== undefined ? { reviewWait: x.reviewWait } : {}),
  })
  const closed = closedOn(list, now())
  const current: Record<string, number> = {}
  for (const id of new Set(list.flatMap((x) => (x.assignee === undefined ? [] : [x.assignee])))) {
    const task = currentTask(list, id)
    if (task) current[id] = task.number
  }
  return {
    open: openTasks(list).map(view),
    closedToday: closed.today.map(view),
    closedBefore: closed.before.map(view),
    current,
  }
}

const filled = (window: BrowserWindow | undefined) =>
  window !== undefined && !window.isDestroyed() && (window.isMaximized() || window.isFullScreen())

const tracked = new Set<string>()

// Each member session of a shown project is followed for its context ring, once.
function readingsOf(projectId: string): Record<string, Reading> {
  const out: Record<string, Reading> = {}
  for (const id of projects.projects.find((p) => p.id === projectId)?.members ?? []) {
    const info = sessionInfo(id)
    if (!info) continue
    const source = kitOf(info.agent).context
    if (source !== null && !tracked.has(id)) {
      tracked.add(id)
      trackContext(id, info.file, source)
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
  void checkFolders()
  lastRunning = runningKey()
  for (const [id, window] of windows) {
    const state = stateFor(id)
    if (state && !window.isDestroyed()) window.webContents.send('window:state', state)
  }
}

// Which sessions run changes with no event of ours: the shell starts the agent (after its rc
// files, seconds for some users) and the agent exits back to it. The windows hear of it within
// the poll, not at whatever change comes next.
const RUNNING_POLL_MS = 500
let lastRunning = ''
const runningKey = () =>
  [...panes.values()]
    .filter((p) => p.terminal.running)
    .map((p) => p.id)
    .sort()
    .join(' ')
setInterval(() => {
  if (runningKey() !== lastRunning) push()
}, RUNNING_POLL_MS).unref()

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

// Each orchestration-mode project's orchestrator, where it runs now: its inbox file follows it.
function orchestratorPanes(): ReadonlyMap<string, OrchestratorPane | null> {
  const where = new Map<string, OrchestratorPane | null>()
  for (const p of projects.projects) {
    const orchestrator = workerTeam(p).orchestrator
    if (!orchestrationInfo(p).on) continue
    const pane = orchestrator ? paneOfSession(orchestrator) : undefined
    const agent = agentOf(pane)
    where.set(
      p.id,
      pane && orchestrator && agent
        ? {
            pane: pane.id,
            sessionId: orchestrator,
            transcript: sessionInfo(orchestrator)?.file ?? null,
            kit: mainKitOf(agent).inbox,
          }
        : null,
    )
  }
  return where
}

const inboxes = new Inboxes(orchestratorPanes)

function changed(options: { projects?: boolean } = {}): void {
  inboxes.sync()
  syncTopicNotices(currentTopics(), (id) => {
    const project = projects.projects.find((p) => p.id === id)
    return project !== undefined && orchestrationInfo(project).on
  })
  releaseBuffersExcept(filePaths())
  layout = ordinaryUnless(layout, staysPlaced)
  startShownTabs()
  syncShown(new Set(layout.windows.map((lw) => lw.shown)))
  push()
  publishSnapshots()
  if (options.projects) {
    teamChanged()
    clearTimeout(saveTimer)
    saveTimer = undefined
    saveProjectsNow()
    return
  }
  saveLayoutSoon()
}

function saveLayoutSoon(): void {
  saveTimer ??= setTimeout(() => {
    saveTimer = undefined
    saveProjectsNow()
  }, LAYOUT_SAVE_DELAY_MS)
}

// Full screen hides the maximize underneath it, so the flag keeps what it was before.
function recordMaximized(windowId: string): void {
  const window = windows.get(windowId)
  if (!window || window.isDestroyed() || window.isFullScreen()) return
  const maximized = window.isMaximized()
  if (layout.windows.find((w) => w.id === windowId)?.maximized === maximized) return
  layout = setMaximized(layout, windowId, maximized)
  saveLayoutSoon()
}

// A project's saved session tabs start the first time its window shows it, not at boot; once
// started they keep running when the window shows another project. A session tab with no panes
// that is not being started is such a deferred tab.
let firstScanFailed = false
const sessionsLoading = () => !sessions.scanned && !firstScanFailed

function startShownTabs(): void {
  if (sessionsLoading()) return
  for (const w of layout.windows) {
    for (const tab of w.tabs) {
      if (tab.kind !== 'session' || tab.project !== w.shown) continue
      if (tabPanes.has(tab.id) || startingTabs.has(tab.id)) continue
      holdStart(tab.id)
      void (async () => {
        try {
          for (const id of tab.panes) await startPane(tab.id, resumeSpec(id))
        } finally {
          releaseStart(tab.id)
        }
        changed()
      })()
    }
  }
}

// Once, after the first scan: a saved tab keeps only the sessions that still exist or that
// `session_agents` names, and goes when none is left. Only tabs not started yet are looked at; a
// started one is the user's.
function dropUnknownSessions(): void {
  const found = new Map(sessionList.map((s) => [s.id, s.agent]))
  const kept = (id: string) => restoreOf(found.get(id), savedAgents[id]).kind !== 'unnamed'
  layout = {
    windows: layout.windows.map((w) => ({
      ...w,
      tabs: w.tabs.flatMap((tab): Tab[] => {
        if (tab.kind !== 'session' || tabPanes.has(tab.id) || startingTabs.has(tab.id)) return [tab]
        const panesKnown = tab.panes.filter(kept)
        return panesKnown.length > 0 ? [{ ...tab, panes: panesKnown }] : []
      }),
    })),
  }
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
  // A file holding the first prompt, read by the shell.
  readonly promptFile?: string
  // A line of Menkar's above the pane's shell.
  readonly notice?: string
}

// Tabs whose panes are being started: a start awaits before the tab has its panes, and a change
// in between must not take the tab for a deferred one and start it twice.
const startingTabs = new Map<string, number>()
const holdStart = (tabId: string) => startingTabs.set(tabId, (startingTabs.get(tabId) ?? 0) + 1)
const releaseStart = (tabId: string) => {
  const left = (startingTabs.get(tabId) ?? 1) - 1
  if (left > 0) startingTabs.set(tabId, left)
  else startingTabs.delete(tabId)
}

const teamContext = () => ({ warn: settings.ring_warn, full: settings.ring_full })

// Names and the ring thresholds are in the team facts. The sessions list changes with every
// transcript write: only a change of these restarts the panes' settle, or a busy team would keep
// putting a post off.
let teamFactsKey = ''
function teamFactsMayChange(): void {
  const key = JSON.stringify([
    settings.ring_warn,
    settings.ring_full,
    sessionList.flatMap((s) => (s.claudeNamed ? [s.id, s.name] : [])),
  ])
  if (key === teamFactsKey) return
  teamFactsKey = key
  teamChanged()
}

// The team input a pane starts with, from its tab's project. A session not yet a member (the
// human's new one, a fork) gets the identity it starts with: what it will be once it joins.
function startInput(
  projectId: string | undefined,
  sessionId: string | null,
  start: Start,
  found: (skill: string) => boolean,
) {
  const p = projects.projects.find((x) => x.id === projectId)
  if (!p) return null
  const id = sessionId ?? start.id
  const member = id && p.members.includes(id) ? id : null
  const startName = start.kind === 'new' ? start.name : undefined
  return teamInput({
    project: p,
    session: member,
    ...(startName ? { startName } : {}),
    named: ownName,
    found,
    context: teamContext(),
  })
}

setTeamSource({
  input: (paneId, found) => {
    const sessionId = panes.get(paneId)?.sessionId
    const p = sessionId ? projectOf(projects, sessionId) : undefined
    if (!sessionId || !p) return null
    return teamInput({
      project: p,
      session: sessionId,
      named: ownName,
      found,
      context: teamContext(),
    })
  },
  session: (paneId) => {
    const pane = panes.get(paneId)
    return pane?.sessionId && pane.agent !== 'shell'
      ? { agent: pane.agent, sessionId: pane.sessionId }
      : null
  },
  counts: (sessionId) => {
    const project = projectOf(projects, sessionId)
    return postCounts(
      project ? orchestrationInfo(project) : undefined,
      sessionId,
      project ? topicsOf(currentTopics(), project.id) : [],
      project ? tasksOf(currentTasks(), project.id) : [],
    )
  },
})

async function startPane(tabId: string, spec: PaneSpec): Promise<void> {
  holdStart(tabId)
  try {
    await startPaneHeld(tabId, spec)
  } finally {
    releaseStart(tabId)
  }
}

async function startPaneHeld(tabId: string, spec: PaneSpec): Promise<void> {
  // Running implies shown: a hidden member started from anywhere is back in its project's list.
  if (spec.sessionId) {
    // Nor is it an earlier conversation any more: it is a row of the list again.
    const shownAgain = releaseEarlier(showMember(projects, spec.sessionId), spec.sessionId)
    if (shownAgain !== projects) {
      projects = shownAgain
      changed({ projects: true })
    }
  }
  const id = newId()
  const tag = t('terminal.tag')
  const messages: string[] = spec.notice ? [appMessage(tag, spec.notice)] : []
  let command: string | undefined
  // The tab's project files folder (decision 1.51), made first so the --settings file names one that
  // exists.
  const projectId = tabById(tabId)?.project
  const filesFolder =
    spec.agent === 'shell' || !projectId
      ? null
      : await ensureFolder(projectId).catch((error: unknown) => {
          log.warn('a project files folder could not be made', { project: projectId, error })
          return null
        })
  // Its private folder (decision 1.175), read through MENKAR_PRIVATE, never a working directory.
  const privateFolder =
    filesFolder && projectId
      ? await ensurePrivateFolder(projectId).catch((error: unknown) => {
          log.warn('a project private folder could not be made', { project: projectId, error })
          return null
        })
      : null
  // The SessionStart hook names the pane, so a clear can be followed (followClear).
  let env: Readonly<Record<string, string>> = {
    [PANE_ENV]: id,
    ...(filesFolder ? { MENKAR_FILES: filesFolder } : {}),
    ...(privateFolder ? { MENKAR_PRIVATE: privateFolder } : {}),
    ...paneFlavorEnv(),
  }
  if (spec.agent !== 'shell' && spec.start) {
    const cliName = descriptorOf(spec.agent).command
    const cli = await findOnPath(cliName)
    if (cli === null) messages.push(appMessage(tag, t('terminal.notFound', { cli: cliName })))
    else {
      const settings = await mainKitOf(spec.agent).settings?.(
        filesFolder && projectId ? { id: projectId, folder: filesFolder } : undefined,
      )
      const start = spec.start
      const teamFile = await startTeam({
        pane: id,
        agent: spec.agent,
        cli,
        cwd: spec.cwd,
        start,
        input: (found) => startInput(projectId, spec.sessionId, start, found),
      })
      const plan = kitOf(spec.agent).launch.plan(start, {
        cli,
        env,
        ...(settings ? { settings } : {}),
        ...(spec.remote ? { remoteControl: spec.remote } : {}),
        mcpConfig: mcpConfig(process.execPath, mcpServerScript()),
        pluginDir: skillsPluginDir(),
        ...(spec.promptFile ? { promptFile: spec.promptFile } : {}),
        ...(teamFile ? { teamFile } : {}),
        execPath: process.execPath,
        programs: dirname(mcpServerScript()),
        paneFiles: join(controlPaths().root, 'panes', id),
        ...(filesFolder ? { filesFolder } : {}),
      })
      for (const file of plan.files ?? [])
        await file
          .text()
          .then((text) => writeTextAtomic(dirname(file.path), basename(file.path), text))
          .catch((error: unknown) => {
            log.warn('a file the agent command names could not be written', { pane: id, error })
          })
      command = commandLine(plan)
      env = plan.env
      const promptedId = spec.sessionId ?? start.id
      if (spec.promptFile && promptedId) recordPromptedStart(promptedId, projectId)
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
      env,
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
    startedAt: now(),
    remote:
      spec.agent !== 'shell' && mainKitOf(spec.agent).remote !== null && spec.remote !== undefined,
  }
  if (spec.sessionId) noteStarted(spec.sessionId)
  if (spec.sessionId && spec.start) recordAgent(spec.sessionId, spec.agent)
  const self = pane
  if (spec.agent !== 'shell') {
    self.handle = registerAgentPane(id, spec.agent, size, {
      sessionId: () => self.sessionId,
      foreground: () => self.terminal.running,
      shellPid: () => self.terminal.pid,
      seen: () => paneSeen(self),
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
  inboxes.sync()
}

function onPaneExit(paneId: string): void {
  const pane = panes.get(paneId)
  if (!pane) return
  panes.delete(paneId)
  if (turns.get(paneId) === 'open' && pane.sessionId) turnEnd(paneId, pane.sessionId, agentOf(pane))
  turns.delete(paneId)
  permissions.exited(paneId)
  forgetTeam(paneId)
  inboxes.paneExited(paneId)
  pane.handle?.close()
  // A pane hung up to renew its session: its tab stays, already re-keyed, for the new one.
  const renewed = renewing.get(paneId)
  renewing.delete(paneId)
  if (renewed) {
    tabPanes.set(
      pane.tabId,
      (tabPanes.get(pane.tabId) ?? []).filter((id) => id !== paneId),
    )
    renewed()
    return
  }
  const pendingRenew = renewRequests.get(paneId)
  if (pendingRenew) clearTimeout(pendingRenew.timer)
  renewRequests.delete(paneId)
  const ids = (tabPanes.get(pane.tabId) ?? []).filter((id) => id !== paneId)
  if (pane.pending) void checkPending([pane])
  if (ids.length === 0) {
    tabPanes.delete(pane.tabId)
    tabLabels.delete(pane.tabId)
    closeDrawer(pane.tabId)
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
  selectTabIn(w.id, tab.id)
  windows.get(w.id)?.focus()
  notifySeen()
  changed()
}

// The terminal's own input passes even in a read-only pane: its replies to the agent's queries
// (cursor position, colors, focus) must arrive, or a session could hang at its start. The window
// keeps the user's keys and pastes out of it.
export function paneInput(paneId: string, data: string): void {
  ;(panes.get(paneId)?.terminal ?? drawers.byId(paneId))?.write(data)
}

// A key Menkar sends on the user's behalf. Drawers are never read only.
export function paneTyped(paneId: string, data: string): void {
  const pane = panes.get(paneId)
  if (pane) {
    const project = pane.sessionId ? projectOf(projects, pane.sessionId) : undefined
    const team = project
      ? { parents: keptParents(project), orchestration: orchestrationInfo(project) }
      : undefined
    if (readOnly(pane.sessionId, team, paneShown(pane.id))) return
  }
  paneInput(paneId, data)
}

export function paneResize(paneId: string, cols: number, rows: number): void {
  const pane = panes.get(paneId)
  if (!pane) drawers.byId(paneId)?.resize(cols, rows)
  pane?.terminal.resize(cols, rows)
  pane?.handle?.resize(cols, rows)
}

export function paneBuffer(paneId: string): { buffer: string; end: number } {
  const terminal = panes.get(paneId)?.terminal ?? drawers.byId(paneId)
  return { buffer: terminal?.buffer ?? '', end: terminal?.end ?? 0 }
}

function closeTab(tabId: string): void {
  const w = windowOfTab(tabId)
  if (!w) return
  const chat = tabChats.get(tabId)
  if (chat !== undefined) {
    tabChats.delete(tabId)
    closeChat(chat)
  }
  const ids = tabPanes.get(tabId) ?? []
  tabPanes.delete(tabId)
  tabLabels.delete(tabId)
  closeDrawer(tabId)
  layout = closeLayoutTab(layout, w.id, tabId)
  for (const id of ids) {
    const pane = panes.get(id)
    if (!pane) continue
    pane.tabId = `closed-${tabId}`
    pane.terminal.hangUp()
  }
  changed()
}

// The human's close of a tab: a worker's tab goes to the background with its process running
// (decision 1.176), any other tab is closed. A second pane beside the worker is hung up, as
// closing would. The worker's name when it was sent to the background.
function closeOrHide(tabId: string): string | null {
  const tab = tabById(tabId)
  const w = windowOfTab(tabId)
  if (tab?.kind === 'session' && tab.place === 'background') return null
  const kept = tab?.kind === 'session' && !tabChats.has(tabId) ? tab.panes.find(mayHide) : undefined
  if (!w || kept === undefined) {
    closeTab(tabId)
    return null
  }
  const ids = tabPanes.get(tabId)
  if (ids) {
    for (const id of ids) {
      const pane = panes.get(id)
      if (!pane || pane.sessionId === kept) continue
      pane.tabId = `closed-${tabId}`
      pane.terminal.hangUp()
    }
    tabPanes.set(
      tabId,
      ids.filter((id) => panes.get(id)?.sessionId === kept),
    )
  }
  replaceTab(tabId, (t) => (t.kind === 'session' ? { ...t, panes: [kept] } : t))
  layout = toBackground(layout, w.id, tabId)
  changed()
  return sessionName(kept)
}

// What a close sent to the background, and whether it is the first time ever, for the toast.
async function backgroundedResult(names: readonly string[]): Promise<ActionResult> {
  if (names.length === 0) return {}
  let first = false
  try {
    await sessions.updateState((state) => {
      first = !backgroundToastShown(state)
      return first ? markBackgroundToast(state) : state
    })
  } catch (error) {
    log.error('state.json could not record the background toast', { error })
  }
  return { backgrounded: { names, first } }
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
    probeBinds(pending)
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

// An agent that picks its own session id and can tell it from its process is asked at each poll
// while its pane waits: Codex has none until the first message, and binds then, before the turn
// ends.
function probeBinds(list: readonly Pane[]): void {
  for (const pane of list) {
    const agent = agentOf(pane)
    const early = agent ? mainKitOf(agent).bind : null
    if (!early || !pane.pending || pane.pending.expectedId !== null) continue
    early
      .find(pane.terminal.pid)
      .then((id) => {
        if (id && pane.pending && panes.has(pane.id) && !inSomeTab(id)) joinSession(pane, id)
      })
      .catch((error: unknown) => log.warn('a pane’s session could not be read early', { error }))
  }
}

// A session of an agent other than the default is recorded with its agent when its pane starts or
// its id binds, so a restore that finds no files for it still knows it.
function recordAgent(sessionId: string, agent: PaneAgent): void {
  if (agent === 'shell' || isDefault(agent) || savedAgents[sessionId] === agent) return
  savedAgents = { ...savedAgents, [sessionId]: agent }
  sessions
    .updateState((state) => withSessionAgent(state, sessionId, agent))
    .catch((error: unknown) => log.error('a session’s agent could not be recorded', { error }))
}

function joinSession(pane: Pane, sessionId: string): void {
  const pending = pane.pending
  if (!pending) return
  pane.pending = undefined
  projects = addMember(projects, joinTarget(projects, pending.startedIn), sessionId)
  pane.sessionId = sessionId
  noteStarted(sessionId)
  recordAgent(sessionId, pane.agent)
  teamPaneChanged(pane.id)
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
  refreshAgentStates()
}

// ---------------------------------------------------------------- a terminal link

// Ctrl+click on a terminal link (decision 1.59): a file opens as a printed path does, anything
// else through the system's handler for its scheme. The renderer's check is made again here, since
// main is what hands it on.
async function openLink(windowId: string, uri: string, system: boolean): Promise<void> {
  const target = linkTarget(uri, hostname())
  if (!target) return
  if (target.kind === 'url') {
    await shell
      .openExternal(target.url)
      .catch((error: unknown) =>
        log.warn('a terminal link could not be opened', { url: target.url, error }),
      )
    return
  }
  await openClickedPath(windowId, target.path, system)
}

// Ctrl+click on a plain path a terminal printed (decision 1.64), opened as a file: link is. It was
// on disk when the renderer asked; it is asked again, since main is what hands it on.
async function openTerminalPath(windowId: string, text: string, system: boolean): Promise<void> {
  const path = await terminalPathExists(text, homedir())
  if (path) await openClickedPath(windowId, path, system)
}

// What the editor opens goes to a file tab of the window (decision 1.192); the rest, and anything
// with Shift held, to the system's app: a folder in the file manager. A file that changed between
// the two checks, and is refused by the tab's, goes to the system's app too.
async function openClickedPath(windowId: string, path: string, system: boolean): Promise<void> {
  if ((await terminalOpensIn(path, homedir(), system)) === 'tab') {
    const refusal = await openFileTab(windowId, path)
    if (!refusal) return
  }
  const error = await shell.openPath(path)
  if (error) log.warn('a terminal path could not be opened', { path, error })
}

// A folder that is gone says so instead of the file manager showing an error of its own.
async function openExistingFolder(folder: string | null): Promise<ActionResult> {
  if (!folder || !(await isFolder(folder))) return { refusal: 'files.folderGone' }
  await openFolder(folder)
  return {}
}

async function isFolder(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

// ---------------------------------------------------------------- Menkar's MCP tools

// A renew waits for the Stop hook's record of the turn's end; ten minutes without one, the pane's
// shown state turning idle or done is taken instead.
const RENEW_FALLBACK_MS = 10 * 60 * 1000
const RENEW_CHECK_MS = 2000

interface RenewRequest {
  readonly sessionId: string
  readonly promptFile?: string
  timer: ReturnType<typeof setTimeout>
}
// By pane: a session asked to be renewed once its turn ends.
const renewRequests = new Map<string, RenewRequest>()
// By pane: hung up to renew; called when it is gone, so the new session starts in its tab. Null
// from the renew's start until its hang-up: a turn ending meanwhile is the renew's, not reported.
const renewing = new Map<string, (() => void) | null>()

// The tools' sentences go to the agent that called, in English.
const refuse = (text: string): ControlAnswer => ({ ok: false, text })
const NOT_KNOWN = "Menkar does not know this tab's session yet; try again in a moment."

const prompted = async (id: string, prompt: unknown): Promise<string | ControlAnswer | null> => {
  if (prompt === undefined || prompt === null || prompt === '') return null
  if (typeof prompt !== 'string') return refuse('The prompt must be text.')
  const checked = promptText(Buffer.from(prompt, 'utf8'))
  return 'refusal' in checked ? refuse(checked.refusal) : savePrompt(id, checked.text)
}

async function handleControl(request: ControlRequest): Promise<ControlAnswer> {
  const pane = panes.get(request.pane)
  const agent = agentOf(pane)
  const sessionId = pane?.sessionId
  const project = sessionId ? projectOf(projects, sessionId) : undefined
  if (!pane || !agent || kitOf(agent).mcp === null || !sessionId || !project)
    return refuse(NOT_KNOWN)
  switch (request.tool) {
    case 'renew':
      return requestRenew(pane, sessionId, request)
    case 'start_session':
      return startForAgent(pane, sessionId, project.id, request)
    case 'list_sessions':
      return { ok: true, text: listText(project.id) }
    case 'last_reply':
      return lastReplyFor(project.id, request.args.name)
    case 'topic_add':
    case 'topic_update':
    case 'topic_close':
    case 'topic_list':
      return topicFor(request.tool, project, sessionId, request.args)
    case 'adopt_session':
      return adoptFor(project.id, sessionId, request.args.name)
    case 'task_add':
    case 'task_steps':
    case 'task_progress':
    case 'task_review':
    case 'task_close':
    case 'task_list':
    case 'task_star':
      return taskFor(request.tool, project, sessionId, request.args)
    case 'set_workers_cap':
      return capFor(project, sessionId, request.args)
    case 'human_back':
      return backFor(project, sessionId)
    case 'human_away': {
      const result = awayTool(workerTeam(project).orchestrator, sessionId, presence)
      if (result.set) askPresence(true, sessionId)
      return { ok: result.ok, text: result.text }
    }
    case 'park_session':
      return parkFor(project, sessionId, request.args.name)
    case 'resume_session':
      return resumeFor(pane, project, sessionId, request)
    case 'ask':
      return askFor(project, sessionId, request.args.question)
    case 'inbox': {
      const info = orchestrationInfo(project)
      return inboxes.read(project.id, (inbox) =>
        inboxTool({ modeOn: info.on, isOrchestrator: info.orchestrator === sessionId, inbox }),
      )
    }
    case 'trash_files': {
      const checked = trashCheck(workerTeam(project).orchestrator, sessionId, request.args.names)
      return checked.ok ? trashNamed(project.id, checked.names) : refuse(checked.text)
    }
  }
}

// A number per question, so two of one session never share an inbox key.
let asks = 0

// Posted at once, not batched: the answer says what the post did.
function askFor(project: Project, sessionId: string, question: unknown): Promise<ControlAnswer> {
  inboxes.retract(project.id, `turn:${sessionId}`)
  const parent = keptParents(project)[sessionId]
  const orchestrator = workerTeam(project).orchestrator
  const task = currentTask(tasksOf(currentTasks(), project.id), sessionId)
  const working = task && (task.state === 'in progress' || task.state === 'waiting')
  return askTool(
    {
      question,
      asker: {
        id: sessionId,
        name: sessionName(sessionId),
        ...(working ? { task: task.number } : {}),
      },
      parent: parent
        ? {
            id: parent,
            name: sessionName(parent),
            toInbox:
              parent === orchestrator ? (key, text) => inboxes.add(project.id, key, text) : null,
          }
        : null,
    },
    {
      post: wakeSession,
      nextAsk: () => {
        asks += 1
        return asks
      },
    },
  )
}

// By pane: a worker to hang up once its turn is over, parked or put away with its closed task.
interface StopRequest {
  readonly sessionId: string
  readonly after: 'park' | 'hide'
  timer?: ReturnType<typeof setTimeout>
}
const stopRequests = new Map<string, StopRequest>()

function turnOver(paneId: string): boolean {
  const state = agentStates().panes.find((p) => p.paneId === paneId)?.state
  return state === 'idle' || state === 'done'
}

// Never mid-turn: hanging up then would lose the turn's work, and nothing is typed into it.
function stopAfterTurn(pane: Pane, sessionId: string, after: StopRequest['after']): void {
  const before = stopRequests.get(pane.id)
  if (before?.timer) clearTimeout(before.timer)
  stopRequests.set(pane.id, { sessionId, after })
  if (turnOver(pane.id)) stopNow(pane.id)
  else stopWhenIdle(pane.id)
}

function stopWhenIdle(paneId: string): void {
  const request = stopRequests.get(paneId)
  if (!request) return
  if (turnOver(paneId)) stopNow(paneId)
  else request.timer = setTimeout(() => stopWhenIdle(paneId), RENEW_CHECK_MS)
}

function stopNow(paneId: string): void {
  const request = stopRequests.get(paneId)
  const pane = panes.get(paneId)
  stopRequests.delete(paneId)
  if (request?.timer) clearTimeout(request.timer)
  if (!request || !pane || pane.sessionId !== request.sessionId) return
  const project = projectOf(projects, request.sessionId)
  stopPane(pane)
  if (project && request.after === 'park')
    projects = setParked(projects, project.id, request.sessionId, true)
  if (project && request.after === 'hide') {
    projects = setParked(projects, project.id, request.sessionId, false)
    const hidden = hideMember(projects, request.sessionId, false)
    if (hidden.ok) projects = hidden.projects
  }
  log.info('a worker was stopped', { session: request.sessionId, after: request.after })
  changed({ projects: true })
}

// As closing its tab does: the tab goes with its only pane.
function stopPane(pane: Pane): void {
  if ((tabPanes.get(pane.tabId) ?? []).length <= 1) closeTab(pane.tabId)
  else pane.terminal.hangUp()
}

function parkFor(project: Project, caller: string, named: unknown): ControlAnswer {
  if (typeof named !== 'string' || !named.trim()) return refuse('Name the worker to park.')
  const found = sessionOfProject(named.trim(), sessionsForNames(project.id))
  if ('refusal' in found) return refuse(found.refusal)
  const current = parkingTask(tasksOf(currentTasks(), project.id), found.id)
  const refusal = mayPark(workerTeam(project), caller, found.id, current)
  if (refusal) return refuse(refusal)
  const pane = paneOfSession(found.id)
  if (!pane) return refuse(`"${named.trim()}" is not running; nothing to park.`)
  stopAfterTurn(pane, found.id, 'park')
  return {
    ok: true,
    text: `"${named.trim()}" will be parked once its turn is over; resume it with resume_session when task ${current?.number ?? ''} can go on.`,
  }
}

async function resumeFor(
  caller: Pane,
  project: Project,
  callerId: string,
  request: ControlRequest,
): Promise<ControlAnswer> {
  const team = workerTeam(project)
  if (team.orchestrator === null) return refuse('The orchestration mode is off in this project.')
  if (callerId !== team.orchestrator)
    return refuse("Only this project's orchestrator resumes a session.")
  const named = request.args.name
  if (typeof named !== 'string' || !named.trim()) return refuse('Name the session to resume.')
  // Its transcript, its folder and its agent, as the agents' folders hold them now.
  await sessions.refresh()
  sessionList = await sessions.list()
  const found = sessionOfProject(named.trim(), sessionsForNames(project.id))
  if ('refusal' in found) return refuse(found.refusal)
  const id = found.id
  if (inSomeTab(id)) return refuse(`"${named.trim()}" is already running.`)
  const agent = sessionInfo(id)?.agent
  if (!agent || kitOf(agent).mcp === null) return refuse('Only a Claude Code session is resumed.')
  if (isWorker(team, id)) {
    const full = capRefusal(team, runningIn(project.id))
    if (full) return refuse(full)
  }
  const promptFile = await prompted(request.id, request.args.prompt)
  if (promptFile !== null && typeof promptFile !== 'string') return promptFile
  if (!tabById(caller.tabId)) return refuse(NOT_KNOWN)
  stopRequests.delete(paneOfSession(id)?.id ?? '')
  projects = setParked(showMember(projects, id), project.id, id, false)
  const tab: Tab = {
    kind: 'session',
    id: newId(),
    project: project.id,
    panes: [id],
    orientation: 'horizontal',
    ...(mayHide(id) ? { place: 'background' as const } : {}),
  }
  layout = insertTabAfter(layout, caller.tabId, tab)
  await startPane(tab.id, { ...resumeSpec(id), ...(promptFile ? { promptFile } : {}) })
  changed({ projects: true })
  return {
    ok: true,
    text: `Resumed "${named.trim()}" with its conversation ${whereStarted(tab)}.`,
  }
}

// A closed task's worker goes away at once (decision 1.120): hung up after its turn, then hidden.
function putAwayWorker(project: Project, number: number): void {
  const task = tasksOf(currentTasks(), project.id).find((x) => x.number === number)
  const id = task?.assignee
  if (
    !task ||
    id === undefined ||
    !hideOnClose(workerTeam(project), project.name, task, sessionName)
  )
    return
  const pane = paneOfSession(id)
  if (pane) {
    stopAfterTurn(pane, id, 'hide')
    return
  }
  projects = setParked(projects, project.id, id, false)
  const hidden = hideMember(projects, id, false)
  if (hidden.ok) projects = hidden.projects
  changed({ projects: true })
}

function capFor(
  project: Project,
  sessionId: string,
  args: Readonly<Record<string, unknown>>,
): ControlAnswer {
  const result = capTool(args, workerTeam(project), sessionId)
  if (result.ok) {
    projects = setWorkersCap(projects, project.id, result.cap)
    changed({ projects: true })
  }
  return { ok: result.ok, text: result.text }
}

function backFor(project: Project, sessionId: string): ControlAnswer {
  const result = backTool(workerTeam(project).orchestrator, sessionId, presence)
  if (result.clear) askPresence(false, sessionId)
  return { ok: result.ok, text: result.text }
}

// ---------------------------------------------------------------- the human's presence

// In memory only: a quit forgets it, and every start is "here".
let presence: Presence = HERE

const modesOn = () => projects.projects.map((p) => orchestrationInfo(p).on)

function presenceNow(): PresenceView {
  return presenceView(presence, modesOn())
}

// The chip, the banner, the shortcut, human_away and human_back all come here. The orchestrator
// that changed it is not told what it just did.
function askPresence(away: boolean, clearedBy?: string): void {
  const before = presence
  presence = presenceAsked(presence, away, now(), modesOn())
  const text = presencePost(before, presence)
  if (text) {
    // An orchestrator with an inbox reads it there; one without is woken as before.
    const woken = projects.projects.flatMap((p) => {
      const id = workerTeam(p).orchestrator
      if (!id) return []
      if (inboxOrchestrator(p) !== id)
        return [{ sessionId: id, running: paneOfSession(id)?.terminal.running === true }]
      if (id === clearedBy) inboxes.retract(p.id, 'presence')
      else inboxes.add(p.id, 'presence', text)
      return []
    })
    for (const id of postRecipients(woken, clearedBy)) wakes.post(id, 'presence', text)
    if (clearedBy) wakes.forget(clearedBy, 'presence')
    recordPresence(presence.away)
    log.info('the human is now', { away: presence.away })
  }
  // The orchestrator that changed it is asked too: its next prompt may be the human's, elsewhere.
  inboxes.setAway(presence.away ? presence.since : null)
  armQuiet()
  push()
}

// A key, click or scroll in a main window while away: the strip of every window asks whether the
// human is back. Every window's mark counts, also one the journal's minute leaves out.
export function noticeActivity(): void {
  settle(noticed(presence, now()))
}

function settle(next: Presence): void {
  if (next === presence) return
  const asked = (next.asking === true) !== (presence.asking === true)
  presence = next
  armQuiet()
  if (asked) push()
}

// A question nobody answers goes back to the plain strip after a quiet spell; away stays.
let quietTimer: ReturnType<typeof setTimeout> | undefined
function armQuiet(): void {
  clearTimeout(quietTimer)
  quietTimer = undefined
  const due = quietDue(presence)
  if (due === null) return
  quietTimer = setTimeout(() => settle(quieted(presence, now())), Math.max(0, due - now()))
}

function sessionsForNames(projectId: string) {
  return projectSessions(projectId).map((id) => ({
    id,
    name: sessionName(id),
    hasTab: inSomeTab(id),
    mtimeMs: sessionInfo(id)?.mtimeMs ?? 0,
  }))
}

function taskFor(
  tool: TaskTool,
  project: Project,
  sessionId: string,
  args: Readonly<Record<string, unknown>>,
): ControlAnswer {
  const o = orchestrationInfo(project)
  const result = taskTool(tool, args, {
    tasks: currentTasks(),
    projectId: project.id,
    caller: sessionId,
    orchestrator: o.on ? o.orchestrator : null,
    nameOf: sessionName,
    idOf: (name) => sessionOfProject(name, sessionsForNames(project.id)),
    at: topicsNow(),
  })
  if (result.tasks) {
    setTasks(result.tasks)
    if (tool === 'task_review') noteReview(project, sessionId, args.number)
    changed()
    if (tool === 'task_close' && typeof args.number === 'number')
      putAwayWorker(project, args.number)
  }
  return { ok: result.ok, text: result.text }
}

// Its assignee set the task to review: the orchestrator is woken at the end of that turn. The
// orchestrator changing whom a review waits on, or reviewing its own task, wakes nobody.
function noteReview(project: Project, sessionId: string, number: unknown): void {
  const orchestrator = inboxOrchestrator(project)
  if (!orchestrator || sessionId === orchestrator || typeof number !== 'number') return
  const task = tasksOf(currentTasks(), project.id).find((x) => x.number === number)
  if (task?.assignee !== sessionId || task.state !== 'to review') return
  reviews.set(sessionId, { task: number, note: task.note })
  inboxes.retract(project.id, `turn:${sessionId}`)
}

function adoptFor(projectId: string, caller: string, named: unknown): ControlAnswer {
  if (typeof named !== 'string' || !named.trim()) return refuse('Name the session to adopt.')
  const found = sessionOfProject(named.trim(), sessionsForNames(projectId))
  if ('refusal' in found) return refuse(found.refusal)
  const result = adopt(projects, caller, found.id)
  if ('refusal' in result) return refuse(result.refusal)
  projects = result.projects
  changed({ projects: true })
  return {
    ok: true,
    text: `"${named.trim()}" is now your child: Menkar tells you when it waits, ends its turn without a report, or sets its task to review.`,
  }
}

// The folder a session starts in: its pane's while it runs, else the one its transcript records.
const sessionFolder = (id: string) => paneOfSession(id)?.cwd ?? sessionInfo(id)?.cwd ?? null

// Menkar's own skills follow from the marks and never show in the window (decision 1.154).
const roleSkill = (s: FoundSkill) =>
  s.name.startsWith('menkar:') ? [] : [{ name: s.name, description: s.description }]

// What "Configure role…" lists for a session (decision 1.157): only what it can load, its folder's
// chain and the user's. Read when the window opens.
export async function roleSkills(sessionId: string): Promise<RoleSkills | null> {
  const project = projectOf(projects, sessionId)
  if (!project) return null
  const folder = sessionFolder(sessionId)
  const listed = await listSkills({
    folders: folder ? [folder] : [],
    user: agentPaths().claudeSkills,
  })
  const o = project.orchestration
  const maintainedBy: Record<string, string> = {}
  for (const [id, list] of Object.entries(o?.skills ?? {}))
    if (id !== sessionId)
      for (const s of list) if (s.maintainer) maintainedBy[s.name] = sessionName(id)
  return {
    label: o?.roles?.[sessionId] ?? '',
    folder: folder
      ? { name: basename(folder), skills: (listed.folders[folder] ?? []).flatMap(roleSkill) }
      : null,
    user: listed.user.flatMap(roleSkill),
    stored: o?.skills?.[sessionId] ?? [],
    maintainedBy,
  }
}

// Label and skills in one change; what the session can load is found again for the block.
async function configureRole(
  action: Extract<Action, { type: 'configureRole' }>,
): Promise<ActionResult> {
  const project = projectOf(projects, action.session)
  if (!project) return {}
  const result = setSkills(
    setRole(projects, project.id, action.session, action.label),
    project.id,
    action.session,
    action.skills,
    sessionName,
  )
  if (!result.ok) return { refusal: result.refusal, refusalParams: result.params }
  const pane = paneOfSession(action.session)
  if (pane) await teamFoundChanged(pane.id, pane.cwd)
  projects = result.projects
  changed({ projects: true })
  return {}
}

// The orchestrator's mark went to another session: what its inbox held was for the last one.
function orchestratorMarkMoved(projectId: string, before: string | null): void {
  const project = projects.projects.find((p) => p.id === projectId)
  const after = project ? orchestrationInfo(project).orchestrator : null
  if (before !== null && after !== before) inboxes.moved(projectId)
}

type MarkAction = Extract<Action, { type: 'setOrchestrator' | 'setRole' | 'setWithYou' }>

function marked(state: Projects, projectId: string, action: MarkAction): Projects {
  switch (action.type) {
    case 'setOrchestrator': {
      // Unchecking a session that is not the orchestrator leaves the one that is.
      const current = state.projects.find((p) => p.id === projectId)?.orchestration?.orchestrator
      if (!action.on && current !== action.session) return state
      return setOrchestrator(state, projectId, action.on ? action.session : null)
    }
    case 'setRole':
      return setRole(state, projectId, action.session, action.label)
    case 'setWithYou':
      return setWithYou(state, projectId, action.session, action.on)
  }
}

function topicFor(
  tool: TopicTool,
  project: Project,
  sessionId: string,
  args: Readonly<Record<string, unknown>>,
): ControlAnswer {
  const before = currentTopics()
  const result = topicTool(tool, args, {
    topics: before,
    projectId: project.id,
    caller: sessionId,
    tasks: tasksOf(currentTasks(), project.id).map((x) => x.number),
    starred: [...starredTasks(tasksOf(currentTasks(), project.id))],
    nameOf: sessionName,
    at: topicsNow(),
  })
  if (result.topics) {
    setTopics(result.topics)
    noticeTopics(project, before, result.topics)
    changed()
  }
  return { ok: result.ok, text: result.text }
}

// A topic raised, or turned blocking, notifies the human (decision 1.103) while the mode is on: off,
// the Topics section is not shown, so a notice would lead nowhere.
function noticeTopics(project: Project, before: Topics, after: Topics): void {
  if (!orchestrationInfo(project).on) return
  const old = topicsOf(before, project.id)
  const discussing = old.some((x) => x.status === 'discussing')
  for (const topic of topicsOf(after, project.id)) {
    const was = old.find((x) => x.number === topic.number)
    if (was === topic) continue
    const notice = topicNoticeNow(presence, topicNotice(was, topic, discussing))
    if (!notice) continue
    notifyTopic({
      project: project.id,
      number: topic.number,
      title: permissionTopicText(topic).title,
      sound: notice.sound,
      focused: focusedShowing(project.id),
      onClick: () => showTopic(project.id, topic.number),
    }).catch((error: unknown) =>
      log.warn('a topic notification failed', { number: topic.number, error }),
    )
  }
}

function focusedShowing(projectId: string): WebContents | null {
  for (const w of layout.windows) {
    const window = windows.get(w.id)
    if (w.shown === projectId && window && !window.isDestroyed() && window.isFocused())
      return window.webContents
  }
  return null
}

function seeTopic(projectId: string, number: number): void {
  const next = markSeen(currentTopics(), projectId, number)
  if (next !== currentTopics()) setTopics(next)
}

// A topic's notice clicked: the orchestrator's tab shown, the Topics section open, the topic
// unfolded. A permission topic leads to the session that waits instead, while its pane is there.
function showTopic(projectId: string, number: number): void {
  const project = projects.projects.find((p) => p.id === projectId)
  const orchestrator = project ? orchestrationInfo(project).orchestrator : null
  const topic = topicsOf(currentTopics(), projectId).find((x) => x.number === number)
  const waiting = topic?.kind === 'permission' ? paneOfSession(topic.from) : undefined
  const pane = waiting ?? (orchestrator ? paneOfSession(orchestrator) : undefined)
  if (pane) revealPane(pane.id)
  else {
    const w = layout.windows.find((x) => x.id === holder(layout, projectId))
    if (w) {
      putWindow({ ...w, shown: projectId })
      windows.get(w.id)?.focus()
    }
  }
  if (project?.topicsCollapsed) projects = setTopicsCollapsed(projects, projectId, false)
  seeTopic(projectId, number)
  changed({ projects: true })
  const window = windows.get(holder(layout, projectId) ?? '')
  if (window && !window.isDestroyed()) window.webContents.send('topics:unfold', { number })
}

async function requestRenew(
  pane: Pane,
  sessionId: string,
  request: ControlRequest,
): Promise<ControlAnswer> {
  const promptFile = await prompted(request.id, request.args.prompt)
  if (promptFile !== null && typeof promptFile !== 'string') return promptFile
  const before = renewRequests.get(pane.id)
  if (before) clearTimeout(before.timer)
  renewRequests.set(pane.id, {
    sessionId,
    ...(promptFile ? { promptFile } : {}),
    timer: setTimeout(() => renewWhenIdle(pane.id), RENEW_FALLBACK_MS),
  })
  return {
    ok: true,
    text: 'This session will be renewed in its tab once this turn ends. End your turn now.',
  }
}

// The agent's turn-end record: the turn in this pane ended, under this session id. A pane waiting
// for an id it could not know at start takes this one; a pane whose session now has another id
// follows it as its agent says.
function turnEnded(paneId: string, sessionId: string): void {
  const pane = panes.get(paneId)
  if (pane?.pending && pane.pending.expectedId === null && !inSomeTab(sessionId))
    joinSession(pane, sessionId)
  else if (pane?.sessionId && pane.sessionId !== sessionId) followPane(pane, sessionId, null)
  stopRecorded(paneId, sessionId)
  turnEndedContext(sessionId)
  if (stopRequests.get(paneId)?.sessionId === sessionId) stopNow(paneId)
  const request = renewRequests.get(paneId)
  if (request && panes.get(paneId)?.sessionId === sessionId && request.sessionId === sessionId)
    void renew(paneId)
}

function renewWhenIdle(paneId: string): void {
  const request = renewRequests.get(paneId)
  if (!request) return
  const state = agentStates().panes.find((p) => p.paneId === paneId)?.state
  if (state === 'idle' || state === 'done') void renew(paneId)
  else request.timer = setTimeout(() => renewWhenIdle(paneId), RENEW_CHECK_MS)
}

// A `/clear` nobody types: the tab is re-keyed to a new id first, as a followed
// clear does, then the old agent is hung up as closing a tab does, then the new session starts in
// the same tab with the same name. Starting first would race its own SessionStart record.
async function renew(paneId: string): Promise<void> {
  const request = renewRequests.get(paneId)
  const pane = panes.get(paneId)
  renewRequests.delete(paneId)
  if (request) clearTimeout(request.timer)
  const agent = agentOf(pane)
  if (!request || !pane || !agent || pane.sessionId !== request.sessionId) return
  renewing.set(paneId, null)
  const from = request.sessionId
  const info = sessionInfo(from)
  const to = randomUUID()
  const model = modelOf(await sessions.currentState(), from)
  if (!followClear(pane, from, to)) {
    if (renewing.get(paneId) === null) renewing.delete(paneId)
    log.warn('a session was not renewed: it is in no project', { session: from })
    return
  }
  const name = info?.claudeNamed ? info.name : startedNames.get(from)
  if (name) startedNames.set(to, name)
  const tabId = pane.tabId
  holdStart(tabId)
  try {
    await new Promise<void>((resolve) => {
      renewing.set(paneId, resolve)
      pane.terminal.hangUp()
    })
    if (!tabById(tabId)) return
    const remote = remoteIds.has(to) ? remoteName(name ?? '', pane.cwd, to) : undefined
    await startPane(tabId, {
      agent,
      start: { kind: 'new', id: to, ...(name ? { name } : {}), ...(model ? { model } : {}) },
      cwd: pane.cwd,
      sessionId: to,
      ...(remote ? { remote } : {}),
      ...(request.promptFile ? { promptFile: request.promptFile } : {}),
    })
  } finally {
    releaseStart(tabId)
  }
  log.info('a session renewed itself', { from, to })
  changed()
}

// A project's sessions as the tools see them: its members, without the earlier conversations.
function projectSessions(projectId: string): string[] {
  const p = projects.projects.find((x) => x.id === projectId)
  if (!p) return []
  const earlier = earlierIds(p)
  return p.members.filter((id) => !earlier.has(id))
}

// The project's sessions with a tab: the ones running.
function runningIn(projectId: string): Set<string> {
  return new Set(projectSessions(projectId).filter(inSomeTab))
}

// Names with a tab in the project: a name is how the agents address a session.
function namesWithTab(projectId: string): Set<string> {
  return new Set(
    layout.windows.flatMap((w) =>
      w.tabs.flatMap((t) =>
        t.kind === 'session' && t.project === projectId ? t.panes.map(sessionName) : [],
      ),
    ),
  )
}

function whereStarted(tab: Tab): string {
  return tab.kind === 'session' && tab.place === 'background'
    ? 'in the background, with no tab of its own until the human opens it'
    : 'in a tab after yours'
}

async function startForAgent(
  caller: Pane,
  callerId: string,
  projectId: string,
  request: ControlRequest,
): Promise<ControlAnswer> {
  const owner = projects.projects.find((p) => p.id === projectId)
  const refusal = owner ? mayStart(owner, callerId, sessionName) : null
  if (refusal) return refuse(refusal)
  const args = request.args
  const named = startName(args, owner?.name ?? '')
  if ('refusal' in named) return refuse(named.refusal)
  const { name, task } = named
  if (task !== undefined) {
    const taken = untakenRefusal(tasksOf(currentTasks(), projectId), task, sessionName)
    if (taken) return refuse(taken)
  }
  if (namesWithTab(projectId).has(name))
    return refuse(`A session called "${name}" is already running in this project.`)
  const groupName = typeof args.group === 'string' ? args.group.trim() : ''
  const project = projects.projects.find((p) => p.id === projectId)
  const group = groupName ? project?.groups.find((g) => g.name === groupName) : undefined
  if (groupName && !group) return refuse(`The project has no group called "${groupName}".`)
  const model = readModel(args.model)
  if ('refusal' in model) return refuse(model.refusal)
  const placement = readPlacement(args)
  if ('refusal' in placement) return refuse(placement.refusal)
  const known = owner ? foldersOfProject(owner).map((f) => f.path) : []
  const where = startFolder(args.folder, known)
  if ('refusal' in where) return refuse(where.refusal)
  if (where.folder !== null && !(await isFolder(where.folder)))
    return refuse(
      `${where.folder} is one of this project's folders but no longer exists on disk. The project's folders: ${known.join(', ')}.`,
    )
  const cwd = where.folder ?? caller.cwd
  const team = owner ? workerTeam(owner) : null
  if (team && startsWorker(team, callerId, placement)) {
    const full = capRefusal(team, runningIn(projectId))
    if (full) return refuse(full)
  }
  const hasPrompt = typeof args.prompt === 'string' && args.prompt !== ''
  if (hasPrompt && args.prompt_file !== undefined)
    return refuse('Give either prompt or prompt_file, not both.')
  let promptFile: string | null = null
  if (args.prompt_file !== undefined) {
    if (typeof args.prompt_file !== 'string') return refuse('The prompt_file must be a path.')
    const read = await readPromptFile(args.prompt_file)
    if ('refusal' in read) return refuse(read.refusal)
    promptFile = await savePrompt(request.id, read.text)
  } else {
    const saved = await prompted(request.id, args.prompt)
    if (saved !== null && typeof saved !== 'string') return saved
    promptFile = saved
  }
  if (!tabById(caller.tabId)) return refuse(NOT_KNOWN)
  const id = randomUUID()
  startedNames.set(id, name)
  const namesakes = projectSessions(projectId)
    .filter((s) => sessionName(s) === name && !inSomeTab(s))
    .sort((a, b) => (sessionInfo(b)?.mtimeMs ?? 0) - (sessionInfo(a)?.mtimeMs ?? 0))
  const tookOver = takeOverName(projects, namesakes, id)
  if (tookOver !== projects && namesakes[0]) {
    followMute(namesakes[0], id)
    followTaskAssignee(namesakes[0], id)
    await followSessionModel(namesakes[0], id)
  }
  const chosen = model.model
  if (chosen) await sessions.updateState((state) => setModel(state, id, chosen))
  const joined = tookOver === projects ? addMember(projects, projectId, id) : tookOver
  projects = placeStarted(joined, projectId, id, callerId, placement)
  if (group) projects = setGroup(projects, projectId, id, { name: group.name, color: group.color })
  if (task !== undefined) {
    const assigned = assignTask(currentTasks(), projectId, task, id, topicsNow(), sessionName)
    if ('tasks' in assigned) setTasks(assigned.tasks)
  }
  const remote = args.remote_control === true
  if (remote) {
    remoteIds.add(id)
    await sessions.updateState((state) => setRemoteControl(state, id, true))
  }
  const tab: Tab = {
    kind: 'session',
    id: newId(),
    project: projectId,
    panes: [id],
    orientation: 'horizontal',
    ...(mayHide(id) ? { place: 'background' as const } : {}),
  }
  layout = insertTabAfter(layout, caller.tabId, tab)
  await startPane(tab.id, {
    agent: DEFAULT_AGENT,
    start: { kind: 'new', id, name, ...model },
    cwd,
    sessionId: id,
    ...(remote ? { remote: remoteName(name, cwd, id) } : {}),
    ...(promptFile ? { promptFile } : {}),
  })
  changed({ projects: true })
  return {
    ok: true,
    text: placement.loose
      ? `Started "${name}" ${whereStarted(tab)}, loose: you are not its parent. Address it by this name.`
      : task !== undefined
        ? `Started "${name}" for task ${task}, now assigned to it, ${whereStarted(tab)}; you are its parent. Address it by this name.`
        : `Started "${name}" ${whereStarted(tab)}; you are its parent. Address it by this name.`,
  }
}

// The projects' folders gone from disk; the windows hear of a change. One check at a time: one
// asked for meanwhile runs once the current one ends.
let goneFolders: readonly string[] = []
let checkingFolders = false
let checkFoldersAgain = false

async function checkFolders(): Promise<void> {
  if (checkingFolders) {
    checkFoldersAgain = true
    return
  }
  checkingFolders = true
  try {
    do {
      checkFoldersAgain = false
      const all = projects.projects.flatMap((p) => foldersOfProject(p))
      const gone = await missingFolders(all, folderExists)
      if (gone.join('\n') !== goneFolders.join('\n')) {
        goneFolders = gone
        push()
        publishSnapshots()
      }
    } while (checkFoldersAgain)
  } finally {
    checkingFolders = false
  }
}

// A folder that cannot be read is taken as there: only one surely gone is hidden.
async function folderExists(path: string): Promise<boolean> {
  try {
    return await isFolder(path)
  } catch (error) {
    log.warn('a project folder could not be checked', { path, error })
    return true
  }
}

// Decision 1.124: its sessions' folders, earlier conversations included, and the ones added by hand.
function foldersOfProject(p: Project): ProjectFolder[] {
  const paneCwds = new Map<string, string>()
  for (const pane of panes.values())
    if (pane.sessionId && pane.cwd) paneCwds.set(pane.sessionId, pane.cwd)
  return membersFolders(p.members, sessionList, paneCwds, orchestrationInfo(p).folders)
}

async function lastReplyFor(projectId: string, named: unknown): Promise<ControlAnswer> {
  if (typeof named !== 'string' || !named.trim())
    return refuse('Name the session whose last reply you want.')
  const list = projectSessions(projectId).map((id) => ({
    id,
    name: sessionName(id),
    hasTab: inSomeTab(id),
    mtimeMs: sessionInfo(id)?.mtimeMs ?? 0,
  }))
  const found = sessionOfProject(named.trim(), list)
  if ('refusal' in found) return refuse(found.refusal)
  const current = await replyOf(found.id)
  const p = projects.projects.find((x) => x.id === projectId)
  const previousId = current === null && p ? keptEarlier(p)[found.id]?.[0] : undefined
  const previous = previousId ? await replyOf(previousId) : null
  const answer = lastReplyAnswer(named.trim(), current, previous)
  return 'refusal' in answer ? refuse(answer.refusal) : { ok: true, text: answer.text }
}

// A session's last reply, or null when it has none (or no transcript yet, or its agent's catalog
// reads none).
async function replyOf(sessionId: string): Promise<string | null> {
  const info = sessionInfo(sessionId)
  const read = info ? kitOf(info.agent).catalog.lastReply : null
  if (!info || !read) return null
  try {
    return await read(info.file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return null
  }
}

function snapshotOf(projectId: string): Snapshot {
  const p = projects.projects.find((x) => x.id === projectId)
  const states = new Map(
    agentStates().panes.flatMap((s) => (s.sessionId ? [[s.sessionId, s.state] as const] : [])),
  )
  const parents = p ? keptParents(p) : {}
  return {
    project: { id: projectId, name: p?.name ?? '' },
    orchestration: p ? orchestrationInfo(p).on : false,
    folders: p ? presentFolders(foldersOfProject(p), goneFolders) : [],
    sessions: projectSessions(projectId).map((id) => {
      const parent = parents[id]
      return {
        ...(p ? sessionMarks(p, id, onStarredTask(tasksOf(currentTasks(), p.id), id)) : {}),
        name: sessionName(id),
        id,
        state: states.get(id) ?? null,
        context: contextReading(id)?.percentage ?? null,
        parent: parent ? sessionName(parent) : null,
        tab: inSomeTab(id),
        pane: paneOfSession(id)?.id ?? null,
        folder: sessionFolder(id),
      }
    }),
  }
}

function listText(projectId: string): string {
  return sessionsAnswer(snapshotOf(projectId))
}

function publishSnapshots(): void {
  for (const p of projects.projects) publishSnapshot(p.id, () => snapshotOf(p.id))
}

export const controlHandlers: ControlHandlers = { handle: handleControl, turnEnded, ready }

// The control folder is new: what a quit took from the inboxes and is still true goes back in.
// Every task to review waiting on its orchestrator, whose wake may not have gone, once the sessions'
// names are known. Its agent is not asked: an inbox nobody reads only keeps its lines.
function ready(): void {
  void firstScan.then(restoreReviews)
}

function restoreReviews(): void {
  for (const project of projects.projects) {
    const o = orchestrationInfo(project)
    if (!o.on || !o.orchestrator) continue
    for (const task of tasksOf(currentTasks(), project.id)) {
      if (task.state !== 'to review' || task.reviewWait?.on !== 'orchestrator') continue
      const who = task.assignee === undefined ? '' : ` (${sessionName(task.assignee)})`
      const note = task.note ? `: ${task.note}` : ''
      inboxes.add(
        project.id,
        `review:${task.number}`,
        `Task ${task.number} is to review${who}${note}`,
      )
    }
  }
}

// Every permission topic a quit left open: the process at the prompt is gone.
function closeLeftPermissionTopics(): void {
  let topics = currentTopics()
  for (const [projectId, own] of Object.entries(topics.projects))
    for (const topic of own?.topics ?? [])
      if (topic.kind === 'permission' && topic.status !== 'closed') {
        const closed = closeTopic(topics, projectId, topic.number, PERMISSION_ANSWERED, topicsNow())
        if (closed) topics = closed.topics
      }
  if (topics !== currentTopics()) setTopics(topics)
}
setSnapshotSource(publishSnapshots)

// Waking a parent: a session another started waits at a prompt or ends its
// turn, and its parent hears of it through Claude Code's messaging, a few seconds later and
// together with its other children's news and the human's own. Never typed into the parent's
// terminal.
const wakes = new WakeBatcher(
  (parent, text, entries) => void sendWake(parent, text, entries),
  {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
  },
  (child) => {
    const p = projectOf(projects, child)
    return p ? onStarredTask(tasksOf(currentTasks(), p.id), child) : false
  },
)

// A wake for a project's orchestrator is addressed when it goes, not when it came: a renew or a
// clear inside the wait gave the orchestrator another id.
const ORCHESTRATOR_OF = 'orch:'

// What could not be posted to an orchestrator waits in its inbox, under the same keys.
async function sendWake(
  parent: string,
  text: string,
  entries: readonly WakeEntry[],
): Promise<void> {
  if (!parent.startsWith(ORCHESTRATOR_OF)) {
    await wakeSession(parent, text)
    return
  }
  const projectId = parent.slice(ORCHESTRATOR_OF.length)
  const project = projects.projects.find((p) => p.id === projectId)
  const orchestrator = project ? inboxOrchestrator(project) : null
  if (!orchestrator) {
    log.info('a wake for an orchestrator no longer in the mode was dropped', { project: projectId })
    return
  }
  if ((await wakeSession(orchestrator, text)) === 'posted') return
  for (const entry of entries) inboxes.add(projectId, entry.key, entry.text)
}

// The project's orchestrator when the mode is on and its agent can be given an inbox: what it was
// woken for, other than a review or a question, waits there instead, off the human's screen.
function inboxOrchestrator(project: Project): string | null {
  const o = orchestrationInfo(project)
  if (!o.on || !o.orchestrator) return null
  const agent = agentOf(paneOfSession(o.orchestrator)) ?? sessionInfo(o.orchestrator)?.agent
  return agent && mainKitOf(agent).inbox !== null ? o.orchestrator : null
}

// By pane, how its last turn stands. A turn ends once, at the first of: its shown state going from
// working or blocked to idle or done, the Stop hook's record, the pane's exit. A Stop record with no
// working seen since the last one is a turn too short to be shown.
const turns = new Map<string, 'open' | 'ended-shown' | 'ended-stop'>()
// By session: the task it set to review in this turn; the orchestrator is woken at the turn's end,
// once its report is written.
const reviews = new Map<string, { readonly task: number; readonly note: string }>()

// Menkar's blocking topic for a session of the orchestrator at a permission prompt nobody looks at.
const permissions = new PermissionTopics(
  {
    openTopic: (session) => {
      const project = projectOf(projects, session)
      return project
        ? (openPermissionTopic(topicsOf(currentTopics(), project.id), session)?.number ?? null)
        : null
    },
    raise: raisePermissionTopic,
    close: (session, number) => {
      const project = projectOf(projects, session)
      const closed = project
        ? closeTopic(currentTopics(), project.id, number, PERMISSION_ANSWERED, topicsNow())
        : null
      if (!closed) return
      setTopics(closed.topics)
      changed()
    },
  },
  {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
  },
)

// Raised as a session's topic_add is: a notice, a sound, silence while the human is away.
function raisePermissionTopic(subject: PermissionSubject): number {
  const project = projectOf(projects, subject.session)
  // Not reached: the subject is a member of a project in the mode.
  if (!project) return 0
  const before = currentTopics()
  const task = currentTask(tasksOf(currentTasks(), project.id), subject.session)
  const added = addTopic(
    before,
    project.id,
    permissionTopic(sessionName(subject.session), subject.session, task?.number),
    topicsNow(),
  )
  setTopics(added.topics)
  noticeTopics(project, before, added.topics)
  changed()
  return added.number
}

// A permission topic is stored in English, as topic_list gives it, and shown in the user's language
// with the session's name now.
function permissionTopicText(topic: Topic): { readonly title: string; readonly context: string } {
  if (topic.kind !== 'permission') return { title: topic.title, context: topic.context }
  const name = sessionName(topic.from)
  return {
    title: t('topics.permissionTitle', { name }),
    context: t('topics.permissionContext'),
  }
}

onShownChange((paneId, sessionId, previous, next) => {
  if (!sessionId) return
  const project = projectOf(projects, sessionId)
  const orchestrator = project ? inboxOrchestrator(project) : null
  const toOrchestrator =
    !!project && !!orchestrator && keptParents(project)[sessionId] === orchestrator
  const pane = panes.get(paneId)
  // Before any transcript is asked: an agent with no turn-end reading still raises these.
  if (project && orchestrator) {
    if (next === 'blocked' && previous !== 'blocked')
      permissions.blocked({
        pane: paneId,
        session: sessionId,
        parentIsOrchestrator: toOrchestrator,
        withYou: orchestrationInfo(project).withYou.includes(sessionId),
        seen: pane ? paneSeen(pane) : false,
      })
    else if (previous === 'blocked' && next !== 'blocked') permissions.unblocked(paneId)
  }
  if (toOrchestrator && project && next === 'blocked' && previous !== 'blocked')
    inboxes.add(
      project.id,
      `permission:${sessionId}`,
      `${sessionName(sessionId)} is waiting at a permission prompt`,
    )
  if (next === 'working' || next === 'blocked') turns.set(paneId, 'open')
  else if ((next === 'idle' || next === 'done') && turns.get(paneId) === 'open') {
    turns.set(paneId, 'ended-shown')
    turnEnd(paneId, sessionId, agentOf(pane))
  }
  if (toOrchestrator) return
  const agent = agentOf(pane)
  const reading = agent ? kitOf(agent).catalog.turnEnd : null
  if (!reading) return
  const turnEnded = previous === 'working' && (next === 'idle' || next === 'done')
  const posted = turnEnded && teamTurnEnded(paneId)
  const parent = project ? keptParents(project)[sessionId] : undefined
  if (!parent) return
  const file = sessionInfo(sessionId)?.file
  const parentName = sessionName(parent)
  void wakesParent(
    previous,
    next,
    posted,
    async () => (file ? reading.onlyTeamUpdates(file) : false),
    async () => (file ? reading.reportedTo(file, parentName) : false),
  )
    .catch((error: unknown) => {
      log.warn('a turn could not be read; its parent is woken', { pane: paneId, error })
      return true
    })
    .then((wake) => {
      if (!wake) {
        log.info('a turn its parent already knows of woke no parent', { pane: paneId })
        return
      }
      wakes.note(parent, sessionId, sessionName(sessionId), previous, next)
    })
})

// The Stop hook's record, unless the shown state ended this turn already.
function stopRecorded(paneId: string, sessionId: string): void {
  const ended = turns.get(paneId) === 'ended-shown'
  turns.set(paneId, 'ended-stop')
  if (!ended) turnEnd(paneId, sessionId, agentOf(panes.get(paneId)))
}

// A turn's end in a project whose orchestrator has an inbox, its rules in order, the first that
// applies winning. The renew is read before any await: a turn seen ending while renew awaits is
// not a turn without a report.
function turnEnd(paneId: string, sessionId: string, agent: AgentId | null): void {
  const project = projectOf(projects, sessionId)
  const orchestrator = project ? inboxOrchestrator(project) : null
  if (!project || !orchestrator) return
  const review = reviews.get(sessionId)
  reviews.delete(sessionId)
  const reading = agent ? kitOf(agent).catalog.turnEnd : null
  if (!review && !reading) return
  const parentIsOrchestrator = keptParents(project)[sessionId] === orchestrator
  const known = {
    event: 'turn-end' as const,
    parentIsOrchestrator,
    reviewPending: review !== undefined,
    renewing: renewRequests.has(paneId) || renewing.has(paneId),
  }
  const name = sessionName(sessionId)
  const act = (where: Route) => {
    if (where === 'wake' && review) {
      inboxes.retract(project.id, `turn:${sessionId}`)
      wakes.wake(
        `${ORCHESTRATOR_OF}${project.id}`,
        sessionId,
        `review:${sessionId}:${review.task}`,
        `${name} set task ${review.task} to review${review.note ? `: ${review.note}` : ''}`,
      )
    } else if (where === 'inbox')
      inboxes.add(project.id, `turn:${sessionId}`, `${name} ended its turn without a report`)
  }
  const posted = parentIsOrchestrator && teamTurnEnded(paneId)
  if (known.reviewPending || known.renewing || !parentIsOrchestrator || !reading) {
    act(route({ ...known, onlyTeamUpdates: false, reportedToParent: false }))
    return
  }
  const file = sessionInfo(sessionId)?.file
  const parentName = sessionName(orchestrator)
  const read = async () => ({
    onlyTeamUpdates: posted && file ? await reading.onlyTeamUpdates(file) : false,
    reportedToParent: file ? await reading.reportedTo(file, parentName) : false,
  })
  void read()
    .catch((error: unknown) => {
      log.warn('a turn could not be read; it goes to the orchestrator’s inbox', {
        pane: paneId,
        error,
      })
      return { onlyTeamUpdates: false, reportedToParent: false }
    })
    .then((found) => act(route({ ...known, ...found })))
}

async function wakeSession(parent: string, text: string): Promise<WakeOutcome> {
  const agent = agentOf(paneOfSession(parent))
  const waker = agent ? mainKitOf(agent).waker : null
  if (!waker) {
    log.info('a parent with no tab that can be woken was not woken', { parent })
    return 'no pane'
  }
  try {
    const project = projectOf(projects, parent)
    const counts = postCounts(
      project ? orchestrationInfo(project) : undefined,
      parent,
      project ? topicsOf(currentTopics(), project.id) : [],
      project ? tasksOf(currentTasks(), project.id) : [],
    )
    const outcome = await waker.wake(parent, text, counts)
    if (outcome === 'posted') log.info('a parent session was woken', { parent })
    else log.warn('a parent session could not be woken', { parent, outcome })
    return outcome
  } catch (error) {
    log.warn('a parent session could not be woken', { parent, error })
    return 'error'
  }
}

// A prompt the orchestrator's model got may have carried its inbox: the transcript says so.
onShownChange((paneId, _sessionId, _previous, next) => {
  if (next === 'working' || next === 'idle' || next === 'done') inboxes.paneTurned(paneId)
})

// ---------------------------------------------------------------- a pane's session changing id

const inSomeTab = (sessionId: string) =>
  layout.windows.some((w) =>
    w.tabs.some((t) => t.kind === 'session' && t.panes.includes(sessionId)),
  )

// `/clear` (decision 1.56) and an in-session `/resume` (1.57) give the session in a pane another
// id, and the tab follows it. After a clear the new session takes the old one's place in its
// project; a resumed one joins the tab's project. The session left stays a stopped row.
export function followPaneStart(paneId: string, sessionId: string, source: PaneStartSource): void {
  const pane = panes.get(paneId)
  teamStartRecord(paneId, source, pane?.sessionId === sessionId)
  if (pane) followPane(pane, sessionId, source)
}

function followPane(pane: Pane, sessionId: string, source: PaneStartSource | null): void {
  const from = pane.sessionId
  const agent = agentOf(pane)
  const change = agent
    ? (kitOf(agent).follow?.classify(source, { to: sessionId, paneStartedAt: pane.startedAt }) ??
      null)
    : null
  if (change instanceof Promise) {
    change
      .then((later) => {
        if (panes.get(pane.id) === pane && pane.sessionId === from)
          applyFollow(pane, from, sessionId, source, later)
      })
      .catch((error: unknown) =>
        log.warn('a pane’s new session could not be classified', { from, to: sessionId, error }),
      )
    return
  }
  applyFollow(pane, from, sessionId, source, change)
}

function applyFollow(
  pane: Pane,
  from: string | null,
  sessionId: string,
  source: PaneStartSource | null,
  change: FollowKind,
): void {
  const tab = tabById(pane.tabId)
  if (!change || !from || from === sessionId || tab?.kind !== 'session') return
  // A session is in one tab at most: a resume of one another tab holds leaves this tab as it was.
  if (inSomeTab(sessionId)) {
    log.warn('a pane’s new session is open in another tab; the pane is not followed', {
      from,
      to: sessionId,
      source,
    })
    return
  }
  if (change === 'clear') {
    if (!followClear(pane, from, sessionId))
      log.warn(
        'a cleared session was not followed: its old id is in no project, or its new one is',
        { from, to: sessionId },
      )
    return
  }
  projects = followResume(projects, from, sessionId, tab.project)
  layout = followNewIdInLayout(layout, from, sessionId)
  followMute(from, sessionId)
  followTaskAssignee(from, sessionId)
  void followSessionModel(from, sessionId)
  pane.sessionId = sessionId
  noteStarted(sessionId)
  recordAgent(sessionId, pane.agent)
  tabLabels.delete(pane.tabId)
  changed({ projects: true })
  refreshAgentStates()
}

// The session in a pane took a new id the way a `/clear` gives one: the new id takes the old one's
// place in its project, group, hidden flag, parents and Remote Control, and the old
// one becomes its earlier conversation. Used by a followed clear and by a renew. False
// when the old id is in no project, or the new one already is in one: then nothing changes.
function followClear(pane: Pane, from: string, to: string): boolean {
  const next = followNewId(projects, from, to)
  if (next === projects) return false
  projects = next
  layout = followNewIdInLayout(layout, from, to)
  pane.sessionId = to
  noteStarted(to)
  recordAgent(to, pane.agent)
  tabLabels.delete(pane.tabId)
  if (remoteIds.has(from)) {
    remoteIds.delete(from)
    remoteIds.add(to)
    sessions
      .updateState((state) => followRemoteControl(state, from, to))
      .catch((error: unknown) =>
        log.error('Remote Control did not follow a session’s new id', { from, to, error }),
      )
  }
  followMute(from, to)
  followTaskAssignee(from, to)
  void followSessionModel(from, to)
  changed({ projects: true })
  refreshAgentStates()
  return true
}

async function followSessionModel(from: string, to: string): Promise<void> {
  try {
    if (modelOf(await sessions.currentState(), from) === undefined) return
    await sessions.updateState((state) => followModel(state, from, to))
  } catch (error) {
    log.error('a model did not follow a session’s new id', { from, to, error })
  }
}

function followTaskAssignee(from: string, to: string): void {
  const next = followTasks(currentTasks(), from, to)
  if (next !== currentTasks()) setTasks(next)
}

function followMute(from: string, to: string): void {
  if (!mutedIds.has(from)) return
  mutedIds.delete(from)
  mutedIds.add(to)
  sessions
    .updateState((state) => followMuted(state, from, to))
    .catch((error: unknown) =>
      log.error('a mute did not follow a session’s new id', { from, to, error }),
    )
}

// ---------------------------------------------------------------- windows

// Each window's last title bar, as its page sent it: the height in the page's own pixels.
const titleBars = new Map<string, { color: string; symbolColor: string; height: number }>()

// The overlay is in the window's pixels, so the page's height is scaled by its zoom. Interface size
// changes the zoom without the header changing in the page's pixels, so the page sends nothing.
function applyTitleBar(windowId: string): void {
  const window = windows.get(windowId)
  const bar = titleBars.get(windowId)
  if (!window || window.isDestroyed() || !bar) return
  window.setTitleBarOverlay({
    ...bar,
    height: Math.round(bar.height * (window.webContents.getZoomFactor() || 1)),
  })
}

export function applyTitleBars(): void {
  for (const windowId of titleBars.keys()) applyTitleBar(windowId)
}

function createBrowserWindow(windowId: string): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    title: translate(flavorFacts().titleKey),
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
      zoomFactor: uiZoom(),
    },
  })
  windows.set(windowId, window)
  window.once('ready-to-show', () => {
    startShown()
    window.show()
    if (layout.windows.find((w) => w.id === windowId)?.maximized) {
      window.maximize()
      log.info('window maximized as it was saved', { window: windowId })
    }
  })
  window.on('maximize', () => {
    lastMaximizeChange.set(windowId, now())
    recordMaximized(windowId)
    push()
  })
  window.on('unmaximize', () => {
    lastMaximizeChange.set(windowId, now())
    recordMaximized(windowId)
    push()
  })
  window.on('enter-full-screen', () => push())
  window.on('leave-full-screen', () => {
    recordMaximized(windowId)
    push()
  })
  window.on('focus', () => {
    focusOrder = [windowId, ...focusOrder.filter((id) => id !== windowId)]
    const shown = layout.windows.find((x) => x.id === windowId)?.shown
    if (shown) recentProjects = touched(recentProjects, shown)
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
    titleBars.delete(windowId)
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
  for (const tab of w?.tabs ?? []) {
    for (const id of tabPanes.get(tab.id) ?? []) panes.get(id)?.terminal.hangUp()
    closeDrawer(tab.id)
  }
}

// The last window keeps its layout in the file for the next start; another window leaves it.
// The last window waits for its save: the app quits right after it, and a write cut short would
// leave its temporary file instead of the new projects.json.
async function finishClose(windowId: string): Promise<void> {
  const last = windows.size <= 1
  recordMaximized(windowId)
  clearTimeout(saveTimer)
  saveTimer = undefined
  if (last) {
    const saved = saveProjectsNow()
    closingLast = true
    await saved
    hangUpWindow(windowId)
  } else {
    // Before the window leaves the layout: its tabs are found there.
    hangUpWindow(windowId)
    layout = removeWindow(layout, windowId)
    saveProjectsNow()
    push()
  }
  allowedToClose.add(windowId)
  windows.get(windowId)?.close()
}

// Restart now's quit: the layout saved as the last window's close saves it, every pty hung up,
// with no question. Its question opened behind Settings, so the button seemed to do nothing.
export async function quitApp(): Promise<void> {
  for (const windowId of windows.keys()) recordMaximized(windowId)
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
}

const unsavedAnswered = new Set<string>()

// The edited files of every window, each once.
export function unsavedEverywhere(): string[] {
  const paths = layout.windows.flatMap((w) =>
    w.tabs.flatMap((tab) =>
      tab.kind === 'file' && !tab.preview && isDirty(tab.path) ? [tab.path] : [],
    ),
  )
  return [...new Set(paths)]
}

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

// A session no reader found but `session_agents` names gets a shell with one line instead of its
// agent, its tab and id kept as saved.
function resumeSpec(sessionId: string): PaneSpec {
  const info = sessionInfo(sessionId)
  const restore = restoreOf(info?.agent, savedAgents[sessionId])
  if (restore.kind === 'missing')
    return {
      agent: 'shell',
      cwd: null,
      sessionId,
      notice: t('terminal.restoreMissing', { agent: agentName(restore.agent) }),
    }
  if (restore.kind === 'unsupported')
    return {
      agent: 'shell',
      cwd: null,
      sessionId,
      notice: t('terminal.restoreUnsupported', { agent: restore.agent }),
    }
  const agent = restore.kind === 'resume' ? restore.agent : DEFAULT_AGENT
  const remote =
    mainKitOf(agent).remote !== null && remoteIds.has(sessionId)
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
// Settled once the agents' folders were first read, whether or not that worked: names are known.
let firstScan: Promise<void> = Promise.resolve()

export async function startWorkspace(): Promise<void> {
  const loaded = currentProjects()
  if (!loaded) throw new Error('projects were not loaded before the workspace started')
  projects = loaded
  closeLeftPermissionTopics()
  // The window does not wait for the first scan of the agents' folders: the list fills in when it
  // ends, and the shown project's saved tabs start then (`startShownTabs` waits for it).
  sessionList = sessions.listNow()
  firstScan = sessions.start().then(
    async () => {
      savedAgents = sessionAgents(await sessions.currentState())
      sessionList = sessions.listNow()
      dropUnknownSessions()
      firstScanDone(sessionList.length)
      changed()
    },
    // Logged where the scan is started; the window stops waiting for it all the same.
    () => {
      firstScanFailed = true
      changed()
    },
  )
  settings = settingsOf(await sessions.currentState())
  startPhase('state for the workspace')
  remoteIds = new Set(remoteControlList(await sessions.currentState()))
  mutedIds = new Set(mutedList(await sessions.currentState()))
  savedAgents = sessionAgents(await sessions.currentState())
  installedAgents = []
  for (const agent of AGENT_IDS)
    if (await findOnPath(descriptorOf(agent).command)) installedAgents.push(agent)
  startPhase('agents found')
  sessions.onChange((list) => {
    sessionList = list
    void sessions.currentState().then((state) => {
      settings = settingsOf(state)
      remoteIds = new Set(remoteControlList(state))
      mutedIds = new Set(mutedList(state))
      savedAgents = sessionAgents(state)
      push()
      teamFactsMayChange()
    })
  })
  layout = reopen(projects, { reopenTabs: settings.reopen_tabs, isFile, newId })
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
  startProjectFiles({
    projects: () => projects.projects,
    settings: () => settings,
    named: (projectId, folderName) => {
      projects = setFilesFolder(projects, projectId, folderName)
      changed({ projects: true })
    },
    openFiles: filePaths,
    listed: push,
  })
  for (const w of layout.windows) createBrowserWindow(w.id)
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

function addTransientTab(windowId: string, title: string, tooltip: string, after?: string): string {
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) throw new Error(`no window ${windowId}`)
  const tab: Tab = { kind: 'transient', id: newId(), project: w.shown }
  const at = after ? w.tabs.findIndex((x) => x.id === after) + 1 : 0
  const tabs = at > 0 ? [...w.tabs.slice(0, at), tab, ...w.tabs.slice(at)] : [...w.tabs, tab]
  putWindow({ ...w, tabs, selected: { ...w.selected, [w.shown]: tab.id } })
  tabLabels.set(tab.id, { title, tooltip })
  return tab.id
}

// A new session in a tab of its own, selected: last in the strip, or right after `after`.
async function startNewSession(
  windowId: string,
  shown: string,
  action: Extract<Action, { type: 'startNew' }>,
  after?: string,
): Promise<ActionResult> {
  if (!statSafeDir(action.folder)) return { refusal: 'newSession.folderGone' }
  const name = action.name.trim()
  const id = kitOf(action.agent).ids.newId()
  const tab = addTransientTab(
    windowId,
    name || basename(action.folder),
    t('tab.tooltipNew', { agent: agentName(action.agent), cwd: action.folder }),
    after,
  )
  await rememberFolder(action.folder)
  await sessions.updateState((state) => withSetting(state, 'last_agent', action.agent))
  // With the switch on, the id joins the list at once, before Claude has created the session.
  if (action.remoteControl && id) {
    await sessions.updateState((state) => setRemoteControl(state, id, true))
    remoteIds.add(id)
  }
  const start: Start = {
    kind: 'new',
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
  }
  const promptFile = id && action.prompt ? await savePrompt(randomUUID(), action.prompt) : undefined
  if (id && action.orchestrator) {
    // A member at once, as start_session's sessions are, so the mark has a session to name.
    if (name) startedNames.set(id, name)
    const project = projects.projects.find((p) => p.id === shown)
    const before = project ? orchestrationInfo(project).orchestrator : null
    projects = setOrchestrator(addMember(projects, shown, id), shown, id)
    orchestratorMarkMoved(shown, before)
  }
  await startPane(tab, {
    agent: action.agent,
    start,
    cwd: action.folder,
    sessionId: null,
    pending: newSessionPending(windowId, action.folder, id, action.agent),
    ...(action.remoteControl && id ? { remote: remoteName(name, action.folder, id) } : {}),
    ...(promptFile ? { promptFile } : {}),
  })
  changed({ projects: Boolean(id && action.orchestrator) })
  return {}
}

function newSessionPending(
  windowId: string,
  folder: string,
  expectedId: string | null,
  agent: AgentId,
): Pending {
  const shown = layout.windows.find((x) => x.id === windowId)?.shown ?? projects.current
  const told = expectedId === null && mainKitOf(agent).bind !== null
  return {
    startedIn: shown,
    expectedId,
    folder,
    startedAt: now(),
    tries: 0,
    ...(told ? { told } : {}),
  }
}

export async function runAction(contents: WebContents, action: Action): Promise<ActionResult> {
  const refusal = refusalFor(action, startedIds())
  if (refusal) return { refusal }
  const windowId = windowIdOf(contents)
  if (!windowId) return {}
  const w = layout.windows.find((x) => x.id === windowId)
  if (!w) return {}
  switch (action.type) {
    case 'switchProject': {
      const outcome = switchProject(layout, windowId, action.project)
      if (outcome.kind === 'focus' && action.ask) return { value: 'held' }
      if (outcome.kind === 'focus') windows.get(outcome.window)?.focus()
      if (outcome.kind === 'shown') {
        layout = outcome.layout
        recentProjects = touched(recentProjects, action.project)
        projects = setCurrent(projects, action.project)
        changed({ projects: true })
      }
      return {}
    }
    case 'bringProject': {
      const ids = projects.projects.map((p) => p.id)
      const outcome = bringProject(layout, windowId, action.project, recentProjects, ids)
      if (outcome.kind === 'refused') return { refusal: outcome.refusal }
      layout = outcome.layout
      recentProjects = touched(recentProjects, action.project)
      projects = setCurrent(projects, action.project)
      notifySeen()
      changed({ projects: true })
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
      const folder = await renameFolder(action.project, action.name).catch((error: unknown) => {
        log.warn('a project files folder was not renamed', { project: action.project, error })
        return undefined
      })
      const renamed = folder ? renameProject(projects, action.project, action.name, folder) : result
      projects = renamed.ok ? renamed.projects : result.projects
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
      const opened = openSession(layout, projects, windowId, action.session, newId, {
        pin: action.pin === true,
        worker: mayHide,
      })
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
    case 'collapseGroup': {
      projects = setCollapsed(projects, action.project, action.group, action.collapsed)
      changed({ projects: true })
      return {}
    }
    case 'bringFiles': {
      const incoming = incomingFolder()
      const paths = action.paths ?? (await chooseIncoming(contents))
      // From the newest menu, only files of the incoming folder itself.
      if (action.paths && action.paths.some((p) => dirname(p) !== incoming)) return {}
      const brought = await bringIn(w.shown, paths)
      return brought ? { brought } : {}
    }
    case 'newestIncoming':
      return { incoming: await newestIncoming() }
    case 'undoBring':
      await undoBring(action.undo)
      return {}
    case 'openFilesFolder':
      await openProjectFolder(w.shown)
      return {}
    case 'openProjectFile': {
      const path = projectFilePath(w.shown, action.name)
      if (!path) return {}
      if (action.with !== 'system') {
        const refusal = await openFileTab(windowId, path)
        if (!refusal) return {}
        if (action.with === 'menkar') return { refusal }
      }
      await openWithSystem(path)
      return {}
    }
    case 'checkProjectFile': {
      const path = projectFilePath(w.shown, action.name)
      if (!path) return { refusal: 'files.unreadable' }
      const checked = await checkFile(path, homedir(), skillsPluginDir())
      return 'refusal' in checked ? { refusal: checked.refusal } : {}
    }
    case 'dragProjectFile':
      await dragProjectFile(contents, w.shown, action.name)
      return {}
    case 'trashProjectFile': {
      const path = projectFilePath(w.shown, action.name)
      if (!path) return {}
      const tabs = layout.windows.flatMap((lw) =>
        lw.tabs.filter((tab) => tab.kind === 'file' && tab.path === path),
      )
      if (!action.force && isDirty(path) && tabs.some((tab) => tab.kind === 'file' && !tab.preview))
        return { unsaved: [basename(path)], value: path }
      if (!(await trashProjectFile(path))) return { refusal: 'files.notTrashed' }
      for (const tab of tabs) closeTab(tab.id)
      return {}
    }
    case 'collapseFiles':
      projects = setFilesCollapsed(projects, w.shown, action.collapsed)
      changed({ projects: true })
      return {}
    case 'setWorkersCap':
      projects = setWorkersCap(projects, action.project, action.cap)
      changed({ projects: true })
      return {}
    case 'setPresence':
      askPresence(action.away ?? !presence.away)
      return {}
    case 'presenceNotYet':
      settle(notYet(presence, now()))
      return {}
    case 'addProjectFolder':
      if (!isAbsoluteFolder(action.folder) || !(await isFolder(action.folder))) return {}
      projects = addFolder(projects, action.project, action.folder)
      changed({ projects: true })
      return {}
    case 'removeProjectFolder':
      projects = removeFolder(projects, action.project, action.folder)
      changed({ projects: true })
      return {}
    case 'setOrchestrationMode':
      projects = setMode(projects, action.project, action.on)
      changed({ projects: true })
      return {}
    case 'setTaskStar': {
      const next = setTaskStar(currentTasks(), w.shown, action.number, action.on, topicsNow())
      if (next) {
        setTasks(next)
        changed()
      }
      return {}
    }
    case 'configureRole':
      return configureRole(action)
    case 'setOrchestrator':
    case 'setRole':
    case 'setWithYou': {
      const project = projectOf(projects, action.session)
      if (!project) return {}
      const before = orchestrationInfo(project).orchestrator
      projects = marked(projects, project.id, action)
      orchestratorMarkMoved(project.id, before)
      changed({ projects: true })
      return {}
    }
    // Decision 1.101: the orchestrator hears who has the session, through the wakes' messaging.
    case 'takeControl':
    case 'handBack': {
      const project = projectOf(projects, action.session)
      const orchestrator = project ? orchestrationInfo(project).orchestrator : null
      if (!project || !orchestrator) return {}
      projects = setWithYou(projects, project.id, action.session, action.type === 'takeControl')
      changed({ projects: true })
      const name = sessionName(action.session)
      const text =
        action.type === 'takeControl'
          ? `The human took control of ${name}`
          : `The human handed ${name} back`
      if (inboxOrchestrator(project) === orchestrator)
        inboxes.add(project.id, `control:${action.session}`, text)
      else if (wakeable(paneOfSession(orchestrator)))
        wakes.post(orchestrator, `control:${action.session}`, text)
      return {}
    }
    case 'setManaged': {
      const project = projects.projects.find((p) => p.id === w.shown)
      const orchestrator = project ? orchestrationInfo(project).orchestrator : null
      if (!orchestrator) return {}
      for (const session of action.sessions)
        if (session !== orchestrator)
          projects = action.on
            ? setParent(projects, session, orchestrator)
            : clearParent(projects, session)
      changed({ projects: true })
      return {}
    }
    case 'seeTopic':
      seeTopic(w.shown, action.number)
      changed()
      return {}
    case 'showTopic':
      showTopic(action.project, action.number)
      return {}
    case 'setConsultantsCollapsed':
      projects = setConsultantsCollapsed(projects, w.shown, action.collapsed)
      changed({ projects: true })
      return {}
    case 'setOrchestratorCollapsed':
      projects = setOrchestratorCollapsed(projects, w.shown, action.collapsed)
      changed({ projects: true })
      return {}
    case 'setOthersCollapsed':
      projects = setOthersCollapsed(projects, w.shown, action.collapsed)
      changed({ projects: true })
      return {}
    case 'setDoneTodayOpen':
      projects = setDoneTodayOpen(projects, w.shown, action.open)
      changed({ projects: true })
      return {}
    case 'setBoard':
      projects = setBoard(projects, w.shown, action)
      changed({ projects: true })
      return {}
    case 'selectSessionTab': {
      const pane = paneOfSession(action.session)
      if (pane) revealPane(pane.id)
      return {}
    }
    case 'setTopicsCollapsed':
      projects = setTopicsCollapsed(projects, w.shown, action.collapsed)
      changed({ projects: true })
      return {}
    case 'discussTopic': {
      const updated = updateTopic(
        currentTopics(),
        w.shown,
        action.number,
        { status: 'discussing' },
        topicsNow(),
      )
      if (!updated) return {}
      setTopics(updated.topics)
      seeTopic(w.shown, action.number)
      const project = projects.projects.find((p) => p.id === w.shown)
      const orchestrator = project ? orchestrationInfo(project).orchestrator : null
      const pane = orchestrator ? paneOfSession(orchestrator) : undefined
      const tab = pane ? w.tabs.find((x) => x.id === pane.tabId) : undefined
      if (tab) putWindow({ ...w, selected: { ...w.selected, [tab.project]: tab.id } })
      const text = `The human wants to discuss topic ${action.number}`
      const key = `topic:${action.number}`
      const hasInbox = !!project && !!orchestrator && inboxOrchestrator(project) === orchestrator
      // Through the project's key, a wake that cannot be delivered falls back to the inbox.
      if (orchestrator && wakeable(pane))
        wakes.post(
          hasInbox && project ? `${ORCHESTRATOR_OF}${project.id}` : orchestrator,
          key,
          text,
        )
      else if (hasInbox && project) inboxes.add(project.id, key, text)
      notifySeen()
      changed()
      return {}
    }
    case 'openPaneFolder': {
      const tab = tabById(action.tab)
      const list = (tabPanes.get(action.tab) ?? []).flatMap((id) => {
        const pane = panes.get(id)
        return pane ? [{ id, agent: pane.agent !== 'shell', cwd: pane.cwd }] : []
      })
      const folder = drawerFolder(
        list,
        action.pane,
        tab?.kind === 'file' ? dirname(tab.path) : null,
      )
      return openExistingFolder(folder)
    }
    case 'openSessionFolder':
      return openExistingFolder(sessionInfo(action.session)?.cwd ?? null)
    case 'moveSession': {
      const moved = moveMember(projects, action.session, action.target, action.place)
      if (moved === projects) return {}
      projects = moved
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
    case 'hideSession': {
      const result = hideMember(
        projects,
        action.session,
        paneOfSession(action.session) !== undefined,
      )
      if (!result.ok) return { refusal: result.refusal }
      projects = result.projects
      changed({ projects: true })
      return {}
    }
    case 'showSession':
      projects = showMember(projects, action.session)
      changed({ projects: true })
      return {}
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
    case 'moveTab':
      layout = moveTab(layout, windowId, action.tab, action.before)
      changed()
      return {}
    case 'selectTab': {
      if (w.tabs.some((x) => x.id === action.tab)) selectTabIn(windowId, action.tab)
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
      const hidden = closeOrHide(action.tab)
      return backgroundedResult(hidden === null ? [] : [hidden])
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
      await openLink(windowId, action.url, action.system)
      return {}
    case 'openTerminalPath':
      await openTerminalPath(windowId, action.path, action.system)
      return {}
    case 'closeAllTabs':
      return backgroundedResult(w.tabs.flatMap((tab) => closeOrHide(tab.id) ?? []))
    case 'closeOtherTabs':
      return backgroundedResult(
        w.tabs.flatMap((tab) => (tab.id === action.tab ? [] : (closeOrHide(tab.id) ?? []))),
      )
    case 'pinTab': {
      const tw = windowOfTab(action.tab)
      if (!tw) return {}
      layout = pin(layout, tw.id, action.tab)
      notifySeen()
      changed()
      return {}
    }
    case 'toggleDrawer': {
      const tabId = shownTab(w)
      if (!tabId) return {}
      if (!action.folder && drawers.ofTab(tabId) !== undefined && drawerShown.has(tabId))
        drawerShown.delete(tabId)
      else {
        openDrawer(tabId, action.pane ?? null, action.folder)
        drawerShown.add(tabId)
      }
      changed()
      return {}
    }
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
    case 'startNew':
      return startNewSession(windowId, w.shown, action)
    case 'askAboutFile': {
      const tab = tabById(action.tab)
      if (tab?.kind !== 'file') return {}
      const paneTab = action.pane ? tabOfPane(action.pane) : undefined
      const paneList = paneTab ? drawerPanes(paneTab) : []
      const folder =
        drawerFolder(paneList, action.pane ?? null, dirname(tab.path)) ?? dirname(tab.path)
      return startNewSession(
        windowId,
        w.shown,
        {
          type: 'startNew',
          agent: DEFAULT_AGENT,
          folder,
          name: askName(basename(tab.path), takenNames(w.shown)),
          prompt: t('files.askPrompt', { path: tab.path }),
        },
        tab.id,
      )
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
    case 'setRemoteControl': {
      await sessions.updateState((state) => setRemoteControl(state, action.session, action.on))
      if (action.on) remoteIds.add(action.session)
      else remoteIds.delete(action.session)
      const pane = paneOfSession(action.session)
      changed()
      // Nothing is typed: a running session connects at its next start, or when the user types /rc.
      return action.on && pane?.terminal.running && !pane.remote ? { value: 'toast' } : {}
    }
    case 'setMuted': {
      await sessions.updateState((state) => setMuted(state, action.session, action.on))
      if (action.on) mutedIds.add(action.session)
      else mutedIds.delete(action.session)
      changed()
      return {}
    }
    case 'forkSession': {
      const info = sessionInfo(action.session)
      const kit = info ? kitOf(info.agent) : null
      const id = kit?.fork ? kit.ids.newId() : null
      if (!info || !kit?.fork || !id) return {}
      const tab = addTransientTab(
        windowId,
        t('tab.fork', { name: info.name }),
        t('tab.tooltipSession', { folder: basename(info.cwd ?? info.folder), id: action.session }),
      )
      await startPane(tab, {
        agent: info.agent,
        start: kit.fork.plan(action.session, id),
        cwd: info.cwd,
        sessionId: null,
        pending: newSessionPending(windowId, info.cwd ?? '', id, info.agent),
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
      await finishClose(windowId)
      return {}
    case 'cancelClose':
      return {}
    case 'copyText':
      clipboard.writeText(action.text)
      return {}
    case 'splitPane': {
      const ids = tabPanes.get(action.tab) ?? []
      const tab = tabById(action.tab)
      if (!tab || tab.kind === 'file' || ids.length === 0) return {}
      if (ids.length >= 2) return { refusal: 'layout.twoPanesMax' }
      const tw = windowOfTab(action.tab)
      if (tab.kind === 'session' && tab.place !== undefined && tw)
        layout = pin(layout, tw.id, action.tab)
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
      if ((tabPanes.get(pane.tabId) ?? []).length > 1) {
        pane.terminal.hangUp()
        return {}
      }
      const hidden = closeOrHide(pane.tabId)
      return backgroundedResult(hidden === null ? [] : [hidden])
    }
    case 'refreshSessions':
      await sessions.refresh()
      return {}
    case 'sessionDetails': {
      const info = sessionInfo(action.session)
      if (!info) return {}
      const [read, tokens] = await Promise.all([
        kitOf(info.agent).catalog.details(info.file),
        sessionTokens(info.id),
      ])
      return {
        details: read,
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
          await kitOf(info.agent).catalog.exportMarkdown(info.name, info.id, info.file),
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
      const place = info ? kitOf(info.agent).catalog.location(info.file) : null
      if (place) shell.showItemInFolder(place)
      return {}
    }
    case 'trashSession':
    case 'deleteSession': {
      // The only writes in an agent's data, each started and confirmed by the user: the file its
      // catalog names.
      const info = sessionInfo(action.session)
      if (!info) return { refusal: 'sessions.gone' }
      const failed =
        action.type === 'trashSession' ? 'sessions.trashFailed' : 'sessions.deleteFailed'
      const trash = kitOf(info.agent).catalog.trash
      if (!trash) return { refusal: failed }
      const target = trash.target(info.file)
      try {
        if (action.type === 'trashSession') await shell.trashItem(target)
        else await unlink(target)
      } catch (error) {
        log.error('a transcript could not be removed', {
          path: target,
          action: action.type,
          error,
        })
        return { refusal: failed }
      }
      const pane = paneOfSession(action.session)
      if (pane) await runAction(contents, { type: 'stopSession', session: action.session })
      projects = forgetSession(projects, action.session)
      changed({ projects: true })
      if (savedAgents[action.session] !== undefined)
        await sessions.updateState((state) => withSessionAgent(state, action.session, null))
      await sessions.refresh()
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
      // Picking a hidden member of this project shows it again rather than adding it twice.
      projects = releaseEarlier(showMember(moved.projects, action.session), action.session)
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
    case 'listActiveProjects':
      return { active: activeProjects(layout, projects, recentProjects, windowId) }
    case 'revealTab': {
      const tw = windowOfTab(action.tab)
      const tab = tabById(action.tab)
      if (!tw || !tab) return {}
      selectTabIn(tw.id, tab.id)
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
      titleBars.set(windowId, {
        color: action.color,
        symbolColor: action.symbolColor,
        height: action.height,
      })
      applyTitleBar(windowId)
      return {}
    case 'openSettings':
      openSettings(action.section)
      return {}
    case 'openUsage': {
      const parent = windows.get(windowId)
      if (parent) openUsage(parent)
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

function setOrientation(tabId: string, orientation: 'horizontal' | 'vertical'): void {
  const tab = tabById(tabId)
  if (tab?.kind === 'session')
    replaceTab(tabId, (t) => (t.kind === 'session' ? { ...t, orientation } : t))
  else tabOrientation.set(tabId, orientation)
}
