// The statusline script, run as Claude Code runs it: a process of its own, the session's state on
// stdin (docs/spec/context.md, CTX-17 to CTX-26).
import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { CONTEXT_READ_KEYS } from '../../../src/core/context/reading'
import {
  CHAINED_TIMEOUT_MS,
  runStatusline,
  SESSION_KEYS,
  USAGE_KEYS,
} from '../../../src/core/context/statusline'
import { STATUSLINE_READ_KEYS } from '../../../src/core/usage/statusline'

const SCRIPT = resolve('src/core/context/statusline.ts')

function dirs() {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'statusline-'))
  return {
    root,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: join(root, 'home'),
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_CACHE_HOME: join(root, 'cache'),
    },
    cache: join(root, 'cache', 'menkar'),
    config: join(root, 'config', 'menkar'),
  }
}

type Dirs = ReturnType<typeof dirs>

function run(d: Dirs, stdin: string) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    input: stdin,
    env: d.env,
    encoding: 'utf8',
  })
  return { out: result.stdout, code: result.status, err: result.stderr }
}

function chain(d: Dirs, command: string) {
  mkdirSync(d.config, { recursive: true })
  writeFileSync(join(d.config, 'chained-statusline.json'), JSON.stringify({ command }))
}

const usageLines = (d: Dirs) =>
  existsSync(join(d.cache, 'usage.jsonl'))
    ? readFileSync(join(d.cache, 'usage.jsonl'), 'utf8').trim().split('\n').filter(Boolean)
    : []

test('CTX-17 the bar, the session file with its nine keys, and one usage line', () => {
  const d = dirs()
  const stdin =
    '{"session_id":"s1","session_name":"fix-login","context_window":{"used_percentage":47.4},"cost":{"total_cost_usd":1.234}}'
  expect(run(d, stdin)).toMatchObject({ out: 'fix-login · 47% · $1.23\n', code: 0 })
  const session = JSON.parse(readFileSync(join(d.cache, 'sessions', 's1.json'), 'utf8'))
  expect(Object.keys(session)).toEqual([...SESSION_KEYS])
  expect(session).toMatchObject({ session_id: 's1', model: null, window: null, percentage: 47.4 })
  expect(session.updated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}\+00:00$/)
  const lines = usageLines(d)
  expect(lines).toHaveLength(1)
  expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ session_id: 's1', cost_usd: 1.234 })
})

test('CTX-18 with no name the bar is the first 8 characters of the id', () => {
  expect(run(dirs(), '{"session_id":"0123456789abcdef"}').out).toBe('01234567\n')
})

test.each([['not json'], ['[]']])(
  'CTX-19 stdin %j prints the fallback bar and writes nothing',
  (stdin) => {
    const d = dirs()
    expect(run(d, stdin)).toMatchObject({ out: 'menkar\n', code: 0 })
    expect(existsSync(d.cache)).toBe(false)
  },
)

test.each([
  ['{"session_id":"../x","session_name":"n"}', 'n'],
  ['{"session_id":""}', 'menkar'],
  ['{"session_id":5}', 'menkar'],
])('CTX-20 an id that is not a safe file name records nothing: %s', (stdin, shown) => {
  const d = dirs()
  expect(run(d, stdin).out).toBe(`${shown}\n`)
  expect(existsSync(d.cache)).toBe(false)
})

test('CTX-21 a read-only cache costs the reading, never the bar', () => {
  const d = dirs()
  mkdirSync(d.cache, { recursive: true })
  chmodSync(d.cache, 0o500)
  try {
    expect(run(d, '{"session_id":"s1","session_name":"n"}')).toMatchObject({
      out: 'n\n',
      code: 0,
      err: '',
    })
  } finally {
    chmodSync(d.cache, 0o700)
  }
})

