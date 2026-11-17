// Menkar's wake: one JSON line to the session's messaging socket, read from its registry entry. An
// idle session must start a new turn with it, and its transcript must record it as a peer message.
// The socket is the throwaway session's own: the run leaves XDG_RUNTIME_DIR unset, so Claude Code
// binds under /tmp, never next to the human's sessions' sockets.
import { readdirSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { bytesOf, keep, makeRun, readJson, report, runClaude, startApi, text } from './lib.mjs'

const run = makeRun('wake')
const api = await startApi(() => text('PROBE-DONE'))
const session = '11111111-aaaa-4bbb-8ccc-111111111111'

async function post() {
  const registry = join(run.home, '.claude', 'sessions')
  const entry = readdirSync(registry).find((f) => /^\d+\.json$/.test(f))
  if (entry === undefined) throw new Error('no registry entry')
  const { messagingSocketPath, peerProtocol } = readJson(join(registry, entry))
  if (!messagingSocketPath.startsWith('/tmp/'))
    throw new Error(`refusing socket ${messagingSocketPath}`)
  if (peerProtocol !== 1) throw new Error(`peerProtocol ${peerProtocol}`)
  const frame = {
    type: 'user',
    message: { content: '[Menkar] probe-child finished its turn (12:00:00)' },
    from: 'menkar',
    msg_id: 'm-probe-1',
  }
  const socket = connect(messagingSocketPath)
  await new Promise((done) => socket.on('connect', done))
  socket.end(`${JSON.stringify(frame)}\n`)
}

const running = runClaude(run, api, ['--session-id', session, 'PROBE-FIRST'], { seconds: 25 })
await sleep(12_000)
const before = api.requests.length
await post()
const reads = await running
await api.close()
keep(run, 'pty.raw', bytesOf(reads))

const woke = api.requests
  .slice(before)
  .some((r) => JSON.stringify(r.body.messages ?? []).includes('probe-child finished its turn'))
const projects = join(run.home, '.claude', 'projects')
const transcript = readdirSync(projects)
  .map((folder) => join(projects, folder, `${session}.jsonl`))
  .flatMap((path) => {
    try {
      return readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    } catch {
      // A project folder without this session's transcript.
      return []
    }
  })
const record = transcript.find((r) => r.type === 'user' && r.origin?.kind === 'peer')
report([
  { name: 'idle session woken into a new turn', ok: woke, detail: run.dir },
  {
    name: 'transcript records a peer user turn from menkar',
    ok: record?.origin?.from === 'menkar' && typeof record.message?.content === 'string',
    detail: run.dir,
  },
])
