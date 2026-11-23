// The OpenCode probes' harness: a packaged Menkar build under xvfb (e2e's launchApp, every HOME and
// XDG folder throwaway), the real `opencode` linked into the run's own bin folder, and the
// stand-in model of standin.mjs on a free loopback port.
import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { launchApp } from '../../../e2e/app'
import { prepare, SESSION } from '../../../e2e/fixtures'

export { SESSION }

// The folder this run's notes, model logs and screenshots go to; kept for reading.
export const RUN = mkdtempSync(join(tmpdir(), 'menkar-probe-opencode-'))

// The packaged build these probes check, never the tree's own `out/`.
const executable = process.env.MENKAR_E2E_EXECUTABLE
if (!executable) throw new Error('set MENKAR_E2E_EXECUTABLE to an extracted build (see README.md)')

function opencodeBinary(): string {
  const named = process.env.OPENCODE_BIN
  if (named) return named
  try {
    return execFileSync('sh', ['-c', 'command -v opencode']).toString().trim()
  } catch {
    throw new Error('opencode is not on the PATH; set OPENCODE_BIN')
  }
}
export const OPENCODE = opencodeBinary()

export interface Shown {
  readonly tabs: readonly {
    readonly id: string
    readonly panes: readonly { readonly sessionId: string | null }[]
  }[]
  readonly projects?: readonly { readonly id: string; readonly name: string }[]
  readonly readings: Readonly<Record<string, unknown>>
  readonly open: readonly string[]
}

interface MenkarGlobal {
  readonly menkar: {
    readonly window: { act(a: unknown): Promise<unknown>; state(): Promise<unknown> }
    readonly agents: { versions(): Promise<unknown> }
    readonly usage: { view(which: unknown, all: boolean): Promise<unknown> }
  }
}

export const act = (page: Page, action: Record<string, unknown>) =>
  page.evaluate((a) => (globalThis as unknown as MenkarGlobal).menkar.window.act(a), action)
export const state = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as MenkarGlobal).menkar.window.state(),
  ) as Promise<Shown>
export const versions = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as MenkarGlobal).menkar.agents.versions())
export const usageToday = (page: Page) =>
  page.evaluate(() =>
    (globalThis as unknown as MenkarGlobal).menkar.usage.view(
      { kind: 'period', period: 'today' },
      true,
    ),
  )

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })
}

export interface Model {
  readonly port: number
  readonly log: string
  readonly process: ChildProcess
  requests(): {
    t: number
    body: {
      messages?: { role: string; content: unknown }[]
      tools?: { function: { name: string } }[]
    }
  }[]
}

export async function startModel(name: string): Promise<Model> {
  const port = await freePort()
  const log = join(RUN, `${name}-model.log`)
  writeFileSync(log, '')
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./standin.mjs', import.meta.url)), String(port), log],
    {
      stdio: 'ignore',
    },
  )
  await sleep(500)
  return {
    port,
    log,
    process: child,
    requests: () =>
      readFileSync(log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
  }
}

export const textOf = (c: unknown): string =>
  typeof c === 'string'
    ? c
    : Array.isArray(c)
      ? c.map((p: { text?: string }) => p.text ?? '').join('')
      : ''

// The throwaway user config of OpenCode: the stand-in as provider `stub`, model `m1`, priced and
// with a context limit; shell calls ask; OpenCode's own update check off, since its modal takes
// the keys a probe types.
function opencodeConfig(port: number) {
  return {
    provider: {
      stub: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Stub',
        options: { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: 'x' },
        models: {
          m1: {
            name: 'm1',
            tool_call: true,
            limit: { context: 50000, output: 4000 },
            cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
          },
        },
      },
    },
    model: 'stub/m1',
    small_model: 'stub/m1',
    autoupdate: false,
    permission: { shell: 'ask', bash: 'ask' },
  }
}

