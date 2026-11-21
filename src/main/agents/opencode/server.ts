import { type ChildProcessByStdio, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import type { Readable, Writable } from 'node:stream'
import { now } from '../../../core/clock'
import { PANE_ENV } from '../../../core/context/statusline'
import { log } from '../../../core/log'
import { withoutSessionEnv } from '../../../core/sessionenv'

// The real server prints its address about 6 s after the spawn.
export const START_WAIT_MS = 30_000
// A server that dies while tabs use it is started again at most once in this time.
export const RETRY_EVERY_MS = 30_000
// Closing its input ends it within 100 ms; one still alive after these is signalled.
export const TERM_AFTER_MS = 2_000
export const KILL_AFTER_MS = 5_000
const CHECK_WAIT_MS = 10_000

export const SERVER_USER = 'opencode'

// The routes an older OpenCode lacks, as /openapi.json names them.
const ENTRIES_ROUTE = '/api/experimental/session/{sessionID}/instructions/entries/{key}'
const MCP_ROUTE = '/api/experimental/mcp/{server}'

// The variables Menkar gives a pane. A Menkar started from a pane inherits them, and the server
// must carry none: the MCP servers it starts inherit its whole environment but the password.
const PANE_VARIABLES = [PANE_ENV, 'MENKAR_FILES', 'MENKAR_PRIVATE']

type Child = ChildProcessByStdio<Writable, Readable, null>

export interface Features {
  // The instruction-entry route: without it the team block is not delivered.
  readonly entries: boolean
  // The per-folder MCP route: without it Menkar's MCP is not mounted.
  readonly mcp: boolean
}

export interface Running {
  readonly url: string
  readonly password: string
  readonly features: Features
}

export interface ServerOptions {
  // The CLI's path or name.
  readonly command: string
  // OPENCODE_CONFIG_CONTENT, read at each start; none when absent.
  readonly config?: () => string
  readonly retryEveryMs?: number
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port was given'))))
    })
  })
}

export function basicAuth(password: string): string {
  return `Basic ${Buffer.from(`${SERVER_USER}:${password}`).toString('base64')}`
}

async function checkFeatures(url: string, password: string): Promise<Features> {
  const headers = { authorization: basicAuth(password) }
  let features: Features = { entries: false, mcp: false }
  try {
    const response = await fetch(`${url}/openapi.json`, {
      headers,
      signal: AbortSignal.timeout(CHECK_WAIT_MS),
    })
    if (!response.ok) throw new Error(`/openapi.json answered ${response.status}`)
    const body = (await response.json()) as { paths?: Record<string, Record<string, unknown>> }
    const paths = body.paths ?? {}
    features = {
      entries: paths[ENTRIES_ROUTE]?.put !== undefined,
      mcp: paths[MCP_ROUTE]?.put !== undefined,
    }
  } catch (error) {
    log.warn("OpenCode's server routes could not be read", { error })
  }
  if (!features.entries || !features.mcp) {
    let version: unknown = null
    try {
      const info = await fetch(`${url}/api/info`, {
        headers,
        signal: AbortSignal.timeout(CHECK_WAIT_MS),
      })
      version = ((await info.json()) as { version?: unknown }).version ?? null
    } catch (error) {
      log.info("OpenCode's version could not be read", { error })
    }
    if (!features.entries)
      log.notice('OpenCode has no instruction-entry route: the team block is not delivered', {
        version,
      })
    if (!features.mcp)
      log.notice("OpenCode has no per-folder MCP route: Menkar's MCP is not mounted", { version })
  }
  return features
}

const CALL_WAIT_MS = 10_000

export interface Answer {
  readonly status: number
  readonly body: unknown
}

