import type { RunResult } from './run'

// The two settings of the classification, under `settings` in state.json: when the switch was last
// turned on (null or absent: off) and the last run.
type Rest = Readonly<Record<string, unknown>>

function settingsOf(rest: Rest): Record<string, unknown> {
  const settings = rest.settings
  return typeof settings === 'object' && settings !== null && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {}
}

export function classifySince(rest: Rest): number | null {
  const since = settingsOf(rest).classify_since
  return typeof since === 'number' && Number.isFinite(since) ? since : null
}

export function classifyLast(rest: Rest): unknown {
  return settingsOf(rest).classify_last
}

// Turning the switch on stores the moment; off stores null. On again starts from the new moment.
export function withSwitch(rest: Rest, on: boolean, nowSeconds: number): Record<string, unknown> {
  return { ...rest, settings: { ...settingsOf(rest), classify_since: on ? nowSeconds : null } }
}

export function withLastRun(rest: Rest, result: RunResult): Record<string, unknown> {
  return {
    ...rest,
    settings: {
      ...settingsOf(rest),
      classify_last: { at: result.at, classified: result.classified, failed: result.failed },
    },
  }
}
