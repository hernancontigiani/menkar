import type { State } from './state'

// The model each session was started with (decision 1.108): `models` in state.json, session id →
// model. Passed again as `--model` when the session renews, since a renew starts a new session.
// A session started without one has no entry.
function models(state: State): Record<string, string> {
  const raw = state.rest.models
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const kept: Record<string, string> = {}
  for (const [id, model] of Object.entries(raw))
    if (typeof model === 'string' && model !== '') kept[id] = model
  return kept
}

export function modelOf(state: State, id: string): string | undefined {
  return models(state)[id]
}

export function setModel(state: State, id: string, model: string): State {
  return { ...state, rest: { ...state.rest, models: { ...models(state), [id]: model } } }
}

// A session that took a new id keeps its model under it; the old id no longer has one.
export function followModel(state: State, from: string, to: string): State {
  const all = models(state)
  const model = all[from]
  if (model === undefined) return state
  const { [from]: _left, ...rest } = all
  return { ...state, rest: { ...state.rest, models: { ...rest, [to]: model } } }
}
