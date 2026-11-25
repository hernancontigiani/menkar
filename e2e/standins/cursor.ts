import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A stand-in `cursor-agent` that runs turns (never the real one), in the shapes cursor-agent
// 2026.11.13 has as `cursor` measured them:
// - `--version` prints 2026.11.13-stand-in and exits.
// - It records its arguments in cursor-args.txt and its environment in cursor-env.json, in HOME.
// - `--new-session-id <uuid>` starts that chat, `--resume <id>` reopens one, else it picks a UUID.
//   The text after `--` is the first turn.
// - A new chat runs the `sessionStart` hooks of each `--plugin-dir`'s hooks/hooks.json, through
//   `sh -c`, and appends each `additional_context` they print to cursor-context.jsonl in HOME as
//   `{ session, context }`. A resume runs none.
// - A turn (the first prompt, or a line typed and ended with Enter while none runs) runs the
//   `beforeSubmitPrompt` entries of the user's ~/.cursor/hooks.json, shows a spinner and "ctrl+c
//   to stop" for FAKE_CURSOR_TURN_MS (800 by default; 4000 for a prompt starting `SLOW `), answers, rewrites the chat's transcript
//   whole under ~/.cursor/projects/<folder>/agent-transcripts/<id>/<id>.jsonl, draws its box
//   (`→ Add a follow-up`), then runs the user's `stop` entries with a completed turn's payload. A
//   `followup_message` a stop hook prints runs as the next turn, 300 ms later. The payloads carry
//   `user_email`, as Cursor's do.
// - A prompt `CALLMENKAR <tool> <JSON arguments>` calls that tool of the server a `--plugin-dir`'s
//   `.mcp.json` names, started with only Cursor's few variables and the entry's `env`, its
//   environment written to cursor-mcp-env.json in HOME; the answer is the turn's reply,
//   "TOOL <name>: <text>". Without an allow entry `Mcp(plugin-<folder>-menkar:*)` in
//   cli-config.json ($CURSOR_CONFIG_DIR, else $XDG_CONFIG_HOME/cursor, else ~/.cursor) it first
//   asks, as a card ("(y) (enter)", "skip (esc or n)"), and goes on once `y` is typed. Any other
//   prompt is answered "ack <n>: <prompt>".
// - A chat's metadata (`createdAtMs`) is written when the chat is made, under the config folder's
//   chats/<md5 of the folder>/<id>/meta.json. `/new` typed while no turn runs starts another chat in
//   the same process, as Cursor's does: its metadata at once, no hook, the transcript at its first
//   message.
// - With FAKE_CURSOR_LIMIT set, every turn ends as on Cursor's free-requests limit screen: the
//   error's lines, a stop with status `error` and no tokens, and the refused prompt put back in the
//   box as text.
// - Typing EXIT0 ends it; a hangup ends it too.
const FAKE_CURSOR = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
if (args[0] === '--version') {
  process.stdout.write('2026.11.13-stand-in\\n')
  process.exit(0)
}
const HOME = process.env.HOME
fs.appendFileSync(path.join(HOME, 'cursor-args.txt'), args.join(' ') + '\\n')
fs.writeFileSync(path.join(HOME, 'cursor-env.json'), JSON.stringify(process.env))
const dash = args.indexOf('--')
const options = dash < 0 ? args : args.slice(0, dash)
const first = dash < 0 ? null : args.slice(dash + 1).join(' ')
const valueOf = (name) => (options.includes(name) ? options[options.indexOf(name) + 1] : null)
const plugins = options.flatMap((o, i) => (options[i - 1] === '--plugin-dir' ? [o] : []))
const resuming = valueOf('--resume') !== null
let id = valueOf('--resume') || valueOf('--new-session-id') || crypto.randomUUID()
const TURN_MS = Number(process.env.FAKE_CURSOR_TURN_MS || 800)
const LIMIT = !!process.env.FAKE_CURSOR_LIMIT
const EMAIL = 'someone@example.com'

