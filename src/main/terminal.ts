import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import { type IPty, spawn } from 'node-pty'
import { log } from '../core/log'
import { foregroundGroup, reapSession } from './reap'

export interface TerminalSink {
  // `end`: where this chunk ends in the pane's whole output.
  data(data: string, end: number): void
  exit(exitCode: number): void
}

export function userShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe'
  return process.env.SHELL || '/bin/bash'
}

const isDir = (path: string) => {
  try {
    return statSync(path).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EACCES') return false
    throw error
  }
}

// A message of the app's own, written to the display (never to the shell's input): a blank line,
// the tag in bold yellow, the text.
export const appMessage = (tag: string, text: string) => `\r\n\x1b[1;33m${tag}\x1b[0m ${text}\r\n`

// Output kept per pane, so a window that shows the pane later (a moved tab, a reload) replays it.
const BUFFER_CHARS = 512 * 1024

export interface StartOptions {
  readonly cwd: string | null
  readonly cols: number
  readonly rows: number
  // Typed into the shell once it starts; none for a plain shell.
  readonly command?: string
  // App messages shown before the shell's output.
  readonly messages?: readonly string[]
  readonly folderGone?: (cwd: string) => string
}

export class Terminal {
  readonly #pty: IPty
  readonly #shellName: string
  #buffer = ''
  #end = 0
  #exited = false
  #hungUp = false

  constructor(options: StartOptions, sink: TerminalSink) {
    const shell = userShell()
    this.#shellName = basename(shell)
    let cwd = options.cwd ?? homedir()
    const pre: string[] = [...(options.messages ?? [])]
    if (options.cwd !== null && !isDir(options.cwd)) {
      cwd = homedir()
      if (options.folderGone) pre.unshift(options.folderGone(options.cwd))
    }
    const emit = (data: string) => {
      this.#buffer = (this.#buffer + data).slice(-BUFFER_CHARS)
      this.#end += data.length
      sink.data(data, this.#end)
    }
    for (const message of pre) emit(message)
    this.#pty = spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd,
      // xterm.js draws 24-bit colour, but a Menkar started from the desktop has no COLORTERM of
      // its own, and without it Claude Code falls back to 256 colours instead of its own palette.
      // The same for hyperlinks: without FORCE_HYPERLINK it prints an address it breaks over rows
      // as plain text, and only the first row's piece is a link; with it, every row is an OSC 8
      // link to the whole address.
      env: { ...process.env, COLORTERM: 'truecolor', FORCE_HYPERLINK: '1' },
    })
    this.#pty.onData(emit)
    this.#pty.onExit(({ exitCode }) => {
      this.#exited = true
      sink.exit(exitCode)
    })
    if (options.command) this.#pty.write(options.command)
  }

  get pid(): number {
    return this.#pty.pid
  }

  get buffer(): string {
    return this.#buffer
  }

  get end(): number {
    return this.#end
  }

  // Something other than the shell itself is in the foreground: the agent, or a command the user
  // started. A shell at its prompt is not running.
  get running(): boolean {
    if (this.#exited) return false
    try {
      // node-pty reports the foreground process's argv[0]: a path, or `-bash` for a login shell.
      return basename(this.#pty.process).replace(/^-/, '') !== this.#shellName
    } catch (error) {
      log.warn('could not read a terminal’s foreground process', { error })
      return false
    }
  }

  write(data: string): void {
    if (!this.#exited) this.#pty.write(data)
  }

  resize(cols: number, rows: number): void {
    if (!this.#exited && cols > 0 && rows > 0) this.#pty.resize(cols, rows)
  }

  // Closing hangs up, as closing a terminal does: nothing is typed into the agent. SIGHUP, not
  // SIGTERM, because an interactive bash ignores SIGTERM; to the agent's process group as well,
  // which gets it then even when its shell is gone first. What outlives it is ended by the reaper.
  hangUp(): void {
    // A shell that already exited may have its pid reused by now.
    if (this.#exited || this.#hungUp) return
    this.#hungUp = true
    const shell = this.#pty.pid
    const agent = foregroundGroup(shell)
    for (const target of agent === null ? [shell] : [shell, -agent]) {
      try {
        process.kill(target, 'SIGHUP')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    void reapSession(shell)
  }
}