export async function launch(model: Model, options: { orchestration?: boolean } = {}) {
  let root = ''
  let home = ''
  const launched = await launchApp({
    prepare: (dirs) => {
      root = dirs.root
      home = dirs.home
      const env = prepare(dirs)
      symlinkSync(OPENCODE, join(dirs.root, 'bin', 'opencode'))
      mkdirSync(join(dirs.root, 'config', 'opencode'), { recursive: true })
      writeFileSync(
        join(dirs.root, 'config', 'opencode', 'opencode.json'),
        JSON.stringify(opencodeConfig(model.port)),
      )
      const projects = [
        {
          id: 'aaaaaaaaaaaa',
          name: 'Client work',
          members: [SESSION],
          groups: [],
          ...(options.orchestration ? { orchestration: { on: true, orchestrator: SESSION } } : {}),
        },
      ]
      // A sandbox build keeps its state in its own folder, `menkar-sandbox`.
      for (const folder of ['menkar', 'menkar-sandbox']) {
        const dir = join(dirs.root, 'config', folder)
        mkdirSync(dir, { recursive: true })
        writeFileSync(
          join(dir, 'projects.json'),
          JSON.stringify({ version: 1, current: 'aaaaaaaaaaaa', projects, windows: [] }),
        )
        if (folder !== 'menkar')
          writeFileSync(
            join(dir, 'state.json'),
            readFileSync(join(dirs.root, 'config', 'menkar', 'state.json')),
          )
      }
      return {
        ...env,
        MENKAR_LOG: 'info',
        FAKE_CLAUDE_SOCKET: '1',
        XDG_STATE_HOME: join(dirs.root, 'state'),
      }
    },
  })
  const page = launched.window
  const db = () => join(root, 'data', 'opencode', 'opencode.db')
  // Read-only queries of the run's own opencode.db.
  const sql = (q: string): unknown[][] => {
    if (!existsSync(db())) return []
    const out = execFileSync('python3', [
      '-I',
      '-c',
      "import sqlite3,sys,json;c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True);print(json.dumps(c.execute(sys.argv[2]).fetchall()))",
      db(),
      q,
    ]).toString()
    return JSON.parse(out)
  }
  const screen = () =>
    page
      .locator('.xterm-rows:visible')
      .first()
      // biome-ignore lint/performance/useDomNodeTextContent: the rendered text keeps one line per terminal row.
      .innerText()
      .catch(() => '')
  const rowDot = (session: string) =>
    page
      .locator(`.row[data-session="${session}"] .dot`)
      .first()
      .getAttribute('class', { timeout: 500 })
      .catch(() => null)
  const tabDot = () =>
    page
      .locator('.tab .dot')
      .first()
      .getAttribute('class', { timeout: 500 })
      .catch(() => null)
  const shownSession = async () => (await state(page)).tabs[0]?.panes[0]?.sessionId ?? null
  // The pane's session, once Menkar has made it.
  const session = async () => {
    for (let i = 0; i < 60; i++) {
      const id = await shownSession()
      if (id) return id
      await sleep(500)
    }
    throw new Error('the pane never showed a session')
  }
  return {
    launched,
    page,
    root: () => root,
    home: () => home,
    sql,
    screen,
    rowDot,
    tabDot,
    shownSession,
    session,
    focus: () => focus(page),
  }
}

// Focused without a click: a click on a message in OpenCode's TUI opens its Message Actions.
const focus = (page: Page) => page.locator('.xterm:visible .xterm-helper-textarea').first().focus()

export async function typeIn(page: Page, text: string) {
  await focus(page)
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

// A slash command: typed slowly, and Enter only once OpenCode's completion list has settled.
export async function typeSlash(page: Page, command: string) {
  await focus(page)
  await page.keyboard.type(command, { delay: 60 })
  await sleep(1200)
  await page.keyboard.press('Enter')
}

// The `opencode serve` processes of the machine, by their command line.
export const serves = () =>
  execFileSync('ps', ['-eo', 'pid=,args='])
    .toString()
    .split('\n')
    .filter((l) => / serve --stdio --port \d+/.test(l))
    .map((l) => l.trim())

export const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// A line of the run's notes, also printed.
export function noter(name: string) {
  const lines: string[] = []
  return (s: string) => {
    lines.push(`${new Date().toISOString()} ${s}`)
    writeFileSync(join(RUN, `${name}.txt`), lines.join('\n'))
  }
}

// A tool of Menkar's called as the Claude stand-in calls it, through its --mcp-config server.
export function callAsClaude(
  home: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<string> {
  const line = readFileSync(join(home, 'claude-args.txt'), 'utf8').trim().split('\n')[0] ?? ''
  const config = /--mcp-config (\{.*?\}\}\}\})/.exec(line)?.[1] ?? '{}'
  const server = JSON.parse(config).mcpServers.menkar
  const env = JSON.parse(readFileSync(join(home, 'claude-env.json'), 'utf8'))
  const child = spawn(server.command, server.args, {
    env: { ...env, ...server.env },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  return new Promise((resolve, reject) => {
    let out = ''
    child.on('error', reject)
    child.stdout.on('data', (d) => {
      out += d
      for (const text of out.split('\n')) {
        if (!text.trim()) continue
        const reply = JSON.parse(text)
        if (reply.id !== 2) continue
        child.kill()
        resolve(reply.result.content[0].text)
      }
    })
    const send = (o: unknown) => child.stdin.write(`${JSON.stringify(o)}\n`)
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } })
  })
}
