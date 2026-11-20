import { spawn } from 'node:child_process'
import { withoutSessionEnv } from '../../../core/sessionenv'

export interface CommandEnd {
  // null when it was ended by a signal, or by the wait running out.
  readonly code: number | null
  readonly stderr: string
}

// The most of a failing command's error output kept for the log.
const STDERR_KEPT = 2000

// An agent's own command that hands a session a message, run as the agent's sessions are started:
// with the session variables of whichever agent Menkar itself runs inside removed, or the command
// takes itself for that session's tool. Its arguments go as words, never through a shell.
export function runWakeCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<CommandEnd> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: withoutSessionEnv(process.env),
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: timeoutMs,
    })
    let stderr = ''
    child.stderr.on('data', (d: Buffer) => {
      if (stderr.length < STDERR_KEPT) stderr += d.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr: stderr.slice(0, STDERR_KEPT) }))
  })
}
