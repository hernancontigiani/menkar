// What an agent in a terminal is doing, from the title it set and the text on its screen.
import { parseAgentId } from '../agents/ids'
import { kitOf } from '../agents/registry'
import type { RawState, ScreenReading } from './raw'

export { RAW_STATES, type RawState, type ScreenReading } from './raw'

// The raw state of an agent's pane; an agent this build does not know is always idle. A pane
// whose agent has exited (the shell owns the terminal's foreground again) is idle whatever its
// screen shows: the caller checks that first.
export function detectState(provider: string, title: string, screen: string): RawState {
  const agent = parseAgentId(provider)
  return agent === null ? 'idle' : kitOf(agent).state.detect(title, screen)
}

// How the pane's screen is read for its agent's rules; an agent this build does not know reads to
// the cursor, and its state is idle anyway.
export function readingOf(provider: string): ScreenReading {
  const agent = parseAgentId(provider)
  return (agent === null ? undefined : kitOf(agent).state.reads) ?? 'toCursor'
}
