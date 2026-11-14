import { existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

// What the app and the stand-ins genuinely run from the machine: sh, bash, env and the coreutils.
export const SYSTEM_DIRS: readonly string[] = ['/usr/bin', '/bin']

// The PATH a launched app gets: the test's own stand-ins first, then a folder holding only the
// Node that runs the suite (the stand-ins are `#!/usr/bin/env node` scripts), then the system
// directories. Never the inherited PATH: a real `claude` or `cursor-agent` in ~/.local/bin, or one
// installed globally next to Node, would make the app see an agent the test did not put there.
export function e2ePath(root: string, ...standins: readonly string[]): string {
  const node = join(root, 'node-bin')
  if (!existsSync(join(node, 'node'))) {
    mkdirSync(node, { recursive: true })
    symlinkSync(process.execPath, join(node, 'node'))
  }
  return [...standins, node, ...SYSTEM_DIRS].join(':')
}

// The entries of `path` that come from the machine rather than from the test: anything outside
// the run's own folder, the repository's tests/data and the system directories.
export function foreignEntries(path: string, root: string, repo: string): string[] {
  const inside = (entry: string, folder: string) =>
    entry === folder || entry.startsWith(`${folder}/`)
  return path
    .split(':')
    .filter(
      (entry) =>
        !SYSTEM_DIRS.includes(entry) &&
        !inside(entry, root) &&
        !inside(entry, join(repo, 'tests', 'data')),
    )
}
