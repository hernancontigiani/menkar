import { randomUUID } from 'node:crypto'
import { existsSync, watch } from 'node:fs'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { now } from '../clock'
import { appDirs } from '../paths'

// What Menkar's MCP server and the main process share: files, no socket and no port.
// A request is written whole under a temporary name and renamed into `requests/`, so main never
// reads half of one; main answers it in `responses/` the same way.

export const TOOL_NAMES = [
  'renew',
  'start_session',
  'list_sessions',
  'last_reply',
  'topic_add',
  'topic_update',
  'topic_close',
  'topic_list',
  'adopt_session',
  'task_add',
  'task_steps',
  'task_progress',
  'task_review',
  'task_close',
  'task_list',
  'set_workers_cap',
  'park_session',
  'resume_session',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export interface ControlRequest {
  readonly id: string
  readonly pane: string
  readonly tool: ToolName
  readonly args: Readonly<Record<string, unknown>>
  readonly at: number
}

export interface ControlAnswer {
  readonly ok: boolean
  readonly text: string
}

export interface ControlResponse extends ControlAnswer {
  readonly id: string
}

export function controlPaths() {
  const root = join(appDirs().cache, 'control')
  return {
    root,
    alive: join(root, 'alive.json'),
    requests: join(root, 'requests'),
    responses: join(root, 'responses'),
    tmp: join(root, 'tmp'),
    snapshots: join(root, 'snapshot'),
    turnEnds: join(root, 'turn-ends'),
    prompts: join(root, 'prompts'),
  }
}

export const RESPONSE_WAIT_MS = 10_000
const POLL_MS = 100

export const NOT_RUNNING = 'Menkar is not running, so it cannot do this now.'
export const NO_ANSWER =
  'Menkar did not answer within 10 seconds. Check its window before trying again.'

// The file is complete before it appears under its name.
export async function writeTextAtomic(dir: string, name: string, text: string): Promise<void> {
  const { tmp } = controlPaths()
  await mkdir(tmp, { recursive: true })
  await mkdir(dir, { recursive: true })
  const temporary = join(tmp, `${name}.${randomUUID()}`)
  await writeFile(temporary, text)
  await rename(temporary, join(dir, name))
}

export const writeAtomic = (dir: string, name: string, value: unknown): Promise<void> =>
  writeTextAtomic(dir, name, `${JSON.stringify(value)}\n`)

function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code
}

// Whether the Menkar that wrote alive.json still runs.
export async function menkarAlive(): Promise<boolean> {
  let pid: unknown
  try {
    pid = (JSON.parse(await readFile(controlPaths().alive, 'utf8')) as { pid?: unknown }).pid
  } catch (error) {
    if (errno(error) === 'ENOENT' || error instanceof SyntaxError) return false
    throw error
  }
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return errno(error) === 'EPERM' // alive, under another user
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function takeResponse(path: string): Promise<ControlAnswer | null> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (errno(error) === 'ENOENT') return null
    throw error
  }
  await unlink(path).catch((error: unknown) => {
    if (errno(error) !== 'ENOENT') throw error
  })
  const parsed = JSON.parse(text) as Partial<ControlResponse>
  return { ok: parsed.ok === true, text: typeof parsed.text === 'string' ? parsed.text : '' }
}

// The server's side of a call: one request, then its response, at most `waitMs` later. A request
// left unanswered is taken back, so main does not act on it after the agent was told it failed.
export async function callMenkar(
  call: Omit<ControlRequest, 'id' | 'at'>,
  waitMs: number = RESPONSE_WAIT_MS,
): Promise<ControlAnswer> {
  if (!(await menkarAlive())) return { ok: false, text: NOT_RUNNING }
  const { requests, responses } = controlPaths()
  await mkdir(responses, { recursive: true })
  const id = randomUUID()
  const responsePath = join(responses, `${id}.json`)
  let woken: () => void = () => {}
  const watcher = watch(responses, () => woken())
  try {
    await writeAtomic(requests, `${id}.json`, { ...call, id, at: now() } satisfies ControlRequest)
    const deadline = now() + waitMs
    while (now() < deadline) {
      const answer = await takeResponse(responsePath)
      if (answer) return answer
      await Promise.race([
        sleep(Math.min(POLL_MS, Math.max(0, deadline - now()))),
        new Promise<void>((resolve) => {
          woken = resolve
        }),
      ])
    }
    const late = await takeResponse(responsePath)
    if (late) return late
    await unlink(join(requests, `${id}.json`)).catch((error: unknown) => {
      if (errno(error) !== 'ENOENT') throw error
    })
    return { ok: false, text: NO_ANSWER }
  } finally {
    watcher.close()
  }
}

// What main publishes about a project for list_sessions.
export interface SnapshotSession {
  readonly name: string
  readonly id: string
  readonly state: string | null
  readonly context: number | null
  readonly parent: string | null
  readonly tab: boolean
  readonly pane: string | null
  // The orchestration mode's marks; a snapshot an older Menkar wrote has none.
  readonly role?: string | null
  readonly orchestrator?: boolean
  readonly priority?: boolean
  readonly withYou?: boolean
}

export interface Snapshot {
  readonly project: { readonly id: string; readonly name: string }
  readonly orchestration?: boolean
  readonly sessions: readonly SnapshotSession[]
}

// list_sessions' answer: the snapshot without the panes, its keys as the agents read them.
export function sessionsAnswer(snapshot: Snapshot): string {
  return JSON.stringify(
    {
      project: snapshot.project.name,
      orchestration: snapshot.orchestration === true,
      sessions: snapshot.sessions.map((s) => ({
        name: s.name,
        id: s.id,
        state: s.state,
        context: s.context,
        parent: s.parent,
        tab: s.tab,
        role: s.role ?? null,
        orchestrator: s.orchestrator === true,
        priority: s.priority === true,
        with_you: s.withYou === true,
      })),
    },
    null,
    2,
  )
}

// The snapshot of the project whose sessions include this pane's, or null.
export async function snapshotOfPane(pane: string): Promise<Snapshot | null> {
  const { snapshots } = controlPaths()
  if (!existsSync(snapshots)) return null
  for (const name of await readdir(snapshots)) {
    if (!name.endsWith('.json')) continue
    let snapshot: Snapshot
    try {
      snapshot = JSON.parse(await readFile(join(snapshots, name), 'utf8')) as Snapshot
    } catch (error) {
      // A snapshot replaced while it is read: the next one is whole.
      if (errno(error) === 'ENOENT' || error instanceof SyntaxError) continue
      throw error
    }
    if (snapshot.sessions?.some((s) => s.pane === pane)) return snapshot
  }
  return null
}
