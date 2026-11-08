// Every IPC channel and its payload, declared once and imported by main, preload and renderer.

import type { AgentStates } from '../core/agentstate/shown'
import type { Reading } from '../core/context/types'
import type { Language, Messages } from '../core/i18n'
import type { ProjectsSnapshot } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'
import type { Action, ActionResult, WindowState } from './workspace'

export type { ProjectsSnapshot, SessionInfo }

export interface Catalog {
  readonly language: Language
  readonly messages: Messages
}

// The classification's state for the Integrations page: the switch, the line under it, and the
// earlier-turns run's progress ("30 of 75") while one runs.
export interface ClassifierStatus {
  readonly on: boolean
  readonly status: string
  readonly progress: string | null
}

// Renderer → main, answered.
export interface InvokeChannels {
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
  'pty:attach': { request: { pane: string }; response: string }
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
  'pty:data': { readonly pane: string; readonly data: string }
  // The whole list, after every rescan and every change to the app's names or hidden set.
  'sessions:changed': readonly SessionInfo[]
  // Agent state and context (plan 09): every pane's shown state and every project's blocked
  // count, to every window, whenever one changes.
  'agentState:changed': AgentStates
  // An agent the user is not watching finished or needs them, in the focused window: its toast.
  'agentState:toast': { readonly paneId: string; readonly text: string }
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
  }
  readonly panes: {
    attach(pane: string): Promise<string>
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
  readonly classifier: {
    status(): Promise<ClassifierStatus>
    set(on: boolean): Promise<ClassifierStatus>
    estimate(day: string): Promise<InvokeChannels['classifier:estimate']['response']>
    classifyEarlier(day: string): Promise<void>
    stop(): Promise<void>
  }
}
