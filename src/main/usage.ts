import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { chooseLanguage, setLanguage } from '../core/i18n'
import { log } from '../core/log'
import { runUsageCli } from '../core/usage/cli'
import type { Memberships } from '../core/usage/history'
import { PassRunner } from '../core/usage/runner'

const HOURLY_MS = 3600 * 1000

function passInWorker(memberships: Memberships): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(import.meta.dirname, 'usage-worker.js'), {
      workerData: memberships,
    })
    let done = false
    worker.once('message', () => {
      done = true
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (done) resolve()
      else reject(new Error(`usage pass worker exited with code ${code}`))
    })
  })
}

// The history keeps what Claude Code deletes with its transcripts only if they are read before
// that: a pass on start and every hour, not only when usage is looked at.
export function startUsagePasses(
  memberships: () => Memberships,
  // Runs after each pass, whatever its outcome: the classification of the turns it wrote.
  after: () => Promise<void> = async () => {},
): {
  readonly runner: PassRunner
  stop(): void
} {
  const runner = new PassRunner(() =>
    passInWorker(memberships()).finally(() => {
      void after().catch((error: unknown) => log.warn('after the usage pass', { error }))
    }),
  )
  void runner.request()
  const timer = setInterval(() => void runner.request(), HOURLY_MS)
  return { runner, stop: () => clearInterval(timer) }
}

// The command's own arguments: after the executable, Chromium's switches placed before the command,
// and (unpackaged) the app's folder.
export function cliArguments(argv: readonly string[], packaged: boolean): string[] {
  let rest = argv.slice(1)
  while (rest[0]?.startsWith('--')) rest = rest.slice(1)
  if (!packaged) rest = rest.slice(1)
  return rest
}

// `menkar usage …`: the report printed in the terminal, with no window. The exit code.
export function runUsageCommand(args: readonly string[]): number {
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
