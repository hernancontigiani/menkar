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
import { describe, expect, test, vi } from 'vitest'
import { CONTEXT_READ_KEYS } from '../../../src/core/context/reading'
import { sessionStartHooks } from '../../../src/core/context/settings'
import {
  BASELINE_KEYS,
  CHAINED_TIMEOUT_MS,
  inboxDir,
  PANE_ENV,
  PRE_COMPACT_ARG,
  PROMPT_SUBMIT_ARG,
  paneStart,
  runStatusline,
  SESSION_KEYS,
  SESSION_START_ARG,
  START_KEYS,
  START_SOURCES,
  TURN_END_ARG,
  turnEndsDir,
  USAGE_KEYS,
} from '../../../src/core/context/statusline'
import { controlPaths } from '../../../src/core/control/files'
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

// The cost since the last compaction: the SessionStart hook (the same script, its hook mode) notes
// a new session or a compaction, and the bar shows the cost since.
function hook(d: Dirs, payload: Record<string, unknown>, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, SESSION_START_ARG], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', ...payload }),
    env: { ...d.env, ...env },
    encoding: 'utf8',
  })
  return { out: result.stdout, code: result.status }
}

const turn = (d: Dirs, id: string, total: number) =>
  run(d, JSON.stringify({ session_id: id, session_name: 'set', cost: { total_cost_usd: total } }))
    .out

test('a new session shows its cost; after a compaction the cost since, kept across a resume', () => {
  const d = dirs()
  expect(hook(d, { session_id: 's1', source: 'startup' })).toEqual({ out: '', code: 0 })
  expect(turn(d, 's1', 1.2)).toBe('set · $1.20\n')
  expect(turn(d, 's1', 3)).toBe('set · $3.00\n')
  hook(d, { session_id: 's1', source: 'compact' })
  expect(turn(d, 's1', 5)).toBe('set · $0.00\n')
  expect(turn(d, 's1', 7.5)).toBe('set · $2.50\n')
  // A resume leaves the baseline: the cost since the compaction goes on.
  hook(d, { session_id: 's1', source: 'resume' })
  expect(turn(d, 's1', 8)).toBe('set · $3.00\n')
  // A second compaction starts the count again.
  hook(d, { session_id: 's1', source: 'compact' })
  expect(turn(d, 's1', 9)).toBe('set · $0.00\n')
})

// Measured with Claude Code 2.1.322: after `/clear` the new id's total starts again at 0, and the
// hook runs with the pty's environment, so the record names the pane.
test('a clear starts the new id’s count at nothing, and its record names the Menkar pane it ran in', () => {
  const d = dirs()
  hook(d, { session_id: 'before', source: 'startup' })
  turn(d, 'before', 3)
  expect(hook(d, { session_id: 'after', source: 'clear' }, { [PANE_ENV]: 'pane7' })).toEqual({
    out: '',
    code: 0,
  })
  expect(turn(d, 'after', 0.42)).toBe('set · $0.42\n')
  const start = JSON.parse(readFileSync(join(d.cache, 'session-starts', 'after.json'), 'utf8'))
  expect(start).toMatchObject({ session_id: 'after', source: 'clear', pane: 'pane7' })
  const outside = JSON.parse(readFileSync(join(d.cache, 'session-starts', 'before.json'), 'utf8'))
  expect(outside.pane).toBeNull()
})

test('the app reads a clear, a resume or a compact record as its pane, id and source, and nothing else as one', () => {
  const d = dirs()
  hook(d, { session_id: 'after', source: 'clear' }, { [PANE_ENV]: 'pane7' })
  // A compaction rebuilds the team block from the start text, which main follows.
  hook(d, { session_id: 'squeezed', source: 'compact' }, { [PANE_ENV]: 'pane9' })
  hook(d, { session_id: 'picked', source: 'resume' }, { [PANE_ENV]: 'pane7' })
  hook(d, { session_id: 'plain', source: 'clear' })
  hook(d, { session_id: 'started', source: 'startup' }, { [PANE_ENV]: 'pane8' })
  const read = (id: string) =>
    paneStart(readFileSync(join(d.cache, 'session-starts', `${id}.json`), 'utf8'))
  expect(read('after')).toEqual({ pane: 'pane7', sessionId: 'after', source: 'clear' })
  expect(read('picked')).toEqual({ pane: 'pane7', sessionId: 'picked', source: 'resume' })
  expect(read('squeezed')).toEqual({ pane: 'pane9', sessionId: 'squeezed', source: 'compact' })
  expect(read('plain')).toBeNull()
  expect(read('started')).toBeNull()
  expect(paneStart('{"source":"clear","pane":"p","session_id":"../x"}')).toBeNull()
  expect(paneStart('{"source":"cle')).toBeNull()
})

