// Cursor's state rules: a simplified port of herdr's agent-detection rules (https://herdr.dev,
// Apache-2.0).
import type { RawState } from '../../agentstate/raw'
import { bottom } from '../shared/screen'
import type { StateRules } from '../types'

const SPINNER = /^\s*[⠀-⣿]+\s+[\p{L}\p{N}_]+ing(?![\p{L}\p{N}_])/mu
const ALLOW = /^\s*(?:\S\s*)?(?:allow|run) .*\(y\)/mu
// The workspace trust prompt of a folder Cursor has not run in: its two choices on lines of their
// own, inside its box. The human answers it; Menkar never does.
const TRUST = /\[a\] trust this workspace[^\n]*\n[^\n]*\[q\] quit/u
const BACKGROUND_TASKS = /(?<![\p{L}\p{N}_])[1-9][0-9]*\s+background\s+tasks?(?![\p{L}\p{N}_])/u

// Cursor's title is not read.
function detect(_title: string, screen: string): RawState {
  const recent = bottom(screen, 10)
  if (
    (recent.includes('run this command?') &&
      (recent.includes('run (once) (y)') || recent.includes('skip (esc or n)'))) ||
    (recent.includes('write to this file?') && recent.includes('proceed (y)')) ||
    recent.includes('(y) (enter)') ||
    recent.includes('keep (n)') ||
    recent.includes('skip (esc or n)') ||
    // After Skip the turn waits for the human's reason, while its footer still says ctrl+c to stop.
    recent.includes('tell the agent what to do instead (enter to send') ||
    ALLOW.test(recent) ||
    TRUST.test(recent)
  ) {
    return 'blocked'
  }
  if (
    bottom(screen, 6).includes('ctrl+c to stop') ||
    SPINNER.test(recent) ||
    BACKGROUND_TASKS.test(recent)
  ) {
    return 'working'
  }
  return 'idle'
}

export const state: StateRules = { detect }
