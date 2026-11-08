// Every IPC channel and its payload, declared once and imported by main, preload and renderer.

import type { Language, Messages } from '../core/i18n'
import type { ProjectsSnapshot } from '../core/projects/info'
import type { SessionInfo } from '../core/sessions/info'

export type { ProjectsSnapshot, SessionInfo }

export interface Catalog {
  readonly language: Language
  readonly messages: Messages
}

export interface TerminalSize {
  readonly cols: number
  readonly rows: number
}

// Renderer → main, answered.
export interface InvokeChannels {
  'terminal:start': { request: TerminalSize; response: undefined }
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
  'terminal:input': string
  'terminal:resize': TerminalSize
}

// Main → renderer.
export interface EventChannels {
  'terminal:data': string
  'terminal:exit': { readonly exitCode: number }
  // The whole list, after every rescan and every change to the app's names or hidden set.
  'sessions:changed': readonly SessionInfo[]
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
  readonly terminal: {
    start(size: TerminalSize): Promise<void>
    write(data: string): void
    resize(size: TerminalSize): void
    onData(listener: (data: string) => void): () => void
    onExit(listener: (event: EventChannels['terminal:exit']) => void): () => void
  }
}
