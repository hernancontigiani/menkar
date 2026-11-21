// Menkar's side of an OpenCode pane, against the stand-in `opencode`'s server: the session made
// there before its TUI attaches, its team block as its instruction entry and every change to it,
// Menkar's MCP added to its folder only in the orchestration mode, a wake through its inbox, and a
// turn's end read from the server's events.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { opencodeStandIn } from '../../../../e2e/standins/opencode'
import { inProcessReads, useReads } from '../../../../src/core/agents/opencode/reads'
import {
  MENKAR_CONFIG,
  OpenCodePreparer,
  serverConfig,
} from '../../../../src/main/agents/opencode/prepare'
import { OpenCodeProxies } from '../../../../src/main/agents/opencode/proxy'
import {
  basicAuth,
  OpenCodeServer,
  type Running,
} from '../../../../src/main/agents/opencode/server'
import { inboxWaker } from '../../../../src/main/agents/opencode/waker'
import type { PrepareInput } from '../../../../src/main/agents/types'

const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-prepare')
const home = join(root, 'home')
const bin = join(root, 'bin')
const work = join(home, 'work')
const other = join(home, 'other')
const command = join(bin, 'opencode')
const teamFile = join(root, 'team.md')

// The database is read on the test's own thread; in the app, on a worker.
useReads(inProcessReads())

let server: OpenCodeServer
let proxies: OpenCodeProxies
let preparer: OpenCodePreparer
let ended: { pane: string; session: string }[]
let moves: { pane: string; session: string; previous: string; kind: string }[]

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  opencodeStandIn(bin)
  mkdirSync(work, { recursive: true })
  mkdirSync(other, { recursive: true })
  writeFileSync(teamFile, '## Your team in Menkar\nYou are `w1`.\n')
  vi.stubEnv('HOME', home)
  vi.stubEnv('OPENCODE_DB', join(home, 'opencode.db'))
  vi.stubEnv('FAKE_OPENCODE_TURN_MS', '50')
  server = new OpenCodeServer({ command, config: () => serverConfig() })
  ended = []
  moves = []
  proxies = new OpenCodeProxies({
    onSession: (pane, session, previous, created) =>
      preparer.moved(pane, session, previous, created),
  })
  preparer = new OpenCodePreparer({
    server,
    proxies,
    turnEnded: (pane, session) => ended.push({ pane, session }),
  })
  preparer.onSession((pane, session, previous, kind) =>
    moves.push({ pane, session, previous, kind }),
  )
})
afterEach(async () => {
  await preparer.quit()
  vi.unstubAllEnvs()
})

// A pane of a project outside the orchestration mode: no block, no MCP.
function outside(over: Partial<PrepareInput> = {}): PrepareInput {
  const { teamFile: _, ...rest } = input(over)
  return { ...rest, team: false }
}

const input = (over: Partial<PrepareInput> = {}): PrepareInput => ({
  pane: 'pane-1',
  cli: command,
  cwd: work,
  start: { kind: 'new', id: 'ses_0000000000a1AAAAAAAAAAAAAA', name: 'w1' },
  teamFile,
  team: true,
  execPath: process.execPath,
  mcpServer: join(root, 'mcp-server.js'),
  ...over,
})

