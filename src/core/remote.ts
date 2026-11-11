import type { State } from './state'

// The sessions started and resumed with Remote Control: `remote_control` in state.json, ids only.
export function remoteControlList(state: State): string[] {
  const raw = state.rest.remote_control
  return Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === 'string'))].sort()
    : []
}

export function setRemoteControl(state: State, id: string, on: boolean): State {
  const list = new Set(remoteControlList(state))
  if (on) list.add(id)
  else list.delete(id)
  return { ...state, rest: { ...state.rest, remote_control: [...list].sort() } }
}

// After a clear the new id takes the old one's place (decision 1.56), Remote Control included: its
// next start carries the flag, and the old id's no longer does.
export function followRemoteControl(state: State, from: string, to: string): State {
  if (!remoteControlList(state).includes(from)) return state
  return setRemoteControl(setRemoteControl(state, from, false), to, true)
}

// The name the session shows on the phone: never empty, since the CLI would make one up.
export function remoteName(displayName: string, cwd: string | null, id: string): string {
  const name = displayName.trim()
  if (name) return name
  const folder = cwd?.split('/').filter(Boolean).pop()
  return folder || id.slice(0, 8)
}
