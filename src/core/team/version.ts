// The oldest Claude Code that takes `--system-prompt-snapshot`, the later of the two versions its
// docs and its changelog give. `--append-system-prompt-file` is older.
export const TEAM_FLOOR = '2.1.267'

// The version `--version` prints first, e.g. "2.1.325 (Claude Code)"; null when there is none.
export function claudeVersion(output: string): string | null {
  return /^\s*(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null
}

const parts = (version: string) => version.split('.').map(Number)

export function teamFlagsAllowed(version: string): boolean {
  const have = parts(version)
  const need = parts(TEAM_FLOOR)
  for (let i = 0; i < need.length; i++) {
    const a = have[i] ?? 0
    const b = need[i] ?? 0
    if (a !== b) return a > b
  }
  return true
}
