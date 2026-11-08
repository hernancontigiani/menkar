// What the windows receive about a session's context: shared with the renderer, so nothing here
// imports Node.
export interface Reading {
  readonly percentage: number
  readonly window: number
  readonly source: 'statusline' | 'estimate'
}
