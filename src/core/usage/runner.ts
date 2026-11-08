import { log } from '../log'

// Runs passes one at a time: a request while a pass runs waits for that pass instead of starting
// a second, as both would read the same appended bytes.
export class PassRunner {
  private running: Promise<void> | null = null

  constructor(private readonly pass: () => Promise<void>) {}

  request(): Promise<void> {
    if (this.running) return this.running
    const run = this.pass()
      .catch((error: unknown) => {
        log.warn('usage pass failed', { error })
      })
      .finally(() => {
        this.running = null
      })
    this.running = run
    return run
  }
}
