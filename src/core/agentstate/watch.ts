import type { RawState } from './detect'
import { detectState } from './detect'
import type { ScreenMirror } from './mirror'

// Output arrives in bursts: the first change schedules one check this long after it, and the
// changes before it runs ride on it.
export const CHECK_DELAY_MS = 250

export interface WatchedPane {
  readonly provider: string
  readonly mirror: Pick<ScreenMirror, 'title' | 'screen' | 'onChange'>
  // The agent still owns the terminal's foreground: back at the shell, the pane is idle.
  foreground(): boolean
}

// Reads a pane's raw state after each burst of changes and reports it when it differs from the
// last one. A new pane starts idle.
export class PaneWatcher {
  private raw: RawState = 'idle'
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly stop: () => void

  constructor(
    private readonly pane: WatchedPane,
    private readonly report: (raw: RawState) => void,
  ) {
    this.stop = pane.mirror.onChange(() => this.schedule())
  }

  schedule(): void {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.check()
    }, CHECK_DELAY_MS)
  }

  check(): void {
    const raw = this.pane.foreground()
      ? detectState(this.pane.provider, this.pane.mirror.title(), this.pane.mirror.screen())
      : 'idle'
    if (raw === this.raw) return
    this.raw = raw
    this.report(raw)
  }

  dispose(): void {
    this.stop()
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
