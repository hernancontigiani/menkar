// Whether a pane's agent has a Remote Control bridge connected now, read from Claude Code's
// per-process registry (`~/.claude/sessions/<pid>.json`). The format is Claude Code's and
// undocumented: anything unexpected reads as 'unknown', never as 'off', so the caller falls back to
// the app's own list instead of hiding an icon that may be true.

export type BridgeState = 'on' | 'off' | 'unknown'

export interface Expected {
  readonly pid: number
  // known once the session's transcript has appeared; until then the pid alone decides
  readonly sessionId?: string | null
  // the process's start time in clock ticks (`/proc/<pid>/stat`, field 22): a reused pid differs
  readonly procStart?: string | null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function bridgeState(json: unknown, expected: Expected): BridgeState {
  if (!isObject(json)) return 'unknown'
  if (json.pid !== expected.pid) return 'unknown'
  if (expected.sessionId && json.sessionId !== expected.sessionId) return 'unknown'
  if (
    expected.procStart &&
    json.procStart !== undefined &&
    String(json.procStart) !== expected.procStart
  )
    return 'unknown'
  const bridge = json.bridgeSessionId
  if (typeof bridge === 'string') return bridge.trim() === '' ? 'unknown' : 'on'
  if (bridge === null || bridge === undefined) return 'off'
  return 'unknown'
}

// `/proc/<pid>/stat`'s 22nd field. The command (field 2) is in parentheses and may hold spaces, so
// the fields are counted after its closing parenthesis.
export function procStartOf(stat: string): string | null {
  const close = stat.lastIndexOf(')')
  if (close < 0) return null
  const fields = stat
    .slice(close + 2)
    .trim()
    .split(/\s+/)
  // fields[0] is field 3 (state), so field 22 is fields[19]
  const start = fields[19]
  return start && /^\d+$/.test(start) ? start : null
}

// What the finder reads from `/proc`; a test gives it a fake one.
export interface ProcReader {
  // the pids `/proc/<pid>/task/*/children` lists
  children(pid: number): readonly number[]
  // `/proc/<pid>/cmdline`, split on NUL; empty when the process is gone
  argv(pid: number): readonly string[]
}

const MAX_DEPTH = 3

const base = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// A script the agent ships as runs under one of these: `node …/claude`.
const INTERPRETERS = new Set(['node', 'bun', 'deno', 'sh', 'bash'])

function runsAgent(argv: readonly string[], agent: string): boolean {
  const [command = '', script = ''] = argv
  return base(command) === agent || (INTERPRETERS.has(base(command)) && base(script) === agent)
}

// The agent's process under the shell the pane's pty runs: the nearest descendant whose command, or
// the script an interpreter runs, is named after the agent (`claude`, `node …/claude`).
export function findAgentPid(shellPid: number, agent: string, proc: ProcReader): number | null {
  let level = [shellPid]
  for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth += 1) {
    const next: number[] = []
    for (const pid of level) {
      for (const child of proc.children(pid)) {
        const argv = proc.argv(child)
        if (runsAgent(argv, agent)) return child
        next.push(child)
      }
    }
    level = next
  }
  return null
}
