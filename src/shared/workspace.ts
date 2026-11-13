// What a window shows and what it may ask for: the protocol between main's workspace and a
// window's renderer. Types only.
import type { Reading } from '../core/context/types'
import type { Key } from '../core/i18n'
import type { TaskState } from '../core/orchestration/taskState'
import type { SettingsSection } from '../core/preferences'
import type { ActiveProject, Notice, ProjectInfo } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'
import type { Details } from '../core/sessions/transcript'
import type { Settings } from '../core/settings'

export type PaneAgent = 'claude' | 'cursor' | 'shell'

export interface PaneView {
  readonly id: string
  readonly agent: PaneAgent
  readonly sessionId: string | null
  readonly remote?: boolean
  // The folder the pane's process started in, when known.
  readonly cwd?: string | null
}

export interface TabView {
  readonly id: string
  readonly project: string
  readonly kind: 'session' | 'file' | 'transient' | 'board'
  readonly title: string
  readonly tooltip: string
  readonly panes: readonly PaneView[]
  readonly orientation: 'horizontal' | 'vertical'
  // The group's color when every session in the tab is in that one group.
  readonly groupColor: string | null
  // A file tab's resolved path, whether it is the Markdown preview, and whether an editor tab's
  // buffer has unsaved edits.
  readonly file?: { readonly path: string; readonly preview: boolean; readonly unsaved: boolean }
  // A chat tab's chat id (plan 14): never saved, never a member, no confirmation.
  readonly chat?: string
  // The shell under the tab's panes (decision 1.29), while it runs: its id on the pty channels,
  // whether it is shown, and its label. Never saved.
  readonly drawer?: { readonly id: string; readonly shown: boolean; readonly label: string }
}

// A file in a project's files folder (decision 1.51), newest first.
export interface ProjectFile {
  readonly name: string
  readonly mtimeMs: number
}

export interface IncomingFile extends ProjectFile {
  readonly path: string
}

// An open topic of the shown project, in the order the Topics section shows it.
export interface TopicView {
  readonly number: number
  readonly title: string
  readonly context: string
  // The name of the session that raised it.
  readonly from: string
  readonly blocking: boolean
  readonly status: 'open' | 'discussing'
  // It belongs to a task with the ★.
  readonly star: boolean
}

// A task of the shown project (decision 1.113).
export interface TaskView {
  readonly number: number
  readonly title: string
  // null until a worker is started for it.
  readonly assignee: string | null
  readonly assigneeName: string
  readonly star: boolean
  readonly state: TaskState
  readonly steps: readonly string[]
  readonly step: number
  readonly note: string
  readonly waitingOn?: string
}

// "Done today" (decision 1.115): a topic closed or a task done since local midnight.
export interface DoneView {
  readonly kind: 'topic' | 'task'
  readonly number: number
  readonly title: string
}

export interface TasksView {
  // ★ first, then by number.
  readonly open: readonly TaskView[]
  // Closed since local midnight, newest first; `closedBefore` the older ones, newest first.
  readonly closedToday: readonly TaskView[]
  readonly closedBefore: readonly TaskView[]
  // Each session's current task, by number.
  readonly current: Readonly<Record<string, number>>
}

