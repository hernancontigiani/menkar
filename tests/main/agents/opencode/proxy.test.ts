// Each OpenCode pane's own loopback port: its TUI talks to Menkar's server through it, byte for byte
// and with no credential added, and main learns from it which session the pane shows — the one it
// was started on, the one its first prompt creates, the one `/new` makes — so a tool call naming a
// session is traced to its pane. Driven with the stand-in `opencode`'s server and TUI.
import { type ChildProcessByStdio, spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { opencodeStandIn } from '../../../../e2e/standins/opencode'
import { proxies as kitProxies } from '../../../../src/main/agents/opencode'
import { OpenCodeProxies } from '../../../../src/main/agents/opencode/proxy'
import {
  basicAuth,
  OpenCodeServer,
  type Running,
} from '../../../../src/main/agents/opencode/server'
import { paneOfCaller } from '../../../../src/main/agents/registry'

const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-proxy')
const home = join(root, 'home')
const bin = join(root, 'bin')
const command = join(bin, 'opencode')
const META = 'ai.opencode/sessionID'

type Tui = ChildProcessByStdio<Writable, Readable, null> & { screen: () => string }

let server: OpenCodeServer
let running: Running
let made: OpenCodeProxies[] = []
let tuis: Tui[] = []
let fakes: Server[] = []
beforeEach(async () => {
  rmSync(root, { recursive: true, force: true })
  opencodeStandIn(bin)
  mkdirSync(home, { recursive: true })
  vi.stubEnv('HOME', home)
  vi.stubEnv('OPENCODE_DB', join(home, 'opencode.db'))
  vi.stubEnv('FAKE_OPENCODE_TURN_MS', '50')
  server = new OpenCodeServer({ command })
  running = await server.acquire('tests')
})
afterEach(async () => {
  for (const tui of tuis) tui.kill()
  tuis = []
  await Promise.all(made.map((p) => p.closeAll()))
  made = []
  await kitProxies.closeAll()
  for (const fake of fakes) fake.close()
  fakes = []
  server.stop()
  vi.unstubAllEnvs()
})

type Seen = { pane: string; id: string; previous: string | null }

function proxies(): { proxies: OpenCodeProxies; seen: Seen[] } {
  const seen: Seen[] = []
  const p = new OpenCodeProxies({
    onSession: (pane, id, previous) => seen.push({ pane, id, previous }),
  })
  made.push(p)
  return { proxies: p, seen }
}

function tui(url: string, args: string[] = [], password = running.password): Tui {
  const child = spawn(command, ['--server', url, ...args, home], {
    env: { ...process.env, OPENCODE_PASSWORD: password },
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  let out = ''
  child.stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString('utf8')
  })
  const made = Object.assign(child, { screen: () => out.slice(out.lastIndexOf('\x1b[2J')) })
  tuis.push(made)
  return made
}

const type = (t: Tui, text: string) => t.stdin.write(`${text}\r`)

async function create(id: string, parentID?: string): Promise<void> {
  const response = await fetch(`${running.url}/api/session`, {
    method: 'POST',
    headers: { authorization: basicAuth(running.password), 'content-type': 'application/json' },
    body: JSON.stringify({ id, location: { directory: home }, ...(parentID ? { parentID } : {}) }),
  })
  expect(response.status).toBe(200)
}

const wait = (check: () => void) => vi.waitFor(check, { timeout: 10_000, interval: 50 })
const paneOf = async (p: OpenCodeProxies, id: string) => (await p.paneOf(id))?.pane ?? null

// A server that answers every request with one status, to see what the proxy makes of an answer.
async function answering(status: number): Promise<{ url: string; password: string }> {
  const fake = createServer((req, res) => {
    req.resume()
    req.on('end', () => res.writeHead(status, { 'content-type': 'application/json' }).end('{}'))
  })
  fakes.push(fake)
  await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve))
  const address = fake.address()
  return {
    url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
    password: 'x',
  }
}

