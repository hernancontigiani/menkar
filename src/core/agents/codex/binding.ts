import { readdir } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { field, parseLine } from '../shared/jsonl'
import { streamLines } from '../shared/zstd'
import type { PaneFollow } from '../types'
import { codexHome } from './config'

// A thread's rollout, `sessions/YYYY/MM/DD/rollout-<local time>-<thread id>.jsonl`; a thread
// reverted to an earlier point continues in `…-<thread id>_<rollout>.jsonl`.
const ROLLOUT =
  /^\d{4}\/\d{2}\/\d{2}\/rollout-[^/]*-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:_[^/]*)?\.jsonl$/

// The thread whose rollout this open file is, or null for any other file.
export function rolloutThread(link: string, sessions: string): string | null {
  const prefix = sessions.endsWith(sep) ? sessions : `${sessions}${sep}`
  if (!link.startsWith(prefix)) return null
  const relative = link.slice(prefix.length).split(sep).join('/')
  return ROLLOUT.exec(relative)?.[1]?.toLowerCase() ?? null
}

// The one thread whose rollout a process tree holds open; null when it holds none, or several and
// which is the pane's cannot be told.
export function heldThread(
  links: readonly string[],
  sessions: string = join(codexHome(), 'sessions'),
): string | null {
  const threads = new Set<string>()
  for (const link of links) {
    const thread = rolloutThread(link, sessions)
    if (thread) threads.add(thread)
  }
  return threads.size === 1 ? ([...threads][0] ?? null) : null
}

const days = async (path: string): Promise<string[]> => {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse()
  } catch {
    return [] // no such folder yet
  }
}

// The thread's rollout under `sessions/YYYY/MM/DD/`, newest days first; null when it has none.
// Codex's title generation runs as a thread of its own that never has one.
export async function findRollout(sessions: string, id: string): Promise<string | null> {
  const suffixes = [`-${id}.jsonl`, `-${id}.jsonl.zst`]
  for (const year of await days(sessions))
    for (const month of await days(join(sessions, year)))
      for (const day of await days(join(sessions, year, month))) {
        const folder = join(sessions, year, month, day)
        let names: string[]
        try {
          names = await readdir(folder)
        } catch {
          continue // removed while walked
        }
        const name = names.find(
          (n) => n.startsWith('rollout-') && suffixes.some((suffix) => n.endsWith(suffix)),
        )
        if (name) return join(folder, name)
      }
  return null
}

// A UUIDv7's first 48 bits: when Codex minted the thread's id, which it does when the thread is
// created (a new session, a /new, a fork), not at its first message.
export function mintedAt(id: string): number | null {
  const hex = id.replaceAll('-', '')
  if (!/^[0-9a-fA-F]{32}$/.test(hex) || hex[12] !== '7') return null
  return Number.parseInt(hex.slice(0, 12), 16)
}

// The thread a fork was made from, from its rollout's first line; null for any other thread.
async function forkedFrom(rollout: string): Promise<string | null> {
  for await (const raw of streamLines(rollout)) {
    const line = parseLine(raw)
    const meta = line && line.type === 'session_meta' ? field(line, 'payload') : null
    const source = field(meta, 'forked_from_id')
    return typeof source === 'string' && source !== '' ? source : null
  }
  return null
}

// A thread made in the pane after it started is a /new, which takes the old one's place; an older
// one is a /resume, and a fork, however new, is another session as a resume is.
export const follow: PaneFollow = {
  classify(_source, change) {
    if (!change) return null
    const minted = mintedAt(change.to)
    if (minted === null || minted < change.paneStartedAt) return 'resume'
    return findRollout(join(codexHome(), 'sessions'), change.to).then(async (rollout) =>
      rollout && (await forkedFrom(rollout)) !== null ? 'resume' : 'clear',
    )
  },
}