const slug = process.cwd().replace(/^\\//, '').replaceAll('/', '-')
const transcriptOf = (chat) => path.join(HOME, '.cursor', 'projects', slug, 'agent-transcripts', chat, chat + '.jsonl')
let transcript = transcriptOf(id)
let lines = fs.existsSync(transcript) ? fs.readFileSync(transcript, 'utf8').split('\\n').filter(Boolean) : []
// A chat's metadata, made when the chat is: at start, or at /new before any message. It goes under
// the config folder, the transcripts under the home's .cursor.
function chatMeta(chat) {
  const dir = path.join(configDir(), 'chats', crypto.createHash('md5').update(process.cwd()).digest('hex'), chat)
  fs.mkdirSync(dir, { recursive: true })
  const at = Date.now()
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schemaVersion: 1, createdAtMs: at, hasConversation: false, updatedAtMs: at, cwd: process.cwd() }))
}
if (!resuming) chatMeta(id)
const rewrite = () => {
  fs.mkdirSync(path.dirname(transcript), { recursive: true })
  fs.writeFileSync(transcript, lines.map((l) => l + '\\n').join(''))
}
const text = (role, t) => JSON.stringify({ role, message: { content: [{ type: 'text', text: t }] } })

function hook(command, payload) {
  const run = spawnSync('sh', ['-c', command], { input: JSON.stringify(payload), encoding: 'utf8', env: process.env, timeout: 3000 })
  try {
    return run.stdout.trim() ? JSON.parse(run.stdout) : null
  } catch {
    return null
  }
}
function userHooks(event, payload) {
  let config = {}
  try {
    config = JSON.parse(fs.readFileSync(path.join(HOME, '.cursor', 'hooks.json'), 'utf8'))
  } catch {}
  const entries = (config.hooks && config.hooks[event]) || []
  return entries.map((e) => hook(e.command, { ...payload, hook_event_name: event, user_email: EMAIL })).filter(Boolean)
}
if (!resuming)
  for (const dir of plugins) {
    let config = {}
    try {
      config = JSON.parse(fs.readFileSync(path.join(dir, 'hooks', 'hooks.json'), 'utf8'))
    } catch {}
    for (const e of (config.hooks && config.hooks.sessionStart) || []) {
      const out = hook(e.command, { hook_event_name: 'sessionStart', session_id: id, user_email: EMAIL })
      if (out && out.additional_context !== undefined)
        fs.appendFileSync(path.join(HOME, 'cursor-context.jsonl'), JSON.stringify({ session: id, context: out.additional_context }) + '\\n')
    }
  }

