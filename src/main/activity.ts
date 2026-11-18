import { randomUUID } from 'node:crypto'
import { access, appendFile, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { markDue } from '../core/activity/marks'
import { sessionIdByName } from '../core/activity/names'
import { type PromptAnswered, PromptTracker } from '../core/activity/prompts'
import {
  type SessionIdByName,
  type TaskStateChange,
  type TopicActivity,
  taskEvents,
  topicEvents,
} from '../core/activity/record'
import type { ShownState } from '../core/agentstate/shown'
import { now } from '../core/clock'
import { log } from '../core/log'
import { emptyTasks, isOpen, type Tasks } from '../core/orchestration/tasks'
import type { Topics } from '../core/orchestration/topics'
import { projectOf } from '../core/projects/model'
import {
  type ActivityImport,
  activityDir,
  batchPath,
  JOURNAL_VERSION,
  type JournalEvent,
} from '../core/usage/activity'
import { onShownChange } from './agentstate'
import { type AgentPane, agentPanes, onAgentPane } from './panes'
import { currentProjects } from './projects'
import { sessions } from './sessions'

type Unstamped =
  | TaskStateChange
  | TopicActivity
  | (PromptAnswered & { readonly projectId?: string })
  | { readonly kind: 'app_start' }
  | { readonly kind: 'present'; readonly projectId?: string }
  | { readonly kind: 'away' | 'back' }
  | { readonly kind: 'prompted_start'; readonly sessionId: string; readonly projectId?: string }

const journalPath = () => join(activityDir(), 'journal.jsonl')
// Written once the first start's baseline is on disk: a crash before it gives a baseline next time.
const baselinePath = () => join(activityDir(), 'baseline')
const seconds = () => now() / 1000
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

// The time is taken when the event happens, not when its line is written.
function stamp<E extends Unstamped>(event: E, at: number): E & JournalEvent {
  return { v: JOURNAL_VERSION, id: randomUUID(), at, ...event } as E & JournalEvent
}

// Every append and every rename of the journal, one at a time: a rename never cuts an append.
let queue: Promise<void> = Promise.resolve()

function enqueue(work: () => Promise<void>): Promise<void> {
  queue = queue
    .then(work)
    .catch((error: unknown) => log.warn('the activity journal could not be written', { error }))
  return queue
}

async function write(lines: readonly JournalEvent[]): Promise<void> {
  if (lines.length === 0) return
  await mkdir(activityDir(), { recursive: true })
  await appendFile(journalPath(), lines.map((line) => `${JSON.stringify(line)}\n`).join(''))
}

async function rotate(): Promise<void> {
  try {
    if ((await stat(journalPath())).size === 0) return
  } catch (error) {
    if (missing(error)) return
    throw error
  }
  await rename(journalPath(), batchPath(activityDir(), now()))
}

async function resolver(): Promise<SessionIdByName> {
  return sessionIdByName(await sessions.list(), currentProjects())
}

// Every change of the tasks, by a tool, the Board or a renew: a task appearing, or its state or
// whom it waits on changing.
export function recordTasks(before: Tasks, after: Tasks): void {
  const at = seconds()
  let named = false
  const changes = taskEvents(before, after, () => {
    named = true
    return undefined
  })
  if (changes.length === 0) return
  void enqueue(async () => {
    const resolved = named ? taskEvents(before, after, await resolver()) : changes
    await write(resolved.map((change) => stamp(change, at)))
  })
}

export function recordTopics(before: Topics, after: Topics): void {
  const at = seconds()
  const events = topicEvents(before, after)
  if (events.length === 0) return
  void enqueue(() => write(events.map((event) => stamp(event, at))))
}

let lastPresent: number | null = null

// A window's presence mark; every window's together keep to one a minute. `shown` is asked only
// for a mark that is written.
export function recordPresent(shown: () => string | undefined): void {
  const ms = now()
  if (!markDue(lastPresent, ms)) return
  lastPresent = ms
  const projectId = shown()
  const event =
    projectId === undefined ? { kind: 'present' as const } : { kind: 'present' as const, projectId }
  void enqueue(() => write([stamp(event, ms / 1000)]))
}

// A session started or resumed with a first prompt on its command line: its next turn is that
// prompt, which the human did not type.
export function recordPromptedStart(sessionId: string, projectId: string | undefined): void {
  const at = seconds()
  const event = { kind: 'prompted_start' as const, sessionId }
  void enqueue(() => write([stamp(projectId === undefined ? event : { ...event, projectId }, at)]))
}

// The human set away or back, by any of the ways presence changes.
export function recordPresence(away: boolean): void {
  const at = seconds()
  void enqueue(() => write([stamp({ kind: away ? ('away' as const) : ('back' as const) }, at)]))
}

const prompts = new PromptTracker()

function shownChanged(
  paneId: string,
  sessionId: string | null,
  previous: ShownState,
  next: ShownState,
): void {
  const at = seconds()
  const answered = prompts.change(paneId, sessionId, previous, next, at)
  if (answered === undefined) return
  // A pane whose agent exited left its question with nobody to answer it.
  if (
    !agentPanes()
      .find((pane) => pane.id === paneId)
      ?.foreground()
  )
    return
  const projects = currentProjects()
  const projectId =
    sessionId === null || projects === undefined ? undefined : projectOf(projects, sessionId)?.id
  void enqueue(() =>
    write([stamp(projectId === undefined ? answered : { ...answered, projectId }, at)]),
  )
}

// Only open tasks, each once, at the first start that records: a task's flow is counted from it.
async function baseline(tasks: Tasks, at: number): Promise<void> {
  try {
    await access(baselinePath())
    return
  } catch (error) {
    if (!missing(error)) throw error
  }
  const open: Tasks = {
    ...tasks,
    projects: Object.fromEntries(
      Object.entries(tasks.projects).map(([id, own]) => [
        id,
        { ...own, tasks: own.tasks.filter(isOpen) },
      ]),
    ),
  }
  const changes = taskEvents(emptyTasks(), open, await resolver())
  await write(changes.map((change) => ({ ...stamp(change, at), baseline: true })))
  await mkdir(activityDir(), { recursive: true })
  await writeFile(baselinePath(), '')
}

function importInWorker(): Promise<ActivityImport | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(import.meta.dirname, 'activity-worker.js'))
    let answer: { value: ActivityImport | null } | null = null
    worker.once('message', (value: ActivityImport | null) => {
      answer = { value }
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (answer) resolve(answer.value)
      else reject(new Error(`activity worker exited with code ${code}`))
    })
  })
}