const post = (url: string, path: string, body: unknown) =>
  fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

test("a new session's id is learnt from the TUI's own create, and /new moves the pane to the next one as a clear", async () => {
  const { proxies: p, seen } = proxies()
  const url = await p.open('pane-1', running, null)
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  expect(url).not.toBe(running.url)
  const t = tui(url)
  // The event stream is relayed live: the TUI draws the answer from it.
  type(t, 'hello')
  await wait(() => expect(t.screen()).toContain('ack 1: hello'))
  expect(seen).toHaveLength(1)
  const first = seen[0]?.id ?? ''
  expect(first).toMatch(/^ses_/)
  expect(seen[0]).toEqual({ pane: 'pane-1', id: first, previous: null })
  expect(await paneOf(p, first)).toBe('pane-1')
  expect(p.sessionOf('pane-1')).toBe(first)

  type(t, '/new')
  type(t, 'again')
  await wait(() => expect(seen).toHaveLength(2))
  const second = seen[1]?.id ?? ''
  expect(second).not.toBe(first)
  expect(seen[1]).toEqual({ pane: 'pane-1', id: second, previous: first })
  expect(await paneOf(p, second)).toBe('pane-1')
  expect(await paneOf(p, first)).toBeNull()
})

test("a pane started on a session knows it at once, and its TUI's requests on it change nothing", async () => {
  const id = 'ses_0000000000aaAAAAAAAAAAAAAA'
  await create(id)
  const { proxies: p, seen } = proxies()
  const url = await p.open('pane-1', running, id)
  expect(seen).toEqual([{ pane: 'pane-1', id, previous: null }])
  const t = tui(url, ['-s', id])
  type(t, 'hello')
  await wait(() => expect(t.screen()).toContain('ack 1: hello'))
  expect(seen).toHaveLength(1)
  expect(await paneOf(p, id)).toBe('pane-1')
})

test("a session opened with the TUI's own picker moves the pane to it, back and forth", async () => {
  const a = 'ses_0000000000a1AAAAAAAAAAAAAA'
  const b = 'ses_0000000000b1BBBBBBBBBBBBBB'
  await create(a)
  await create(b)
  const { proxies: p, seen } = proxies()
  const t = tui(await p.open('pane-1', running, a), ['-s', a])
  // Typed once its screen is drawn, as a person would.
  await wait(() => expect(t.screen()).toContain('ctrl+p commands'))
  type(t, `/switch ${b}`)
  await wait(() => expect(seen).toHaveLength(2))
  expect(seen[1]).toEqual({ pane: 'pane-1', id: b, previous: a })
  expect(await paneOf(p, a)).toBeNull()
  type(t, `/switch ${a}`)
  await wait(() => expect(seen).toHaveLength(3))
  expect(seen[2]).toEqual({ pane: 'pane-1', id: a, previous: b })
  expect(await paneOf(p, a)).toBe('pane-1')
})

test("a goal's request binds whatever the server answers; a create or a prompt only once it is answered", async () => {
  const { proxies: p, seen } = proxies()
  const refusing = await p.open('pane-1', await answering(400), null)
  await post(refusing, '/api/session', { id: 'ses_create' })
  await post(refusing, '/api/session/ses_prompt/prompt', { text: 'x' })
  expect(seen).toEqual([])
  await post(refusing, '/api/rpc/opencode.goal/get?location%5Bdirectory%5D=%2Ftmp', {
    input: { sessionID: 'ses_goal' },
  })
  expect(seen).toEqual([{ pane: 'pane-1', id: 'ses_goal', previous: null }])

  const accepting = await p.open('pane-2', await answering(200), null)
  await post(accepting, '/api/session', { id: 'ses_create' })
  await post(accepting, '/api/session/ses_prompt/prompt', { text: 'x' })
  // Another session's routes the TUI polls name no session it shows.
  await post(accepting, '/api/session/ses_other/view', { idle: 1 })
  expect(seen.slice(1)).toEqual([
    { pane: 'pane-2', id: 'ses_create', previous: null },
    { pane: 'pane-2', id: 'ses_prompt', previous: 'ses_create' },
  ])
})

