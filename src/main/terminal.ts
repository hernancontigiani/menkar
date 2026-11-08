import { type IPty, spawn } from 'node-pty'
import type { TerminalSize } from '../shared/ipc'

export interface TerminalSink {
  data(data: string): void
  exit(exitCode: number): void
}

function userShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe'
  return process.env.SHELL || '/bin/sh'
}

export class Terminal {
  readonly #pty: IPty

  constructor(size: TerminalSize, cwd: string, sink: TerminalSink) {
    this.#pty = spawn(userShell(), [], {
      name: 'xterm-256color',
      cols: size.cols,
      rows: size.rows,
      cwd,
      env: process.env,
    })
    this.#pty.onData((data) => sink.data(data))
    this.#pty.onExit(({ exitCode }) => sink.exit(exitCode))
  }

  get pid(): number {
    return this.#pty.pid
  }

  write(data: string): void {
    this.#pty.write(data)
  }

  resize(size: TerminalSize): void {
    this.#pty.resize(size.cols, size.rows)
  }

  // SIGHUP, not SIGTERM: an interactive bash ignores SIGTERM, and a hangup is what a shell
  // expects when its terminal goes away.
  kill(): void {
    try {
      process.kill(this.#pty.pid, 'SIGHUP')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
}
