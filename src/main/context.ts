import { type FSWatcher, mkdirSync, watch } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { Reading } from '../core/context/reading'
import { shellQuote, writeSessionSettings } from '../core/context/settings'
import { sessionsDir } from '../core/context/statusline'
import { ReadingTracker } from '../core/context/tracker'
import { log } from '../core/log'
import { snapshotsChanged } from './control'

// The statusline is a script Claude Code runs after each assistant message, outside Menkar's
// window. Electron's own binary runs it as plain Node, so no system Node is needed.
export function statuslineCommand(): string {
  const script = join(import.meta.dirname, 'statusline.js')
  return `ELECTRON_RUN_AS_NODE=1 ${shellQuote(process.execPath)} ${shellQuote(script)}`
}

// The path every `claude` Menkar starts carries as `--settings <path>`, written (when it changed)
// before it is returned. Cursor's commands carry no such flag.
export function sessionSettingsFile(): Promise<string> {
  return writeSessionSettings(statuslineCommand())
}

const tracker = new ReadingTracker()

// Starts following a session's context: its reading now, and again whenever the statusline writes
// its file. The window calls it for each member session of the project it shows.
export function trackContext(sessionId: string, transcript: string): void {
  void tracker.track(sessionId, transcript)
}

export function contextReading(sessionId: string): Reading | null {
  return tracker.get(sessionId)
}

// Watches the statusline's session files; every window learns of a changed reading.
export function startContextReadings(): () => void {
  const dir = sessionsDir()
  mkdirSync(dir, { recursive: true })
  const stopChanges = tracker.onChange((sessionId, reading) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('context:reading', { sessionId, reading })
    }
    snapshotsChanged()
  })
  let watcher: FSWatcher | null = null
  try {
    watcher = watch(dir, (_event, name) => {
      if (name) void tracker.fileChanged(name)
    })
    // A watch must not keep the app alive after its windows close.
    watcher.unref()
  } catch (error) {
    log.warn('statusline sessions folder cannot be watched; readings will not update', {
      dir,
      error,
    })
  }
  return () => {
    stopChanges()
    watcher?.close()
  }
}
