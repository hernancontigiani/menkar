import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { runningNow } from '../../../core/agents/opencode/catalog'
import { MCP_NAME, mcpEntry } from '../../../core/agents/opencode/mcp'
import { log } from '../../../core/log'
import type { TeamText } from '../../../core/team/posts'
import type {
  MainTeamDelivery,
  PaneNotice,
  Prepared,
  PrepareInput,
  Preparer,
  ServerRuns,
  TeamOutcome,
} from '../types'
import { Executions, OpenCodeEvents } from './events'
import type { OpenCodeProxies } from './proxy'
import { answered, call, type OpenCodeServer, type Running } from './server'

// The session's one instruction entry: the team block, in its system prompt, replaced whole when it
// changes; OpenCode tells the model of a change before its next prompt, with no turn of its own.
export const TEAM_ENTRY = 'menkar.team'

const entryPath = (id: string) =>
  `/api/experimental/session/${encodeURIComponent(id)}/instructions/entries/${TEAM_ENTRY}`
const mcpPath = (folder: string) =>
  `/api/experimental/mcp/${MCP_NAME}?location%5Bdirectory%5D=${encodeURIComponent(folder)}`

type Follower = Parameters<Preparer['onSession']>[0]

// A start waits at most this long for the event stream, so its session's turns are seen.
const EVENTS_WAIT_MS = 5_000

interface PaneStart {
  readonly cwd: string
  readonly execPath: string
  readonly mcpServer: string
}

export interface PreparerOptions {
  readonly server: OpenCodeServer
  readonly proxies: OpenCodeProxies
  // A session's turn ended, from the server's events.
  readonly turnEnded: (pane: string, sessionId: string) => void
}

// Menkar's side of an OpenCode pane: the session made on Menkar's server before the TUI attaches
// (its id and title Menkar's), its team block put as its instruction entry, Menkar's MCP added to
// its folder when its project is in the orchestration mode, and the pane's own proxy.
export class OpenCodePreparer implements Preparer {
  private readonly starts = new Map<string, PaneStart>()
  // Per server life: a restarted server has none of the folders it was given.
  private mounted = new WeakMap<Running, Set<string>>()
  private readonly events: OpenCodeEvents
  private readonly executions: Executions
  private follower: Follower | null = null
  private readonly listeners = new Set<(pane: string) => void>()
  private readonly notices = new Set<(pane: string, notice: PaneNotice) => void>()

  constructor(private readonly options: PreparerOptions) {
    this.executions = new Executions({
      turnEnded: (root) => {
        const pane = options.proxies.showing(root)
        if (pane !== null) options.turnEnded(pane, root)
      },
      changed: (root) => {
        const pane = options.proxies.showing(root)
        if (pane !== null) for (const listener of this.listeners) listener(pane)
      },
    })
    this.events = new OpenCodeEvents({
      server: () => options.server.running(),
      event: (event) => this.executions.see(event),
      lost: () => this.executions.clear(),
    })
  }

  // A pane's session runs while its server says it, or a subagent under it, does: a root waiting
  // on its subagent shows no busy footer of its own.
  readonly runs: ServerRuns = {
    running: (pane) => {
      const session = this.options.proxies.sessionOf(pane)
      return session !== null && this.executions.runningUnder(session)
    },
    onChange: (changed) => {
      this.listeners.add(changed)
      return () => this.listeners.delete(changed)
    },
  }

  // D9: a session open in another OpenCode server too (the human's own TUI) runs two turns at
  // once there. Menkar's server reports only its own executions; the database's row is written by
  // whichever server ran the session last, so a turn it says runs that Menkar's server is not
  // running is another server's. Said in the log, and once in the pane that shows the session.
  async otherServer(
    sessionId: string,
    when: 'start' | 'wake',
    pane: string | null = null,
  ): Promise<boolean> {
    if (this.executions.runningUnder(sessionId)) return false
    const running = await runningNow(sessionId)
    if (running !== true) return false
    log.notice('an OpenCode session Menkar runs has a turn running in another OpenCode server', {
      session: sessionId,
      when,
    })
    const shown = pane ?? this.options.proxies.showing(sessionId)
    if (shown !== null)
      for (const listener of this.notices) listener(shown, { kind: 'other-server', when })
    return true
  }

  onNotice(listener: (pane: string, notice: PaneNotice) => void): void {
    this.notices.add(listener)
  }

  async prepare(input: PrepareInput): Promise<Prepared | null> {
    if (input.start.kind === 'fork') throw new Error('OpenCode sessions are not forked')
    const { server, proxies } = this.options
    let running: Running
    try {
      running = await server.acquire(input.pane)
    } catch (error) {
      log.warn("an OpenCode pane starts without a command: Menkar's server did not start", {
        pane: input.pane,
        error,
      })
      server.release(input.pane)
      return null
    }
    const id = input.start.id
    const cwd = input.cwd ?? homedir()
    try {
      if (input.start.kind === 'new') {
        if (id === undefined) throw new Error('a new OpenCode session needs the id Menkar gave it')
        const model = input.start.model ? modelOf(input.start.model) : null
        if (input.start.model && !model)
          log.warn('an OpenCode session starts on its default model: not named as provider/model', {
            pane: input.pane,
          })
        const created = await call(running, 'POST', '/api/session', {
          id,
          ...(input.start.name ? { title: input.start.name } : {}),
          location: { directory: cwd },
          ...(model ? { model } : {}),
        })
        if (!answered(created)) throw new Error(`the session's create answered ${created.status}`)
      }
      if (id === undefined) throw new Error('an OpenCode start names no session')
      if (input.start.kind === 'resume') void this.otherServer(id, 'start', input.pane)
      await this.putTeam(running, id, input.teamFile)
      this.starts.set(input.pane, {
        cwd,
        execPath: input.execPath,
        mcpServer: input.mcpServer,
      })
      if (input.team) await this.mount(running, input.pane)
      const url = await proxies.open(input.pane, running, id)
      // A turn's start or end before the stream is open would be missed.
      this.events.ensure()
      await this.events.ready(EVENTS_WAIT_MS)
      // Given before the TUI attaches rather than with its own --prompt, which it would submit
      // again in the next session after a /new. It draws the turn already running.
      const prompted = input.promptFile !== undefined
      if (input.promptFile !== undefined) {
        const text = await readFile(input.promptFile, 'utf8')
        const answer = await call(
          running,
          'POST',
          `/api/session/${encodeURIComponent(id)}/prompt`,
          {
            text,
            delivery: 'steer',
          },
        )
        if (!answered(answer)) throw new Error(`the first prompt answered ${answer.status}`)
      }
      return { server: url, env: { OPENCODE_PASSWORD: running.password }, prompted }
    } catch (error) {
      log.warn('an OpenCode pane starts without a command: its session could not be prepared', {
        pane: input.pane,
        error,
      })
      this.release(input.pane)
      return null
    }
  }

