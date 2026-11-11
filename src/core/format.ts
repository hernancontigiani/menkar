const UNITS = ['KB', 'MB', 'GB'] as const

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${UNITS[unit]}`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function formatTimestamp(value: string | undefined): string {
  if (value === undefined) return '—'
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return value
  return formatTime(ms)
}

// Local `YYYY-MM-DD HH:MM` of a moment in milliseconds.
export function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
