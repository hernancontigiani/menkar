// Codex's state rules, from screens of its 0.169.0 TUI.
import type { RawState } from '../../agentstate/raw'
import { bottom } from '../shared/screen'
import type { StateRules } from '../types'

// Codex titles the pane with the cwd's basename, after a Braille spinner while a turn runs, and as
// "[ ! ] Action Required | <cwd>" (blinking to "[ . ]") while an approval or a question waits.
// The spinner is the only sign of a reply streaming: the working line is gone then. The fresh
// composer's big Braille logo is drawn on the screen, never in the title.
const TITLE_WORKING = /^[⠀-⣿] /u
const TITLE_BLOCKED = /^\[ \S \] Action Required(?: \||$)/u

// The exec card's footer, the question card's (Plan mode), and the trust prompt, whose title stays
// plain. The pickers (/model, /resume, /new) end in "enter select · esc back" or "enter resume" and
// are not a question from the agent.
const CARD_LINES = 14
// The working line sits right over the composer and its footer, which stay drawn while a turn runs:
// the composer alone never means idle. A background terminal's "N background terminal(s) running"
// stays after the turn ends, so it is not read.
const WORKING_LINES = 8

function detect(title: string, screen: string): RawState {
  const recent = bottom(screen, CARD_LINES)
  if (
    TITLE_BLOCKED.test(title) ||
    recent.includes('press enter to confirm or esc to cancel') ||
    recent.includes('enter to submit answer') ||
    (recent.includes('trust this folder?') && recent.includes('enter continue'))
  ) {
    return 'blocked'
  }
  if (TITLE_WORKING.test(title) || bottom(screen, WORKING_LINES).includes('esc to interrupt)')) {
    return 'working'
  }
  return 'idle'
}

export const state: StateRules = { detect }
