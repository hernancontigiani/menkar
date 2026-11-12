import type { State } from './state'

// The sessions muted by hand (decision 1.104): `muted` in state.json, ids only. A muted session
// raises no sound, toast or desktop notice, in any mode; its dot still shows.
export function mutedList(state: State): string[] {
  const raw = state.rest.muted
  return Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === 'string'))].sort()
    : []
}

export function setMuted(state: State, id: string, on: boolean): State {
  const list = new Set(mutedList(state))
  if (on) list.add(id)
  else list.delete(id)
  return { ...state, rest: { ...state.rest, muted: [...list].sort() } }
}

// A session that took a new id stays muted under it; the old id no longer is.
export function followMuted(state: State, from: string, to: string): State {
  if (!mutedList(state).includes(from)) return state
  return setMuted(setMuted(state, from, false), to, true)
}
