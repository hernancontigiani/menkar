import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, watch } from 'node:fs'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type AgentId, parseAgentId } from '../agents/ids'
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
  'task_star',
  'set_workers_cap',
  'human_back',
  'human_away',
  'park_session',
  'resume_session',
  'trash_files',
  'ask',
  'inbox',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

// Who calls a tool: a pane Menkar started, or a session an agent's server names in its request.
export type Caller =
  | { readonly pane: string }
  | { readonly agentSession: { readonly meta: string; readonly id: string } }

export interface ControlRequest {
  readonly id: string
  readonly caller: Caller
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
    // The orchestrator's inbox, by pane id, for its prompt hook to read.
    inbox: join(root, 'inbox'),
    prompts: join(root, 'prompts'),
    // Each pane's team block, by pane id: Claude reads it once, at start.
    team: join(root, 'team'),
    tools: join(root, 'tools.json'),
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

// Whether the Menkar that wrote alive.json, read as `text`, still runs.
function aliveIn(text: string): boolean {
  let pid: unknown
  try {
    pid = (JSON.parse(text) as { pid?: unknown }).pid
  } catch (error) {
    if (error instanceof SyntaxError) return false
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

export async function menkarAlive(): Promise<boolean> {
  let text: string
  try {
    text = await readFile(controlPaths().alive, 'utf8')
  } catch (error) {
    if (errno(error) === 'ENOENT') return false
    throw error
  }
  return aliveIn(text)
}

// For a command-line path that is synchronous end to end.
export function menkarAliveSync(): boolean {
  let text: string
  try {
    text = readFileSync(controlPaths().alive, 'utf8')
  } catch (error) {
    if (errno(error) === 'ENOENT') return false
    throw error
  }
  return aliveIn(text)
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
  readonly skills?: readonly { readonly name: string; readonly maintainer: boolean }[]
  // Its working folder; an older Menkar wrote none.
  readonly folder?: string | null
}

export interface Snapshot {
  readonly project: { readonly id: string; readonly name: string }
  readonly orchestration?: boolean
  // Where start_session { folder } may start a session; an older Menkar wrote none.
  readonly folders?: readonly string[]
  readonly sessions: readonly SnapshotSession[]
}

// list_sessions' answer: the snapshot without the panes, its keys as the agents read them.
export function sessionsAnswer(snapshot: Snapshot): string {
  return JSON.stringify(
    {
      project: snapshot.project.name,
      orchestration: snapshot.orchestration === true,
      folders: snapshot.folders ?? [],
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
        skills: s.skills ?? [],
        folder: s.folder ?? null,
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

// The agent whose session runs the server, named in the server's environment by its mount. A
// mount that names none is the default agent's, whose mount predates the variable.
export const AGENT_ENV = 'MENKAR_AGENT'

// What one caller's tool list holds beyond the tools every caller has.
export interface CallerShape {
  readonly sendMessage: boolean
  // The agents start_session may start; offered as its `agent` only when there are two or more.
  readonly agents: readonly AgentId[]
}

// What main publishes once it has found the installed agents.
export interface ToolsFile {
  readonly listChanged: boolean
  readonly callers: Readonly<Record<string, CallerShape>>
}

export interface ServerShape extends CallerShape {
  readonly listChanged: boolean
}

// Without a published file, or for an agent it does not list, the list every caller had before.
export const PLAIN_SHAPE: ServerShape = { listChanged: false, sendMessage: false, agents: [] }

function shapeIn(value: unknown, agent: AgentId): ServerShape {
  if (typeof value !== 'object' || value === null) return PLAIN_SHAPE
  const file = value as { listChanged?: unknown; callers?: unknown }
  if (typeof file.callers !== 'object' || file.callers === null) return PLAIN_SHAPE
  const caller = (file.callers as Record<string, unknown>)[agent]
  if (typeof caller !== 'object' || caller === null) return PLAIN_SHAPE
  const { sendMessage, agents } = caller as { sendMessage?: unknown; agents?: unknown }
  return {
    listChanged: file.listChanged === true,
    sendMessage: sendMessage === true,
    agents: Array.isArray(agents)
      ? agents.map(parseAgentId).filter((id): id is AgentId => id !== null)
      : [],
  }
}

export async function readShape(agent: AgentId): Promise<ServerShape> {
  let text: string
  try {
    text = await readFile(controlPaths().tools, 'utf8')
  } catch (error) {
    if (errno(error) === 'ENOENT') return PLAIN_SHAPE
    throw error
  }
  try {
    return shapeIn(JSON.parse(text), agent)
  } catch (error) {
    if (error instanceof SyntaxError) return PLAIN_SHAPE
    throw error
  }
}
