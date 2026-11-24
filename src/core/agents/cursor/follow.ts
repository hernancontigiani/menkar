import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { log } from '../../log'
import { agentPaths } from '../../paths'
import type { FollowKind, PaneFollow } from '../types'

// Where Cursor keeps each chat's metadata, one folder per working folder's hash, then per chat.
export const chatsRoot = (): string => join(dirname(agentPaths().cursorProjects), 'chats')

const plainId = (id: string) => /^[A-Za-z0-9_-]{1,100}$/.test(id)

// When the chat was made, from its metadata; null when it is not found or says no time. Only that
// key is taken: the file also holds the chat's title.
export async function createdAt(root: string, id: string): Promise<number | null> {
  if (!plainId(id)) return null
  let folders: string[]
  try {
    folders = await readdir(root)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  for (const folder of folders) {
    let text: string
    try {
      text = await readFile(join(root, folder, id, 'meta.json'), 'utf8')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT' || code === 'ENOTDIR') continue
      throw error
    }
    try {
      const value: unknown = JSON.parse(text)
      const at =
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>).createdAtMs
          : undefined
      return typeof at === 'number' && Number.isFinite(at) ? at : null
    } catch (error) {
      log.warn("a Cursor chat's metadata could not be read", { chat: id, error })
      return null
    }
  }
  return null
}

// Cursor tells no hook of a switch inside its TUI: a turn then ends under another chat's id. `/new`
// made that chat after the pane started, and it takes the old one's place as a clear's does; `/resume`
// reopened an older one.
export function cursorFollow(root: () => string = chatsRoot): PaneFollow {
  return {
    classify(_source, change): FollowKind | Promise<FollowKind> {
      if (!change) return null
      return createdAt(root(), change.to).then((at) => {
        if (at === null) return null
        return at >= change.paneStartedAt ? 'clear' : 'resume'
      })
    },
  }
}

export const follow: PaneFollow = cursorFollow()
