import { now } from '../clock'
import { withoutEscapes } from './versions'

// A CLI that refuses an option fails at once, before its first screen: only the start of a pane's
// output is read for it.
export const REFUSAL_WINDOW_MS = 30_000
export const REFUSAL_WINDOW_CHARS = 64 * 1024

// Reads the start of a pane's output for the line its CLI prints when it refuses the id it was
// started with, and tells it once.
export class IdRefusal {
  readonly #refused: RegExp
  readonly #told: () => void
  readonly #until = now() + REFUSAL_WINDOW_MS
  #seen = ''
  #done = false

  constructor(refused: RegExp, told: () => void) {
    this.#refused = refused
    this.#told = told
  }

  read(data: string): void {
    if (this.#done) return
    if (now() > this.#until || this.#seen.length > REFUSAL_WINDOW_CHARS) {
      this.#done = true
      this.#seen = ''
      return
    }
    this.#seen += data
    if (!this.#refused.test(withoutEscapes(this.#seen))) return
    this.#done = true
    this.#seen = ''
    this.#told()
  }
}
