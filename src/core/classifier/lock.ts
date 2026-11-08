import type { RunResult } from './run'

// One classification at a time, so a turn is never sent twice. The hourly pass is skipped while
// earlier turns are being classified; an earlier-turns run waits for an hourly pass in flight and
// then reads what is still unclassified.
export class ClassifierLock {
  private running: Promise<unknown> | null = null
  private earlierRunning = false

  get busy(): boolean {
    return this.running !== null
  }

  get classifyingEarlier(): boolean {
    return this.earlierRunning
  }

  // Null when a run already holds the lock: the pass is skipped and records nothing.
  async hourly(run: () => Promise<RunResult>): Promise<RunResult | null> {
    if (this.running !== null) return null
    return this.hold(run())
  }

  async earlier(run: () => Promise<RunResult>): Promise<RunResult> {
    while (this.running !== null) await this.running.catch(() => undefined)
    this.earlierRunning = true
    try {
      return await this.hold(run())
    } finally {
      this.earlierRunning = false
    }
  }

  private async hold<T>(work: Promise<T>): Promise<T> {
    this.running = work
    try {
      return await work
    } finally {
      this.running = null
    }
  }
}
