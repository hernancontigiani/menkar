import type { Badge } from './badges'
import type { Agent } from './lines'

// What the renderer receives for a session. Types only, with no Node import, because the
// renderer's compile sees this file through the IPC module.
export interface SessionInfo {
  readonly agent: Agent
  readonly id: string
  readonly name: string
  // Claude named it (`-n`, `/rename`): the app does not rename it.
  readonly claudeNamed: boolean
  readonly file: string
  readonly folder: string
  readonly cwd: string | null
  readonly preview: string
  readonly badge: Badge
  readonly mtimeMs: number
  readonly size: number
  readonly hidden: boolean
}
