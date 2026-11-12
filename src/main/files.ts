import { type FSWatcher, watch } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname } from 'node:path'
import { ChangeSet, Text } from '@codemirror/state'
import { checkFile, isClaudeData } from '../core/files/check'
import type { Key } from '../core/i18n'
import { log } from '../core/log'
import { skillsPluginDir } from './control'

// One buffer per file for the whole app, every window and project: identity is the path resolved
// through links. Windows are separate processes, so the buffer lives here and they follow it.
interface FileBuffer {
  readonly path: string
  doc: Text
  version: number
  dirty: boolean
  readonly readOnly: Key | null
  bar: 'changed' | 'deleted' | null
  // The text last read from or written to disk, so the app's own save is not a change on disk.
  disk: string
  watcher: FSWatcher | undefined
}

export interface BufferState {
  readonly path: string
  readonly text: string
  readonly version: number
  readonly dirty: boolean
  readonly readOnly: Key | null
  readonly bar: 'changed' | 'deleted' | null
}

export interface BufferUpdate extends BufferState {
  // The edit that made this version, for windows that apply it instead of replacing the text.
  readonly changes?: unknown
  // The tab that made the edit, which has it already.
  readonly origin?: string
}

const buffers = new Map<string, FileBuffer>()
let notify: (update: BufferUpdate) => void = () => {}

export function onBufferUpdate(listener: (update: BufferUpdate) => void): void {
  notify = listener
}

const docOf = (text: string) => Text.of(text.split('\n'))

function stateOf(b: FileBuffer): BufferState {
  return {
    path: b.path,
    text: b.doc.toString(),
    version: b.version,
    dirty: b.dirty,
    readOnly: b.readOnly,
    bar: b.bar,
  }
}

function publish(b: FileBuffer, extra: { changes?: unknown; origin?: string } = {}): void {
  notify({ ...stateOf(b), ...extra })
}

export function bufferState(path: string): BufferState | undefined {
  const b = buffers.get(path)
  return b ? stateOf(b) : undefined
}

export const isDirty = (path: string) => buffers.get(path)?.dirty === true

// Opens (or finds) the buffer of a file after the file check; the path given back is resolved.
export async function openBuffer(path: string): Promise<{ path: string } | { refusal: Key }> {
  const checked = await checkFile(path, homedir(), skillsPluginDir())
  if ('refusal' in checked) return checked
  const existing = buffers.get(checked.path)
  if (existing) return { path: existing.path }
  const b: FileBuffer = {
    path: checked.path,
    doc: docOf(checked.text),
    version: 0,
    dirty: false,
    readOnly: checked.readOnly,
    bar: null,
    disk: checked.text,
    watcher: undefined,
  }
  buffers.set(b.path, b)
  watchFile(b)
  return { path: b.path }
}

// The folder is watched, not the file: a save by rename or a deletion would end a file watch.
function watchFile(b: FileBuffer): void {
  try {
    b.watcher = watch(dirname(b.path), { persistent: false }, (_event, name) => {
      if (name === null || name === basename(b.path)) void onDiskChange(b)
    })
    b.watcher.on('error', (error) =>
      log.warn('stopped watching an open file', { path: b.path, error }),
    )
  } catch (error) {
    log.warn('could not watch an open file', { path: b.path, error })
  }
}

async function onDiskChange(b: FileBuffer): Promise<void> {
  if (buffers.get(b.path) !== b) return
  let text: string
  try {
    text = await readFile(b.path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (b.bar !== 'deleted') {
      b.bar = 'deleted'
      publish(b)
    }
    return
  }
  if (text === b.disk) {
    if (b.bar === 'deleted') {
      b.bar = null
      publish(b)
    }
    return
  }
  b.disk = text
  if (b.dirty) b.bar = 'changed'
  else {
    b.doc = docOf(text)
    b.version += 1
    b.bar = null
  }
  publish(b)
}

// An edit made in one tab: applied when it was made on the current version; otherwise that tab is
// sent the whole text to start again from.
export function applyEdit(path: string, base: number, changes: unknown, origin: string): boolean {
  const b = buffers.get(path)
  if (!b || b.readOnly) return false
  if (base !== b.version) {
    publish(b)
    return false
  }
  b.doc = ChangeSet.fromJSON(changes).apply(b.doc)
  b.version += 1
  b.dirty = b.doc.toString() !== b.disk || b.bar === 'deleted'
  publish(b, { changes, origin })
  return true
}

export async function saveBuffer(path: string): Promise<Key | null> {
  const b = buffers.get(path)
  if (!b) return null
  // Refused again right before writing, whatever the tab said.
  if (b.readOnly || (await isClaudeData(path, homedir())))
    return b.readOnly ?? 'files.readOnlyClaude'
  const text = b.doc.toString()
  try {
    b.disk = text
    await writeFile(path, text, 'utf8')
  } catch (error) {
    log.error('a file could not be saved', { path, error })
    return 'files.saveFailed'
  }
  b.dirty = false
  b.bar = null
  publish(b)
  return null
}

export async function reloadBuffer(path: string): Promise<void> {
  const b = buffers.get(path)
  if (!b) return
  try {
    const text = await readFile(path, 'utf8')
    b.disk = text
    b.doc = docOf(text)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  b.version += 1
  b.dirty = false
  b.bar = null
  publish(b)
}

export function keepMine(path: string): void {
  const b = buffers.get(path)
  if (!b) return
  b.bar = null
  publish(b)
}

// A buffer lives while any tab, editor or preview, holds it.
export function releaseBuffersExcept(live: ReadonlySet<string>): void {
  for (const [path, b] of buffers) {
    if (live.has(path)) continue
    b.watcher?.close()
    buffers.delete(path)
  }
}
