// A link in a terminal is handed to the system with Ctrl+click, as GNOME Terminal does: an OSC 8
// hyperlink names any scheme, and the system's own handler for it decides. A string that is not a
// URL at all is no link.
export function linkUrl(uri: string): string | null {
  try {
    new URL(uri)
  } catch (error) {
    if (error instanceof TypeError) return null // not a URL at all
    throw error
  }
  return uri
}

export type LinkTarget =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }

// A file: link opens as a path, with the file's default app (a folder in the file manager); it
// names this machine when its host is empty, `localhost` or this host's name. Any other URL goes as
// it was written.
export function linkTarget(uri: string, hostname: string): LinkTarget | null {
  if (linkUrl(uri) === null) return null
  const url = new URL(uri)
  if (url.protocol !== 'file:') return { kind: 'url', url: uri }
  const host = url.hostname.toLowerCase()
  if (host !== '' && host !== 'localhost' && host !== hostname.toLowerCase()) return null
  // An escaped slash would be a different path than the one shown; NUL ends a path early.
  if (/%2f|%00/i.test(url.pathname)) return null
  try {
    return { kind: 'path', path: decodeURIComponent(url.pathname) }
  } catch (error) {
    if (error instanceof URIError) return null // an escape that decodes to no character
    throw error
  }
}

export interface FoundPath {
  // As printed: absolute, or under the home folder as `~/…`.
  readonly path: string
  // The link's span in the row, a `:line:col` suffix included; end exclusive.
  readonly start: number
  readonly end: number
}

const OPENERS = new Set(['"', "'", '`', '(', '['])
const QUOTES = new Set(['"', "'", '`'])
const TRAILING = new Set(['.', ',', ':', ';', "'", '"', '`'])
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

const count = (text: string, char: string) => text.split(char).length - 1

function trimmed(text: string): string {
  let t = text
  for (;;) {
    const last = t.at(-1) ?? ''
    const opener = CLOSERS[last]
    if (TRAILING.has(last) || (opener && count(t, last) > count(t, opener))) t = t.slice(0, -1)
    else return t
  }
}

// A plain path printed in a terminal (decision 1.64), as VS Code's terminal finds one: it starts
// at `/` or `~/` after the row's start, whitespace or an opening quote, backtick or bracket, and
// runs to whitespace, or to the closing quote when quoted, so only a quoted path holds spaces.
// Trailing punctuation is the sentence's; a `:line:col` suffix is a place in the file, which opens
// whole. One row only: whether it exists is main's to say.
export function findPaths(line: string): FoundPath[] {
  const found: FoundPath[] = []
  let i = 0
  while (i < line.length) {
    const before = i === 0 ? ' ' : (line[i - 1] ?? ' ')
    const starts = line[i] === '/' || (line[i] === '~' && line[i + 1] === '/')
    if (!starts || !(/\s/.test(before) || OPENERS.has(before))) {
      i++
      continue
    }
    const closing = QUOTES.has(before) ? line.indexOf(before, i + 1) : -1
    let runEnd = closing
    if (runEnd === -1) {
      const space = line.slice(i).search(/\s/)
      runEnd = space === -1 ? line.length : i + space
    }
    const text = trimmed(line.slice(i, runEnd))
    const suffix = /:\d+(?::\d+)?$/.exec(text)
    const path = suffix ? text.slice(0, suffix.index) : text
    const body = path.slice(path.startsWith('~') ? 2 : 1)
    if (/[^/]/.test(body)) found.push({ path, start: i, end: i + text.length })
    i = Math.max(runEnd, i + 1)
  }
  return found
}

// The path a found one names: `~/` is the home folder. Anything else that is not absolute, or
// holds a NUL, which would end the path early, is none.
export function terminalPath(text: string, home: string): string | null {
  if (text.includes('\0')) return null
  if (text.startsWith('/')) return text
  if (text.startsWith('~/')) return `${home.replace(/\/+$/, '')}${text.slice(1)}`
  return null
}
