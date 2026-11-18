import type { State } from './state'

// Whether the toast "‹name› keeps running in the background" was ever shown (decision 1.176):
// `background_toast` in state.json, true once it was.
export const backgroundToastShown = (state: State): boolean => state.rest.background_toast === true

export const markBackgroundToast = (state: State): State => ({
  ...state,
  rest: { ...state.rest, background_toast: true },
})
