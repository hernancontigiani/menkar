import type { StateRules } from '../types'

// Interim until P1a.5 reads Codex's screen: a Codex pane is shown idle.
export const state: StateRules = { detect: () => 'idle' }