test("CTX-22 the user's own statusline is the bar, and the records are still written", () => {
  const d = dirs()
  chain(d, 'echo mine')
  for (const [key, value] of Object.entries(d.env)) vi.stubEnv(key, value)
  try {
    // A generous limit: this checks the chained output is shown, not how fast the machine is.
    expect(runStatusline('{"session_id":"s1"}', 30_000)).toBe('mine')
  } finally {
    vi.unstubAllEnvs()
  }
  expect(existsSync(join(d.cache, 'sessions', 's1.json'))).toBe(true)
  expect(usageLines(d)).toHaveLength(1)
})

// A command that never reads its stdin can exit before the state is written to it; the write then
// fails (EPIPE) though the command succeeded. Under load that happens with the real, small state;
// a large one makes it certain.
test("CTX-22 a chained command that ignores its stdin is still the bar, whatever the state's size", () => {
  const d = dirs()
  chain(d, 'exec 0<&-; echo mine')
  for (const [key, value] of Object.entries(d.env)) vi.stubEnv(key, value)
  try {
    const state = JSON.stringify({ session_id: 's1', padding: 'x'.repeat(2_000_000) })
    expect(runStatusline(state, 30_000)).toBe('mine')
  } finally {
    vi.unstubAllEnvs()
  }
})

test.each([['exit 3'], ['printf "   \\n"']])(
  'CTX-23 a chained command that fails or prints blank: %s',
  (command) => {
    const d = dirs()
    chain(d, command)
    for (const [key, value] of Object.entries(d.env)) vi.stubEnv(key, value)
    try {
      expect(runStatusline('{"session_id":"s1","session_name":"own"}', 30_000)).toBe('own')
    } finally {
      vi.unstubAllEnvs()
    }
  },
)

test("CTX-23 a chained command still running at its limit is abandoned for Menkar's bar", () => {
  const d = dirs()
  chain(d, 'sleep 5; echo late')
  for (const [key, value] of Object.entries(d.env)) vi.stubEnv(key, value)
  try {
    const started = performance.now()
    expect(runStatusline('{"session_id":"s1","session_name":"own"}', 200)).toBe('own')
    expect(performance.now() - started).toBeLessThan(4000)
  } finally {
    vi.unstubAllEnvs()
  }
})

test('the limit for the chained command is 2 seconds: Claude Code cancels a run when the next comes', () => {
  expect(CHAINED_TIMEOUT_MS).toBe(2000)
})

test('CTX-24 the chained command receives the same stdin, byte for byte', () => {
  const d = dirs()
  const copy = join(d.root, 'copy')
  chain(d, `cat > '${copy}'; echo ok`)
  const stdin = '  {"session_id":"s1", "x": "ünïcode\\n", "spaces":   1}\n\n'
  run(d, stdin)
  expect(readFileSync(copy, 'utf8')).toBe(stdin)
})

test('CTX-25 two statuslines appending at once write whole lines only', async () => {
  const d = dirs()
  const loop = (id: string) =>
    new Promise<void>((done, fail) => {
      const child = spawn(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { record } from ${JSON.stringify(SCRIPT)}; for (let i = 0; i < 1000; i++) record({ session_id: ${JSON.stringify(id)}, cwd: '/x'.repeat(${id === 'a' ? 40 : 3}) })`,
        ],
        { env: d.env, stdio: 'ignore' },
      )
      child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`exit ${code}`))))
    })
  await Promise.all([loop('a'), loop('b')])
  const lines = usageLines(d)
  expect(lines).toHaveLength(2000)
  for (const line of lines) expect(() => JSON.parse(line)).not.toThrow()
  expect(readdirSync(join(d.cache, 'sessions')).sort()).toEqual(['a.json', 'b.json'])
}, 60_000)

test('CTX-26 parity: what the app reads is what the statusline writes', () => {
  expect(CONTEXT_READ_KEYS.length).toBeGreaterThan(0)
  for (const key of CONTEXT_READ_KEYS) expect(SESSION_KEYS).toContain(key)
  expect(STATUSLINE_READ_KEYS.length).toBeGreaterThan(0)
  for (const key of STATUSLINE_READ_KEYS) expect(USAGE_KEYS).toContain(key)
})
