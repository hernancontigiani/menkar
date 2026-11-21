import {
  createServer,
  type IncomingMessage,
  request,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { Socket } from 'node:net'
import { log } from '../../../core/log'
import { basicAuth } from './server'

// The requests that say which session a pane's TUI shows. It asks for the goal of the session it
// shows, and only that one, whether started on it, after `/new` or switched with its own picker;
// the answer is no help (any id gets one, and a server still loading refuses it), so the request
// alone binds. A session it creates is named first in the create's body, and it prompts only the
// session it shows. Its other requests name any session of its tab strip and the children it draws.
const CREATE = '/api/session'
const GOAL = '/api/rpc/opencode.goal/get'
const PROMPT = /^\/api\/session\/([^/?]+)\/prompt(?:\?|$)/
// A body larger than this is relayed unread.
const BODY_READ_MAX = 64 * 1024
// A subagent's subagent is still traced; a longer chain of parents is not followed.
const PARENTS_MAX = 8
const LOOKUP_WAIT_MS = 5_000

export interface ProxyOptions {
  // Called when a pane's TUI moves to another session: its first, the one `/new` made (`created`:
  // its create went through this pane), or one its own picker opened.
  readonly onSession?: (
    pane: string,
    sessionId: string,
    previous: string | null,
    created: boolean,
  ) => void
}

// The server the pane's requests go to, and its password for main's own lookups.
export interface Target {
  readonly url: string
  readonly password: string
}

interface Pane {
  readonly server: Server
  readonly sockets: Set<Socket>
  target: Target
  session: string | null
  // The sessions this pane's TUI created.
  readonly created: Set<string>
}

const isOk = (status: number | undefined) => status !== undefined && status >= 200 && status < 300

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

// The session named by the body of a create or of a goal's request.
function namedInBody(path: string, raw: Buffer): string | null {
  let body: unknown
  try {
    body = JSON.parse(raw.toString('utf8'))
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const fields = body as { id?: unknown; input?: { sessionID?: unknown } | null }
  return path === CREATE ? text(fields.id) : text(fields.input?.sessionID)
}

// One loopback port per OpenCode pane, relaying its TUI to Menkar's server byte for byte. It adds
// no credential (the TUI sends the server's password itself) and reads only the requests that say
// which session the pane shows, so main knows which pane a session OpenCode names belongs to.
export class OpenCodeProxies {
  private readonly panes = new Map<string, Pane>()
  private readonly byId = new Map<string, string>()

  constructor(private readonly options: ProxyOptions = {}) {}

  // The pane's address for its TUI's `--server`. `session` is the one the TUI is started on (`-s`),
  // null for a new one.
  async open(pane: string, target: Target, session: string | null): Promise<string> {
    if (this.panes.has(pane)) await this.close(pane)
    const sockets = new Set<Socket>()
    const server = createServer((req, res) => this.relay(pane, req, res))
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.panes.set(pane, { server, sockets, target, session: null, created: new Set() })
    if (session !== null) this.bind(pane, session)
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    log.info("An OpenCode pane's proxy listens", { pane, port })
    return `http://127.0.0.1:${port}`
  }

  // The server was started anew elsewhere: later requests go there.
  retarget(pane: string, target: Target): void {
    const entry = this.panes.get(pane)
    if (entry) entry.target = target
  }

  async close(pane: string): Promise<void> {
    const entry = this.panes.get(pane)
    if (!entry) return
    this.panes.delete(pane)
    if (entry.session !== null && this.byId.get(entry.session) === pane)
      this.byId.delete(entry.session)
    for (const socket of entry.sockets) socket.destroy()
    await new Promise<void>((resolve) => entry.server.close(() => resolve()))
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.panes.keys()].map((pane) => this.close(pane)))
  }

  sessionOf(pane: string): string | null {
    return this.panes.get(pane)?.session ?? null
  }

  // The pane showing this very session, its parents not followed.
  showing(sessionId: string): string | null {
    return this.byId.get(sessionId) ?? null
  }

  // The pane showing the session OpenCode names in a tool call, and that session: a subagent's
  // call names its own session, so its parents are followed to the one a pane shows.
  async paneOf(sessionId: string): Promise<{ pane: string; sessionId: string } | null> {
    let id = sessionId
    for (let depth = 0; ; depth += 1) {
      const pane = this.byId.get(id)
      if (pane !== undefined) return { pane, sessionId: id }
      if (depth === PARENTS_MAX) return null
      const parent = await this.parentOf(id)
      if (parent === null) return null
      id = parent
    }
  }

  private async parentOf(sessionId: string): Promise<string | null> {
    const target = [...this.panes.values()][0]?.target
    if (!target) return null
    try {
      const response = await fetch(`${target.url}/api/session/${encodeURIComponent(sessionId)}`, {
        headers: { authorization: basicAuth(target.password) },
        signal: AbortSignal.timeout(LOOKUP_WAIT_MS),
      })
      if (!response.ok) return null
      const body = (await response.json()) as { data?: { parentID?: unknown } }
      return text(body.data?.parentID)
    } catch (error) {
      log.warn("An OpenCode session's parent could not be read", { session: sessionId, error })
      return null
    }
  }

  private bind(pane: string, sessionId: string): void {
    const entry = this.panes.get(pane)
    if (!entry || entry.session === sessionId) return
    const previous = entry.session
    if (previous !== null && this.byId.get(previous) === pane) this.byId.delete(previous)
    entry.session = sessionId
    this.byId.set(sessionId, pane)
    log.info("An OpenCode pane's session is known", { pane, session: sessionId, previous })
    this.options.onSession?.(pane, sessionId, previous, entry.created.has(sessionId))
  }

  private relay(pane: string, req: IncomingMessage, res: ServerResponse): void {
    const entry = this.panes.get(pane)
    if (!entry) {
      res.writeHead(502).end()
      return
    }
    const url = req.url ?? '/'
    const path = url.split('?')[0] ?? url
    const post = req.method === 'POST'
    const prompted = post ? PROMPT.exec(url)?.[1] : undefined
    const reads = post && (path === CREATE || path === GOAL)
    const chunks: Buffer[] = []
    let size = 0
    const named = () =>
      reads && size <= BODY_READ_MAX ? namedInBody(path, Buffer.concat(chunks)) : null
    if (reads) {
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size <= BODY_READ_MAX) chunks.push(chunk)
      })
      req.on('end', () => {
        const goal = path === GOAL ? named() : null
        if (goal !== null) this.bind(pane, goal)
      })
    }
    const target = new URL(entry.target.url)
    const upstream = request(
      {
        host: target.hostname,
        port: target.port,
        method: req.method,
        path: url,
        headers: req.headers,
      },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.statusMessage, answer.rawHeaders)
        if (isOk(answer.statusCode)) {
          const made = path === CREATE && post ? named() : null
          if (made !== null) entry.created.add(made)
          const shown = prompted !== undefined ? decodeURIComponent(prompted) : made
          if (shown !== null) this.bind(pane, shown)
        }
        answer.pipe(res)
      },
    )
    upstream.on('error', (error) => {
      log.warn("An OpenCode pane's request did not reach the server", { pane, error })
      if (!res.headersSent) res.writeHead(502)
      res.end()
    })
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy()
    })
    req.pipe(upstream)
  }
}
