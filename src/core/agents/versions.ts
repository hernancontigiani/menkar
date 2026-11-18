import type { AgentId } from './ids'

// Where the user's installed version of an agent stands against the one Menkar was validated with
// and the oldest one it can run.
export type Standing =
  | 'notInstalled'
  // Installed, but `--version` printed nothing we could read.
  | 'unknown'
  | 'old'
  | 'notValidated'
  | 'older'
  | 'validated'
  | 'newer'
  | 'muchNewer'

export interface AgentVersions {
  readonly validated: string | null
  readonly floor: string | null
}

// What About and the banner show for one agent.
export interface AgentVersionView {
  readonly agent: AgentId
  readonly installed: string | null
  readonly validated: string | null
  readonly floor: string | null
  readonly standing: Standing
  // The user hid the banner for this installed version.
  readonly hidden: boolean
}

// The first word `--version` prints, e.g. "2.1.327" of "2.1.327 (Claude Code)".
export function readVersion(output: string): string | null {
  return /^\s*(\S+)/.exec(output)?.[1] ?? null
}

function numbers(version: string): number[] | null {
  const match = /^(\d+(?:\.\d+)*)/.exec(version)
  return match?.[1] ? match[1].split('.').map(Number) : null
}

// Negative, zero or positive as `a` is older, equal or newer; null when either is not dotted numbers.
export function compareVersions(a: string, b: string): number | null {
  const x = numbers(a)
  const y = numbers(b)
  if (!x || !y) return null
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

// A jump that changes the major or minor number is large; one in the patch number only is small.
export function largeJump(from: string, to: string): boolean {
  const x = numbers(from)
  const y = numbers(to)
  if (!x || !y) return true
  return x[0] !== y[0] || (x[1] ?? 0) !== (y[1] ?? 0)
}

export function standingOf(installed: string | null, found: boolean, v: AgentVersions): Standing {
  if (!found) return 'notInstalled'
  if (installed === null) return 'unknown'
  const belowFloor = v.floor === null ? null : compareVersions(installed, v.floor)
  if (belowFloor !== null && belowFloor < 0) return 'old'
  if (v.validated === null) return 'notValidated'
  const d = compareVersions(installed, v.validated)
  if (d === null) return 'unknown'
  if (d === 0) return 'validated'
  if (d < 0) return 'older'
  return largeJump(v.validated, installed) ? 'muchNewer' : 'newer'
}

const SAYS: Readonly<Partial<Record<Standing, number>>> = { old: 3, muchNewer: 2, newer: 1 }

// The one banner a window shows: the most serious of what is not hidden, or null.
export function bannerOf(views: readonly AgentVersionView[]): AgentVersionView | null {
  let best: AgentVersionView | null = null
  for (const v of views) {
    const weight = SAYS[v.standing] ?? 0
    if (weight === 0 || v.hidden) continue
    if (!best || weight > (SAYS[best.standing] ?? 0)) best = v
  }
  return best
}

// ---------------------------------------------------------------- Hide, in state.json

const HIDDEN = 'agent_versions_hidden'

// state.json's shape as far as Hide needs it: the renderer reads this module, and the state's own
// module reads files.
interface Kept {
  readonly rest: Readonly<Record<string, unknown>>
}

// The installed version each agent's banner was hidden for.
export function hiddenVersions(state: Kept): Readonly<Record<string, string>> {
  const value = state.rest[HIDDEN]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [agent, version] of Object.entries(value))
    if (typeof version === 'string') out[agent] = version
  return out
}

export function withHiddenVersion<S extends Kept>(state: S, agent: AgentId, version: string): S {
  return {
    ...state,
    rest: { ...state.rest, [HIDDEN]: { ...hiddenVersions(state), [agent]: version } },
  }
}
