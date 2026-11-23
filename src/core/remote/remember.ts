import type { BridgeState } from './live'

// What the app keeps per pane to see a bridge turn connected: the last definite reading, and a
// connect seen before the pane knew its session.
export interface BridgeSeen {
  readonly last: 'on' | 'off' | null
  readonly owed: boolean
}

export const NOT_SEEN: BridgeSeen = { last: null, owed: false }

// A bridge seen turning connected puts its session on the Remote Control list (decision 1.211),
// once: a connection that stays on never adds it again, so unchecking it in the menu holds. An
// unknown reading is not a change either way, and a disconnect removes nothing.
export function bridgeStep(
  before: BridgeSeen,
  now: BridgeState,
  sessionId: string | null,
  listed: (id: string) => boolean,
): { readonly seen: BridgeSeen; readonly remember: string | null } {
  if (now === 'unknown') return { seen: before, remember: null }
  if (now === 'off') return { seen: { last: 'off', owed: false }, remember: null }
  const owed = before.owed || before.last !== 'on'
  if (!owed) return { seen: { last: 'on', owed: false }, remember: null }
  if (sessionId === null) return { seen: { last: 'on', owed: true }, remember: null }
  return { seen: { last: 'on', owed: false }, remember: listed(sessionId) ? null : sessionId }
}