function configDir() {
  if (process.env.CURSOR_CONFIG_DIR) return process.env.CURSOR_CONFIG_DIR
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'cursor')
  return path.join(HOME, '.cursor')
}
function allowed(server, tool) {
  try {
    const allow = JSON.parse(fs.readFileSync(path.join(configDir(), 'cli-config.json'), 'utf8')).permissions.allow
    return allow.includes('Mcp(' + server + ':*)') || allow.includes('Mcp(' + server + ':' + tool + ')')
  } catch {
    return false
  }
}
function menkarServer() {
  for (const dir of plugins) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8')).mcpServers.menkar
      if (entry) return { name: 'plugin-' + path.basename(dir) + '-menkar', ...entry }
    } catch {}
  }
  return null
}
function callMenkar(server, name, toolArgs, done) {
  const env = {}
  for (const v of ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER']) if (process.env[v] !== undefined) env[v] = process.env[v]
  Object.assign(env, server.env || {})
  fs.writeFileSync(path.join(HOME, 'cursor-mcp-env.json'), JSON.stringify(env))
  const child = spawn(server.command, server.args || [], { env, stdio: ['pipe', 'pipe', 'inherit'] })
  let out = ''
  child.stdout.on('data', (d) => {
    out += d
    const parts = out.split('\\n')
    out = parts.pop()
    for (const reply of parts.filter(Boolean).map((l) => JSON.parse(l))) {
      if (reply.id !== 2) continue
      child.kill()
      done(reply.result.content[0].text.replace(/\\s+/g, ' '))
    }
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }) + '\\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: toolArgs } }) + '\\n')
}

let draft = ''
let busy = false
let card = null
let turns = 0
const drawBox = () => process.stdout.write('\\r\\x1b[2K  → ' + (draft || 'Add a follow-up'))
process.stdout.write('stand-in cursor-agent ready\\r\\n')

function answer(reply, generation) {
  lines.push(text('assistant', reply))
  lines.push(JSON.stringify({ type: 'turn_ended', status: 'success' }))
  rewrite()
  process.stdout.write('\\r\\x1b[2K  ' + reply + '\\r\\n')
  busy = false
  drawBox()
  const outs = userHooks('stop', { session_id: id, generation_id: generation, status: 'completed', loop_count: 0, model: 'default', input_tokens: 1200, output_tokens: 80, cache_read_tokens: 1000, cache_write_tokens: 0 })
  for (const out of outs)
    if (typeof out.followup_message === 'string') setTimeout(() => turn(out.followup_message), 300)
}
function refused(prompt, generation) {
  process.stdout.write('\\r\\x1b[2K  Error: You\\'ve hit your usage limit\\r\\n  limitType: included_usage\\r\\n  chatMessage: *You\\'ve hit your free requests limit.*\\r\\n')
  busy = false
  draft = prompt
  drawBox()
  userHooks('stop', { session_id: id, generation_id: generation, status: 'error', loop_count: 0, model: 'default', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 })
}
function turn(prompt) {
  busy = true
  turns += 1
  const n = turns
  const generation = crypto.randomUUID()
  userHooks('beforeSubmitPrompt', { session_id: id, generation_id: generation, prompt, attachments: [] })
  lines.push(text('user', '<user_query>\\n' + prompt + '\\n</user_query>'))
  rewrite()
  process.stdout.write('\\r\\x1b[2K  PROMPT: ' + prompt.replace(/\\s+/g, ' ') + '\\r\\n')
  process.stdout.write('\\r\\x1b[2K  ⠋ Generating   ctrl+c to stop')
  setTimeout(() => {
    if (LIMIT) return refused(prompt, generation)
    if (!prompt.startsWith('CALLMENKAR ')) return answer('ack ' + n + ': ' + prompt.replace(/\\s+/g, ' '), generation)
    const call = prompt.slice('CALLMENKAR '.length)
    const space = call.indexOf(' ')
    const name = space < 0 ? call : call.slice(0, space)
    const toolArgs = space < 0 ? {} : JSON.parse(call.slice(space + 1))
    const server = menkarServer()
    if (!server) return answer('TOOL ' + name + ': no Menkar server', generation)
    const go = () => callMenkar(server, name, toolArgs, (t) => answer('TOOL ' + name + ': ' + t, generation))
    if (allowed(server.name, name)) return go()
    card = () => {
      card = null
      process.stdout.write('\\r\\x1b[2K\\x1b[1A\\x1b[2K\\x1b[1A\\x1b[2K')
      go()
    }
    process.stdout.write('\\r\\x1b[2K  Call ' + name + ' on ' + server.name + '?\\r\\n  Run (once) (y) (enter)\\r\\n  Skip (esc or n)')
  }, prompt.startsWith('SLOW ') ? 4000 : TURN_MS)
}

// /new, as cursor-agent 2026.11.13 does it: another chat in the same process, its metadata made at
// once, its transcript at its first message; no hook runs.
function newChat() {
  id = crypto.randomUUID()
  transcript = transcriptOf(id)
  lines = []
  chatMeta(id)
  process.stdout.write('\\r\\x1b[2K  → Plan, search, build anything')
}

if (first !== null) turn(first)
else drawBox()
if (process.stdin.isTTY) process.stdin.setRawMode(true)
let typed = ''
process.stdin.on('data', (d) => {
  typed += d.toString()
  if (typed.includes('EXIT0')) process.exit(0)
  for (const c of d.toString()) {
    if (card) {
      if (c === 'y') card()
      continue
    }
    if (c === '\\r') {
      if (busy || !draft) continue
      const prompt = draft
      draft = ''
      process.stdout.write('\\r\\x1b[2K')
      if (prompt === '/new') newChat()
      else turn(prompt)
    } else if (c === '\\x7f') {
      draft = draft.slice(0, -1)
      if (!busy) drawBox()
    } else if (c >= ' ') {
      draft += c
      if (!busy) drawBox()
    }
  }
})
`

// Puts the stand-in `cursor-agent` that runs turns in `bin`, beside the stand-in claude.
export function cursorTurnsStandIn(bin: string): void {
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'cursor-agent'), FAKE_CURSOR)
  chmodSync(join(bin, 'cursor-agent'), 0o755)
}
