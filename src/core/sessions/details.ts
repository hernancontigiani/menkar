// What reading a transcript yields. Types only, with no Node import: the renderer's compile sees
// this file through the IPC module and the shared workspace types.

export type Badge = 'waiting' | 'interrupted' | null

export interface Head {
  readonly cwd: string | null
  readonly preview: string
}

export interface RecentMessage {
  readonly fromUser: boolean
  readonly text: string
}

export interface Details {
  readonly user: number
  readonly assistant: number
  readonly toolCalls: number
  readonly models: readonly string[]
  readonly created: string | null
  readonly lastActivity: string | null
  readonly cwd: string | null
  // [server, count], most used first.
  readonly mcpUsed: ReadonlyArray<readonly [string, number]>
  readonly recent: readonly RecentMessage[]
}
