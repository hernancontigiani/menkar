export const RAW_STATES = ['working', 'blocked', 'idle'] as const
export type RawState = (typeof RAW_STATES)[number]

// How much of a terminal an agent's rules read: one terminal height ending at the cursor's row, as
// a VTE terminal's text read gives it, or every row of the visible screen, for a full-screen TUI
// that leaves its hidden cursor wherever it last drew.
export type ScreenReading = 'toCursor' | 'wholeScreen'
