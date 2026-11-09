// What a window shows and what it may ask for: the protocol between main's workspace and a
// window's renderer. Types only.
import type { Reading } from '../core/context/types'
import type { Key } from '../core/i18n'
import type { Notice, ProjectInfo } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'
import type { Details, Turn } from '../core/sessions/transcript'
import type { Settings } from '../core/settings'

export type PaneAgent = 'claude' | 'cursor' | 'shell'

export interface PaneView {
  readonly id: string
  readonly agent: PaneAgent
  readonly sessionId: string | null
  readonly remote?: boolean
}

export interface TabView {
  readonly id: string
  readonly project: string
  readonly kind: 'session' | 'file' | 'transient'
  readonly title: string
  readonly tooltip: string
  readonly panes: readonly PaneView[]
  readonly orientation: 'horizontal' | 'vertical'
  // The group's color when every session in the tab is in that one group.
  readonly groupColor: string | null
  // A replay tab's turns (read once, whole).
  readonly replay?: readonly Turn[]
  // A file tab's resolved path, whether it is the Markdown preview, and whether an editor tab's
  // buffer has unsaved edits.
  readonly file?: { readonly path: string; readonly preview: boolean; readonly unsaved: boolean }
  // A chat tab's chat id (plan 14): never saved, never a member, no confirmation.
  readonly chat?: string
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
  // Every window's tab count, for "Close all tabs" (shown with two or more).
  readonly tabCount: number
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
  readonly ghostty: boolean
  // Maximized or full screen: the window's edge is the screen's.
  readonly maximized: boolean
}

export type Action =
  | { readonly type: 'switchProject'; readonly project: string }
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
  | { readonly type: 'removeMember'; readonly session: string }
  | { readonly type: 'hideSession'; readonly session: string }
  | { readonly type: 'showSession'; readonly session: string }
  | { readonly type: 'renameSession'; readonly session: string; readonly name: string }
  | { readonly type: 'renameTab'; readonly tab: string; readonly title: string }
  | { readonly type: 'selectTab'; readonly tab: string }
  | { readonly type: 'moveTab'; readonly tab: string; readonly before: string | null }
  | { readonly type: 'closeTab'; readonly tab: string; readonly force?: boolean }
  | { readonly type: 'closeAllTabs' }
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
      readonly model?: string
      readonly mode?: string
      readonly addDir?: string
      readonly remoteControl?: boolean
    }
  | { readonly type: 'continueLast'; readonly agent: 'claude' | 'cursor' }
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
  | {
      readonly type: 'newChat'
      readonly agent: 'claude' | 'cursor'
      readonly key: 'default' | 'ask' | 'trusted'
    }
  | {
      readonly type: 'continueInChat'
      readonly session: string
      readonly key: 'default' | 'ask' | 'trusted'
    }
  | { readonly type: 'openInGhostty'; readonly session: string }
  | { readonly type: 'openMcpServers' }
  | { readonly type: 'openExternal'; readonly url: string }
  | { readonly type: 'copyText'; readonly text: string }
  | {
      readonly type: 'splitPane'
      readonly tab: string
      readonly orientation: 'horizontal' | 'vertical'
    }
  | { readonly type: 'closePane'; readonly pane: string }
  | { readonly type: 'swapOrientation'; readonly tab: string }
  | { readonly type: 'listTabs' }
  | { readonly type: 'pickSession'; readonly session: string }
  | { readonly type: 'checkFolder'; readonly folder: string }
  | { readonly type: 'refreshSessions' }
  | { readonly type: 'sessionDetails'; readonly session: string }
  | { readonly type: 'exportSession'; readonly session: string }
  | { readonly type: 'revealTranscript'; readonly session: string }
  | { readonly type: 'trashSession'; readonly session: string }
  | { readonly type: 'deleteSession'; readonly session: string }
  | { readonly type: 'replaySession'; readonly session: string }
  | { readonly type: 'openSessionFile' }
  | { readonly type: 'revealTab'; readonly tab: string }
  | {
      readonly type: 'titleBar'
      readonly color: string
      readonly symbolColor: string
      readonly height: number
    }
  | { readonly type: 'toggleMaximize' }
  | { readonly type: 'openPreferences' }
  | { readonly type: 'openUsage' }
  | { readonly type: 'openAbout' }

// One tab of any window, for Go to agent.
export interface TabEntry {
  readonly window: string
  readonly tab: string
  readonly projectName: string
  readonly title: string
  readonly kind: 'session' | 'file' | 'transient'
  readonly agent: PaneAgent | null
  readonly panes: readonly string[]
}

export interface ActionResult {
  readonly refusal?: Key
  readonly value?: string | null
  readonly tabs?: readonly TabEntry[]
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
