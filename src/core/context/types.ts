// What the windows receive about a session's context: shared with the renderer, so nothing here
// imports Node.
export interface Reading {
  readonly percentage: number
  readonly window: number
  readonly source: 'statusline' | 'estimate'
}

// How long Claude Code keeps transcripts now: absent (its own default applies), a number of days
// from its settings, or a file that could not be read.
export type RetentionStatus =
  | { kind: 'unset'; defaultDays: number }
  | { kind: 'days'; days: number; by: 'user' | 'menkar'; on: boolean }
  | { kind: 'unreadable'; path: string }
