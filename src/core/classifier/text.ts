import { t } from '../i18n'
import type { Estimate, RunResult } from './run'

// Rounded half to even, as agent-tablet's figures were.
function roundEven(value: number, digits = 0): number {
  const scaled = value * 10 ** digits
  const floor = Math.floor(scaled)
  const rounded =
    Math.abs(scaled - floor - 0.5) < 1e-9
      ? floor % 2 === 0
        ? floor
        : floor + 1
      : Math.round(scaled)
  return rounded / 10 ** digits
}

const pad = (n: number) => String(n).padStart(2, '0')

// The run's local time: HH:MM when it was today, else YYYY-MM-DD HH:MM.
function when(atSeconds: number, nowSeconds: number): string {
  const at = new Date(atSeconds * 1000)
  const now = new Date(nowSeconds * 1000)
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()
  return sameDay
    ? time
    : `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${time}`
}

// The second line under the switch, from `classify_last`: our words, never Claude's output.
export function statusText(last: unknown, nowSeconds: number): string {
  if (typeof last !== 'object' || last === null) return ''
  const { at, classified, failed } = last as Record<string, unknown>
  if (typeof at !== 'number' || !Number.isFinite(at)) return ''
  const shown = when(at, nowSeconds)
  if (failed) return t('classifier.failed', { when: shown })
  return t('classifier.classified', {
    count: String(typeof classified === 'number' ? classified : 0),
    when: shown,
  })
}

export function costText(dollars: number): string {
  return dollars < 0.01
    ? t('classifier.costUnderCent')
    : t('classifier.cost', { amount: roundEven(dollars, 2).toFixed(2) })
}

export function durationText(seconds: number): string {
  const minutes = roundEven(seconds / 60)
  return minutes === 0
    ? t('classifier.underMinute')
    : t('classifier.minutes', { minutes: String(minutes) })
}

// The earlier-turns dialog's estimate, one line per item.
export function estimateLines(found: Estimate): string[] {
  const lines = [
    t('classifier.turnsToSend', { turns: String(found.turns) }),
    t('classifier.estimatedUse', { cost: costText(found.dollars) }),
    t('classifier.estimatedTime', { took: durationText(found.seconds) }),
  ]
  if (found.unavailable > 0)
    lines.push(t('classifier.unavailable', { count: String(found.unavailable) }))
  return lines
}

export function progressText(sent: number, total: number): string {
  return t('classifier.progress', { sent: String(sent), total: String(total) })
}

export function resultSetting(result: RunResult): {
  at: number
  classified: number
  failed: boolean
} {
  return { at: result.at, classified: result.classified, failed: result.failed }
}
