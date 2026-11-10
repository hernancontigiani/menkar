// Every IPC channel and its payload, declared once and imported by main, preload and renderer.

import type { AgentStates } from '../core/agentstate/shown'
import type { McpSection } from '../core/chat/mcp'
import type { Reply } from '../core/chat/model'
import type { ChatEvent } from '../core/chat/protocol'
import type { ChatAgent, VariantKey } from '../core/chat/variants'
import type { Reading, RetentionStatus } from '../core/context/types'
import type { Key, Language, Messages } from '../core/i18n'
import type { PreferenceKey, SettingsSection } from '../core/preferences'
import type { ProjectsSnapshot } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'
import type { Settings } from '../core/settings'
import type { UsageView, UsageWhich } from '../core/usage/nodes'
import type { Action, ActionResult, FileUpdate, WindowState } from './workspace'

export type { ProjectsSnapshot, SessionInfo }

export interface Catalog {
  readonly language: Language
  readonly messages: Messages
}

// What a chat tab needs to know about its chat.
export interface ChatInfo {
  readonly agent: ChatAgent
  readonly key: VariantKey
  readonly continuing: boolean
  readonly title: string
  readonly tooltip: string
}

// What Preferences shows besides the settings: the language the app started in (a change waits for
// a restart), the languages it ships, the installed monospace fonts, the app's version.
export interface PreferencesInfo {
  readonly settings: Settings
  readonly startLanguage: string
  readonly languages: readonly { readonly code: string; readonly name: string }[]
  readonly fonts: readonly string[]
  readonly version: string
}

// The classification's state for the Integrations page: the switch, the line under it, and the
// earlier-turns run's progress ("30 of 75") while one runs.
export interface ClassifierStatus {
  readonly on: boolean
  readonly status: string
  readonly progress: string | null
}

// Restart now with unsaved file edits: first asked, then saved or discarded by the user's answer.
export type RestartUnsaved = 'ask' | 'save' | 'discard'
export type RestartAnswer =
  | { readonly restarting: true }
  | { readonly restarting: false; readonly unsaved: readonly string[] }
  | { readonly restarting: false; readonly notSaved: string; readonly refusal: Key }

// Renderer → main, answered.
export interface InvokeChannels {
  // Preferences (plan 12): the settings and what the page offers; one row's value; restart.
  'settings:get': { request: undefined; response: PreferencesInfo }
  'settings:set': {
    request: { key: PreferenceKey; value: string | number | boolean }
    response: Settings
  }
  'app:restart': { request: { unsaved: RestartUnsaved }; response: RestartAnswer }
  // Chat tabs (plan 14): installed agents, a chat's facts, a message, a permission's answer, Stop.
  'chat:agents': { request: undefined; response: readonly ChatAgent[] }
  'chat:info': { request: { chatId: string }; response: ChatInfo | null }
  'chat:send': { request: { chatId: string; text: string }; response: undefined }
  'chat:reply': { request: { chatId: string; reply: Reply; declined: string }; response: undefined }
  'chat:stop': { request: { chatId: string }; response: undefined }
  // The MCP servers browser (plan 14): ~/.claude.json read once, when it opens.
  'mcp:sections': { request: undefined; response: readonly McpSection[] }
  // The Usage window (plan 12): a pass, then the period's figures, for the opener window's project
  // unless every project is asked for.
  'usage:view': { request: { which: UsageWhich; allProjects: boolean }; response: UsageView }
  // About's two links, opened in the system browser only when clicked.
  'app:open-link': { request: { link: 'website' | 'issues' }; response: undefined }
  // The status line in every Claude session: on when installed and still as written; a refused
  // change comes back with our sentence.
  'integrations:statusline': { request: undefined; response: { on: boolean } }
  'integrations:set-statusline': {
    request: { on: boolean }
    response: { on: boolean; error: string | null }
  }
  // Transcript retention (cleanupPeriodDays), the same shape as the status line.
  'integrations:retention': {
    request: undefined
    response: { on: boolean; status: RetentionStatus }
  }
  'integrations:set-retention': {
    request: { on: boolean }
    response: { on: boolean; error: string | null }
  }
  // Classification (plan 10): the switch, its status, the earlier-turns estimate, run and stop.
  'classifier:status': { request: undefined; response: ClassifierStatus }
  'classifier:set': { request: { on: boolean }; response: ClassifierStatus }
  'classifier:estimate': {
    request: { day: string }
    response: { turns: number; lines: readonly string[] }
  }
  'classifier:classify-earlier': { request: { day: string }; response: undefined }
  'classifier:stop': { request: undefined; response: undefined }
  'window:state': { request: undefined; response: WindowState | null }
  'window:action': { request: Action; response: ActionResult }
  'pty:attach': { request: { pane: string }; response: { buffer: string; end: number } }
  'i18n:catalog': { request: undefined; response: Catalog }
  'sessions:list': { request: undefined; response: readonly SessionInfo[] }
  'projects:get': { request: undefined; response: ProjectsSnapshot }
  'sessions:set-hidden': {
    request: { ids: readonly string[]; hidden: boolean }
    response: undefined
  }
}

