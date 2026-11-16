import type { Key } from '../i18n'
import type { AgentId } from './ids'

export type AgentCap = 'remote' | 'fork' | 'trash' | 'chat' | 'context'

export interface AgentDescriptor {
  readonly id: AgentId
  // The CLI's name on the PATH.
  readonly command: string
  readonly label: Key
  readonly glyph: string
  readonly caps: Readonly<Record<AgentCap, boolean>>
}