  release(pane: string): void {
    this.starts.delete(pane)
    void this.options.proxies.close(pane)
    this.options.server.release(pane)
    if (this.starts.size === 0) this.events.close()
  }

  onSession(follower: Follower): void {
    this.follower = follower
  }

  // What the pane's proxy saw: its TUI moved to another session. Its first is the one it was
  // started on, which the pane already runs.
  moved(pane: string, sessionId: string, previous: string | null, created: boolean): void {
    if (previous === null) return
    this.follower?.(pane, sessionId, previous, created ? 'clear' : 'resume')
  }

  async quit(): Promise<void> {
    this.events.close()
    this.starts.clear()
    this.options.server.stop()
    await this.options.proxies.closeAll()
  }

  // The team's delivery on main's side: the entry replaced, or removed when the session holds no
  // block any more. A session given a block is in a project in the mode, so its folder gets
  // Menkar's MCP then if it had not.
  readonly team: MainTeamDelivery = {
    tell: async (sessionId, _text, _counts, current): Promise<TeamOutcome> => {
      const starting = this.options.server.running()
      if (starting === null) return 'no session'
      const running = await starting
      if (!running.features.entries) return 'protocol'
      const answer = current
        ? await call(running, 'PUT', entryPath(sessionId), { value: current.block })
        : await call(running, 'DELETE', entryPath(sessionId))
      if (answer.status === 404) return 'no session'
      if (!answered(answer)) throw new Error(`the team entry answered ${answer.status}`)
      const pane = this.options.proxies.showing(sessionId)
      if (current && pane !== null) await this.mount(running, pane)
      return 'stored'
    },
  }

  private async putTeam(running: Running, id: string, teamFile: string | undefined): Promise<void> {
    if (!running.features.entries) return
    const block: TeamText | null = teamFile
      ? { facts: '', block: await readFile(teamFile, 'utf8') }
      : null
    // A session resumed outside the mode drops the block it was given before.
    const answer = block
      ? await call(running, 'PUT', entryPath(id), { value: block.block })
      : await call(running, 'DELETE', entryPath(id))
    if (!answered(answer) && !(block === null && answer.status === 404))
      throw new Error(`the team entry answered ${answer.status}`)
  }

  private async mount(running: Running, pane: string): Promise<void> {
    const start = this.starts.get(pane)
    if (!start || !running.features.mcp) return
    let folders = this.mounted.get(running)
    if (!folders) {
      folders = new Set()
      this.mounted.set(running, folders)
    }
    if (folders.has(start.cwd)) return
    const answer = await call(running, 'PUT', mcpPath(start.cwd), {
      config: mcpEntry(start.execPath, start.mcpServer),
    })
    if (!answered(answer)) {
      log.warn("Menkar's MCP could not be added to an OpenCode folder", {
        pane,
        status: answer.status,
      })
      return
    }
    folders.add(start.cwd)
    log.info("Menkar's MCP was added to an OpenCode folder", { pane })
  }
}

// `provider/model`, as OpenCode names a model, into its create's form; null for any other name.
export function modelOf(model: string): { providerID: string; id: string } | null {
  const slash = model.indexOf('/')
  return slash > 0 && slash < model.length - 1
    ? { providerID: model.slice(0, slash), id: model.slice(slash + 1) }
    : null
}

// What Menkar's sessions need of its own server, over the user's own OPENCODE_CONFIG_CONTENT when
// they have one (OpenCode reads it as the last layer of the user's configuration): Menkar's tools
// run with no approval card. Menkar's MCP itself is added per folder, so a session outside the
// orchestration mode sends the request it would send on any server.
export const MENKAR_CONFIG = { permission: { [`${MCP_NAME}_*`]: 'allow' } } as const

export function serverConfig(
  own: string | undefined = process.env.OPENCODE_CONFIG_CONTENT,
): string {
  if (own === undefined || own.trim() === '') return JSON.stringify(MENKAR_CONFIG)
  let parsed: unknown
  try {
    parsed = JSON.parse(own)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    log.warn("the user's OPENCODE_CONFIG_CONTENT does not parse: Menkar's server gets it as it is")
    return own
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return own
  const user = parsed as Record<string, unknown>
  const permission = user.permission
  return JSON.stringify({
    ...user,
    permission:
      typeof permission === 'object' && permission !== null && !Array.isArray(permission)
        ? { ...MENKAR_CONFIG.permission, ...permission }
        : (permission ?? MENKAR_CONFIG.permission),
  })
}
