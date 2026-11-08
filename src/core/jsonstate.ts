import { randomBytes } from 'node:crypto'
import { access, mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileStamp, now } from './clock'
import { log } from './log'

// The file-system calls a write makes, replaceable so a test can fail one midway.
export interface WriteIo {
  rename(from: string, to: string): Promise<void>
}

const realIo: WriteIo = { rename }

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false
      throw error
    },
  )
}

async function moveAside(path: string): Promise<string> {
  const base = `${path}.broken-${fileStamp(now())}`
  let target = base
  for (let n = 2; await exists(target); n += 1) target = `${base}-${n}`
  await rename(path, target)
  return target
}

// `parse` turns whatever the file held into the caller's shape, repairing what it must, and keeps
// the keys it does not know so a later write does not drop what a newer version stored. A file
// that is not JSON at all is moved aside, never deleted, and `fallback` is returned.
export async function readJson<T>(
  path: string,
  parse: (value: unknown) => T,
  fallback: () => T,
): Promise<T> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback()
    throw error
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const movedTo = await moveAside(path)
    log.warn('state file is not JSON; moved aside', { path, movedTo, error })
    return fallback()
  }
  return parse(value)
}

const writes = new Map<string, Promise<void>>()

// The whole file or nothing: a temporary file in the same directory, flushed to disk, then renamed
// over the old one. Writes to the same path run one after another, in call order.
export function writeJson(path: string, value: unknown, io: WriteIo = realIo): Promise<void> {
  const previous = writes.get(path) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => writeWhole(path, value, io))
  writes.set(path, next)
  const forget = () => {
    if (writes.get(path) === next) writes.delete(path)
  }
  // The caller gets the rejection through `next`; this branch only tidies the map.
  next.then(forget, forget)
  return next
}

async function writeWhole(path: string, value: unknown, io: WriteIo): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const temporary = join(dir, `.${basename(path)}.${randomBytes(6).toString('hex')}.tmp`)
  const handle = await open(temporary, 'w')
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await io.rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}
