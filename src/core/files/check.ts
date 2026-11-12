import { constants } from 'node:fs'
import { access, open, readFile, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Key } from '../i18n'

export const LARGEST_FILE = 10 * 1024 * 1024
export const BINARY_PROBE = 8 * 1024

// What the user typed in "Open file": trimmed; `~` and `~/` are the home folder; anything else
// must be absolute (`~user` is not expanded).
export function expandInput(input: string, home: string): { path: string } | { refusal: Key } {
  const text = input.trim()
  if (text === '~') return { path: home }
  if (text.startsWith('~/')) return { path: join(home, text.slice(2)) }
  if (text.startsWith('/')) return { path: text }
  return { refusal: 'files.needFullPath' }
}

const missing = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

// The dialog's own refusals, before the file check: a folder, or nothing there.
export async function checkTyped(path: string): Promise<Key | null> {
  try {
    if ((await stat(path)).isDirectory()) return 'files.isFolder'
  } catch (error) {
    if (missing(error)) return 'files.missing'
    throw error
  }
  return null
}

async function resolved(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch (error) {
    if (missing(error)) return path
    throw error
  }
}

// ~/.claude, anything in it, and ~/.claude.json, each resolved through links.
export async function isClaudeData(path: string, home: string): Promise<boolean> {
  const target = await resolved(path)
  const claudeDir = await resolved(join(home, '.claude'))
  const claudeJson = await resolved(join(home, '.claude.json'))
  return target === claudeJson || target === claudeDir || target.startsWith(`${claudeDir}/`)
}

export type CheckedFile =
  | { readonly path: string; readonly text: string; readonly readOnly: Key | null }
  | { readonly refusal: Key }

// `menkarFolder`: Menkar's own shipped files (its plugin folder), opened read only.
export async function checkFile(
  path: string,
  home: string,
  menkarFolder?: string,
): Promise<CheckedFile> {
  let target: string
  let size: number
  try {
    target = await realpath(path)
    const info = await stat(target)
    if (!info.isFile()) return { refusal: 'files.notFile' }
    size = info.size
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code && (error as NodeJS.ErrnoException).code !== 'EISDIR')
      return { refusal: 'files.unreadable' }
    throw error
  }
  if (size > LARGEST_FILE) return { refusal: 'files.tooLarge' }
  let bytes: Buffer
  try {
    const handle = await open(target, 'r')
    await handle.close()
    bytes = await readFile(target)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code) return { refusal: 'files.unreadable' }
    throw error
  }
  if (bytes.subarray(0, BINARY_PROBE).includes(0)) return { refusal: 'files.binary' }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    if (error instanceof TypeError) return { refusal: 'files.notUtf8' }
    throw error
  }
  if (await isClaudeData(target, home))
    return { path: target, text, readOnly: 'files.readOnlyClaude' }
  if (menkarFolder) {
    const own = await resolved(menkarFolder)
    if (target.startsWith(`${own}/`))
      return { path: target, text, readOnly: 'files.readOnlyMenkar' }
  }
  const writable = await access(target, constants.W_OK).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'EROFS') return false
      throw error
    },
  )
  return { path: target, text, readOnly: writable ? null : 'files.readOnlyPermission' }
}
