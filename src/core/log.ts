import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { localIso, now } from './clock'

export type Level = 'debug' | 'info' | 'warning' | 'error'
export type Fields = Readonly<Record<string, unknown>>
export type Sink = (line: string) => void

const RANK: Record<Level, number> = { debug: 10, info: 20, warning: 30, error: 40 }

function threshold(): number {
  const value = process.env.MENKAR_LOG?.toLowerCase()
  return value && value in RANK ? RANK[value as Level] : RANK.warning
}

function stderrSink(line: string): void {
  process.stderr.write(`${line}\n`)
}

const sinks = new Set<Sink>([stderrSink])

export function addSink(sink: Sink): () => void {
  sinks.add(sink)
  return () => sinks.delete(sink)
}

function encode(value: unknown): string {
  if (value instanceof Error) return JSON.stringify(`${value.name}: ${value.message}`)
  if (typeof value === 'string' && /^[\w./:@+-]+$/.test(value)) return value
  return JSON.stringify(value) ?? String(value)
}

export function formatRecord(ms: number, level: Level, message: string, fields: Fields): string {
  const pairs = Object.entries(fields).map(([key, value]) => `${key}=${encode(value)}`)
  return [localIso(ms), level.toUpperCase(), message, ...pairs].join(' ')
}

function emit(level: Level, message: string, fields: Fields): void {
  if (RANK[level] < threshold()) return
  const line = formatRecord(now(), level, message, fields)
  for (const sink of sinks) sink(line)
}

export const log = {
  debug: (message: string, fields: Fields = {}) => emit('debug', message, fields),
  info: (message: string, fields: Fields = {}) => emit('info', message, fields),
  warn: (message: string, fields: Fields = {}) => emit('warning', message, fields),
  error: (message: string, fields: Fields = {}) => emit('error', message, fields),
}

export interface FileSink {
  readonly sink: Sink
  close(): Promise<void>
}

// Appends through a stream so a record never waits on the disk. When the file would pass
// `maxBytes` it becomes `<path>.1`, replacing the previous one, and a new file starts.
export async function openFileSink(path: string, maxBytes: number): Promise<FileSink> {
  await mkdir(dirname(path), { recursive: true })
  let size = await stat(path).then(
    (s) => s.size,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return 0
      throw error
    },
  )
  const open = (): WriteStream =>
    createWriteStream(path, { flags: 'a' }).on('error', (error) => {
      // The file sink cannot report its own failure to itself.
      stderrSink(formatRecord(now(), 'error', 'log file write failed', { path, error }))
    })
  const end = (s: WriteStream) => new Promise<void>((resolve) => s.end(resolve))
  let stream = open()
  let chain: Promise<void> = Promise.resolve()

  const sink: Sink = (line) => {
    const bytes = Buffer.byteLength(line) + 1
    const rotating = size > 0 && size + bytes > maxBytes
    size = rotating ? bytes : size + bytes
    chain = chain
      .then(async () => {
        if (rotating) {
          await end(stream)
          await rename(path, `${path}.1`)
          stream = open()
        }
        stream.write(`${line}\n`)
      })
      .catch((error: unknown) => {
        stderrSink(formatRecord(now(), 'error', 'log file rotation failed', { path, error }))
      })
  }

  return {
    sink,
    async close() {
      await chain
      await end(stream)
    },
  }
}
