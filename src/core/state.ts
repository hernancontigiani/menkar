import { join } from 'node:path'
import { readJson, writeJson } from './jsonstate'
import { appDirs } from './paths'

// Menkar's state.json as far as the areas built so far read it; every other key is carried in
// `rest` untouched, so a later area's (or a newer version's) keys survive a save.
export interface State {
  readonly names: Readonly<Record<string, string>>
  readonly hidden: readonly string[]
  readonly rest: Readonly<Record<string, unknown>>
}

export function statePath(): string {
  return join(appDirs().config, 'state.json')
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function parseState(value: unknown): State {
  if (!isObject(value)) return { names: {}, hidden: [], rest: {} }
  const { names, hidden, ...rest } = value
  const cleanNames: Record<string, string> = {}
  if (isObject(names)) {
    for (const [id, name] of Object.entries(names)) {
      if (id && typeof name === 'string' && name.trim()) cleanNames[id] = name.trim()
    }
  }
  const cleanHidden = Array.isArray(hidden)
    ? [...new Set(hidden.filter((id): id is string => typeof id === 'string'))].sort()
    : []
  return { names: cleanNames, hidden: cleanHidden, rest }
}

export function setAppName(state: State, id: string, name: string): State {
  const { [id]: _previous, ...names } = state.names
  const trimmed = name.trim()
  return { ...state, names: trimmed ? { ...names, [id]: trimmed } : names }
}

export function setHidden(state: State, ids: readonly string[], hidden: boolean): State {
  const set = new Set(state.hidden)
  for (const id of ids) {
    if (hidden) set.add(id)
    else set.delete(id)
  }
  return { ...state, hidden: [...set].sort() }
}

export function loadState(): Promise<State> {
  return readJson(statePath(), parseState, () => parseState({}))
}

export function saveState(state: State): Promise<void> {
  return writeJson(statePath(), { ...state.rest, names: state.names, hidden: state.hidden })
}