export interface WindowState {
  readonly windowId: string
  // The user's home folder, for paths shown as ~/…
  readonly home: string
  readonly settings: Settings
  readonly shown: string
  readonly projects: readonly ProjectInfo[]
  // Projects another window holds, with that window's id.
  readonly heldElsewhere: Readonly<Record<string, string>>
  readonly tabs: readonly TabView[]
  readonly selectedTab: string | null
  readonly sessions: readonly SessionInfo[]
  // Sessions whose agent is in the foreground of their pane.
  readonly running: readonly string[]
  // Sessions that have a pane (a tab) in any window.
  readonly open: readonly string[]
  // The context reading of each member session of the shown project that has one.
  readonly readings: Readonly<Record<string, Reading>>
  readonly notices: readonly Notice[]
  // The agents whose CLI is on the PATH.
  readonly agents: readonly ('claude' | 'cursor')[]
  // Sessions with Remote Control on.
  readonly remoteControl: readonly string[]
  // Sessions muted by hand: no sound, toast or desktop notice.
  readonly muted: readonly string[]
  readonly ghostty: boolean
  // Maximized or full screen: the window's edge is the screen's.
  readonly maximized: boolean
  // The first scan of the agents' folders has not ended: the list and the saved tabs are coming.
  readonly sessionsLoading: boolean
  // The shown project's files folder: its files, and whether the section is collapsed.
  readonly files: { readonly items: readonly ProjectFile[]; readonly collapsed: boolean }
  readonly topics: readonly TopicView[]
  readonly tasks: TasksView
  // Newest first.
  readonly doneToday: readonly DoneView[]
  // The orchestration mode's guide, shipped with Menkar (decision 1.90).
  readonly guidePath: string
}

