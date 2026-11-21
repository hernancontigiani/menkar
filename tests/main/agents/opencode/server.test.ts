// Menkar's one `opencode serve --stdio`: started with the first OpenCode tab on a random port with a
// password of its own, its routes checked, stopped with the last tab and on quit, gone when main is
// killed, and started again once per 30 s when it dies while tabs use it. Driven with the stand-in
// `opencode`, which records its environment and PIDs in HOME.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { opencodeStandIn } from '../../../../e2e/standins/opencode'
import { addSink } from '../../../../src/core/log'
import { SESSION_ENV } from '../../../../src/core/sessionenv'
import {
  basicAuth,
  OpenCodeServer,
  RETRY_EVERY_MS,
  type Running,
} from '../../../../src/main/agents/opencode/server'

const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'opencode-server')
const home = join(root, 'home')
const bin = join(root, 'bin')
const command = join(bin, 'opencode')
const IDENTITY = Object.values(SESSION_ENV).flat()[0] ?? ''

let servers: OpenCodeServer[] = []
let lines: string[] = []
let removeSink = () => {}
beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  opencodeStandIn(bin)
  mkdirSync(home, { recursive: true })
  vi.stubEnv('HOME', home)
  vi.stubEnv('OPENCODE_DB', join(home, 'opencode.db'))
  vi.stubEnv('MENKAR_PANE', 'outer-pane')
  vi.stubEnv('MENKAR_FILES', '/outer/files')
  vi.stubEnv('MENKAR_PRIVATE', '/outer/private')
  vi.stubEnv(IDENTITY, 'outer-session')
  vi.stubEnv('R10_USER_VARIABLE', 'kept')
  lines = []
  removeSink = addSink((line) => lines.push(line))
})
afterEach(() => {
  for (const server of servers) server.stop()
  servers = []
  removeSink()
  vi.unstubAllEnvs()
})

function server(retryEveryMs?: number): OpenCodeServer {
  const made = new OpenCodeServer({ command, ...(retryEveryMs ? { retryEveryMs } : {}) })
  servers.push(made)
  return made
}

const pids = (): number[] => {
  const file = join(home, 'opencode-serve-pids.txt')
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map(Number) : []
}

function alive(pid: number): boolean {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2)[0] !== 'Z'
  } catch {
    return false
  }
}

const gone = (pid: number) => vi.waitFor(() => expect(alive(pid)).toBe(false), { timeout: 5_000 })

async function answers(running: Running, password = running.password): Promise<number> {
  try {
    const response = await fetch(`${running.url}/api/info`, {
      headers: { authorization: basicAuth(password) },
    })
    return response.status
  } catch {
    return 0
  }
}

test('nothing runs before the first acquire; it starts one stdio server on a free port with a password, without the pane or session variables', async () => {
  const made = server()
  expect(made.pid()).toBeNull()
  expect(pids()).toEqual([])
  const running = await made.acquire('pane-1')
  const args = readFileSync(join(home, 'opencode-args.txt'), 'utf8').trim()
  expect(args).toMatch(/^serve --stdio --port \d+$/)
  const port = Number(args.split(' ').pop())
  expect(port).toBeGreaterThan(0)
  expect(running.url).toBe(`http://127.0.0.1:${port}`)
  expect(running.password.length).toBeGreaterThanOrEqual(24)
  expect(await answers(running)).toBe(200)
  expect(await answers(running, 'wrong')).toBe(401)
  expect(running.features).toEqual({ entries: true, mcp: true })

  const env = JSON.parse(readFileSync(join(home, 'opencode-serve-env.json'), 'utf8'))
  expect(env.OPENCODE_PASSWORD).toBe(running.password)
  expect(env.MENKAR_PANE).toBeUndefined()
  expect(env.MENKAR_FILES).toBeUndefined()
  expect(env.MENKAR_PRIVATE).toBeUndefined()
  expect(env[IDENTITY]).toBeUndefined()
  expect(env.OPENCODE_CONFIG_CONTENT).toBeUndefined()
  expect(env.R10_USER_VARIABLE).toBe('kept')

  expect(await made.acquire('pane-2')).toBe(running)
  expect(pids()).toHaveLength(1)
})

test('its configuration goes in OPENCODE_CONFIG_CONTENT', async () => {
  const made = new OpenCodeServer({ command, config: () => '{"skills":{"paths":["/s"]}}' })
  servers.push(made)
  await made.acquire('pane-1')
  const env = JSON.parse(readFileSync(join(home, 'opencode-serve-env.json'), 'utf8'))
  expect(env.OPENCODE_CONFIG_CONTENT).toBe('{"skills":{"paths":["/s"]}}')
})

