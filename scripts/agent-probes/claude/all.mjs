// Runs every Claude Code probe in turn, then says which failed. Each probe runs in its own process,
// so one that throws does not stop the others.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const PROBES = ['permission', 'add-dir', 'team-block', 'wake', 'prompt-hook']
const failed = []
for (const probe of PROBES) {
  console.log(`== ${probe}`)
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', join(import.meta.dirname, `${probe}.mjs`)],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) failed.push(probe)
}
console.log(failed.length === 0 ? 'every probe passed' : `failed: ${failed.join(', ')}`)
process.exitCode = failed.length === 0 ? 0 : 1
