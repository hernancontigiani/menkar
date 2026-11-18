import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { classifySince } from '../core/classifier/settings'
import { chooseLanguage, setLanguage } from '../core/i18n'
import { log } from '../core/log'
import { runUsageCli } from '../core/usage/cli'
import type { Memberships, Tokens } from '../core/usage/history'
import type {
  ActivityView,
  ActivityWhich,
  TaskFlowView,
  UsageView,
  UsageWhich,
} from '../core/usage/nodes'
import { PassRunner } from '../core/usage/runner'
import { importActivity } from './activity'
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
// hourly one), then the report, both off the UI path. `projectId`: the opener window's project,
// whose figures alone are shown unless `allProjects`.
export async function usageView(
  which: UsageWhich,
  projectId: string | null,
  allProjects: boolean,
): Promise<UsageView> {
  await usageRunner?.request()
  const categories = classifySince((await sessions.currentState()).rest) !== null
  const names = (await sessions.list()).map((s) => [s.id, s.name] as const)
  const projectNames = currentMemberships().projectNames
  const name = projectId === null ? undefined : projectNames.get(projectId)
  return queryInWorker<UsageView>({
    kind: 'report',
    which,
    categories,
    project: projectId !== null && name !== undefined ? { id: projectId, name } : null,
    scoped: !allProjects,
    projectNames: [...projectNames],
    names,
  })
}

function openerProject(projectId: string | null): { id: string; name: string } | null {
  if (projectId === null) return null
  const name = currentMemberships().projectNames.get(projectId)
  return name === undefined ? null : { id: projectId, name }
}

// The pass brings the human's turns into the history, then the import the journal up to now:
// after the pass, never beside it, as both open the history.
async function historyUpToNow(): Promise<void> {
  await usageRunner?.request()
  await importActivity()
}

// Your time's day or week, as `usageView` reads its period.
export async function activityView(
  which: ActivityWhich,
  projectId: string | null,
  allProjects: boolean,
): Promise<ActivityView> {
  await historyUpToNow()
  return queryInWorker<ActivityView>({
    kind: 'activity',
    which,
    project: openerProject(projectId),
    scoped: !allProjects,
    projectNames: [...currentMemberships().projectNames],
  })
}

// Task times' 7 or 30 days. The flow waits for the pass too, so its import keeps that same rule.
export async function flowView(
  period: '7d' | '30d',
  projectId: string | null,
  allProjects: boolean,
): Promise<TaskFlowView> {
  await historyUpToNow()
  return queryInWorker<TaskFlowView>({
    kind: 'flow',
    period,
    project: openerProject(projectId),
    scoped: !allProjects,
  })
}
