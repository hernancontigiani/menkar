// The no-write check of R9 (§2.10 of the multi-agent architecture), shared by the core contract,
// which reads each agent's sessions, and main's, which runs each agent's own commands: every file
// under the home keeps its bytes and mtime and the tree its listing, except a declared path.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { DeclaredWrites } from '../../../../src/core/agents/types'

export const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents')

export interface Entry {
  readonly bytes: Buffer
  readonly mtime: number
}

// A folder is listed by its path ending in '/', so one that appears empty is seen; its mtime moves
// with every file written in it, so only its presence is compared.
const FOLDER: Entry = { bytes: Buffer.alloc(0), mtime: 0 }

// Every file and folder under the home, by its path relative to the home.
export function filesOf(home: string): Map<string, Entry> {
  const files = new Map<string, Entry>()
  const walk = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name)
      if (item.isDirectory()) {
        files.set(`${relative(home, path).split(sep).join('/')}/`, FOLDER)
        walk(path)
      } else
        files.set(relative(home, path).split(sep).join('/'), {
          bytes: readFileSync(path),
          mtime: statSync(path).mtimeMs,
        })
    }
  }
  walk(home)
  return files
}

// The paths that changed beyond what the agent declares: a file that appeared, vanished or whose
// bytes or mtime differ, unless a declared pattern allows it.
export function undeclared(
  before: Map<string, Entry>,
  after: Map<string, Entry>,
  writes: DeclaredWrites,
): string[] {
  const matches = (patterns: readonly RegExp[], path: string) => patterns.some((p) => p.test(path))
  const out: string[] = []
  for (const [path, entry] of after) {
    const was = before.get(path)
    if (!was) {
      if (!matches([...writes.created, ...writes.changed], path)) out.push(`created ${path}`)
    } else if (!was.bytes.equals(entry.bytes) || was.mtime !== entry.mtime) {
      if (!matches(writes.changed, path)) out.push(`changed ${path}`)
    }
  }
  for (const path of before.keys()) if (!after.has(path)) out.push(`removed ${path}`)
  return out.sort()
}
