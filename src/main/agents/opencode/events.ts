import { request } from 'node:http'
import { log } from '../../../core/log'
import { basicAuth, type Running } from './server'

const STARTED = 'session.execution.started'
const CREATED = 'session.created'
// An execution ends one of these ways.
const ENDS = new Set([
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted',
])
// A stream that ends while the server is wanted is opened again after this.
export const REOPEN_AFTER_MS = 2_000

// A root whose child just ended starts its own execution again at once; its turn ends only if it
// has not within this time.
export const SETTLE_MS = 1_000
// A subagent's subagent is still counted; a longer chain of parents is not followed.
const PARENTS_MAX = 8

export interface ServerEvent {
  readonly type: string
  readonly sessionId: string | null
  // A created session's parent, for a subagent's.
  readonly parentId: string | null
}

// The `data:` lines of one server-sent event frame, as one JSON event; comments (the heartbeat)
// and anything that does not parse give nothing.
export function parseFrame(frame: string): ServerEvent | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n')
  if (data === '') return null
  let event: unknown
  try {
    event = JSON.parse(data)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
  if (typeof event !== 'object' || event === null) return null
  const { type, data: body } = event as { type?: unknown; data?: unknown }
  if (typeof type !== 'string') return null
  const fields = (typeof body === 'object' && body !== null ? body : {}) as {
    sessionID?: unknown
    parentID?: unknown
  }
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null)
  return { type, sessionId: text(fields.sessionID), parentId: text(fields.parentID) }
}

export interface ExecutionsOptions {
  // A root session's turn ended: neither it nor a subagent under it runs.
  readonly turnEnded: (root: string) => void
  // Whether a root or a subagent under it started or ended running.
  readonly changed: (root: string) => void
  readonly settleMs?: number
}

// Which sessions run now, by the server's events. A subagent runs in a session of its own whose
// parent's execution ends while it works and starts again when it is done, so a root counts as
// running while anything under it does, and its turn ends when nothing under it runs any more.
export class Executions {
  private readonly parents = new Map<string, string>()
  private readonly running = new Set<string>()
  private readonly settling = new Map<string, NodeJS.Timeout>()

  constructor(private readonly options: ExecutionsOptions) {}

  see(event: ServerEvent): void {
    const id = event.sessionId
    if (id === null) return
    if (event.type === CREATED && event.parentId !== null) this.parents.set(id, event.parentId)
    else if (event.type === STARTED) {
      const root = this.rootOf(id)
      this.unsettle(root)
      this.running.add(id)
      this.options.changed(root)
    } else if (ENDS.has(event.type)) {
      const root = this.rootOf(id)
      this.running.delete(id)
      this.options.changed(root)
      if (this.runningUnder(root)) return
      if (id === root) this.options.turnEnded(root)
      else this.settle(root)
    }
  }

  // Whether the session, or a subagent under it, runs now.
  runningUnder(root: string): boolean {
    for (const id of this.running) if (this.rootOf(id) === root) return true
    return false
  }

  // Everything seen is of a server that ended.
  clear(): void {
    for (const timer of this.settling.values()) clearTimeout(timer)
    this.settling.clear()
    const roots = new Set([...this.running].map((id) => this.rootOf(id)))
    this.running.clear()
    this.parents.clear()
    for (const root of roots) this.options.changed(root)
  }

  rootOf(id: string): string {
    let root = id
    for (let depth = 0; depth < PARENTS_MAX; depth += 1) {
      const parent = this.parents.get(root)
      if (parent === undefined) break
      root = parent
    }
    return root
  }

  private settle(root: string): void {
    this.unsettle(root)
    const timer = setTimeout(() => {
      this.settling.delete(root)
      if (!this.runningUnder(root)) this.options.turnEnded(root)
    }, this.options.settleMs ?? SETTLE_MS)
    timer.unref()
    this.settling.set(root, timer)
  }

  private unsettle(root: string): void {
    const timer = this.settling.get(root)
    if (timer !== undefined) clearTimeout(timer)
    this.settling.delete(root)
  }
}

export interface EventsOptions {
  // The server as it runs or starts now; null between a death and its restart.
  readonly server: () => Promise<Running> | null
  readonly event: (event: ServerEvent) => void
  // The stream of a server that ended: what it said running is not any more.
  readonly lost?: () => void
  readonly reopenAfterMs?: number
}

// Menkar's one subscription to its OpenCode server's events, where its sessions' executions are
// read: no hook and nothing written into OpenCode's data. Opened with the server, and again after
// it restarts.
export class OpenCodeEvents {
  private open: { readonly server: Running; close(): void } | null = null
  private timer: NodeJS.Timeout | null = null
  private wanted = false
  private live = false
  private waiting: (() => void)[] = []

  constructor(private readonly options: EventsOptions) {}

  // A pane uses the server: a stream to it is opened if none is, and kept open, through the
  // server's restarts, until `close`.
  ensure(): void {
    this.wanted = true
    const running = this.options.server()
    if (running === null) {
      this.later()
      return
    }
    running.then(
      (server) => {
        if (!this.wanted || this.open?.server === server) return
        this.open?.close()
        this.open = this.subscribe(server)
      },
      (error: unknown) => {
        log.info("OpenCode's events wait for its server", { error })
        this.later()
      },
    )
  }

  // Once the stream is open, so no event after this is missed; at most `ms` later otherwise.
  ready(ms: number): Promise<void> {
    if (this.live) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms)
      timer.unref()
      function done() {
        clearTimeout(timer)
        resolve()
      }
      this.waiting.push(done)
    })
  }

  // No pane uses the server any more.
  close(): void {
    this.live = false
    this.wanted = false
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.open?.close()
    this.open = null
  }

  private later(): void {
    if (!this.wanted || this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.ensure()
    }, this.options.reopenAfterMs ?? REOPEN_AFTER_MS)
    this.timer.unref()
  }

  private reopen(server: Running): void {
    if (this.open?.server !== server) return
    this.open = null
    this.later()
  }

  private subscribe(server: Running): { readonly server: Running; close(): void } {
    let closed = false
    const ended = () => {
      if (closed) return
      closed = true
      this.live = false
      this.options.lost?.()
      this.reopen(server)
    }
    const url = new URL('/api/event', server.url)
    const req = request(
      {
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { authorization: basicAuth(server.password), accept: 'text/event-stream' },
      },
      (res) => {
        res.on('close', ended)
        if (res.statusCode !== 200) {
          log.warn("OpenCode's events were refused", { status: res.statusCode })
          res.resume()
          return
        }
        res.setEncoding('utf8')
        this.live = true
        for (const done of this.waiting.splice(0)) done()
        let pending = ''
        res.on('data', (chunk: string) => {
          pending += chunk.replaceAll('\r\n', '\n')
          for (let end = pending.indexOf('\n\n'); end >= 0; end = pending.indexOf('\n\n')) {
            const event = parseFrame(pending.slice(0, end))
            pending = pending.slice(end + 2)
            if (event) this.options.event(event)
          }
        })
      },
    )
    req.on('error', (error) => {
      if (!closed) log.info("OpenCode's events stream ended", { error })
      ended()
    })
    req.end()
    return {
      server,
      close: () => {
        closed = true
        this.live = false
        req.destroy()
      },
    }
  }
}
