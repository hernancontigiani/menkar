// Claude Code's state rules: a simplified port of herdr's agent-detection rules (https://herdr.dev,
// Apache-2.0).
import type { RawState } from '../../agentstate/raw'
import { bottom } from '../shared/screen'
import type { StateRules } from '../types'

// Claude Code's busy title: a Braille spinner, or the half circles it draws since 2.1.228, then a
// space. Its idle title begins with "✳ ".
const TITLE_WORKING = /^[⠀-⣿◐-◓] /u

// Claude Code's footer pill while background work runs (decision 1.105), as its 2.1.323 program
// writes it: "1 shell", "2 monitors", "↳ 3 background", "◇ 1 cloud session"… Claude Code's own
// housekeeping ("saving memories", "dreaming", "auto-mode scan", "memory import") has no count and
// is left out. The pill starts the footer's line or follows a " · ", after at most one symbol
// that is not the input box's prompt, so a count typed in the box or said in the conversation is
// not read as one.
const BACKGROUND_PILLS = [
  'shells?',
  'monitors?',
  'artifact comment monitors?',
  'local agents?',
  'teams?',
  'mcp tasks?',
  'background', // "↳ 2 background", "2 background tasks", "2 background dynamic workflows"
  'cloud sessions?',
  'remote dynamic workflows?',
] as const
// The footer's lines: the last non-empty lines of the screen.
const FOOTER_LINES = 3
const BACKGROUND = new RegExp(
  `(?:^|·)\\s*(?:[^\\p{L}\\p{N}\\s>❯]\\s*)?[1-9][0-9]*\\s+(?:${BACKGROUND_PILLS.join('|')})(?![\\p{L}\\p{N}_])`,
  'mu',
)

function detect(title: string, screen: string): RawState {
  const recent = bottom(screen, 14)
  if (recent.includes('select model') && recent.includes('enter to set as default')) {
    return 'idle' // the /model picker, not a question from the agent
  }
  if (
    recent.includes('do you want to proceed?') ||
    recent.includes('waiting for permission') ||
    recent.includes('do you want to allow this connection?') ||
    recent.includes('review your answers') ||
    (recent.includes('esc to cancel') &&
      (recent.includes('enter to confirm') || recent.includes('enter to select'))) ||
    ((recent.includes('do you want to') || recent.includes('would you like to')) &&
      recent.includes('yes'))
  ) {
    return 'blocked'
  }
  if (
    TITLE_WORKING.test(title) ||
    recent.includes('esc to interrupt') ||
    BACKGROUND.test(bottom(screen, FOOTER_LINES))
  ) {
    return 'working'
  }
  return 'idle'
}

export const state: StateRules = { detect }