export type Action =
  // With `ask`, a project another window holds is not brought forward: the answer is 'held'.
  | { readonly type: 'switchProject'; readonly project: string; readonly ask?: boolean }
  | { readonly type: 'bringProject'; readonly project: string }
  | { readonly type: 'createProject'; readonly name: string }
  | { readonly type: 'renameProject'; readonly project: string; readonly name: string }
  | { readonly type: 'deleteProject'; readonly project: string }
  | { readonly type: 'openSession'; readonly session: string }
  | { readonly type: 'openBeside'; readonly session: string }
  | { readonly type: 'stopSession'; readonly session: string }
  | {
      readonly type: 'setGroup'
      readonly session: string
      readonly group: { readonly name: string; readonly color: string } | null
    }
  | { readonly type: 'newGroup'; readonly session: string; readonly name: string }
  // The shown project's files folder (decision 1.51). Without paths, bringing in opens the
  // system's file chooser; with them (from newestIncoming), each must be where shared files arrive.
  | { readonly type: 'bringFiles'; readonly paths?: readonly string[] }
  | { readonly type: 'newestIncoming' }
  | { readonly type: 'undoBring'; readonly undo: string }
  | { readonly type: 'openFilesFolder' }
  // `menkar`: a file tab, or the refusal; `system`: the system's app; neither: a tab when the file
  // check allows one, else the system's app.
  | {
      readonly type: 'openProjectFile'
      readonly name: string
      readonly with?: 'menkar' | 'system'
    }
  | { readonly type: 'checkProjectFile'; readonly name: string }
  | { readonly type: 'dragProjectFile'; readonly name: string }
  // To the system's trash, closing the file's tabs in every window; without `force`, unsaved edits
  // in them come back as `unsaved` to ask first.
  | { readonly type: 'trashProjectFile'; readonly name: string; readonly force?: boolean }
  | { readonly type: 'collapseFiles'; readonly collapsed: boolean }
  // The orchestration mode (decisions 1.77, 1.89): its switch per project, a session's marks, and
  // the shown project's Topics section.
  | { readonly type: 'setOrchestrationMode'; readonly project: string; readonly on: boolean }
  // null: any number of workers at once.
  | { readonly type: 'setWorkersCap'; readonly project: string; readonly cap: number | null }
  | { readonly type: 'setOrchestrator'; readonly session: string; readonly on: boolean }
  | { readonly type: 'setRole'; readonly session: string; readonly label: string }
  | { readonly type: 'setTaskStar'; readonly number: number; readonly on: boolean }
  | { readonly type: 'setWithYou'; readonly session: string; readonly on: boolean }
  | { readonly type: 'setTopicsCollapsed'; readonly collapsed: boolean }
  // The Work view (decisions 1.112, 1.115), saved per project.
  | { readonly type: 'setTeamView'; readonly team: boolean }
  | { readonly type: 'setConsultantsCollapsed'; readonly collapsed: boolean }
  | { readonly type: 'setDoneTodayOpen'; readonly open: boolean }
  // The shown project's Board tab (decision 1.112), opened once per window and then selected.
  | { readonly type: 'openBoard' }
  // Selects the session's tab if it has one; starts nothing.
  | { readonly type: 'selectSessionTab'; readonly session: string }
  | { readonly type: 'discussTopic'; readonly number: number }
  // The focused pane's working folder (the drawer's), or a session's, in the file manager.
  | { readonly type: 'openPaneFolder'; readonly tab: string; readonly pane: string | null }
  | { readonly type: 'openSessionFolder'; readonly session: string }
  | {
      readonly type: 'collapseGroup'
      readonly project: string
      readonly group: string
      readonly collapsed: boolean
    }
  | {
      readonly type: 'moveSession'
      readonly session: string
      readonly target: string
      readonly place: 'before' | 'after'
    }
  | { readonly type: 'removeMember'; readonly session: string }
  | { readonly type: 'hideSession'; readonly session: string }
  | { readonly type: 'showSession'; readonly session: string }
  | { readonly type: 'renameSession'; readonly session: string; readonly name: string }
  | { readonly type: 'renameTab'; readonly tab: string; readonly title: string }
  | { readonly type: 'selectTab'; readonly tab: string }
  | { readonly type: 'moveTab'; readonly tab: string; readonly before: string | null }
  | { readonly type: 'closeTab'; readonly tab: string; readonly force?: boolean }
  | { readonly type: 'closeAllTabs' }
  | { readonly type: 'closeOtherTabs'; readonly tab: string }
  // Shows or hides the selected tab's drawer, starting its shell in the folder of `pane` (the
  // focused one) when it has none.
  // With `folder` (the orchestrator's tab, decision 1.78), a drawer started now starts there.
  | { readonly type: 'toggleDrawer'; readonly pane?: string; readonly folder?: string }
  | { readonly type: 'stepTab'; readonly direction: 1 | -1 }
  | { readonly type: 'nthTab'; readonly n: number }
  | { readonly type: 'newWindow' }
  | { readonly type: 'newWindowWithProject'; readonly name: string }
  | { readonly type: 'setSidebarWidth'; readonly width: number }
  | {
      readonly type: 'startNew'
      readonly agent: 'claude' | 'cursor'
      readonly folder: string
      readonly name: string
      readonly remoteControl?: boolean
      // Its first prompt, as start_session passes one; Claude only.
      readonly prompt?: string
      // Marked as the shown project's orchestrator as it starts (the first-time card); Claude only.
      readonly orchestrator?: boolean
    }
  // "Ask an agent" on a Markdown file tab (decision 1.95); `pane` is the project's focused agent
  // pane, whose folder the session starts in.
  | { readonly type: 'askAboutFile'; readonly tab: string; readonly pane?: string }
  | { readonly type: 'forkSession'; readonly session: string }
  | { readonly type: 'pickFolder' }
  | { readonly type: 'dismissNotice'; readonly index: number }
  | { readonly type: 'confirmClose' }
  | { readonly type: 'cancelClose' }
  | { readonly type: 'openFile'; readonly input: string }
  | { readonly type: 'openFilePath'; readonly path: string }
  | { readonly type: 'pickFile' }
  | { readonly type: 'fileState'; readonly path: string }
  | {
      readonly type: 'fileEdit'
      readonly path: string
      readonly base: number
      readonly changes: unknown
      readonly tab: string
    }
  | { readonly type: 'saveFile'; readonly path: string }
  | { readonly type: 'reloadFile'; readonly path: string }
  | { readonly type: 'keepMine'; readonly path: string }
  | { readonly type: 'saveFiles'; readonly paths: readonly string[] }
  | { readonly type: 'discardFiles'; readonly paths: readonly string[] }
  | { readonly type: 'closeWindowNow' }
  | { readonly type: 'togglePreview'; readonly tab: string }
  | { readonly type: 'openFilesIn'; readonly window: string; readonly paths: readonly string[] }
  | { readonly type: 'setRemoteControl'; readonly session: string; readonly on: boolean }
  | { readonly type: 'setMuted'; readonly session: string; readonly on: boolean }
  // The human unfolded a topic of the shown project; a notice's Show, for any project.
  | { readonly type: 'seeTopic'; readonly number: number }
  // A read-only tab's banner: the session becomes "with you", or goes back to the orchestrator.
  | { readonly type: 'takeControl'; readonly session: string }
  // Decision 1.102: these sessions become the shown project's orchestrator's children, or leave it.
  | { readonly type: 'setManaged'; readonly sessions: readonly string[]; readonly on: boolean }
  | { readonly type: 'handBack'; readonly session: string }
  | { readonly type: 'showTopic'; readonly project: string; readonly number: number }
  | {
      readonly type: 'continueInChat'
      readonly session: string
      readonly key: 'default' | 'ask' | 'trusted'
    }
  | { readonly type: 'openInGhostty'; readonly session: string }
  | { readonly type: 'openExternal'; readonly url: string }
  // A plain path a terminal printed, as printed (`~/…` included).
  | { readonly type: 'openTerminalPath'; readonly path: string }
  | { readonly type: 'copyText'; readonly text: string }
  | {
      readonly type: 'splitPane'
      readonly tab: string
      readonly orientation: 'horizontal' | 'vertical'
    }
  | { readonly type: 'closePane'; readonly pane: string }
  | { readonly type: 'swapOrientation'; readonly tab: string }
  | { readonly type: 'listTabs' }
  | { readonly type: 'listActiveProjects' }
  | { readonly type: 'pickSession'; readonly session: string }
  | { readonly type: 'checkFolder'; readonly folder: string }
  | { readonly type: 'refreshSessions' }
  | { readonly type: 'sessionDetails'; readonly session: string }
  | { readonly type: 'exportSession'; readonly session: string }
  | { readonly type: 'revealTranscript'; readonly session: string }
  | { readonly type: 'trashSession'; readonly session: string }
  | { readonly type: 'deleteSession'; readonly session: string }
  | { readonly type: 'revealTab'; readonly tab: string }
  | {
      readonly type: 'titleBar'
      readonly color: string
      readonly symbolColor: string
      readonly height: number
    }
  | { readonly type: 'toggleMaximize' }
  | { readonly type: 'openSettings'; readonly section?: SettingsSection }
  | { readonly type: 'openUsage' }

// One tab of any window, for Go to agent.
export interface TabEntry {
  readonly window: string
  readonly tab: string
  readonly projectName: string
  readonly title: string
  readonly kind: 'session' | 'file' | 'transient' | 'board'
  readonly agent: PaneAgent | null
  readonly panes: readonly string[]
}

export interface ActionResult {
  readonly refusal?: Key
  readonly brought?: { readonly undo: string; readonly names: readonly string[] }
  readonly incoming?: readonly IncomingFile[]
  readonly value?: string | null
  readonly tabs?: readonly TabEntry[]
  readonly active?: readonly ActiveProject[]
  readonly details?: Details
  // The session's tokens from the usage history (deduplicated), when it holds any.
  readonly tokens?: { readonly input: number; readonly output: number; readonly cacheRead: number }
  readonly file?: FileState
  // Closing would lose unsaved edits: the files' names, to ask first.
  readonly unsaved?: readonly string[]
}

export interface FileState {
  readonly path: string
  readonly text: string
  readonly version: number
  readonly dirty: boolean
  readonly readOnly: Key | null
  readonly bar: 'changed' | 'deleted' | null
}

export interface FileUpdate extends FileState {
  readonly changes?: unknown
  readonly origin?: string
}
