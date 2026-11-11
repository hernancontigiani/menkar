import { type FSWatcher, mkdirSync, watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { paneStart, sessionStartsDir } from '../core/context/statusline'
import { log } from '../core/log'

// The SessionStart hook of every claude Menkar starts writes a record naming the pane it runs in.
// A clear or an in-session resume gives that pane's session another id, which the pane follows.
export function watchPaneStarts(
  follow: (pane: string, sessionId: string, source: 'clear' | 'resume') => void,
): () => void {
  const dir = sessionStartsDir()
  mkdirSync(dir, { recursive: true })
  const read = async (name: string) => {
    let text: string
    try {
      text = await readFile(join(dir, name), 'utf8')
    } catch {
      return // renamed over or removed in between: the next event reads it
    }
    const start = paneStart(text)
    if (start) follow(start.pane, start.sessionId, start.source)
  }
  let watcher: FSWatcher | null = null
  try {
    watcher = watch(dir, (_event, name) => {
      if (name?.endsWith('.json')) void read(name)
    })
    // A watch must not keep the app alive after its windows close.
    watcher.unref()
  } catch (error) {
    log.warn(
      'session starts folder cannot be watched; a cleared or resumed tab keeps its old session',
      {
        dir,
        error,
      },
    )
  }
  return () => watcher?.close()
}