test('two panes keep their own sessions', async () => {
  const { proxies: p } = proxies()
  const a = tui(await p.open('pane-a', running, null))
  const b = tui(await p.open('pane-b', running, null))
  type(a, 'from a')
  type(b, 'from b')
  await wait(() => {
    expect(p.sessionOf('pane-a')).not.toBeNull()
    expect(p.sessionOf('pane-b')).not.toBeNull()
  })
  const ida = p.sessionOf('pane-a') ?? ''
  const idb = p.sessionOf('pane-b') ?? ''
  expect(ida).not.toBe(idb)
  expect(await paneOf(p, ida)).toBe('pane-a')
  expect(await paneOf(p, idb)).toBe('pane-b')
})

test('the proxy adds no credential: without the password the server refuses and the TUI ends', async () => {
  const { proxies: p } = proxies()
  const url = await p.open('pane-1', running, null)
  expect((await fetch(`${url}/api/info`)).status).toBe(401)
  expect(
    (await fetch(`${url}/api/info`, { headers: { authorization: basicAuth(running.password) } }))
      .status,
  ).toBe(200)
  const t = tui(url, [], 'wrong')
  const code = await new Promise<number | null>((resolve) => t.on('exit', resolve))
  expect(code).toBe(1)
  expect(p.sessionOf('pane-1')).toBeNull()
})

test('a closed pane forgets its session and its port answers no more', async () => {
  const id = 'ses_0000000000bbBBBBBBBBBBBBBB'
  await create(id)
  const { proxies: p } = proxies()
  const url = await p.open('pane-1', running, id)
  await p.close('pane-1')
  expect(await paneOf(p, id)).toBeNull()
  await expect(fetch(`${url}/api/info`)).rejects.toThrow()
})

test("a subagent's call, naming its own session, is traced through its parents to the pane", async () => {
  const root = 'ses_0000000000ddDDDDDDDDDDDDDD'
  const child = 'ses_0000000000deDDDDDDDDDDDDDD'
  const grandchild = 'ses_0000000000dfDDDDDDDDDDDDDD'
  await create(root)
  await create(child, root)
  await create(grandchild, child)
  const { proxies: p } = proxies()
  await p.open('pane-1', running, root)
  expect(await p.paneOf(child)).toEqual({ pane: 'pane-1', sessionId: root })
  expect(await p.paneOf(grandchild)).toEqual({ pane: 'pane-1', sessionId: root })
  expect(await p.paneOf('ses_unknown')).toBeNull()
})

test("a tool call naming a session under OpenCode's key is traced to the pane that runs that very session", async () => {
  const id = 'ses_0000000000ccCCCCCCCCCCCCCC'
  const child = 'ses_0000000000cdCCCCCCCCCCCCCC'
  await create(id)
  await create(child, id)
  await kitProxies.open('pane-1', running, id)
  const shows = (agent: string, sessionId: string | null) => () => ({ agent, sessionId })
  expect(await paneOfCaller(META, id, shows('opencode', id))).toBe('pane-1')
  expect(await paneOfCaller(META, child, shows('opencode', id))).toBe('pane-1')
  // The pane not yet followed to that session, another agent's pane, another key, an unknown id.
  expect(await paneOfCaller(META, id, shows('opencode', 'ses_other'))).toBeNull()
  expect(await paneOfCaller(META, id, shows('claude', id))).toBeNull()
  expect(await paneOfCaller('other/sessionID', id, shows('opencode', id))).toBeNull()
  expect(await paneOfCaller(META, 'ses_unknown', shows('opencode', 'ses_unknown'))).toBeNull()
  expect(await paneOfCaller(META, id, () => undefined)).toBeNull()
})