// Renderer → main, fire and forget.
export interface SendChannels {
  'pty:input': { pane: string; data: string }
  'pty:resize': { pane: string; cols: number; rows: number }
  'panes:reveal': { paneId: string }
}

// Main → renderer.
export interface EventChannels {
  'window:state': WindowState
  // The names of the running sessions, when closing the window must ask first.
  'window:confirm-close': readonly string[]
  // Closing the window would lose unsaved edits in these files (their every editor tab is here).
  'window:confirm-unsaved': { readonly paths: readonly string[]; readonly names: readonly string[] }
  // A file's buffer changed (an edit elsewhere, a save, a change on disk).
  'file:update': FileUpdate
  // `menkar open` with several windows: the active one asks which.
  'files:which-window': {
    readonly paths: readonly string[]
    readonly names: readonly string[]
    readonly choices: readonly { readonly window: string; readonly label: string }[]
  }
  'files:refused': readonly { readonly name: string; readonly reason: Key }[]
  'pty:data': { readonly pane: string; readonly data: string; readonly end: number }
  // The whole list, after every rescan and every change to the app's names or hidden set.
  'sessions:changed': readonly SessionInfo[]
  // Agent state and context (plan 09): every pane's shown state and every project's blocked
  // count, to every window, whenever one changes.
  'agentState:changed': AgentStates
  // An agent the user is not watching finished or needs them, in the focused window: its toast.
  'agentState:toast': { readonly paneId: string; readonly text: string }
  // What a chat's process said (plan 14); `ended`: Claude's process exited.
  'chat:event': { readonly chatId: string; readonly event: ChatEvent | { readonly kind: 'ended' } }
  // A setting changed (plan 12): Menkar's own windows re-apply the look.
  'settings:changed': Settings
  // The open Settings window was asked for again, on this section.
  'settings:section': SettingsSection
  // A session's context reading changed (null: no reading, no ring).
  'context:reading': { readonly sessionId: string; readonly reading: Reading | null }
}

export type InvokeChannel = keyof InvokeChannels
export type SendChannel = keyof SendChannels
export type EventChannel = keyof EventChannels

// The object the preload exposes on `window.menkar`.
export interface MenkarApi {
  readonly i18n: {
    catalog(): Promise<Catalog>
  }
  readonly projects: {
    get(): Promise<ProjectsSnapshot>
  }
  readonly sessions: {
    list(): Promise<readonly SessionInfo[]>
    setHidden(ids: readonly string[], hidden: boolean): Promise<void>
    onChanged(listener: (list: readonly SessionInfo[]) => void): () => void
  }
  readonly window: {
    state(): Promise<WindowState | null>
    act(action: Action): Promise<ActionResult>
    onState(listener: (state: WindowState) => void): () => void
    onConfirmClose(listener: (names: readonly string[]) => void): () => void
    onConfirmUnsaved(listener: (event: EventChannels['window:confirm-unsaved']) => void): () => void
  }
  readonly files: {
    onUpdate(listener: (update: FileUpdate) => void): () => void
    onWhichWindow(listener: (event: EventChannels['files:which-window']) => void): () => void
    onRefused(listener: (event: EventChannels['files:refused']) => void): () => void
  }
  readonly panes: {
    attach(pane: string): Promise<{ buffer: string; end: number }>
    input(pane: string, data: string): void
    resize(pane: string, cols: number, rows: number): void
    reveal(paneId: string): void
    onData(listener: (event: EventChannels['pty:data']) => void): () => void
  }
  readonly agentState: {
    onChanged(listener: (states: AgentStates) => void): () => void
    onToast(listener: (toast: EventChannels['agentState:toast']) => void): () => void
  }
  readonly context: {
    onReading(listener: (event: EventChannels['context:reading']) => void): () => void
  }
  readonly preferences: {
    get(): Promise<PreferencesInfo>
    set(key: PreferenceKey, value: string | number | boolean): Promise<Settings>
    restart(unsaved?: RestartUnsaved): Promise<RestartAnswer>
    openLink(link: 'website' | 'issues'): Promise<void>
    onSettings(listener: (settings: Settings) => void): () => void
    statusline(): Promise<{ on: boolean }>
    setStatusline(on: boolean): Promise<{ on: boolean; error: string | null }>
    retention(): Promise<{ on: boolean; status: RetentionStatus }>
    setRetention(on: boolean): Promise<{ on: boolean; error: string | null }>
    onSection(listener: (section: SettingsSection) => void): () => void
  }
  readonly chat: {
    agents(): Promise<readonly ChatAgent[]>
    info(chatId: string): Promise<ChatInfo | null>
    send(chatId: string, text: string): Promise<void>
    reply(chatId: string, reply: Reply, declined: string): Promise<void>
    stop(chatId: string): Promise<void>
    onEvent(listener: (event: EventChannels['chat:event']) => void): () => void
    mcpSections(): Promise<readonly McpSection[]>
  }
  readonly usage: {
    view(which: UsageWhich, allProjects: boolean): Promise<UsageView>
  }
  readonly classifier: {
    status(): Promise<ClassifierStatus>
    set(on: boolean): Promise<ClassifierStatus>
    estimate(day: string): Promise<InvokeChannels['classifier:estimate']['response']>
    classifyEarlier(day: string): Promise<void>
    stop(): Promise<void>
  }
}
