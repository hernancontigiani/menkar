import { join } from 'node:path'

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

// A project's name as a folder name every system accepts: Windows' forbidden characters and
// control characters become '-', trailing dots and spaces go (Windows drops them), and an empty
// or reserved name gets '_'.
export function safeFolderName(name: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it replaces
  const replaced = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '')
  if (replaced === '' || RESERVED.test(replaced)) return `${replaced}_`
  return replaced
}

// Compared ignoring case, since Windows' and macOS's file systems do.
export function uniqueFolderName(safe: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()))
  if (!lower.has(safe.toLowerCase())) return safe
  for (let n = 2; ; n++) {
    const candidate = `${safe} (${n})`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

// `name`, or the first of `name (2).ext`, `name (3).ext`… that `exists` says is free.
export function clashFree(name: string, exists: (name: string) => boolean): string {
  if (!exists(name)) return name
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!exists(candidate)) return candidate
  }
}

// A file the renderer names in a project's folder: its path only when it is a plain file name of
// that folder itself, never a path, a parent or a dotfile.
export function insideFolder(folder: string, name: string): string | null {
  if (name === '' || name.startsWith('.') || /[/\\]/.test(name) || /^[A-Za-z]:/.test(name))
    return null
  return join(folder, name)
}
