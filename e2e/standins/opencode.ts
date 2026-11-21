import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A stand-in `opencode` (never the real one), imitating what `opencode` measured on v2.3.0
// (2026-11-21). Two programs in one, as OpenCode is: a server and a TUI that is only its client.
// - `--version` prints `opencode v<FAKE_OPENCODE_VERSION>` (2.3.0 by default) and exits.
// - Each start appends its arguments to opencode-args.txt in HOME.
//
// `opencode serve --stdio --port <p>` (`--port 0`, or none, takes a free one):
// - Its environment, as given, goes to opencode-serve-env.json in HOME and its PID is appended to
//   opencode-serve-pids.txt. It reads OPENCODE_PASSWORD (a random one when unset) and removes it
//   from what its MCP servers inherit; they get everything else (OPENCODE_CONFIG_CONTENT too).
// - It listens on 127.0.0.1, after FAKE_OPENCODE_START_MS (0 by default; about 6 s for the real
//   one), and prints one line, {"url":"http://127.0.0.1:<p>"}. It exits 0 when its stdin closes,
//   checkpointing its database. Any other `serve` exits 2: Menkar runs only the stdio form.
// - Every route needs HTTP Basic `opencode:<password>`, or answers 401 with OpenCode's body.
// - Its database is $OPENCODE_DB, or $XDG_DATA_HOME/opencode/opencode.db (~/.local/share), in WAL
//   with OpenCode's tables, held open while it runs: `-wal` and `-shm` exist from its start, a
//   clean exit removes both, a SIGKILL leaves both.
// - Routes, with OpenCode's shapes: GET /api/info, GET /openapi.json (its paths: the ones served
//   here), POST /api/session, GET and PATCH /api/session/<id>, POST …/view (requires {idle}),
//   POST …/agent and …/model, POST …/prompt (delivery `queue`, or `steer` by default), GET …/inbox,
//   DELETE …/inbox/<msg>, GET, PUT and DELETE /api/experimental/session/<id>/instructions/entries
//   [/<key>], PUT and DELETE /api/experimental/mcp/<server>?location[directory]=<dir>,
//   GET /api/mcp?directory=<dir>, GET /api/session/active, GET /api/permission/request,
//   POST /api/session/<id>/permission/<per>/reply ({decision: once|always|reject}), and
//   GET /api/event (server-sent `data:` frames and `: heartbeat` comments every
//   FAKE_OPENCODE_HEARTBEAT_MS, 10000 by default), and POST /api/rpc/opencode.goal/get
//   ({input: {sessionID}}: `{"output":null}` for any id, known or not; 400 without the id). An
//   unknown session is OpenCode's 404. A session's `parentID` is given when it has one; a create
//   with `parentID` in its body makes a child (the stand-in's own way to have one).
//   FAKE_OPENCODE_NO_ENTRIES and FAKE_OPENCODE_NO_MCP_ROUTE leave out the instruction-entry routes
//   and the per-folder MCP route, as an older OpenCode would, from /openapi.json and from service.
//   GET /api/session/<id>/message is the stand-in's own way to give its TUI the rows: its shape
//   was not measured.
// - A prompt goes to the session's inbox (session.inbox.enqueued) and runs as soon as no
//   execution runs; a steered message joins the running execution at its next step, a queued one
//   after that step. Each step takes FAKE_OPENCODE_TURN_MS (1000 by default) and answers
//   "ack N: <text>"; one `idle` row and session.execution.succeeded close the execution. A prompt
//   to a session that does not exist is OpenCode's 404, as measured. A session with no title takes
//   FAKE_OPENCODE_TITLE (else the first words of its first message) at its first prompt.
// - Each step appends to opencode-requests.jsonl in HOME what the model would be sent:
//   { sessionID, tools, system: { instructions, skills, entries } } — OpenCode's twelve tools in
//   Code Mode, plus `<server>_<tool>` for each MCP server mounted with `codemode: false`, its
//   `instructions` and `skills.paths` from OPENCODE_CONFIG_CONTENT, the session's entries.
// - MCP servers come from OPENCODE_CONFIG_CONTENT's `mcp` (every folder) and from the per-folder
//   route; each local one is started once per folder at a step of a session there, as OpenCode
//   starts it (initialize, notifications/initialized, tools/list), its environment written to
//   opencode-mcp-env.json in HOME. "CALLMENKAR <tool> [<JSON arguments>]" in a message calls that
//   tool of the `menkar` server, with `_meta["ai.opencode/sessionID"]`, and answers
//   "TOOL <tool>: <text>".
// - "RUNTOOL" in a message asks a permission (`shell`, `touch b.txt`): permission.asked, listed
//   by GET /api/permission/request until a reply; `reject` interrupts the execution.
//
// `opencode --server <url> [-s <id>] [--prompt <text>] [<dir>]`, the TUI:
// - Its environment goes to opencode-env.json in HOME. Without --server it exits 1 (the real one
//   would start the user's shared service, which Menkar never uses). Without the server's
//   password in OPENCODE_PASSWORD it prints OpenCode's error and exits 1.
// - With -s it opens that session (POST …/agent, …/model, then …/prompt for --prompt, delivery
//   steer); without, its first prompt creates one with an id it mints (POST /api/session {id,
//   agent, model, location}, no title). It asks for the goal of the session it shows, and of no
//   other (POST /api/rpc/opencode.goal/get): at its start on -s, after a create, and when typed
//   `/switch <id>` (the stand-in's own picker; OpenCode's is Ctrl+X L) opens another. After an
//   execution of its session ends it posts …/view {idle}. Typed `/new` leaves the session (…/view
//   for one that had a turn) and, as OpenCode does, re-submits --prompt's text in the new session
//   at once.
// - It draws OpenCode's screen from the event stream: the tab strip (a Braille spinner while
//   busy), the conversation, "  ┃  N queued · <text>", the permission card, the composer and the
//   footer ("⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt" while busy). Enter submits the typed line, or answers an
//   open card "once"; Esc answers it "reject". Ctrl+C with nothing typed exits 0 printing
//   "  Session   <title>" and "  Continue  opencode -s <id>"; typing EXIT0 exits 0 too.
const FAKE_OPENCODE = String.raw`#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const crypto = require('node:crypto'), cp = require('node:child_process')
const args = process.argv.slice(2)
const VERSION = process.env.FAKE_OPENCODE_VERSION || '2.3.0'
if (args[0] === '--version' || args[0] === '-v') {
  process.stdout.write('opencode v' + VERSION + '\n')
  process.exit(0)
}
const HOME = process.env.HOME
fs.appendFileSync(path.join(HOME, 'opencode-args.txt'), args.join(' ') + '\n')
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const rand = (n) => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, 'x').slice(0, n)
const idOf = (prefix) => prefix + '_' + Date.now().toString(16) + rand(14)
const BUILTIN = ['edit', 'glob', 'grep', 'question', 'read', 'shell', 'skill', 'subagent',
  'webfetch', 'websearch', 'write', 'execute']

if (args[0] === 'serve') serve()
else tui()

function serve() {
  if (!args.includes('--stdio')) {
    process.stderr.write('stand-in opencode: only serve --stdio is imitated\n')
    process.exit(2)
  }
  fs.writeFileSync(path.join(HOME, 'opencode-serve-env.json'), JSON.stringify(process.env))
  fs.appendFileSync(path.join(HOME, 'opencode-serve-pids.txt'), process.pid + '\n')
  const password = process.env.OPENCODE_PASSWORD || rand(24)
  delete process.env.OPENCODE_PASSWORD
  let config = {}
  try {
    config = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT || '{}')
  } catch {
    process.stderr.write('stand-in opencode: OPENCODE_CONFIG_CONTENT is not JSON\n')
    process.exit(1)
  }
  const { DatabaseSync } = require('node:sqlite')
  const dbPath = process.env.OPENCODE_DB || path.join(process.env.XDG_DATA_HOME ||
    path.join(HOME, '.local', 'share'), 'opencode', 'opencode.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000')
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'session_v2'").get())
    db.exec(fs.readFileSync(path.join(__dirname, 'opencode-schema.sql'), 'utf8'))

  const noEntries = !!process.env.FAKE_OPENCODE_NO_ENTRIES
  const noMcpRoute = !!process.env.FAKE_OPENCODE_NO_MCP_ROUTE
  const turnMs = Number(process.env.FAKE_OPENCODE_TURN_MS || 1000)
  const streams = new Set()
  const seqs = new Map()
  const runs = new Map() // sessionID → { running, steps }
  const permissions = new Map() // per id → { item, resolve }
  const mounts = new Map() // directory → Map(name → config)
  const clients = new Map() // directory + '\0' + name → Promise of client
  let steps = 0

  const nextSeq = (id) => {
    if (!seqs.has(id)) {
      const row = db.prepare('SELECT max(seq) AS m FROM session_message WHERE session_id = ?').get(id)
      seqs.set(id, (row && row.m != null ? row.m : -1) + 1)
    }
    const seq = seqs.get(id)
    seqs.set(id, seq + 1)
    return seq
  }
  const emit = (type, data, extra = {}) => {
    const frame = 'data: ' + JSON.stringify({ id: idOf('evt'), created: Date.now(), type, ...extra, data }) + '\n\n'
    for (const res of streams) res.write(frame)
  }
  const durable = (id) => ({ durable: { aggregateID: id, seq: nextSeq(id), version: 1 } })
  const rowOf = (id) => db.prepare('SELECT * FROM session_v2 WHERE id = ?').get(id)
  const sessionJson = (r) => ({
    id: r.id,
    projectID: r.project_id,
    cost: r.cost,
    tokens: { input: r.tokens_input, output: r.tokens_output, reasoning: r.tokens_reasoning,
      cache: { read: r.tokens_cache_read, write: r.tokens_cache_write } },
    time: { created: r.time_created, updated: r.time_updated },
    ...(r.title == null ? {} : { title: r.title }),
    ...(r.parent_id == null ? {} : { parentID: r.parent_id }),
    location: { directory: r.directory },
  })
  const SLUGS = ['shiny-cactus', 'curious-wolf', 'brave-otter', 'calm-heron', 'quick-lynx']
  function createSession(id, title, directory, parent) {
    const now = Date.now()
    const project = crypto.createHash('sha1').update(directory).digest('hex')
    db.prepare("INSERT OR IGNORE INTO project (id, worktree, time_created, time_updated, sandboxes) VALUES (?, ?, ?, ?, '[]')")
      .run(project, directory, now, now)
    const slug = SLUGS[Math.floor(Math.random() * SLUGS.length)]
    db.prepare("INSERT INTO session_v2 (id, project_id, parent_id, slug, directory, path, title, version, time_created, time_updated) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?)")
      .run(id, project, parent || null, slug, directory, title == null ? null : title, VERSION, now, now)
    emit('session.created', { sessionID: id, slug, version: VERSION, projectID: project,
      location: { directory }, subpath: '', ...(title == null ? {} : { title }) },
      { location: { directory }, ...durable(id) })
    return rowOf(id)
  }
  function rename(id, title) {
    db.prepare('UPDATE session_v2 SET title = ?, time_updated = ? WHERE id = ?').run(title, Date.now(), id)
    emit('session.renamed', { sessionID: id, title }, durable(id))
  }
  function message(id, type, data) {
    const now = Date.now()
    db.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(idOf('msg'), id, type, nextSeq(id), now, now, JSON.stringify(data))
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function mountsFor(directory) {
    const all = { ...(config.mcp || {}) }
    for (const [name, c] of mounts.get(directory) || []) all[name] = c
    return all
  }
  function mcpClient(directory, name, c) {
    const key = directory + '\0' + name
    if (clients.has(key)) return clients.get(key)
    const started = new Promise((resolve) => {
      const env = { ...process.env, ...(c.environment || {}) }
      fs.writeFileSync(path.join(HOME, 'opencode-mcp-env.json'), JSON.stringify(env))
      const child = cp.spawn(c.command[0], c.command.slice(1), { env, cwd: directory, stdio: ['pipe', 'pipe', 'ignore'] })
      child.on('error', () => resolve(null))
      let buffer = ''
      let next = 1
      const waiting = new Map()
      child.stdout.on('data', (d) => {
        buffer += d.toString()
        let nl
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          const msg = JSON.parse(line)
          if (msg.id != null && waiting.has(msg.id)) {
            waiting.get(msg.id)(msg)
            waiting.delete(msg.id)
          }
        }
      })
      const call = (method, params) => new Promise((done) => {
        const id = next++
        waiting.set(id, done)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
      })
      ;(async () => {
        await call('initialize', { protocolVersion: '2025-11-25', capabilities: {},
          clientInfo: { name: 'opencode', version: VERSION } })
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
        const listed = await call('tools/list', {})
        resolve({ call, tools: ((listed.result && listed.result.tools) || []).map((t) => t.name), child })
      })()
    })
    clients.set(key, started)
    return started
  }
  async function request(id, directory) {
    const tools = [...BUILTIN]
    for (const [name, c] of Object.entries(mountsFor(directory))) {
      if (c.type !== 'local' || c.enabled === false) continue
      const client = await mcpClient(directory, name, c)
      if (client && c.codemode === false) for (const t of client.tools) tools.push(name + '_' + t)
    }
    const entries = db.prepare('SELECT key, value FROM instruction_entry WHERE session_id = ? AND removed = 0 ORDER BY key').all(id)
      .map((e) => ({ key: e.key, value: e.value }))
    fs.appendFileSync(path.join(HOME, 'opencode-requests.jsonl'), JSON.stringify({ sessionID: id, tools,
      system: { instructions: config.instructions || [], skills: (config.skills && config.skills.paths) || [], entries } }) + '\n')
  }

  function take(id, delivery) {
    const row = db.prepare('SELECT * FROM session_inbox WHERE session_id = ? AND delivery = ? ORDER BY enqueued_seq LIMIT 1').get(id, delivery)
    if (!row) return null
    db.prepare('DELETE FROM session_inbox WHERE id = ?').run(row.id)
    emit('session.inbox.delivered', { sessionID: id, inboxID: row.id }, { location: { directory: rowOf(id).directory }, ...durable(id) })
    return JSON.parse(row.payload).text
  }
  async function execute(id) {
    if (runs.get(id)) return
    let text = take(id, 'steer') || take(id, 'queue')
    if (text == null) return
    runs.set(id, true)
    const started = Date.now()
    db.prepare('UPDATE session_v2 SET time_busy = ?, time_updated = ? WHERE id = ?').run(started, started, id)
    emit('session.execution.started', { sessionID: id }, durable(id))
    let outcome = 'succeeded'
    while (text != null) {
      message(id, 'user', { time: { created: Date.now() }, text })
      const s = rowOf(id)
      if (s.title == null) rename(id, process.env.FAKE_OPENCODE_TITLE || text.split(/\s+/).slice(0, 5).join(' '))
      await request(id, s.directory)
      steps += 1
      const at = Date.now()
      if (text.includes('RUNTOOL')) {
        const per = idOf('per')
        const item = { id: per, sessionID: id, action: 'shell', resources: ['touch b.txt'], save: ['touch *'],
          source: { type: 'tool', messageID: idOf('msg'), id: 'call_' + steps } }
        const decision = await new Promise((resolve) => {
          permissions.set(per, { item, resolve, directory: s.directory })
          emit('permission.asked', item, { location: { directory: s.directory } })
        })
        if (decision === 'reject') {
          outcome = 'interrupted'
          break
        }
      }
      let answer = 'ack ' + steps + ': ' + text
      const called = /CALLMENKAR (\S+)\s*(.*)$/.exec(text)
      if (called) {
        const c = mountsFor(s.directory).menkar
        const client = c && (await mcpClient(s.directory, 'menkar', c))
        if (!client) answer = 'TOOL ' + called[1] + ': no menkar server'
        else {
          const reply = await client.call('tools/call', { name: called[1], arguments: called[2] ? JSON.parse(called[2]) : {},
            _meta: { 'ai.opencode/sessionID': id, progressToken: steps } })
          const r = reply.result || {}
          answer = 'TOOL ' + called[1] + ': ' + ((r.content && r.content[0] && r.content[0].text) || JSON.stringify(reply.error || r))
        }
      }
      await sleep(turnMs)
      text = take(id, 'steer')
      const done = Date.now()
      const tokens = { input: 1000 + 10 * steps, output: 10, reasoning: 0, cache: { read: 0, write: 0 } }
      const cost = Number(process.env.FAKE_OPENCODE_COST || 0)
      message(id, 'assistant', { time: { created: at, firstToken: at + 1, streamed: done - 1, completed: done },
        agent: 'build', model: { id: 'm1', providerID: 'stub' }, content: [{ type: 'text', text: answer }],
        snapshot: { start: '0'.repeat(40), end: '0'.repeat(40), files: [] }, finish: 'stop', rawFinish: 'stop', cost, tokens })
      db.prepare('UPDATE session_v2 SET tokens_input = tokens_input + ?, tokens_output = tokens_output + ?, cost = cost + ? WHERE id = ?')
        .run(tokens.input, tokens.output, cost, id)
      if (text == null) text = take(id, 'queue')
    }
    const idle = Date.now()
    message(id, 'idle', { time: { created: idle }, outcome })
    db.prepare('UPDATE session_v2 SET time_idle = ?, idle_outcome = ?, time_updated = ? WHERE id = ?').run(idle, outcome, idle, id)
    runs.delete(id)
    emit('session.execution.' + outcome, { sessionID: id, ...(outcome === 'interrupted' ? { reason: 'user' } : {}) }, durable(id))
    execute(id)
  }

  const ROUTES = [
    ['GET', '/api/info', '/api/info'],
    ['GET', '/api/session/active', '/api/session/active'],
    ['POST', '/api/session', '/api/session'],
    ['GET', /^\/api\/session\/([^/]+)$/, '/api/session/{sessionID}'],
    ['PATCH', /^\/api\/session\/([^/]+)$/, '/api/session/{sessionID}'],
    ['POST', /^\/api\/session\/([^/]+)\/view$/, '/api/session/{sessionID}/view'],
    ['POST', /^\/api\/session\/([^/]+)\/agent$/, '/api/session/{sessionID}/agent'],
    ['POST', /^\/api\/session\/([^/]+)\/model$/, '/api/session/{sessionID}/model'],
    ['POST', /^\/api\/session\/([^/]+)\/prompt$/, '/api/session/{sessionID}/prompt'],
    ['GET', /^\/api\/session\/([^/]+)\/inbox$/, '/api/session/{sessionID}/inbox'],
    ['DELETE', /^\/api\/session\/([^/]+)\/inbox\/([^/]+)$/, '/api/session/{sessionID}/inbox/{inboxID}'],
    ['GET', /^\/api\/session\/([^/]+)\/message$/, '/api/session/{sessionID}/message'],
    ['POST', /^\/api\/session\/([^/]+)\/permission\/([^/]+)\/reply$/, '/api/session/{sessionID}/permission/{requestID}/reply'],
    ['GET', '/api/permission/request', '/api/permission/request'],
    ['GET', '/api/mcp', '/api/mcp'],
    ['GET', '/api/event', '/api/event'],
    ['POST', '/api/rpc/opencode.goal/get', '/api/rpc/opencode.goal/get'],
    ['GET', /^\/api\/experimental\/session\/([^/]+)\/instructions\/entries$/, '/api/experimental/session/{sessionID}/instructions/entries', 'entries'],
    ['PUT', /^\/api\/experimental\/session\/([^/]+)\/instructions\/entries\/([^/]+)$/, '/api/experimental/session/{sessionID}/instructions/entries/{key}', 'entries'],
    ['DELETE', /^\/api\/experimental\/session\/([^/]+)\/instructions\/entries\/([^/]+)$/, '/api/experimental/session/{sessionID}/instructions/entries/{key}', 'entries'],
    ['PUT', /^\/api\/experimental\/mcp\/([^/]+)$/, '/api/experimental/mcp/{server}', 'mcp'],
    ['DELETE', /^\/api\/experimental\/mcp\/([^/]+)$/, '/api/experimental/mcp/{server}', 'mcp'],
    ['GET', '/openapi.json', '/openapi.json'],
  ].filter((r) => !(r[3] === 'entries' && noEntries) && !(r[3] === 'mcp' && noMcpRoute))

  const send = (res, status, body) => {
    if (body === undefined) {
      res.writeHead(status)
      res.end()
    } else {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
  }
  const notFound = (res, id) => send(res, 404, { _tag: 'SessionNotFoundError', sessionID: id, message: 'Session not found: ' + id })
  const invalid = (res, message, kind) => send(res, 400, { _tag: 'InvalidRequestError', message, kind })

  const server = http.createServer((req, res) => {
    const auth = req.headers.authorization || ''
    const given = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString() : ''
    if (given !== 'opencode:' + password) {
      res.writeHead(401, { 'www-authenticate': 'Basic realm="Secure Area"', 'content-type': 'application/json' })
      res.end(JSON.stringify({ _tag: 'UnauthorizedError', message: 'Authentication required' }))
      return
    }
    const url = new URL(req.url, 'http://127.0.0.1')
    let match = null
    const route = ROUTES.find(([method, p]) => {
      if (method !== req.method) return false
      if (typeof p === 'string') return p === url.pathname
      match = p.exec(url.pathname)
      return !!match
    })
    if (!route) return send(res, 404, { _tag: 'NotFound', message: 'Not found' })
    let raw = ''
    req.on('data', (d) => (raw += d))
    req.on('end', () => {
      let body = {}
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        return invalid(res, 'Invalid JSON', 'Payload')
      }
      handle(route[2], req.method, match ? match.slice(1).map(decodeURIComponent) : [], url, body, res)
    })
  })

  function handle(name, method, p, url, body, res) {
    const id = p[0]
    const exists = id && rowOf(id)
    switch (method + ' ' + name) {
      case 'GET /api/info':
        return send(res, 200, { version: VERSION, pid: process.pid, hostname: 'stand-in',
          urls: ['http://127.0.0.1:' + server.address().port], paths: { tmp: '/tmp/opencode' }, capabilities: { persistentPty: true } })
      case 'GET /openapi.json': {
        const paths = {}
        for (const r of ROUTES) (paths[r[2]] ||= {})[r[0].toLowerCase()] = {}
        return send(res, 200, { openapi: '3.1.0', info: { title: 'opencode', version: VERSION }, paths })
      }
      case 'POST /api/rpc/opencode.goal/get':
        if (!body.input || typeof body.input.sessionID !== 'string')
          return send(res, 400, { _tag: 'RpcError', type: 'rpc.invalid_input', message: 'Missing key\n  at ["sessionID"]' })
        return send(res, 200, { output: null })
      case 'GET /api/session/active': {
        const data = {}
        for (const s of runs.keys()) data[s] = { type: 'running' }
        return send(res, 200, { data })
      }
      case 'POST /api/session': {
        const sid = body.id || idOf('ses')
        const directory = (body.location && body.location.directory) || process.cwd()
        return send(res, 200, { data: sessionJson(rowOf(sid) || createSession(sid, body.title, directory, body.parentID)) })
      }
      case 'GET /api/session/{sessionID}':
        return exists ? send(res, 200, { data: sessionJson(exists) }) : notFound(res, id)
      case 'PATCH /api/session/{sessionID}':
        if (!exists) return notFound(res, id)
        if (typeof body.title === 'string') rename(id, body.title)
        return send(res, 204)
      case 'POST /api/session/{sessionID}/view':
        if (typeof body.idle !== 'number') return invalid(res, 'Missing key\n  at ["idle"]', 'Payload')
        if (!exists) return notFound(res, id)
        db.prepare('UPDATE session_v2 SET time_viewed = ? WHERE id = ?').run(body.idle, id)
        emit('session.viewed', { sessionID: id, idle: body.idle }, durable(id))
        return send(res, 204)
      case 'POST /api/session/{sessionID}/agent':
      case 'POST /api/session/{sessionID}/model':
        return exists ? send(res, 204) : notFound(res, id)
      case 'POST /api/session/{sessionID}/prompt': {
        if (!exists) return notFound(res, id)
        const s = exists
        const delivery = body.delivery === 'queue' ? 'queue' : 'steer'
        const mid = body.id || idOf('msg')
        const created = Date.now()
        db.prepare('INSERT INTO session_inbox VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(mid, id, 'user', JSON.stringify({ text: body.text }), delivery, nextSeq(id), created)
        emit('session.inbox.enqueued', { inboxID: mid, sessionID: id, item: { type: 'user', payload: { text: body.text }, delivery } },
          { location: { directory: s.directory }, ...durable(id) })
        send(res, 200, { data: { id: mid, sessionID: id, time: { created }, type: 'user', payload: { text: body.text }, delivery } })
        return execute(id)
      }
      case 'GET /api/session/{sessionID}/inbox': {
        if (!exists) return notFound(res, id)
        const data = db.prepare('SELECT * FROM session_inbox WHERE session_id = ? ORDER BY enqueued_seq').all(id)
          .map((r) => ({ id: r.id, sessionID: id, time: { created: r.time_created }, type: r.type, payload: JSON.parse(r.payload), delivery: r.delivery }))
        return send(res, 200, { data })
      }
      case 'DELETE /api/session/{sessionID}/inbox/{inboxID}':
        if (!exists) return notFound(res, id)
        db.prepare('DELETE FROM session_inbox WHERE id = ? AND session_id = ?').run(p[1], id)
        emit('session.inbox.cancelled', { sessionID: id, inboxID: p[1] }, durable(id))
        return send(res, 204)
      case 'GET /api/session/{sessionID}/message': {
        if (!exists) return notFound(res, id)
        const data = db.prepare('SELECT * FROM session_message WHERE session_id = ? ORDER BY seq').all(id)
          .map((r) => ({ id: r.id, type: r.type, seq: r.seq, data: JSON.parse(r.data) }))
        return send(res, 200, { data })
      }
      case 'POST /api/session/{sessionID}/permission/{requestID}/reply': {
        const pending = permissions.get(p[1])
        if (!pending || !['once', 'always', 'reject'].includes(body.decision)) return send(res, pending ? 400 : 404, {})
        permissions.delete(p[1])
        emit('permission.replied', { sessionID: id, requestID: p[1], reply: body.decision }, { location: { directory: pending.directory } })
        pending.resolve(body.decision)
        return send(res, 204)
      }
      case 'GET /api/permission/request': {
        const data = [...permissions.values()].map((x) => x.item)
        const directory = url.searchParams.get('directory') || (permissions.size ? [...permissions.values()][0].directory : process.cwd())
        return send(res, 200, { location: { directory }, data })
      }
      case 'GET /api/mcp': {
        const directory = url.searchParams.get('directory') || process.cwd()
        const data = []
        for (const name of Object.keys(mountsFor(directory))) {
          const key = directory + '\0' + name
          data.push({ name, status: { status: clients.has(key) ? 'connected' : 'pending' } })
        }
        return send(res, 200, { location: { directory }, data })
      }
      case 'GET /api/event':
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({ id: idOf('evt'), type: 'server.connected', data: {} }) + '\n\n')
        streams.add(res)
        res.on('close', () => streams.delete(res))
        return
      case 'GET /api/experimental/session/{sessionID}/instructions/entries':
        if (!exists) return notFound(res, id)
        return send(res, 200, { data: db.prepare('SELECT key, value FROM instruction_entry WHERE session_id = ? AND removed = 0 ORDER BY key').all(id)
          .map((e) => ({ key: e.key, value: e.value })) })
      case 'PUT /api/experimental/session/{sessionID}/instructions/entries/{key}':
      case 'DELETE /api/experimental/session/{sessionID}/instructions/entries/{key}': {
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(p[1]))
          return invalid(res, 'Expected a string matching the RegExp ^[a-z0-9][a-z0-9._-]*$\n  at ["key"]', 'Params')
        if (!exists) return notFound(res, id)
        const now = Date.now()
        if (method === 'PUT')
          db.prepare('INSERT INTO instruction_entry VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT (session_id, key) DO UPDATE SET value = excluded.value, removed = 0, time_updated = excluded.time_updated')
            .run(id, p[1], String(body.value), now, now)
        else db.prepare('UPDATE instruction_entry SET removed = 1, time_updated = ? WHERE session_id = ? AND key = ?').run(now, id, p[1])
        return send(res, 204)
      }
      case 'PUT /api/experimental/mcp/{server}':
      case 'DELETE /api/experimental/mcp/{server}': {
        const directory = url.searchParams.get('location[directory]')
        if (!directory) return invalid(res, 'Missing key\n  at ["location"]', 'Params')
        if (!mounts.has(directory)) mounts.set(directory, new Map())
        if (method === 'PUT') mounts.get(directory).set(p[0], body.config)
        else mounts.get(directory).delete(p[0])
        emit('mcp.status.changed', { server: p[0] }, { location: { directory } })
        return send(res, 204)
      }
    }
  }

  const heartbeat = setInterval(() => {
    for (const res of streams) res.write(': heartbeat\n\n')
  }, Number(process.env.FAKE_OPENCODE_HEARTBEAT_MS || 10000))
  heartbeat.unref()
  setTimeout(() => {
    server.listen(Number(flag('--port') || 0), '127.0.0.1', () => {
      process.stdout.write(JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port }) + '\n')
    })
  }, Number(process.env.FAKE_OPENCODE_START_MS || 0))
  process.stdin.on('end', () => {
    for (const c of clients.values()) c.then((x) => x && x.child.kill())
    db.close()
    process.exit(0)
  })
  process.stdin.resume()
}

function tui() {
  fs.writeFileSync(path.join(HOME, 'opencode-env.json'), JSON.stringify(process.env))
  const base = flag('--server')
  if (!base) {
    process.stderr.write('stand-in opencode: the TUI is imitated only with --server\n')
    process.exit(1)
  }
  const options = new Set(['--server', '-s', '--session', '--prompt'])
  const positional = args.filter((a, i) => !a.startsWith('-') && !options.has(args[i - 1]))
  const dir = positional[0] ? path.resolve(positional[0]) : process.cwd()
  const firstPrompt = flag('--prompt')
  const auth = 'Basic ' + Buffer.from('opencode:' + (process.env.OPENCODE_PASSWORD || '')).toString('base64')
  const api = (method, p, body) => new Promise((resolve, reject) => {
    const req = http.request(base + p, { method, headers: { authorization: auth, 'content-type': 'application/json' } }, (res) => {
      let raw = ''
      res.on('data', (d) => (raw += d))
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }))
    })
    req.on('error', reject)
    req.end(body === undefined ? undefined : JSON.stringify(body))
  })
  const MODEL = { providerID: 'stub', id: 'm1' }
  let session = flag('-s') || flag('--session') || null
  let created = !!session // a session given by -s is opened as it is; a new one is created at its first prompt
  let title = ''
  let busy = false
  let rows = []
  let queued = []
  let card = null
  let typed = ''
  let lastIdle = null
  const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let spin = 0

  function draw() {
    const out = []
    out.push(' ' + (busy ? SPIN[spin % SPIN.length] : '•') + ' ' + (title || 'New session') + '                     +')
    out.push('')
    for (const r of rows) {
      if (r.type === 'user') out.push('  ┃  ' + r.data.text, '')
      if (r.type === 'assistant') {
        for (const c of r.data.content) if (c.type === 'text') out.push('     ' + c.text)
        const ms = r.data.time.completed - r.data.time.created
        out.push('', '     ▣  Build · m1 · ' + ms + 'ms', '')
      }
      if (r.type === 'idle' && r.data.outcome === 'interrupted') out.push('     ▣  Build · m1 · interrupted', '')
    }
    if (card) {
      out.push('     Press ctrl+b to move running work to the background')
      out.push('  ┃  △ Permission required', '  ┃  $ ' + card.resources.join(' '))
      out.push('  ┃   Allow once   Always allow   Reject      ctrl+f fullscreen  ⇆ select  enter confirm')
    } else {
      if (queued.length) out.push('  ┃  ' + queued.length + ' queued · ' + queued[queued.length - 1].text)
      out.push('  ┃  ' + typed, '  ┃  Build · m1 Stub', '  ╹▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀')
    }
    const last = [...rows].reverse().find((r) => r.type === 'assistant')
    const used = last ? last.data.tokens.input + last.data.tokens.output : 0
    const limit = Number(process.env.FAKE_OPENCODE_CONTEXT || 100000)
    const context = (used / 1000).toFixed(1) + 'K (' + Math.round((100 * used) / limit) + '%)'
    out.push(busy ? '   ⬝⬝⬝⬝⬝⬝⬝⬝ esc interrupt      ' + context + '  ctrl+p commands'
      : '  ' + dir + '    ' + context + '  ctrl+p commands')
    process.stdout.write('\x1b[2J\x1b[H' + out.join('\r\n'))
  }
  async function refresh() {
    if (!created) return draw()
    const s = await api('GET', '/api/session/' + session)
    if (s.status === 200) title = s.body.data.title || ''
    const m = await api('GET', '/api/session/' + session + '/message')
    rows = m.status === 200 ? m.body.data : []
    const idle = [...rows].reverse().find((r) => r.type === 'idle')
    lastIdle = idle ? idle.data.time.created : null
    draw()
  }
  const goal = () => api('POST', '/api/rpc/opencode.goal/get?location%5Bdirectory%5D=' + encodeURIComponent(dir), { input: { sessionID: session } })
  async function submit(text) {
    if (!created) {
      session = 'ses_' + (0xffffffffffff - Date.now()).toString(16) + rand(14)
      await api('POST', '/api/session', { id: session, agent: 'build', model: MODEL, location: { directory: dir } })
      created = true
      await goal()
    }
    await api('POST', '/api/session/' + session + '/model', { model: MODEL })
    await api('POST', '/api/session/' + session + '/prompt', { id: 'msg_' + rand(26), text, files: [], agents: [], delivery: 'steer' })
  }
  function listen() {
    const req = http.request(base + '/api/event', { headers: { authorization: auth } }, (res) => {
      let buffer = ''
      res.on('data', (d) => {
        buffer += d.toString()
        let end
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (frame.startsWith('data: ')) onEvent(JSON.parse(frame.slice(6)))
        }
      })
    })
    req.end()
  }
  async function onEvent(e) {
    const d = e.data || {}
    if (d.sessionID !== session) return
    if (e.type === 'session.execution.started') busy = true
    if (e.type === 'session.inbox.enqueued' && d.item.delivery === 'queue') queued.push({ id: d.inboxID, text: d.item.payload.text })
    if (e.type === 'session.inbox.delivered' || e.type === 'session.inbox.cancelled') queued = queued.filter((q) => q.id !== d.inboxID)
    if (e.type === 'permission.asked') card = d
    if (e.type === 'permission.replied') card = null
    if (e.type === 'session.renamed') title = d.title
    if (e.type.startsWith('session.execution.') && e.type !== 'session.execution.started') {
      busy = false
      await refresh()
      if (lastIdle != null) await api('POST', '/api/session/' + session + '/view', { idle: lastIdle })
      return
    }
    await refresh()
  }

  ;(async () => {
    const info = await api('GET', '/api/info').catch(() => null)
    if (!info) {
      process.stderr.write('Error: Unable to connect to ' + base + '\n')
      process.exit(1)
    }
    if (info.status === 401) {
      process.stderr.write('Error: Server at ' + base + ' requires a password; set OPENCODE_PASSWORD\n' +
        '    at cli.server-connection.resolve (stand-in)\n  [cause]: UnauthorizedError: Authentication required\n')
      process.exit(1)
    }
    listen()
    if (created) {
      await goal()
      await api('POST', '/api/session/' + session + '/agent', { agent: 'build' })
      await api('POST', '/api/session/' + session + '/model', { model: MODEL })
    }
    await refresh()
    if (firstPrompt) await submit(firstPrompt)
  })()

  setInterval(() => {
    if (!busy) return
    spin += 1
    draw()
  }, 100).unref()
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.on('data', async (chunk) => {
    for (const ch of chunk.toString()) {
      if (card) {
        if (ch === '\r') await api('POST', '/api/session/' + session + '/permission/' + card.id + '/reply', { decision: 'once' })
        else if (ch === '\x1b') await api('POST', '/api/session/' + session + '/permission/' + card.id + '/reply', { decision: 'reject' })
        continue
      }
      if (ch === '\x03') {
        if (typed) {
          typed = ''
          draw()
          continue
        }
        process.stdout.write('\x1b[2J\x1b[H  Session   ' + (title || 'New session') + '\r\n  Continue  opencode -s ' + session + '\r\n')
        process.exit(0)
      }
      if (ch === '\r') {
        const text = typed.trim()
        typed = ''
        if (text === '/new') {
          if (created && lastIdle != null) await api('POST', '/api/session/' + session + '/view', { idle: lastIdle })
          session = null
          created = false
          title = ''
          rows = []
          queued = []
          lastIdle = null
          draw()
          if (firstPrompt) await submit(firstPrompt)
        } else if (text.startsWith('/switch ')) {
          const picked = text.slice(8).trim()
          if ((await api('GET', '/api/session/' + picked)).status === 200) {
            session = picked
            created = true
            queued = []
            await goal()
            await refresh()
          }
        } else if (text) await submit(text)
        draw()
        continue
      }
      if (ch === '\x7f') typed = typed.slice(0, -1)
      else typed += ch
      if (typed.includes('EXIT0')) process.exit(0)
      draw()
    }
  })
}
`

const SCHEMA = join(
  import.meta.dirname,
  '..',
  '..',
  'tests',
  'data',
  'agents',
  'opencode',
  'schema.sql',
)

// Puts the stand-in `opencode` in `bin`, beside the stand-in claude, with OpenCode's tables.
export function opencodeStandIn(bin: string): void {
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'opencode'), FAKE_OPENCODE)
  chmodSync(join(bin, 'opencode'), 0o755)
  copyFileSync(SCHEMA, join(bin, 'opencode-schema.sql'))
}