async function batchesWaiting(): Promise<boolean> {
  try {
    return (await readdir(activityDir())).some((name) => name.startsWith('batch-'))
  } catch (error) {
    if (missing(error)) return false
    throw error
  }
}

let importing: Promise<void> = Promise.resolve()

// After each usage pass: the journal so far becomes a batch, and every batch goes into the
// history. A failed import leaves its batches for the next one.
export function importActivity(): Promise<void> {
  importing = importing
    .then(async () => {
      await enqueue(rotate)
      if (!(await batchesWaiting())) return
      const result = await importInWorker()
      if (result === null) log.info('activity left for a newer Menkar’s history')
      else log.info('activity imported', { ...result })
    })
    .catch((error: unknown) => log.warn('the activity journal could not be imported', { error }))
  return importing
}

// A journal a crash or a quit left is set aside first: a last line torn by a power loss would
// otherwise swallow this start's app_start, which ends any away period.
export function startActivity(tasks: Tasks): () => void {
  const at = seconds()
  void enqueue(rotate)
  void enqueue(() => write([stamp({ kind: 'app_start' }, at)]))
  void enqueue(() => baseline(tasks, at))
  const follow = (pane: AgentPane) => pane.onClose(() => prompts.closed(pane.id))
  for (const pane of agentPanes()) follow(pane)
  const stopPanes = onAgentPane(follow)
  const stopShown = onShownChange(shownChanged)
  return () => {
    stopPanes()
    stopShown()
  }
}
