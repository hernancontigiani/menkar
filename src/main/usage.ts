import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { classifySince } from '../core/classifier/settings'
import { chooseLanguage, setLanguage } from '../core/i18n'
import { log } from '../core/log'
import { runUsageCli } from '../core/usage/cli'
import type { Memberships, Tokens } from '../core/usage/history'
import type { UsageView, UsageWhich } from '../core/usage/nodes'
import { PassRunner } from '../core/usage/runner'
import { currentProjects } from './projects'
import { sessions } from './sessions'
import type { Query } from './usage-query-worker'

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
  usageRunner = runner
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

function queryInWorker<T>(query: Query): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(import.meta.dirname, 'usage-query-worker.js'), {
      workerData: query,
    })
    let answer: { value: T } | null = null
    worker.once('message', (value: T) => {
      answer = { value }
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (answer) resolve(answer.value)
      else reject(new Error(`usage query worker exited with code ${code}`))
    })
  })
}

// A session's tokens over its whole history (deduplicated, its subagents included), for the session
// details; null when the history holds none of it. Read off the UI path.
export function sessionTokens(sessionId: string): Promise<Tokens | null> {
  return queryInWorker<Tokens | null>({ kind: 'sessionTokens', sessionId })
}

let usageRunner: PassRunner | null = null

// Each session's current project and each project's name, for the passes and the reports.
export function currentMemberships(): Memberships {
  const projects = currentProjects()?.projects ?? []
  const sessions = new Map<string, { id: string; name: string }>()
  for (const project of projects) {
    for (const member of project.members)
      sessions.set(member, { id: project.id, name: project.name })
  }
  return { sessions, projectNames: new Map(projects.map((p) => [p.id, p.name])) }
}

// The Usage window's figures for a period: a pass first (the same one-at-a-time runner as the
// hourly one), then the report, both off the UI path.
export async function usageView(which: UsageWhich): Promise<UsageView> {
  await usageRunner?.request()
  const categories = classifySince((await sessions.currentState()).rest) !== null
  const names = (await sessions.list()).map((s) => [s.id, s.name] as const)
  return queryInWorker<UsageView>({
    kind: 'report',
    which,
    categories,
    projectNames: [...currentMemberships().projectNames],
    names,
  })
}
