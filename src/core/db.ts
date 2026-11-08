import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// node:sqlite is synchronous: whoever opens a database does so off the UI path (a worker or a
// utility process), never on Electron's main thread or in the renderer.
export interface Db {
  readonly raw: DatabaseSync
  transaction<T>(work: () => T): T
  userVersion(): number
  setUserVersion(version: number): void
  close(): void
}

export function openDb(path: string, busyTimeoutMs = 5000): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const raw = new DatabaseSync(path, { timeout: busyTimeoutMs })
  return {
    raw,
    transaction(work) {
      raw.exec('BEGIN IMMEDIATE')
      try {
        const result = work()
        raw.exec('COMMIT')
        return result
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
    },
    userVersion() {
      const row = raw.prepare('PRAGMA user_version').get()
      return Number(row?.user_version ?? 0)
    },
    setUserVersion(version) {
      if (!Number.isSafeInteger(version) || version < 0) {
        throw new RangeError(`user_version must be a non-negative integer, got ${version}`)
      }
      // A pragma takes no bound parameters; the value was checked to be an integer above.
      raw.exec(`PRAGMA user_version = ${version}`)
    },
    close() {
      raw.close()
    },
  }
}