// Plan 39 P3.2: Cursor's preCompact hook (a plugin's, measured by `cursor` on 2026.11.13) says only
// that a compaction is about to run; the same program records it as a compact start of the session
// in the pane, which main reads as Claude's.
test('a pre-compact payload is recorded as a compact start of its session in the pane', () => {
  const d = dirs()
  const result = spawnSync(process.execPath, [SCRIPT, PRE_COMPACT_ARG], {
    input: JSON.stringify({
      hook_event_name: 'preCompact',
      conversation_id: 'c1',
      session_id: 'c1',
      trigger: 'manual',
      user_email: 'someone@example.invalid',
    }),
    env: { ...d.env, [PANE_ENV]: 'pane4' },
    encoding: 'utf8',
  })
  expect([result.stdout, result.status]).toEqual(['', 0])
  const text = readFileSync(join(d.cache, 'session-starts', 'c1.json'), 'utf8')
  expect(paneStart(text)).toEqual({ pane: 'pane4', sessionId: 'c1', source: 'compact' })
  expect(text).not.toContain('example.invalid')
  const bad = spawnSync(process.execPath, [SCRIPT, PRE_COMPACT_ARG], {
    input: 'not json',
    env: d.env,
    encoding: 'utf8',
  })
  expect([bad.stdout, bad.status]).toEqual(['', 0])
})

test('a session first seen with a cost and no hook record shows its total alone until it compacts', () => {
  const d = dirs()
  expect(turn(d, 'old', 240)).toBe('set · $240.00\n')
  expect(turn(d, 'old', 246.5)).toBe('set · $246.50\n')
  hook(d, { session_id: 'old', source: 'compact' })
  expect(turn(d, 'old', 247)).toBe('set · $0.00\n')
})

test('a session first seen below a cent, with no hook record, counts as new', () => {
  const d = dirs()
  expect(turn(d, 'n1', 0.004)).toBe('set · $0.00\n')
  expect(turn(d, 'n1', 0.5)).toBe('set · $0.50\n')
})

test('the hook notes no fork and no id with a path in it, and never fails', () => {
  const d = dirs()
  for (const source of ['fork'])
    expect(hook(d, { session_id: 'x', source })).toEqual({ out: '', code: 0 })
  expect(hook(d, { session_id: '../x', source: 'compact' })).toEqual({ out: '', code: 0 })
  const bad = spawnSync(process.execPath, [SCRIPT, SESSION_START_ARG], {
    input: 'not json',
    env: d.env,
    encoding: 'utf8',
  })
  expect([bad.stdout, bad.status]).toEqual(['', 0])
  expect(existsSync(join(d.cache, 'session-starts'))).toBe(false)
})

test("parity: the hook --settings declares is the script's hook mode, for the sources it keeps; its record and the baseline have their keys", () => {
  const hooks = sessionStartHooks('STATUSLINE') as {
    SessionStart: { matcher: string; hooks: { command: string }[] }[]
  }
  expect(hooks.SessionStart.map((h) => h.matcher)).toEqual([...START_SOURCES])
  for (const entry of hooks.SessionStart)
    expect(entry.hooks.map((h) => h.command)).toEqual([`STATUSLINE ${SESSION_START_ARG}`])
  const d = dirs()
  hook(d, { session_id: 'p1', source: 'startup' })
  turn(d, 'p1', 1)
  const start = JSON.parse(readFileSync(join(d.cache, 'session-starts', 'p1.json'), 'utf8'))
  expect(Object.keys(start)).toEqual([...START_KEYS])
  expect(start).toMatchObject({ session_id: 'p1', source: 'startup' })
  const baseline = JSON.parse(readFileSync(join(d.cache, 'cost-baselines', 'p1.json'), 'utf8'))
  expect(Object.keys(baseline)).toEqual([...BASELINE_KEYS])
  expect(baseline).toEqual({ baseline_usd: 0, start_at: start.at })
})

