import type { ShownState } from '../agentstate/shown'
import type { PaneStateName } from '../usage/activity'

export interface PaneRow {
  readonly paneId: string
  readonly state: PaneStateName
  // Unix seconds
  readonly at: number
  readonly seq: number
}

// Each pane's opening, shown changes and close, as rows; a change to the state last written for
// the pane writes nothing. No hold: the watcher's own re-read is the only debounce.
export class PaneStateRecorder {
  private seq = 0
  private readonly last = new Map<string, PaneStateName>()

  constructor(private readonly write: (row: PaneRow) => void) {}

  opened(paneId: string, state: ShownState, at: number): void {
    if (this.last.has(paneId)) return
    this.emit(paneId, state, at)
  }

  changed(paneId: string, next: ShownState, at: number): void {
    const last = this.last.get(paneId)
    if (last === undefined || last === next) return
    this.emit(paneId, next, at)
  }

  closed(paneId: string, at: number): void {
    if (!this.last.has(paneId)) return
    this.emit(paneId, 'closed', at)
    this.last.delete(paneId)
  }

  private emit(paneId: string, state: PaneStateName, at: number): void {
    this.seq += 1
    this.last.set(paneId, state)
    this.write({ paneId, state, at, seq: this.seq })
  }
}

export const TICK_MS = 900_000

// Every UTC offset in use is a whole number of quarter hours, so an epoch multiple of 15 minutes is
// a local quarter hour in every zone.
export function nextTick(nowMs: number): number {
  return (Math.floor(nowMs / TICK_MS) + 1) * TICK_MS
}