async function api(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const running = (await server.running()) as Running
  const response = await fetch(`${running.url}${path}`, {
    method,
    headers: {
      authorization: basicAuth(running.password),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

const entries = async (id: string) =>
  (
    (await api(`/api/experimental/session/${id}/instructions/entries`)).body as {
      data: { key: string; value: string }[]
    }
  ).data
const mounted = async (folder: string) =>
  (
    (await api(`/api/mcp?directory=${encodeURIComponent(folder)}`)).body as {
      data: { name: string }[]
    }
  ).data.map((s) => s.name)

const wait = (check: () => void | Promise<void>) =>
  vi.waitFor(check, { timeout: 10_000, interval: 50 })

describe('a new session', () => {
  test('is made on the server with its id and title, its block as its entry, before the TUI', async () => {
    const prepared = await preparer.prepare(input())
    if (!prepared) throw new Error('not prepared')
    const running = (await server.running()) as Running
    expect(prepared.server).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(prepared.server).not.toBe(running.url)
    expect(prepared.env).toEqual({ OPENCODE_PASSWORD: running.password })
    const session = await api('/api/session/ses_0000000000a1AAAAAAAAAAAAAA')
    expect(session.status).toBe(200)
    expect(session.body).toMatchObject({ data: { title: 'w1', location: { directory: work } } })
    expect(await entries('ses_0000000000a1AAAAAAAAAAAAAA')).toEqual([
      { key: 'menkar.team', value: '## Your team in Menkar\nYou are `w1`.\n' },
    ])
    expect(proxies.sessionOf('pane-1')).toBe('ses_0000000000a1AAAAAAAAAAAAAA')
  })

  test('is given its first prompt before its TUI attaches, so the TUI is not', async () => {
    const prompt = join(root, 'prompt.txt')
    writeFileSync(prompt, 'fix the parser')
    const prepared = await preparer.prepare(outside({ promptFile: prompt }))
    expect(prepared?.prompted).toBe(true)
    const id = 'ses_0000000000a1AAAAAAAAAAAAAA'
    await wait(() => expect(ended).toEqual([{ pane: 'pane-1', session: id }]))
    const messages = (await api(`/api/session/${id}/message`)).body as {
      data: { type: string; data: { text?: string } }[]
    }
    expect(messages.data.filter((m) => m.type === 'user').map((m) => m.data.text)).toEqual([
      'fix the parser',
    ])
    expect(
      (await preparer.prepare(outside({ pane: 'pane-2', start: { kind: 'resume', id } })))
        ?.prompted,
    ).toBe(false)
  })

  test("gets Menkar's MCP in its folder only in the orchestration mode, once per folder", async () => {
    await preparer.prepare(outside({ cwd: other }))
    expect(await mounted(other)).toEqual([])
    await preparer.prepare(
      input({ pane: 'pane-2', start: { kind: 'new', id: 'ses_0000000000b1BBBBBBBBBBBBBB' } }),
    )
    expect(await mounted(work)).toEqual(['menkar'])
    expect(await mounted(other)).toEqual([])
  })

  test('outside the mode it holds no entry, and a resume there drops the one it had', async () => {
    await preparer.prepare(input())
    preparer.release('pane-1')
    await preparer.prepare(
      outside({ start: { kind: 'resume', id: 'ses_0000000000a1AAAAAAAAAAAAAA' } }),
    )
    expect(await entries('ses_0000000000a1AAAAAAAAAAAAAA')).toEqual([])
  })

  test('a server that does not start leaves the pane without a command and holds nothing', async () => {
    const broken = new OpenCodeServer({ command: join(bin, 'no-opencode') })
    const alone = new OpenCodePreparer({ server: broken, proxies, turnEnded: () => {} })
    expect(await alone.prepare(input())).toBeNull()
    expect(broken.running()).toBeNull()
    expect(proxies.sessionOf('pane-1')).toBeNull()
  })
})

describe('a change to the team', () => {
  test('replaces the entry with no turn, and a block taken away removes it', async () => {
    await preparer.prepare(outside())
    const id = 'ses_0000000000a1AAAAAAAAAAAAAA'
    const block = '## Your team in Menkar\nYou are `w2`.\n'
    expect(await preparer.team.tell(id, 'post', undefined, { facts: '', block })).toBe('stored')
    expect(await entries(id)).toEqual([{ key: 'menkar.team', value: block }])
    // Given a block, the session is in a project in the mode: its folder gets Menkar's MCP.
    expect(await mounted(work)).toEqual(['menkar'])
    expect(await preparer.team.tell(id, 'post', undefined, null)).toBe('stored')
    expect(await entries(id)).toEqual([])
    expect(ended).toEqual([])
  })

  test('to a session the server does not have is no session', async () => {
    await preparer.prepare(input())
    expect(
      await preparer.team.tell('ses_0000000000ffFFFFFFFFFFFFFF', 'post', undefined, {
        facts: '',
        block: 'x',
      }),
    ).toBe('no session')
  })

  test('without the entry route is not delivered, at start or later', async () => {
    vi.stubEnv('FAKE_OPENCODE_NO_ENTRIES', '1')
    expect(await preparer.prepare(input())).not.toBeNull()
    expect(
      await preparer.team.tell('ses_0000000000a1AAAAAAAAAAAAAA', 'post', undefined, null),
    ).toBe('protocol')
  })
})

describe('a wake', () => {
  test("goes to the session's inbox as a queued message, and its turn's end is read from the events", async () => {
    // Outside the mode: the stand-in would start the MCP server this test does not have.
    await preparer.prepare(input({ team: false }))
    const id = 'ses_0000000000a1AAAAAAAAAAAAAA'
    const waker = inboxWaker(() => server.running())
    expect(await waker.wake(id, 'your worker finished', undefined)).toBe('posted')
    await wait(() => expect(ended).toEqual([{ pane: 'pane-1', session: id }]))
    const messages = (await api(`/api/session/${id}/message`)).body as {
      data: { type: string; data: { text?: string } }[]
    }
    const user = messages.data.find((m) => m.type === 'user')
    expect(user?.data.text).toMatch(/^\[Menkar\] your worker finished \(\d\d:\d\d/)
  })

  test('of a session the server does not have, or with no server, is no session', async () => {
    const waker = inboxWaker(() => server.running())
    expect(await waker.wake('ses_0000000000a1AAAAAAAAAAAAAA', 'x', undefined)).toBe('no session')
    await preparer.prepare(input())
    expect(await waker.wake('ses_0000000000ffFFFFFFFFFFFFFF', 'x', undefined)).toBe('no session')
  })
})

// D9: the same session open in another OpenCode server (the human's own TUI) runs two turns at
// once. Menkar's server reports only its own executions; the database row, whichever server wrote
// it last.
describe('a session another server runs', () => {
  test('is told when its row says a turn runs that Menkar’s server is not running', async () => {
    vi.stubEnv('FAKE_OPENCODE_TURN_MS', '3000')
    const notices: unknown[] = []
    preparer.onNotice((pane, notice) => notices.push({ pane, ...notice }))
    await preparer.prepare(outside())
    const id = 'ses_0000000000a1AAAAAAAAAAAAAA'
    expect(await preparer.otherServer(id, 'start')).toBe(false)
    const other = new OpenCodeServer({ command })
    try {
      const theirs = await other.acquire('theirs')
      await fetch(`${theirs.url}/api/session/${id}/prompt`, {
        method: 'POST',
        headers: { authorization: basicAuth(theirs.password), 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'busy elsewhere', delivery: 'steer' }),
      })
      await wait(async () => expect(await preparer.otherServer(id, 'wake')).toBe(true))
      // one line in the pane that shows the session, for that detection
      expect(notices).toEqual([{ pane: 'pane-1', kind: 'other-server', when: 'wake' }])
      expect(await preparer.otherServer(id, 'start', 'pane-2')).toBe(true)
      expect(notices.at(-1)).toEqual({ pane: 'pane-2', kind: 'other-server', when: 'start' })
      expect(notices).toHaveLength(2)
    } finally {
      other.stop()
    }
  })

  test('is not told for a turn Menkar’s own server runs', async () => {
    vi.stubEnv('FAKE_OPENCODE_TURN_MS', '3000')
    await preparer.prepare(outside())
    const id = 'ses_0000000000a1AAAAAAAAAAAAAA'
    expect(await inboxWaker(() => server.running()).wake(id, 'x', undefined)).toBe('posted')
    await wait(() => expect(preparer.runs.running('pane-1')).toBe(true))
    expect(await preparer.otherServer(id, 'wake')).toBe(false)
  })
})

describe("a pane's move", () => {
  test('to a session its TUI made is a clear, to one it opened a resume; its first is none', () => {
    preparer.moved('pane-1', 'ses_a', null, false)
    preparer.moved('pane-1', 'ses_b', 'ses_a', true)
    preparer.moved('pane-1', 'ses_a', 'ses_b', false)
    expect(moves).toEqual([
      { pane: 'pane-1', session: 'ses_b', previous: 'ses_a', kind: 'clear' },
      { pane: 'pane-1', session: 'ses_a', previous: 'ses_b', kind: 'resume' },
    ])
  })
})

describe("the server's configuration", () => {
  // S12: what Menkar adds to its server changes nothing a session outside the mode sends.
  test('a session outside the mode sends the request it would send on a server Menkar gave nothing', async () => {
    const prompt = join(root, 'prompt.txt')
    writeFileSync(prompt, 'hello')
    await preparer.prepare(outside({ promptFile: prompt }))
    vi.stubEnv('OPENCODE_DB', join(home, 'plain.db'))
    const plain = new OpenCodeServer({ command })
    try {
      const bare = await plain.acquire('plain')
      const id = 'ses_0000000000b1BBBBBBBBBBBBBB'
      const auth = { authorization: basicAuth(bare.password), 'content-type': 'application/json' }
      await fetch(`${bare.url}/api/session`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ id, title: 'w1', location: { directory: work } }),
      })
      await fetch(`${bare.url}/api/session/${id}/prompt`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ text: 'hello', delivery: 'steer' }),
      })
      const requests = () =>
        readFileSync(join(home, 'opencode-requests.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as { sessionID: string; tools: unknown; system: unknown })
      await wait(() => expect(requests()).toHaveLength(2))
      const [first, second] = requests().map(({ tools, system }) => ({ tools, system }))
      expect(first).toEqual(second)
      const config = JSON.parse(readFileSync(join(home, 'opencode-serve-env.json'), 'utf8')) as {
        OPENCODE_CONFIG_CONTENT?: string
      }
      expect(config.OPENCODE_CONFIG_CONTENT).toBeUndefined()
    } finally {
      plain.stop()
    }
  })

  test("is Menkar's alone without the user's own", () => {
    expect(JSON.parse(serverConfig(undefined))).toEqual(MENKAR_CONFIG)
  })

  test("keeps the user's own and adds Menkar's tools' permission beside theirs", () => {
    const own = JSON.stringify({ model: 'p/m', permission: { bash: 'ask' } })
    expect(JSON.parse(serverConfig(own))).toEqual({
      model: 'p/m',
      permission: { 'menkar_*': 'allow', bash: 'ask' },
    })
  })

  test("is the user's own as it is when it does not parse", () => {
    expect(serverConfig('{not json')).toBe('{not json')
  })
})
