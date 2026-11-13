// start_session's model becomes a command-line argument: one word, never read as an option.
const MODEL_REFUSAL = 'The model must be one word, as the agent names it, not starting with "-".'

export function readModel(value: unknown): { model?: string } | { refusal: string } {
  if (value === undefined) return {}
  if (typeof value !== 'string' || !/^[^\s-]\S*$/u.test(value)) return { refusal: MODEL_REFUSAL }
  return { model: value }
}
