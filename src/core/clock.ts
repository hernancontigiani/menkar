export function now(): number {
  return Date.now()
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

// Local wall time with its UTC offset, e.g. 2026-11-08T23:59:30.123-03:00.
export function localIso(ms: number): string {
  const d = new Date(ms)
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

// Local wall time fit for a file name, e.g. 20261108-235930.
export function fileStamp(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}
