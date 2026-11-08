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
}

export interface WindowState {
  readonly windowId: string
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
  | { readonly type: 'renameSession'; readonly session: string; readonly name: string }
  | { readonly type: 'renameTab'; readonly tab: string; readonly title: string }
  | { readonly type: 'selectTab'; readonly tab: string }
  | { readonly type: 'closeTab'; readonly tab: string }
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
    }
  | { readonly type: 'continueLast'; readonly agent: 'claude' | 'cursor' }
  | { readonly type: 'forkSession'; readonly session: string }
  | { readonly type: 'pickFolder' }
  | { readonly type: 'dismissNotice'; readonly index: number }
  | { readonly type: 'confirmClose' }
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
}
