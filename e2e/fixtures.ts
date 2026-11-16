import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { e2ePath } from './path'

export const SESSION = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'
export const CLEARED_SESSION = '9e9e9e9e-0000-4000-8000-0000000000c1'

// A stand-in `claude` (never the real one): it records its arguments and its environment, writes the transcript a
// new session or a fork would get, with one typed message, and stays in the foreground until
// it reads EXIT0 or EXIT1; ASK makes it print a permission question. CLEAR acts as `/clear` does
// in Claude Code: a new session id (CLEARED_SESSION) with a transcript of its own, and the
// SessionStart hook its --settings declares for "clear" run with that id, in its environment;
// RESUME runs the "resume" hook for the session FAKE_CLAUDE_RESUME names, as `/resume` does.
// Menkar's MCP tools are called through the real server its --mcp-config names, started
// as Claude Code starts it: RENEW calls renew, then ends the turn (the Stop hook its --settings
// declares); SPAWN1 starts "worker" in the group "pair" with a prompt; SPAWN2 asks for "worker"
// again; SPAWN3 names a group that does not exist; LISTS lists the project; REPLY asks for
// worker's last reply; TOPIC raises a topic "Pick a port". A worker per task (decision 1.118):
// TASKADD adds an unassigned task, WORKT starts its worker, STEPS and WAITS (which ends the turn)
// report on task 1, PARK parks "client-work-t1", WAKEW resumes it with a prompt, CLOSE1 closes
// task 1 as done; STAR1 gives task 1 the ★ and DROPSTAR takes it away; REVIEWPR (which ends the
// turn) hands task 1 to review waiting on PR approval #436, SECONDW starts task 2's worker.
// Each answer is printed as "TOOL <name>: <text>". The session FAKE_CLAUDE_QUERY names asks the
// terminal for the cursor's position (CSI 6n) as it starts, as Claude Code queries its terminal.
// The team block: --version prints FAKE_CLAUDE_VERSION (2.1.325 by default) and exits;
// --append-system-prompt-file is read at start, as Claude Code reads it, into claude-team.jsonl, and
// a missing one stops it with Claude Code's error. With FAKE_CLAUDE_SOCKET set, unless a registry
// entry already names its session, it publishes a messaging socket as Claude Code does (an entry
// Remote Control's state also reads), and what arrives there goes to claude-posts.jsonl; with FAKE_CLAUDE_TEAM_TURN set, a team update starts a turn that writes the
// update and a "Noted." to its transcript, as Claude Code records them. TURN is a turn the human
// typed; COMPACT runs the "compact" hook; FAKE_CLAUDE_START_HOOK runs the "resume" hook of a
// --resume start, as Claude Code does.
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const args = process.argv.slice(2)
if (args[0] === '--version') {
  process.stdout.write((process.env.FAKE_CLAUDE_VERSION || '2.1.325') + ' (Claude Code)\\n')
  process.exit(0)
}
fs.appendFileSync(path.join(process.env.HOME, 'claude-args.txt'), args.join(' ') + '\\n')
fs.writeFileSync(path.join(process.env.HOME, 'claude-pid.txt'), String(process.pid))
fs.writeFileSync(path.join(process.env.HOME, 'claude-env.json'), JSON.stringify(process.env))
const at = args.indexOf('--session-id')
if (at >= 0 && !process.env.FAKE_CLAUDE_QUIET) {
  const id = args[at + 1]
  const name = args.includes('-n') ? args[args.indexOf('-n') + 1] : null
  const folder = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'))
  fs.mkdirSync(folder, { recursive: true })
  const lines = []
  if (name) lines.push({ type: 'custom-title', customTitle: name })
  lines.push({ type: 'user', cwd: process.cwd(), message: { content: 'typed in the stand-in' } })
  fs.writeFileSync(path.join(folder, id + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\\n') + '\\n')
}
process.stdout.write('stand-in claude ready\\r\\n')
const folder = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'))
// The SessionStart hook its --settings declares for this source, run as Claude Code runs it.
function sessionStart(source, id, transcript) {
  const settings = JSON.parse(fs.readFileSync(args[args.indexOf('--settings') + 1], 'utf8'))
  const entry = settings.hooks.SessionStart.find((h) => h.matcher === source)
  require('node:child_process').execFileSync('/bin/sh', ['-c', entry.hooks[0].command], {
    input: JSON.stringify({ session_id: id, transcript_path: transcript, cwd: process.cwd(), hook_event_name: 'SessionStart', source }),
  })
}
const ownId = at >= 0 ? args[at + 1] : args.includes('--resume') ? args[args.indexOf('--resume') + 1] : null
if (ownId && process.env.FAKE_CLAUDE_QUERY === ownId) process.stdout.write('\\x1b[6n')
// A test's injected defect: a socket listening on loopback, as no process of the app may have.
if (process.env.FAKE_CLAUDE_LISTEN) require('node:net').createServer().listen(0, '127.0.0.1').unref()
const teamAt = args.indexOf('--append-system-prompt-file')
if (teamAt >= 0) {
  const file = args[teamAt + 1]
  if (!fs.existsSync(file)) {
    process.stderr.write('Error: Append system prompt file not found: ' + file + '\\r\\n')
    process.exit(1)
  }
  fs.appendFileSync(path.join(process.env.HOME, 'claude-team.jsonl'), JSON.stringify({ id: ownId, file, text: fs.readFileSync(file, 'utf8') }) + '\\n')
}
const transcriptOf = (id) => path.join(folder, id + '.jsonl')
const record = (lines) => fs.appendFileSync(transcriptOf(ownId), lines.map((l) => JSON.stringify(l)).join('\\n') + '\\n')
// A turn: the working footer, then the transcript's lines, then the screen cleared.
function turn(lines) {
  process.stdout.write('esc to interrupt\\r\\n')
  setTimeout(() => {
    // Claude Code has answered every earlier message by then; the stand-in's first prompt had none.
    const kinds = fs.readFileSync(transcriptOf(ownId), 'utf8').split('\\n').filter(Boolean).map((l) => JSON.parse(l).type)
    const last = kinds.filter((k) => k === 'user' || k === 'assistant').pop()
    if (last === 'user') lines = [{ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Started.' }] } }, ...lines]
    record(lines)
    process.stdout.write('\\x1b[2J\\x1b[Hstand-in idle\\r\\n')
  }, 1500)
}
const registry = path.join(process.env.HOME, '.claude', 'sessions')
const taken = ownId && fs.existsSync(registry) && fs.readdirSync(registry).some((n) => {
  try {
    const entry = JSON.parse(fs.readFileSync(path.join(registry, n), 'utf8'))
    if (entry.sessionId !== ownId) return false
    if (entry.pid === 4242) return true // a test's own entry: its socket is the test's
    process.kill(entry.pid, 0)
    return true
  } catch { return false }
})
if (ownId && process.env.FAKE_CLAUDE_SOCKET && !taken) {
  const socket = path.join(os.tmpdir(), 'mk-' + process.pid + '.sock')
  require('node:net').createServer((c) => {
    let data = ''
    c.on('data', (d) => { data += d })
    c.on('end', () => {
      for (const line of data.split('\\n').filter(Boolean)) {
        const content = JSON.parse(line).message.content
        fs.appendFileSync(path.join(process.env.HOME, 'claude-posts.jsonl'), JSON.stringify({ id: ownId, content }) + '\\n')
        if (process.env.FAKE_CLAUDE_TEAM_TURN && content.startsWith('[Menkar] Team update:'))
          turn([
            { type: 'user', isMeta: true, origin: { kind: 'peer', from: 'menkar' }, message: { role: 'user', content: 'Another Claude session sent a message:\\n' + content + '\\n\\nThis came from another Claude session.' } },
            { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Noted.' }] } },
          ])
      }
    })
  }).listen(socket).unref()
  fs.mkdirSync(registry, { recursive: true })
  fs.writeFileSync(path.join(registry, process.pid + '.json'), JSON.stringify({ pid: process.pid, sessionId: ownId, messagingSocketPath: socket, peerProtocol: 1 }))
  for (const signal of ['SIGHUP', 'SIGTERM']) process.on(signal, () => process.exit(129))
  process.on('exit', () => {
    for (const file of [path.join(registry, process.pid + '.json'), socket]) try { fs.unlinkSync(file) } catch {}
  })
}
if (process.env.FAKE_CLAUDE_START_HOOK && args.includes('--resume') && !args.includes('--fork-session'))
  sessionStart('resume', ownId, transcriptOf(ownId))
function callTool(name, toolArgs, endsTurn) {
  const server = JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers.menkar
  const child = require('node:child_process').spawn(server.command, server.args, {
    env: { ...process.env, ...server.env },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  let out = ''
  child.stdout.on('data', (d) => {
    out += d
    const lines = out.split('\\n')
    out = lines.pop()
    for (const line of lines) {
      const reply = JSON.parse(line)
      if (reply.id !== 2) continue
      process.stdout.write('TOOL ' + name + ': ' + reply.result.content[0].text.replace(/\\s+/g, ' ') + '\\r\\n')
      child.kill()
      if (endsTurn) stopHook()
    }
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }) + '\\n')
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: toolArgs } }) + '\\n')
}
// The turn ends: the Stop hook its --settings declares, run as Claude Code runs it.
function stopHook() {
  const settings = JSON.parse(fs.readFileSync(args[args.indexOf('--settings') + 1], 'utf8'))
  require('node:child_process').execFileSync('/bin/sh', ['-c', settings.hooks.Stop[0].hooks[0].command], {
    input: JSON.stringify({ session_id: ownId, hook_event_name: 'Stop', stop_hook_active: false }),
  })
}
// Raw, so the bytes each key sends arrive as they are; recorded as hex, one read per line.
if (process.stdin.isTTY) process.stdin.setRawMode(true)
let typed = ''
process.stdin.on('data', (d) => {
  fs.appendFileSync(path.join(process.env.HOME, 'claude-input.txt'), d.toString('hex') + '\\n')
  typed += d.toString()
  if (typed.includes('EXIT0')) process.exit(0)
  if (typed.endsWith('ASK')) process.stdout.write('Do you want to proceed?\\r\\n')
  if (typed.endsWith('CLEAR')) {
    typed = ''
    const transcript = path.join(folder, '${CLEARED_SESSION}.jsonl')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(transcript, JSON.stringify({ type: 'user', cwd: process.cwd(), message: { content: 'after the clear' } }) + '\\n')
    sessionStart('clear', '${CLEARED_SESSION}', transcript)
    process.stdout.write('stand-in cleared\\r\\n')
  }
  if (typed.endsWith('COMPACT')) {
    typed = ''
    sessionStart('compact', ownId, transcriptOf(ownId))
    process.stdout.write('stand-in compacted\\r\\n')
  }
  if (typed.endsWith('TURN')) {
    typed = ''
    turn([
      { type: 'user', message: { role: 'user', content: 'a question typed by the human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'An answer.' }] } },
    ])
  }
  if (typed.endsWith('RESUME')) {
    typed = ''
    sessionStart('resume', process.env.FAKE_CLAUDE_RESUME, path.join(folder, process.env.FAKE_CLAUDE_RESUME + '.jsonl'))
    process.stdout.write('stand-in resumed\\r\\n')
  }
  const calls = {
    RENEW: ['renew', { prompt: 'carry on from the notes' }, true],
    SPAWN1: ['start_session', { name: 'worker', prompt: 'build the thing', group: 'pair' }],
    SPAWN2: ['start_session', { name: 'worker' }],
    SPAWN3: ['start_session', { name: 'other', group: 'no such group' }],
    LISTS: ['list_sessions', {}],
    REPLY: ['last_reply', { name: 'worker' }],
    TOPIC: ['topic_add', { title: 'Pick a port', context: 'Which port should the API use?' }],
    TASKADD: ['task_add', { title: 'Fix the login' }],
    WORKT: ['start_session', { task: 1, prompt: 'fix the login' }],
    STEPS: ['task_steps', { number: 1, steps: ['read', 'fix', 'open the PR'] }],
    WAITS: ['task_progress', { number: 1, step: 3, note: 'PR open', waiting_on: 'the PR review' }, true],
    PARK: ['park_session', { name: 'client-work-t1' }],
    WAKEW: ['resume_session', { name: 'client-work-t1', prompt: 'the PR got feedback' }],
    CLOSE1: ['task_close', { number: 1, outcome: 'done' }],
    STAR1: ['task_star', { number: 1, star: true }],
    DROPSTAR: ['task_star', { number: 1, star: false }],
    REVIEWPR: ['task_review', { number: 1, note: 'PR open', waiting_on: 'pr-approval', waiting_note: '#436' }, true],
    SECONDW: ['start_session', { task: 2, prompt: 'fix the docs' }],
  }
  for (const [word, [tool, toolArgs, endsTurn]] of Object.entries(calls)) {
    if (!typed.endsWith(word)) continue
    typed = ''
    callTool(tool, toolArgs, endsTurn)
  }
  if (typed.includes('EXIT1')) {
    process.stderr.write('stand-in failed to start\\r\\n')
    process.exit(1)
  }
})
`

// A stand-in `cursor-agent` (never the real one): it records its arguments and its environment, as
// the stand-in claude does, and stays in the foreground until it reads EXIT0.
const FAKE_CURSOR = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path')
fs.appendFileSync(path.join(process.env.HOME, 'cursor-args.txt'), process.argv.slice(2).join(' ') + '\\n')
fs.writeFileSync(path.join(process.env.HOME, 'cursor-env.json'), JSON.stringify(process.env))
process.stdout.write('stand-in cursor-agent ready\\r\\n')
if (process.stdin.isTTY) process.stdin.setRawMode(true)
let typed = ''
process.stdin.on('data', (d) => {
  typed += d.toString()
  if (typed.includes('EXIT0')) process.exit(0)
})
`

// Puts the stand-in `cursor-agent` in `bin`, beside the stand-in claude.
export function cursorStandIn(bin: string): void {
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'cursor-agent'), FAKE_CURSOR)
  chmodSync(join(bin, 'cursor-agent'), 0o755)
}

// The colours these tests assert are Catppuccin's, as the old "Default" theme gave them: Mocha
// unless the scheme is light, with the terminals in the theme's colours too. A test about the
// first start's own theme or terminal colours writes neither.
export function catppuccin(scheme: unknown): string {
  return scheme === 'light' ? 'Catppuccin Latte' : 'Catppuccin Mocha'
}

export function prepare(dirs: {
  readonly root: string
  readonly home: string
}): Record<string, string> {
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'claude'), FAKE_CLAUDE)
  chmodSync(join(bin, 'claude'), 0o755)
  const work = join(dirs.home, 'work')
  mkdirSync(work, { recursive: true })
  const transcripts = join(dirs.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${SESSION}.jsonl`),
    `${JSON.stringify({ type: 'user', cwd: work, message: { content: 'fix the login bug' } })}\n`,
  )
  const config = join(dirs.root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaaa',
      projects: [{ id: 'aaaaaaaaaaaa', name: 'Client work', members: [SESSION], groups: [] }],
      windows: [],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: 'dark',
        terminal_theme: catppuccin('dark'),
        terminal_colors: 'theme',
      },
    }),
  )
  return { PATH: e2ePath(dirs.root, bin) }
}

// The look's standard case: "Client work" with a group "api pair" (#5ec4b6) of two sessions and
// one session in no group, in two folders. `tabs` lists saved tabs by session key.
export const CLIENT = {
  login: '1a1a1a1a-0000-4000-8000-000000000001',
  api: '2b2b2b2b-0000-4000-8000-000000000002',
  long: '3c3c3c3c-0000-4000-8000-000000000003',
} as const
export const CLIENT_NAMES = {
  login: 'login fix',
  api: 'api review',
  long: 'abcdefghijklmnopqrstuvwxyz0123456789ABCD',
} as const
export type ClientKey = keyof typeof CLIENT

export function clientWork(
  dirs: { readonly root: string; readonly home: string },
  options: {
    readonly settings?: Readonly<Record<string, unknown>>
    readonly tabs?: readonly (readonly ClientKey[])[]
    readonly extraProjects?: readonly { id: string; name: string; members: string[] }[]
  } = {},
): Record<string, string> {
  const env = prepare(dirs)
  const folders: Record<ClientKey, string> = {
    login: join(dirs.home, 'work', 'api'),
    api: join(dirs.home, 'work', 'api'),
    long: join(dirs.home, 'work', 'web'),
  }
  for (const key of Object.keys(CLIENT) as ClientKey[]) {
    const cwd = folders[key]
    mkdirSync(cwd, { recursive: true })
    const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${CLIENT[key]}.jsonl`),
      `${[
        { type: 'custom-title', customTitle: CLIENT_NAMES[key] },
        { type: 'user', cwd, message: { content: `work on ${key}` } },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n')}\n`,
    )
  }
  const config = join(dirs.root, 'config', 'menkar')
  const project = 'cccccccccccc'
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: project,
      projects: [
        {
          id: project,
          name: 'Client work',
          members: [CLIENT.login, CLIENT.api, CLIENT.long],
          groups: [{ name: 'api pair', color: '#5ec4b6', members: [CLIENT.login, CLIENT.api] }],
        },
        ...(options.extraProjects ?? []).map((p) => ({ ...p, groups: [] })),
      ],
      windows:
        options.tabs === undefined
          ? []
          : [
              {
                current: project,
                tabs: {
                  [project]: options.tabs.map((keys) => ({
                    panes: keys.map((k) => CLIENT[k]),
                    orientation: 'horizontal',
                  })),
                },
              },
            ],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: 'dark',
        terminal_theme: catppuccin(options.settings?.color_scheme),
        terminal_colors: 'theme',
        ...options.settings,
      },
    }),
  )
  return env
}
