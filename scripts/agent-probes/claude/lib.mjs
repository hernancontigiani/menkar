// Shared pieces of the Claude Code probes: a throwaway home, a stand-in API on 127.0.0.1, a run of
// the real `claude` under a pseudo-terminal, and a replay of its output through Menkar's own screen
// reading. Nothing here may touch the human's home, sessions or sockets.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

export const REPO = resolve(import.meta.dirname, '../../..')
const require = createRequire(join(REPO, 'package.json'))

// Fake, never a credential: Claude Code only needs a key it was told the user approved.
const FAKE_KEY = `sk-ant-api03-${'Z'.repeat(80)}AA`

export function claudeBinary() {
  return realpathSync(join(homedir(), '.local/bin/claude'))
}

// A fresh folder under the system's temporary directory, with a home and a work folder in it. The
// work folder is trusted in the throwaway `.claude.json`, so no first-start dialog stands in the way.
export function makeRun(name, { trusted = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `menkar-probe-claude-${name}-`))
  const home = join(dir, 'home')
  const work = join(dir, 'work')
  mkdirSync(join(home, '.claude'), { recursive: true })
  mkdirSync(work, { recursive: true })
  if (realpathSync(home) === realpathSync(homedir())) throw new Error('refusing: the real home')
  const projects = {}
  for (const folder of [work, ...trusted]) {
    projects[folder] = { hasTrustDialogAccepted: true, hasCompletedProjectOnboarding: true }
  }
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      hasCompletedOnboarding: true,
      theme: 'dark',
      autoUpdates: false,
      customApiKeyResponses: { approved: [FAKE_KEY.slice(-20)], rejected: [] },
      projects,
    }),
  )
  return { dir, home, work }
}

// A stand-in for the Messages API. `answer(body)` returns the content blocks of the reply; requests
// are kept in order for the checks to read.
export async function startApi(answer) {
  const requests = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let body = {}
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        // A request with no JSON body (a probe of the endpoint) is answered like any other.
      }
      requests.push({ path: req.url, body })
      if (!req.url.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{"input_tokens":100}')
        return
      }
      const { blocks, stop } = answer(body, requests.length)
      reply(res, body, blocks, stop)
    })
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  return {
    port: server.address().port,
    requests,
    close: () => new Promise((done) => server.close(done)),
  }
}

function reply(res, body, blocks, stop) {
  const message = {
    id: 'msg_probe',
    type: 'message',
    role: 'assistant',
    model: body.model ?? 'probe',
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 },
  }
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ...message, content: blocks, stop_reason: stop }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
  event('message_start', { type: 'message_start', message })
  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      event('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'text', text: '' },
      })
      event('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: block.text },
      })
    } else {
      event('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { ...block, input: {} },
      })
      event('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
      })
    }
    event('content_block_stop', { type: 'content_block_stop', index })
  })
  event('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stop, stop_sequence: null },
    usage: { output_tokens: 5 },
  })
  event('message_stop', { type: 'message_stop' })
  res.end()
}

export const text = (t) => ({ blocks: [{ type: 'text', text: t }], stop: 'end_turn' })

// The real `claude`, in the run's home, under a pseudo-terminal made by util-linux's `script`. The
// environment is built from nothing, so no variable of the session running the probe reaches it.
// Each read is kept with its time, so the screen can be judged at the end of each burst.
export async function runClaude(
  run,
  api,
  args,
  { seconds = 20, cols = 120, rows = 40, keys = [], extraEnv = {} },
) {
  const quoted = [claudeBinary(), ...args].map((a) => `'${a.replaceAll("'", `'"'"'`)}'`).join(' ')
  const child = spawn(
    'script',
    ['-qfec', `stty cols ${cols} rows ${rows}; exec ${quoted}`, '/dev/null'],
    {
      cwd: run.work,
      detached: true,
      env: {
        HOME: run.home,
        PATH: '/usr/bin:/bin',
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        SHELL: '/bin/sh',
        ANTHROPIC_API_KEY: FAKE_KEY,
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${api.port}`,
        DISABLE_AUTOUPDATER: '1',
        ...extraEnv,
      },
    },
  )
  const reads = []
  const started = performance.now()
  child.stdout.on('data', (chunk) => reads.push({ at: performance.now() - started, chunk }))
  for (const [at, key] of [...keys].sort((a, b) => a[0] - b[0])) {
    await sleep(Math.max(0, at * 1000 - (performance.now() - started)))
    child.stdin.write(key)
  }
  await sleep(Math.max(0, seconds * 1000 - (performance.now() - started)))
  stop(child.pid)
  return reads
}

// The process group `script` leads: the shell, claude and anything claude started.
function stop(pid) {
  try {
    process.kill(-pid, 'SIGKILL')
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

// The text Menkar's mirror would read (rows ending at the cursor), and main's `detectState` over it,
// at the end of each burst: a read followed by at least 250 ms of quiet, as the pane watcher checks.
export async function judge(reads, { cols = 120, rows = 40 } = {}) {
  const { Terminal } = require('@xterm/headless')
  // PROBE_DETECT points at another detect module, to see a check fail against a broken rule.
  const detect = process.env.PROBE_DETECT ?? join(REPO, 'src/core/agentstate/detect.ts')
  const { detectState } = await import(detect)
  const terminal = new Terminal({ cols, rows, allowProposedApi: true, scrollback: 1000 })
  let title = ''
  terminal.onTitleChange((t) => {
    title = t
  })
  const verdicts = []
  for (let i = 0; i < reads.length; i += 1) {
    await new Promise((done) => terminal.write(reads[i].chunk, done))
    const quiet = i === reads.length - 1 || reads[i + 1].at - reads[i].at >= 250
    if (!quiet) continue
    const screen = screenOf(terminal)
    verdicts.push({ at: reads[i].at, state: detectState('claude', title, screen), screen })
  }
  return verdicts
}

function screenOf(terminal) {
  const buffer = terminal.buffer.active
  const cursor = buffer.baseY + buffer.cursorY
  const first = Math.max(0, cursor - terminal.rows)
  let screen = ''
  for (let row = first; row <= cursor; row += 1) {
    const line = buffer.getLine(row)
    if (line === undefined) continue
    if (row > first && !line.isWrapped) screen += '\n'
    screen += line.translateToString(true)
  }
  return screen
}

export function keep(run, name, content) {
  writeFileSync(join(run.dir, name), content)
}

export function bytesOf(reads) {
  return Buffer.concat(reads.map((r) => r.chunk))
}

// One line per result; the process exits 1 when any check failed.
export function report(results) {
  for (const { name, ok, detail } of results)
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
