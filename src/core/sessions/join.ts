import type { SessionInfo } from './info'

// A tab started without a known session, waiting for its transcript. With the id known (a new
// session or a fork) it waits as long as the tab lives; without one it guesses the session from its
// folder and start time, and gives up, unless the agent's own process tells the id (`told`): then
// it waits for that as long as the tab lives, since a guess can take another tab's session.
export interface Pending {
  readonly startedIn: string
  readonly expectedId: string | null
  readonly folder: string
  readonly startedAt: number
  readonly tries: number
  readonly told?: boolean
}

export const UNKNOWN_ID_TRIES = 120

export type Lookup =
  | { readonly kind: 'joined'; readonly sessionId: string }
  | { readonly kind: 'waiting'; readonly pending: Pending }
  | { readonly kind: 'gaveUp' }

// One lookup: a session joins once its transcript holds a message the user typed.
export function lookUp(pending: Pending, sessions: readonly SessionInfo[]): Lookup {
  const typed = (s: SessionInfo) => s.preview !== ''
  if (pending.expectedId === null && pending.told)
    return { kind: 'waiting', pending: { ...pending, tries: pending.tries + 1 } }
  const found = pending.expectedId
    ? sessions.find((s) => s.id === pending.expectedId && typed(s))
    : sessions
        .filter(
          (s) => s.cwd === pending.folder && s.mtimeMs >= pending.startedAt - 1000 && typed(s),
        )
        .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
  if (found) return { kind: 'joined', sessionId: found.id }
  const tries = pending.tries + 1
  if (pending.expectedId === null && tries >= UNKNOWN_ID_TRIES) return { kind: 'gaveUp' }
  return { kind: 'waiting', pending: { ...pending, tries } }
}