// Plan 31, decision 9: the same script is Menkar's Stop hook. At each turn's end it leaves the
// session id for the pane it runs in, which is how Menkar renews a session only once its turn is over.
test('the Stop hook records the turn end for its pane, and nothing outside a Menkar pane', () => {
  const d = dirs()
  const stop = (env: Record<string, string>) =>
    spawnSync(process.execPath, [SCRIPT, TURN_END_ARG], {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's7', stop_hook_active: false }),
      env: { ...d.env, ...env },
      encoding: 'utf8',
    })
  expect(stop({ MENKAR_PANE: 'pane-4' })).toMatchObject({ status: 0, stdout: '' })
  const record = JSON.parse(
    readFileSync(join(d.cache, 'control', 'turn-ends', 'pane-4.json'), 'utf8'),
  )
  expect(record).toMatchObject({ session_id: 's7' })
  expect(typeof record.at).toBe('string')
  expect(stop({})).toMatchObject({ status: 0, stdout: '' })
  expect(readdirSync(join(d.cache, 'control', 'turn-ends'))).toEqual(['pane-4.json'])
})

test('the turn-ends folder the hook writes is the one Menkar watches', () => {
  expect(turnEndsDir()).toBe(controlPaths().turnEnds)
  expect(inboxDir()).toBe(controlPaths().inbox)
})

