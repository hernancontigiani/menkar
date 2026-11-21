// OpenCode's state rules, from screens of its v2.3.0 TUI.
import type { RawState } from '../../agentstate/raw'
import { bottom } from '../shared/screen'
import type { StateRules } from '../types'

// The permission card replaces the composer: its heading and its choices' row. Esc there rejects
// the call and interrupts the turn, and a key typed answers it.
const CARD_LINES = 12
// The footer's row while a turn runs ("esc interrupt", "esc again to interrupt" after one Esc). The
// tab strip's spinner also turns while a message only waits in the inbox, so it is not read; a
// conversation's text above the footer may quote the footer's words, so only the last line is.
const WORKING_LINES = 1

function detect(_title: string, screen: string): RawState {
  const recent = bottom(screen, CARD_LINES)
  if (
    recent.includes('△ permission required') &&
    recent.includes('allow once') &&
    recent.includes('reject')
  )
    return 'blocked'
  const footer = bottom(screen, WORKING_LINES)
  if (footer.includes('esc interrupt') || footer.includes('esc again to interrupt'))
    return 'working'
  return 'idle'
}

export const state: StateRules = { detect }
