import { createRequire } from 'node:module'
import type * as Headless from '@xterm/headless'

// @xterm/headless ships CommonJS only, which Node's ESM cannot import by name.
const { Terminal } = createRequire(import.meta.url)('@xterm/headless') as typeof Headless

// A copy of a pane's terminal kept outside any window, so a pane that is not on screen can be read:
// it is fed the same bytes as the pane and parses the title the agent sets.
export class ScreenMirror {
  private readonly terminal: Headless.Terminal
  private currentTitle = ''
  private readonly listeners = new Set<() => void>()

  constructor(cols: number, rows: number) {
    this.terminal = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 1000 })
    this.terminal.onTitleChange((title) => {
      this.currentTitle = title
      this.changed()
    })
    this.terminal.onWriteParsed(() => this.changed())
  }

  // The pane's output, exactly as the pty gave it.
  write(data: string | Uint8Array): void {
    this.terminal.write(data)
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows)
  }

  // The last title the agent set (OSC 0 or 2), or ''.
  title(): string {
    return this.currentTitle
  }

  // The text of as many rows as the terminal is tall, ending at the cursor's row, as plain text.
  // Rows the terminal wrapped continue the previous line, with no line break, as a terminal's own
  // text read does.
  screen(): string {
    const buffer = this.terminal.buffer.active
    const cursor = buffer.baseY + buffer.cursorY
    const first = Math.max(0, cursor - this.terminal.rows)
    let text = ''
    for (let row = first; row <= cursor; row += 1) {
      const line = buffer.getLine(row)
      if (line === undefined) continue
      if (row > first && !line.isWrapped) text += '\n'
      text += line.translateToString(true)
    }
    return text
  }

  // Called whenever the contents or the title change, after the bytes were parsed.
  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Resolves once every byte written so far has been parsed.
  flush(): Promise<void> {
    return new Promise((resolve) => this.terminal.write('', resolve))
  }

  dispose(): void {
    this.listeners.clear()
    this.terminal.dispose()
  }

  private changed(): void {
    for (const listener of this.listeners) listener()
  }
}