// One call of Menkar's own to its server, with the password; the body read as JSON when it has one.
export async function call(
  server: Running,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<Answer> {
  const response = await fetch(`${server.url}${path}`, {
    method,
    headers: {
      authorization: basicAuth(server.password),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(CALL_WAIT_MS),
  })
  const text = await response.text()
  let parsed: unknown = null
  if (text !== '') {
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      parsed = text
    }
  }
  return { status: response.status, body: parsed }
}

export const answered = (answer: Answer): boolean => answer.status >= 200 && answer.status < 300

// Menkar's one `opencode serve` (stdio mode): started with the first tab that needs it, stopped
// with the last one and on quit, started again on the same port and with the same password when it
// dies while tabs use it, so their TUIs can reconnect.
export class OpenCodeServer {
  private readonly panes = new Set<string>()
  private child: Child | null = null
  private starting: Promise<Running> | null = null
  private port: number | null = null
  private password: string | null = null
  private lastRestart: number | null = null
  private retry: NodeJS.Timeout | null = null
  private restartCount = 0
  private readonly ended = new WeakSet<Child>()

  constructor(private readonly options: ServerOptions) {}

  // The server for this pane, started if none runs.
  acquire(pane: string): Promise<Running> {
    this.panes.add(pane)
    if (this.starting === null) {
      const starting = this.start()
      this.starting = starting
      starting.catch(() => {
        if (this.starting === starting) this.starting = null
      })
    }
    return this.starting
  }

  // With the last pane released the server stops.
  release(pane: string): void {
    this.panes.delete(pane)
    if (this.panes.size === 0) this.end()
  }

  // On quit.
  stop(): void {
    this.panes.clear()
    this.end()
  }

  // The server as it runs now, or as it is starting; null while none does.
  running(): Promise<Running> | null {
    return this.starting
  }

  restarts(): number {
    return this.restartCount
  }

  pid(): number | null {
    return this.child?.pid ?? null
  }

  private async start(): Promise<Running> {
    this.port ??= await freePort()
    this.password ??= randomBytes(24).toString('base64url')
    const port = this.port
    const password = this.password
    const env = withoutSessionEnv(process.env)
    for (const key of PANE_VARIABLES) delete env[key]
    env.OPENCODE_PASSWORD = password
    const config = this.options.config?.()
    if (config !== undefined) env.OPENCODE_CONFIG_CONTENT = config
    // Its own process group, so what it leaves when signalled goes with it; its input held here,
    // so it ends when this process does, however that happens.
    const child = spawn(this.options.command, ['serve', '--stdio', '--port', String(port)], {
      env,
      stdio: ['pipe', 'pipe', 'ignore'],
      detached: true,
    })
    this.child = child
    let up = false
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null
      if (this.ended.has(child)) return
      log.warn("OpenCode's server ended", { pid: child.pid, code, signal, up })
      if (up && this.panes.size > 0) this.scheduleRestart()
    })
    const url = await new Promise<string>((resolve, reject) => {
      let pending = ''
      const timer = setTimeout(() => {
        reject(new Error(`no address within ${START_WAIT_MS} ms`))
        this.endChild(child)
      }, START_WAIT_MS)
      const fail = (error: Error) => {
        clearTimeout(timer)
        reject(error)
      }
      child.on('error', fail)
      child.on('exit', (code, signal) =>
        fail(new Error(`it ended before its address, with ${code ?? signal}`)),
      )
      child.stdout.on('data', (chunk: Buffer) => {
        if (up) return
        pending += chunk.toString('utf8')
        const newline = pending.indexOf('\n')
        if (newline < 0) return
        try {
          const given = (JSON.parse(pending.slice(0, newline)) as { url?: unknown }).url
          if (typeof given !== 'string') throw new Error('its first line has no url')
          up = true
          clearTimeout(timer)
          resolve(given)
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)))
          this.endChild(child)
        }
      })
    }).catch((error: unknown) => {
      log.warn("OpenCode's server did not start", { port, error })
      throw error
    })
    log.notice("OpenCode's server started", { pid: child.pid, port })
    return { url, password, features: await checkFeatures(url, password) }
  }

  private scheduleRestart(): void {
    if (this.retry !== null) return
    const every = this.options.retryEveryMs ?? RETRY_EVERY_MS
    const wait = this.lastRestart === null ? 0 : Math.max(0, this.lastRestart + every - now())
    this.starting = null
    this.retry = setTimeout(() => {
      this.retry = null
      if (this.panes.size === 0) return
      this.restartCount += 1
      this.lastRestart = now()
      log.notice("OpenCode's server is started again", {
        port: this.port,
        restarts: this.restartCount,
      })
      const starting = this.start()
      this.starting = starting
      starting.catch(() => {
        if (this.starting !== starting) return
        this.starting = null
        if (this.panes.size > 0) this.scheduleRestart()
      })
    }, wait)
    this.retry.unref()
  }

  private end(): void {
    if (this.retry !== null) clearTimeout(this.retry)
    this.retry = null
    this.starting = null
    this.port = null
    this.password = null
    this.lastRestart = null
    if (this.child !== null) this.endChild(this.child)
    this.child = null
  }

  private endChild(child: Child): void {
    this.ended.add(child)
    child.stdin.end()
    const pid = child.pid
    if (pid === undefined) return
    const alive = () => child.exitCode === null && child.signalCode === null
    const signal = (name: NodeJS.Signals) => {
      if (!alive()) return
      log.warn("OpenCode's server outlived its input", { pid, signal: name })
      try {
        process.kill(-pid, name)
      } catch (error) {
        log.info("OpenCode's server group was already gone", { pid, error })
      }
    }
    setTimeout(() => signal('SIGTERM'), TERM_AFTER_MS).unref()
    setTimeout(() => signal('SIGKILL'), KILL_AFTER_MS).unref()
  }
}
