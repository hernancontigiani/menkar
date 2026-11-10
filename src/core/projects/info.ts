import type { Key } from '../i18n'

// What the renderer receives about projects. Types only, with no Node import, because the
// renderer's compile sees this file through the IPC module.
export interface ProjectInfo {
  readonly id: string
  readonly name: string
  readonly members: readonly string[]
  readonly hidden: readonly string[]
  readonly groups: readonly {
    readonly name: string
    readonly color: string
    readonly members: readonly string[]
  }[]
}

// A message for the user, shown until dismissed: a key of `t()` and its placeholders.
export interface Notice {
  readonly key: Key
  readonly params?: Readonly<Record<string, string>>
}

export interface ProjectsSnapshot {
  readonly current: string
  readonly projects: readonly ProjectInfo[]
  readonly notices: readonly Notice[]
}

// A project the project switcher lists (decision 1.38).
export interface ActiveProject {
  readonly id: string
  readonly name: string
  // The window that holds it: this one, or the one to bring forward.
  readonly window: string
  readonly tabs: number
  readonly here: boolean
}
