import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A stand-in `codex` (never the real one), with the files Codex 0.169 writes in their shapes:
// - `--version` prints FAKE_CODEX_VERSION (0.169.0 by default) and exits.
// - It records its arguments in codex-args.txt and its environment in codex-env.json, in HOME.
// - `codex [options] [prompt]` starts a thread, its id a UUIDv7 minted then. Its rollout appears
//   under $CODEX_HOME/sessions/YYYY/MM/DD/ (CODEX_HOME defaults to ~/.codex), named with that
//   time, at its first message (the prompt's, at once), with its `session_meta` line, and the
//   process holds it open while it runs, as Codex 0.169 does. Each thread's id is appended to
//   codex-threads.txt in HOME when its rollout appears.
//   `codex resume <id> [prompt]` reopens that thread's rollout, or exits 1 when none exists.
// - The prompt, or a line typed and ended with Enter, runs a turn of FAKE_CODEX_TURN_MS (1000 by
//   default): its lines are appended to the rollout, then each `-c notify=[…]` program runs with
//   Codex's one JSON argument. The first turn of a new thread notifies first for a title thread
//   that has no rollout, as Codex's title generation does.
// - `/new` typed starts another thread, whose rollout appears at its next message; `/fork` forks
//   the thread, its rollout written at once with `forked_from_id`. Either way the earlier
//   rollout stays open, as Codex keeps it.
// - `codex queue --thread <id> --message <text>` puts the message in $CODEX_HOME/queue_1.sqlite,
//   or exits 1 when the thread has no rollout; a running stand-in holding that thread takes it as
//   its next turn and deletes the row. Without `--disable plugins` it first syncs Codex's plugin
//   marketplace as 0.169 does, leaving a `.tmp/git-XXXXXX/` behind in $CODEX_HOME. With
//   FAKE_CODEX_DAEMON set (Codex's shared daemon running), any `-c` or `--disable` is refused with
//   Codex's own line and exit 1, and a plain call is served by the daemon: nothing synced here.
// - With `-c mcp_servers.menkar.*` given, `/menkar <tool> [<JSON arguments>]` typed calls that
//   tool of the server the keys name, started as Codex 0.169 starts a stdio server: its environment is only Codex's few
//   variables, then the names in `env_vars` taken from its own environment, then `env`. The
//   environment it was given goes to codex-mcp-env.json in HOME, and the answer is printed as
//   "TOOL <name>: <text>".
// Timestamps inside the rollout are UTC; its file name and folders are local time, as Codex's.
// - Typing EXIT0 ends it.
const FAKE_CODEX = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const args = process.argv.slice(2)
if (args[0] === '--version') {
  process.stdout.write('codex-cli ' + (process.env.FAKE_CODEX_VERSION || '0.169.0') + '\\n')
  process.exit(0)
}
fs.appendFileSync(path.join(process.env.HOME, 'codex-args.txt'), args.join(' ') + '\\n')
fs.writeFileSync(path.join(process.env.HOME, 'codex-env.json'), JSON.stringify(process.env))
const home = process.env.CODEX_HOME || path.join(process.env.HOME, '.codex')
const sessions = path.join(home, 'sessions')

function rolloutOf(id) {
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return null
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const at = path.join(dir, item.name)
      if (item.isDirectory()) {
        const found = walk(at)
        if (found) return found
      } else if (item.name.endsWith('-' + id + '.jsonl')) return at
    }
    return null
  }
  return walk(sessions)
}

function queueDb() {
  const { DatabaseSync } = require('node:sqlite')
  fs.mkdirSync(home, { recursive: true })
  const db = new DatabaseSync(path.join(home, 'queue_1.sqlite'))
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS queued_items (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, payload_json TEXT NOT NULL, queue_order INTEGER NOT NULL, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL)')
  return db
}

