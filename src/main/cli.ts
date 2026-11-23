// The commands that print and end (`usage`, `--version`, `open` with no file), run by the app's
// own binary as plain Node: Chromium never starts, so no display, desktop session or bus is
// needed, and nothing but this program can end the process. Its imports stay free of Electron.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flavorFacts } from '../core/flavor'
import { chooseLanguage, setLanguage } from '../core/i18n'
import { versionOf } from '../core/launch'
import { log } from '../core/log'
import { useProgramsFolder } from '../core/paths'
import { runUsageCli } from '../core/usage/cli'

useProgramsFolder(import.meta.dirname)

function printVersion(): number {
  // Two folders up from out/main is the app's root, inside the asar when packaged; the build adds
  // the package's version to its package.json.
  let packageJson: unknown = null
  try {
    packageJson = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
    )
  } catch (error) {
    log.warn("the app's package.json could not be read", { error })
  }
  const version = versionOf(packageJson)
  if (version === null) return 1
  process.stdout.write(`${version}\n`)
  return 0
}

function runUsage(args: readonly string[]): number {
  setLanguage(
    chooseLanguage(
      undefined,
      [process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG].filter((v): v is string =>
        Boolean(v),
      ),
    ),
  )
  return runUsageCli(args, {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
  })
}

function run(command: readonly string[]): number {
  if (command[0] === 'usage') return runUsage(command.slice(1))
  if (command[0] === 'open') {
    process.stderr.write(`Usage: ${flavorFacts().command} open <file> [<file>…]\n`)
    return 2
  }
  return printVersion()
}

// The process is left to end on its own, which Node does only once every pending write to a pipe
// has reached it; never `process.exit`, which would cut them. A write that failed (the reader went
// away) makes a 0 a 1, so a cut output never passes for a whole one. Nothing is logged then: the
// log goes to standard error, which may be the stream that failed.
let failed = false
for (const stream of [process.stdout, process.stderr])
  stream.on('error', () => {
    failed = true
  })
const code = run(process.argv.slice(2))
process.exitCode = code
process.on('exit', () => {
  if (failed && code === 0) process.exitCode = 1
})