test('an OpenCode without the instruction route or the per-folder MCP route is told by its routes, and logged', async () => {
  vi.stubEnv('FAKE_OPENCODE_NO_ENTRIES', '1')
  expect((await server().acquire('p')).features).toEqual({ entries: false, mcp: true })
  expect(lines.some((l) => l.includes('no instruction-entry route'))).toBe(true)
  servers[0]?.stop()
  vi.stubEnv('FAKE_OPENCODE_NO_ENTRIES', '')
  vi.stubEnv('FAKE_OPENCODE_NO_MCP_ROUTE', '1')
  expect((await server().acquire('p')).features).toEqual({ entries: true, mcp: false })
  expect(lines.some((l) => l.includes('no per-folder MCP route'))).toBe(true)
})

test('it stops with the last pane released, not before, and starts afresh with the next', async () => {
  const made = server()
  const first = await made.acquire('pane-1')
  await made.acquire('pane-2')
  const [pid] = pids()
  if (pid === undefined) throw new Error('no server')
  made.release('pane-1')
  expect(alive(pid)).toBe(true)
  made.release('pane-2')
  await gone(pid)
  expect(made.pid()).toBeNull()
  expect(made.restarts()).toBe(0)
  const second = await made.acquire('pane-3')
  expect(pids()).toHaveLength(2)
  expect(second.password).not.toBe(first.password)
})

test('on quit it stops', async () => {
  const made = server()
  await made.acquire('pane-1')
  const [pid] = pids()
  if (pid === undefined) throw new Error('no server')
  made.stop()
  await gone(pid)
})

test('a server that dies while tabs use it is started again on its port with its password, once per period, and each restart is counted and logged', async () => {
  const every = 1_500
  const made = server(every)
  const running = await made.acquire('pane-1')
  const first = pids()[0] ?? 0
  process.kill(first, 'SIGKILL')
  await vi.waitFor(() => expect(pids()).toHaveLength(2), { timeout: 5_000 })
  await vi.waitFor(async () => expect(await answers(running)).toBe(200), { timeout: 5_000 })
  expect(made.restarts()).toBe(1)
  expect(lines.some((l) => l.includes('started again'))).toBe(true)

  const killedAt = performance.now()
  process.kill(pids()[1] ?? 0, 'SIGKILL')
  await vi.waitFor(() => expect(pids()).toHaveLength(3), { timeout: 5_000 })
  expect(performance.now() - killedAt).toBeGreaterThanOrEqual(every - 200)
  await vi.waitFor(async () => expect(await answers(running)).toBe(200), { timeout: 5_000 })
  expect(made.restarts()).toBe(2)
})

test('a restart is at most once per 30 s', () => {
  expect(RETRY_EVERY_MS).toBe(30_000)
})

test('a server that dies with no tab left is not started again', async () => {
  const made = server(100)
  await made.acquire('pane-1')
  const [pid] = pids()
  made.release('pane-1')
  await gone(pid ?? 0)
  await new Promise((done) => setTimeout(done, 500))
  expect(pids()).toHaveLength(1)
  expect(made.restarts()).toBe(0)
})

test('with main killed, the server is gone', async () => {
  const out = join(root, 'bundle')
  mkdirSync(out, { recursive: true })
  const entry = join(out, 'main.ts')
  writeFileSync(
    entry,
    `import { OpenCodeServer } from ${JSON.stringify(resolve('src/main/agents/opencode/server.ts'))}
new OpenCodeServer({ command: ${JSON.stringify(command)} }).acquire('pane-1').then(() => process.stdout.write('up\\n'))
`,
  )
  await build({
    configFile: false,
    logLevel: 'silent',
    // Bundled whole: the bundle runs outside the repository, where its packages do not resolve.
    ssr: { noExternal: true },
    build: { ssr: entry, outDir: out, emptyOutDir: false, minify: false },
  })
  const main = spawn(process.execPath, [join(out, 'main.js')], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  await new Promise<void>((done, fail) => {
    main.stdout.on('data', (chunk: Buffer) => chunk.toString().includes('up') && done())
    main.on('exit', () => fail(new Error('main ended before the server was up')))
  })
  const [pid] = pids()
  if (pid === undefined) throw new Error('no server')
  expect(alive(pid)).toBe(true)
  main.kill('SIGKILL')
  await gone(pid)
}, 30_000)