if (args[0] === 'queue') {
  const overridden = args.includes('-c') || args.includes('--disable')
  if (process.env.FAKE_CODEX_DAEMON && overridden) {
    process.stderr.write('Error: cannot queue through an embedded app server while a local app-server daemon is running; remove configuration overrides or use --remote\\n')
    process.exit(1)
  }
  const disabled = args.some((word, i) => args[i - 1] === '--disable' && word === 'plugins')
  if (!process.env.FAKE_CODEX_DAEMON && !disabled) {
    const git = path.join(home, '.tmp', 'git-' + crypto.randomBytes(3).toString('hex'))
    for (const dir of ['objects', 'refs']) fs.mkdirSync(path.join(git, dir), { recursive: true })
    fs.writeFileSync(path.join(git, 'HEAD'), '')
  }
  const thread = args[args.indexOf('--thread') + 1]
  const message = args[args.indexOf('--message') + 1]
  if (!rolloutOf(thread)) {
    process.stderr.write('Error: no rollout found for thread id ' + thread + '\\n')
    process.exit(1)
  }
  const db = queueDb()
  const at = Date.now()
  const order = db.prepare('SELECT COUNT(*) AS n FROM queued_items WHERE thread_id = ?').get(thread).n
  const payload = { UserInput: { content: [{ type: 'text', text: message, text_elements: [] }], client_id: crypto.randomUUID() } }
  db.prepare('INSERT INTO queued_items VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), thread, JSON.stringify(payload), order, at, at)
  db.close()
  process.exit(0)
}

// -c key=value, as many as given; the value is TOML, and notify's array of strings reads as JSON.
const config = {}
args.forEach((word, i) => {
  if (args[i - 1] !== '-c') return
  const eq = word.indexOf('=')
  config[word.slice(0, eq)] = word.slice(eq + 1)
})
const notify = config.notify ? JSON.parse(config.notify) : null
function menkarServer() {
  const key = (name) => config['mcp_servers.menkar.' + name]
  if (!key('command')) return null
  const env = {}
  const names = ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'USER', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'TZ', ...(key('env_vars') ? JSON.parse(key('env_vars')) : [])]
  for (const name of names) if (process.env[name] !== undefined) env[name] = process.env[name]
  for (const m of (key('env') || '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")/g)) env[m[1]] = JSON.parse(m[2])
  return { command: JSON.parse(key('command')), args: JSON.parse(key('args')), env }
}
function callMenkar(call) {
  const space = call.indexOf(' ')
  const name = space < 0 ? call : call.slice(0, space)
  const toolArgs = space < 0 ? {} : JSON.parse(call.slice(space + 1))
  const server = menkarServer()
  if (!server) {
    process.stdout.write('TOOL ' + name + ': no Menkar server\\r\\n')
    return
  }
  fs.writeFileSync(path.join(process.env.HOME, 'codex-mcp-env.json'), JSON.stringify(server.env))
  const child = require('node:child_process').spawn(server.command, server.args, { env: server.env, stdio: ['pipe', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', (d) => {
    out += d
    const lines = out.split('\\n')
    out = lines.pop()
    for (const reply of lines.map((l) => JSON.parse(l))) {
      if (reply.id !== 2) continue
      process.stdout.write('TOOL ' + name + ': ' + reply.result.content[0].text.replace(/\\s+/g, ' ') + '\\r\\n')
      child.kill()
    }
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }) + '\\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: toolArgs } }) + '\\n')
}
const valued = new Set(['-c', '-m', '--model', '-C', '--cd', '--add-dir', '-s', '-a', '-p', '--profile'])
const words = args.filter((word, i) => !word.startsWith('-') && !valued.has(args[i - 1]))
const resuming = words[0] === 'resume'
const prompt = resuming ? words[2] : words[0]
const cwd = args.includes('-C') ? path.resolve(args[args.indexOf('-C') + 1]) : process.cwd()

const pad = (n) => String(n).padStart(2, '0')
// A UUIDv7: the first 48 bits are the time it was minted.
function v7() {
  const hex = Date.now().toString(16).padStart(12, '0') + crypto.randomBytes(10).toString('hex')
  const variant = ((parseInt(hex[16], 16) & 3) | 8).toString(16)
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-7' + hex.slice(13, 16) + '-' + variant + hex.slice(17, 20) + '-' + hex.slice(20, 32)
}
const opened = []
let id, file = null, fd = null, minted = new Date(), fresh = !resuming
function open(meta) {
  if (!file) {
    const day = [String(minted.getFullYear()), pad(minted.getMonth() + 1), pad(minted.getDate())]
    const time = [pad(minted.getHours()), pad(minted.getMinutes()), pad(minted.getSeconds())].join('-')
    const dir = path.join(sessions, ...day)
    fs.mkdirSync(dir, { recursive: true })
    file = path.join(dir, 'rollout-' + day.join('-') + 'T' + time + '-' + id + '.jsonl')
  }
  // Held open for appends while it runs: the open file is how a running Codex's thread is found.
  fd = fs.openSync(file, 'a')
  opened.push(fd)
  if (meta) line('session_meta', { session_id: id, id, timestamp: minted.toISOString(), cwd, originator: 'codex-tui', cli_version: '0.169.0', source: 'cli', thread_source: 'user', model_provider: 'openai', base_instructions: { text: 'Stand-in instructions.' }, history_mode: 'paginated', ...meta })
  fs.appendFileSync(path.join(process.env.HOME, 'codex-threads.txt'), id + '\\n')
}
const line = (type, payload) => fs.writeSync(fd, JSON.stringify({ timestamp: new Date().toISOString(), type, payload }) + '\\n')
if (resuming) {
  id = words[1]
  file = rolloutOf(id)
  if (!file) {
    process.stderr.write('Error: no rollout found for thread id ' + id + '\\n')
    process.exit(1)
  }
  open(null)
} else id = v7()

const inputs = []
let turns = 0
let busy = false
function run(program, payload) {
  require('node:child_process').spawnSync(program[0], [...program.slice(1), JSON.stringify(payload)], { stdio: 'ignore' })
}
function turn(text) {
  if (text.startsWith('/menkar ')) {
    callMenkar(text.slice('/menkar '.length))
    return
  }
  if (text === '/new' || text === '/fork') {
    const from = id
    id = v7()
    minted = new Date()
    file = null
    inputs.length = 0
    turns = 0
    fresh = true
    if (text === '/fork') open({ forked_from_id: from })
    process.stdout.write('\\x1b[2J\\x1b[H• ' + text.slice(1) + ' thread\\r\\n› Ask Codex to do anything\\r\\n')
    return
  }
  if (!file) open({})
  busy = true
  turns += 1
  const turnId = crypto.randomUUID()
  inputs.push(text)
  process.stdout.write('\\x1b[2J\\x1b[H• Working (0s • esc to interrupt)\\r\\n› Ask Codex to do anything\\r\\n')
  setTimeout(() => {
    const reply = 'Done: ' + text
    const started = Math.floor(Date.now() / 1000)
    const usage = { input_tokens: 1200, cached_input_tokens: 800, cache_write_input_tokens: 0, output_tokens: 40, reasoning_output_tokens: 10, total_tokens: 1240 }
    line('turn_context', { turn_id: turnId, cwd, approval_policy: 'on-request', model: 'gpt-stand-in', effort: 'low' })
    line('event_msg', { type: 'task_started', turn_id: turnId, started_at: started, model_context_window: 258400, collaboration_mode_kind: 'default' })
    line('event_msg', { type: 'item_completed', thread_id: id, turn_id: turnId, item: { type: 'UserMessage', id: crypto.randomUUID(), client_id: crypto.randomUUID(), content: [{ type: 'text', text, text_elements: [] }] }, completed_at_ms: Date.now() })
    line('event_msg', { type: 'item_completed', thread_id: id, turn_id: turnId, item: { type: 'AgentMessage', id: 'msg_' + turns, content: [{ type: 'Text', text: reply }] }, completed_at_ms: Date.now() })
    line('event_msg', { type: 'token_count', info: { total_token_usage: usage, last_token_usage: usage, last_usage_includes_reasoning: true, model_context_window: 258400 }, rate_limits: null })
    line('event_msg', { type: 'task_complete', turn_id: turnId, root_turn_id: turnId, last_agent_message: reply, started_at: started, completed_at: started + 1, duration_ms: 1000, time_to_first_token_ms: 300 })
    const payload = { type: 'agent-turn-complete', 'thread-id': id, 'turn-id': turnId, cwd, client: 'codex-tui', 'input-messages': inputs, 'last-assistant-message': reply }
    if (notify && fresh && turns === 1) run(notify, { ...payload, 'thread-id': crypto.randomUUID(), 'turn-id': crypto.randomUUID(), 'input-messages': [text], 'last-assistant-message': 'A title' })
    if (notify) run(notify, payload)
    process.stdout.write('\\x1b[2J\\x1b[H• ' + reply + '\\r\\n› Ask Codex to do anything\\r\\n')
    busy = false
  }, Number(process.env.FAKE_CODEX_TURN_MS || 1000))
}

process.stdout.write('› Ask Codex to do anything\\r\\n')
if (prompt) turn(prompt)
setInterval(() => {
  if (busy || !fs.existsSync(path.join(home, 'queue_1.sqlite'))) return
  const db = queueDb()
  const row = db.prepare('SELECT id, payload_json FROM queued_items WHERE thread_id = ? ORDER BY queue_order LIMIT 1').get(id)
  if (row) db.prepare('DELETE FROM queued_items WHERE id = ?').run(row.id)
  db.close()
  if (row) turn(JSON.parse(row.payload_json).UserInput.content[0].text)
}, 500).unref()
if (process.stdin.isTTY) process.stdin.setRawMode(true)
let typed = ''
process.stdin.on('data', (d) => {
  typed += d.toString()
  if (typed.includes('EXIT0')) process.exit(0)
  const enter = typed.indexOf('\\r')
  if (enter >= 0) {
    const text = typed.slice(0, enter).trim()
    typed = typed.slice(enter + 1)
    if (text && !busy) turn(text)
  }
})
`

// Puts the stand-in `codex` in `bin`, beside the stand-in claude.
export function codexStandIn(bin: string): void {
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'codex'), FAKE_CODEX)
  chmodSync(join(bin, 'codex'), 0o755)
}
