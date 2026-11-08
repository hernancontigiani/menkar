import { formatSize } from '../format'
import type { Key } from '../i18n'
import type { SessionInfo } from './info'

// No Node import: the renderer builds the history browser and the switcher from these.

const lastComponent = (path: string) => path.split('/').filter(Boolean).pop() ?? ''

// The last component of the folder; the whole cwd when that is empty (`/`); without a cwd, the
// name of the directory holding the transcript.
export function folderName(session: SessionInfo): string {
  if (session.cwd !== null) return lastComponent(session.cwd) || session.cwd
  return lastComponent(session.folder)
}

export interface FolderGroup {
  readonly name: string
  readonly sessions: readonly SessionInfo[]
}

export function groupByFolder(sessions: readonly SessionInfo[]): FolderGroup[] {
  const groups = new Map<string, SessionInfo[]>()
  for (const session of [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs)) {
    const name = folderName(session)
    const list = groups.get(name) ?? []
    list.push(session)
    groups.set(name, list)
  }
  return [...groups].map(([name, list]) => ({ name, sessions: list }))
}

export function sessionSearchText(session: SessionInfo): string {
  return [session.name, folderName(session), session.preview, session.id].join(' ').toLowerCase()
}

export const SEARCH_LIMIT = 50

// The query trimmed and lowercased, as a substring of each item's search text; at most `limit`.
export function filterSearch<T>(
  items: readonly T[],
  query: string,
  text: (item: T) => string,
  limit = SEARCH_LIMIT,
): T[] {
  const q = query.trim().toLowerCase()
  const kept = q ? items.filter((item) => text(item).includes(q)) : [...items]
  return kept.slice(0, limit)
}

export function countLine(sessions: readonly SessionInfo[], open: number) {
  const size = sessions.reduce((sum, s) => sum + s.size, 0)
  return {
    sessions: sessions.length,
    projects: new Set(sessions.map(folderName)).size,
    size: formatSize(size),
    open,
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type RelativeTime =
  | { readonly key: Key; readonly params?: { readonly n: number } }
  | { readonly date: string }

export function relativeTime(mtimeMs: number, nowMs: number): RelativeTime {
  const age = nowMs - mtimeMs
  if (age < MINUTE) return { key: 'time.justNow' }
  if (age < HOUR) return { key: 'time.minutes', params: { n: Math.floor(age / MINUTE) } }
  if (age < DAY) return { key: 'time.hours', params: { n: Math.floor(age / HOUR) } }
  if (age < 7 * DAY) return { key: 'time.days', params: { n: Math.floor(age / DAY) } }
  const d = new Date(mtimeMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
}

export function recentFolders(sessions: readonly SessionInfo[]): string[] {
  const seen = new Set<string>()
  for (const session of [...sessions].sort((a, b) => b.mtimeMs - a.mtimeMs)) {
    if (session.cwd !== null) seen.add(session.cwd)
  }
  return [...seen]
}