// Decision 1.178: the same script is the orchestrator's prompt hook. It gives the inbox main wrote
// for its pane as the prompt's additional context, unseen on the screen, and clears nothing: main
// drops an entry only once the transcript shows the model was given it.
describe('the prompt hook', () => {
  // 17:02:11 UTC, shown in the hook's own zone.
  const at = Date.UTC(2026, 10, 18, 17, 2, 11)
  const entries = (n: number, text = (i: number) => `event ${i}`) =>
    Array.from({ length: n }, (_, i) => ({ seq: i + 1, at: at + i * 1000, text: text(i + 1) }))
  function setup(file: unknown) {
    const d = dirs()
    const dir = join(d.cache, 'control', 'inbox')
    mkdirSync(dir, { recursive: true })
    if (file !== undefined)
      writeFileSync(
        join(dir, 'pane-1.json'),
        typeof file === 'string' ? file : JSON.stringify(file),
      )
    return { d, dir }
  }
  const submit = (d: Dirs, session = 's1') => {
    const result = spawnSync(process.execPath, [SCRIPT, PROMPT_SUBMIT_ARG], {
      input: JSON.stringify({
        session_id: session,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'go on',
      }),
      env: { ...d.env, MENKAR_PANE: 'pane-1', TZ: 'Asia/Tokyo' },
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    return result.stdout
  }
  const context = (out: string): string => {
    const parsed = JSON.parse(out)
    expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit')
    return parsed.hookSpecificOutput.additionalContext
  }

  test('no file, or a file of another session → nothing', () => {
    expect(submit(setup(undefined).d)).toBe('')
    const { d } = setup({ session_id: 's0', dropped: 0, entries: entries(2) })
    expect(submit(d)).toBe('')
  })

  test('three entries → three lines named "(events 1–3)", the same again, nothing written', () => {
    const { d, dir } = setup({ session_id: 's1', dropped: 0, entries: entries(3) })
    const before = readFileSync(join(dir, 'pane-1.json'))
    const out = submit(d)
    const lines = context(out).split('\n')
    expect(lines[0]).toContain("Menkar's inbox (events 1–3)")
    expect(lines.slice(1)).toEqual([
      '- 02:02:11 event 1',
      '- 02:02:12 event 2',
      '- 02:02:13 event 3',
    ])
    expect(submit(d)).toBe(out)
    expect(readdirSync(dir)).toEqual(['pane-1.json'])
    expect(readFileSync(join(dir, 'pane-1.json'))).toEqual(before)
  })

  test('two dropped → the first line says so', () => {
    const { d } = setup({ session_id: 's1', dropped: 2, entries: entries(1) })
    expect(context(submit(d)).split('\n')[0]).toContain('(2 earlier events dropped)')
  })

  test('an empty inbox or a corrupt file → nothing, exit 0, no stderr', () => {
    expect(submit(setup({ session_id: 's1', dropped: 0, entries: [] }).d)).toBe('')
    expect(submit(setup('{"session_id": "s1", "entr').d)).toBe('')
    expect(submit(setup({ session_id: 's1', entries: [{ seq: 'x' }] }).d)).toBe('')
  })

  // Decision 1.188: while the human is away the file stays with no entry, for this line.
  test('no entry and away_since → the away line alone; a bad or absent away_since → nothing', () => {
    const since = Date.UTC(2026, 10, 18, 4, 5, 0) // 13:05 in Tokyo
    const text = context(
      submit(setup({ session_id: 's1', dropped: 0, entries: [], away_since: since }).d),
    )
    expect(text).toMatch(/^The human is marked away since 13:05\. /)
    expect(text).not.toContain("Menkar's inbox")
    expect(submit(setup({ session_id: 's1', dropped: 0, entries: [], away_since: 'x' }).d)).toBe('')
    expect(submit(setup({ session_id: 's1', dropped: 0, entries: [] }).d)).toBe('')
  })

  test('entries and away_since → the away line, then the inbox; without it, as before', () => {
    const since = Date.UTC(2026, 10, 18, 4, 5, 0)
    const lines = context(
      submit(setup({ session_id: 's1', dropped: 0, entries: entries(2), away_since: since }).d),
    ).split('\n')
    expect(lines[0]).toMatch(/^The human is marked away since 13:05\. /)
    expect(lines[1]).toContain("Menkar's inbox (events 1–2)")
    const plain = context(submit(setup({ session_id: 's1', dropped: 0, entries: entries(2) }).d))
    expect(plain.split('\n')[0]).toContain("Menkar's inbox (events 1–2)")
    expect(plain).not.toContain('The human is marked away')
  })

  // Decision 1.217: a standing line holds until what it says is fixed; no delivery drops it.
  test('standing lines alone, or after the away line and before the inbox; empty ones ignored', () => {
    const line = 'You sent work to w1, which has no open task: give it one with task_add.'
    const alone = { session_id: 's1', dropped: 0, entries: [], standing: [line, ''] }
    expect(context(submit(setup(alone).d))).toBe(line)
    const since = Date.UTC(2026, 10, 18, 4, 5, 0)
    const lines = context(
      submit(setup({ ...alone, entries: entries(1), away_since: since, standing: [line, 7] }).d),
    ).split('\n')
    expect(lines[0]).toMatch(/^The human is marked away since 13:05\. /)
    expect(lines[1]).toBe(line)
    expect(lines[2]).toContain("Menkar's inbox (events 1–1)")
    expect(submit(setup({ ...alone, standing: [''] }).d)).toBe('')
  })

  test('30 entries of 120 characters → under 1,500 bytes, the oldest given, the rest counted', () => {
    const { d } = setup({
      session_id: 's1',
      dropped: 0,
      entries: entries(30, (i) => `${String(i).padStart(3, '0')} ${'x'.repeat(116)}`),
    })
    const text = context(submit(d))
    expect(Buffer.byteLength(text)).toBeLessThan(1500)
    const given = text.split('\n').filter((x) => x.startsWith('- '))
    expect(given.length).toBeGreaterThan(0)
    expect(text.split('\n')[0]).toContain(`(events 1–${given.length})`)
    expect(text.split('\n').at(-1)).toBe(`${30 - given.length} more: call inbox.`)
  })
})
