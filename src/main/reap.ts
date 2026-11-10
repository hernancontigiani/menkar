import { readdirSync, readFileSync } from 'node:fs'
import { log } from '../core/log'

// After a pty is hung up, nothing of it may be left: an agent that ignores SIGHUP (Claude Code's
// background backend does, when it does not own the terminal) outlives its shell, and one stopped
// before its shell died stays stopped for good, reparented, and still registered as a session.
// So every process still in the pty's session (sid = the shell's pid) after TERM_AFTER_MS gets
// SIGCONT and SIGTERM, and whatever is left KILL_AFTER_MS later gets SIGKILL. Nothing is typed.
// Linux only: elsewhere there is no /proc to read, and nothing is escalated.

export const TERM_AFTER_MS = 3000
export const KILL_AFTER_MS = 2000
const POLL_MS = 100

export interface Proc {
  readonly pid: number
  readonly state: string
  readonly sid: number
  // The terminal's foreground process group.
  readonly tpgid: number
}

// /proc/<pid>/stat after the command name, which may hold spaces and parentheses: state ppid
// pgrp session tty_nr tpgid …
export function parseStat(pid: number, stat: string): Proc | null {
  const fields = stat.slice(stat.lastIndexOf(') ') + 2).split(' ')
  const sid = Number(fields[3])
  const tpgid = Number(fields[5])
  if (!fields[0] || !Number.isInteger(sid) || !Number.isInteger(tpgid)) return null
  return { pid, state: fields[0], sid, tpgid }
}

function readProc(pid: number): Proc | null {
  try {
    return parseStat(pid, readFileSync(`/proc/${pid}/stat`, 'utf8'))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ESRCH' || code === 'EACCES') return null // gone, or not ours
    throw error
  }
}

export function processes(): Proc[] {
  let entries: string[]
  try {
    entries = readdirSync('/proc')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [] // no /proc: not Linux
    throw error
  }
  const found: Proc[] = []
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    const proc = readProc(Number(entry))
    if (proc) found.push(proc)
  }
  return found
}

// The foreground process group of the shell's terminal (the agent), when it is not the shell's.
export function foregroundGroup(shellPid: number): number | null {
  const proc = readProc(shellPid)
  return proc && proc.tpgid > 0 && proc.tpgid !== shellPid ? proc.tpgid : null
}

export interface ReapDeps {
  readonly list: () => readonly Proc[]
  readonly kill: (pid: number, signal: NodeJS.Signals) => void
}

const realDeps: ReapDeps = {
  list: processes,
  kill: (pid, signal) => process.kill(pid, signal),
}

const pending = new Set<Promise<void>>()

function send(deps: ReapDeps, pid: number, signal: NodeJS.Signals): void {
  try {
    deps.kill(pid, signal)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
}

// Resolves once the session is empty, or once SIGKILL has gone to what was left.
export function reapSession(sid: number, deps: ReapDeps = realDeps): Promise<void> {
  const left = () => deps.list().filter((p) => p.sid === sid && p.state !== 'Z')
  const done = new Promise<void>((resolve) => {
    let waited = 0
    let termed = false
    const tick = () => {
      const survivors = left()
      if (survivors.length === 0) return resolve()
      if (!termed && waited >= TERM_AFTER_MS) {
        termed = true
        for (const p of survivors) {
          log.warn('a process outlived its terminal’s hang-up: SIGCONT and SIGTERM', {
            pid: p.pid,
            session: sid,
            state: p.state,
            signal: 'SIGTERM',
          })
          send(deps, p.pid, 'SIGCONT')
          send(deps, p.pid, 'SIGTERM')
        }
      } else if (waited >= TERM_AFTER_MS + KILL_AFTER_MS) {
        for (const p of survivors) {
          log.warn('a process outlived SIGTERM after its terminal’s hang-up: SIGKILL', {
            pid: p.pid,
            session: sid,
            state: p.state,
            signal: 'SIGKILL',
          })
          send(deps, p.pid, 'SIGKILL')
        }
        return resolve()
      }
      waited += POLL_MS
      setTimeout(tick, POLL_MS)
    }
    setTimeout(tick, POLL_MS)
  })
  pending.add(done)
  void done.then(() => pending.delete(done))
  return done
}

export function reaping(): boolean {
  return pending.size > 0
}

export async function allReaped(): Promise<void> {
  await Promise.all([...pending])
}
