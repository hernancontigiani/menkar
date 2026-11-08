// Every IPC channel and its payload, declared once and imported by main, preload and renderer.

import type { Language, Messages } from '../core/i18n'

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
}

export type InvokeChannel = keyof InvokeChannels
export type SendChannel = keyof SendChannels
export type EventChannel = keyof EventChannels

// The object the preload exposes on `window.menkar`.
export interface MenkarApi {
  readonly i18n: {
    catalog(): Promise<Catalog>
  }
  readonly terminal: {
    start(size: TerminalSize): Promise<void>
    write(data: string): void
    resize(size: TerminalSize): void
    onData(listener: (data: string) => void): () => void
    onExit(listener: (event: EventChannels['terminal:exit']) => void): () => void
  }
}
