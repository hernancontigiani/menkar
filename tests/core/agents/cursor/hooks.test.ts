// Cursor's hook program (§2.9 of the multi-agent architecture): it runs in every Cursor session the
// user's hooks.json reaches, so it acts only in a pane of its own flavour, never waits and never
// fails the turn; it logs each prompt and each turn's end with their times and tokens, leaves the
// pane's turn-end record, keeps a prompt's text only while the classifier is on, and never keeps
// the account's email Cursor sends with every event (D21).
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import {
  HOOK_LOG,
  type HookPaths,
  ownPane,
  PROMPT_KEYS,
  PROMPTS_DIR,
  runHook,
  STOP_KEYS,
} from '../../../../src/core/agents/cursor/hooks'
import { TEAM_PREFIX, WAKE_PREFIX } from '../../../../src/core/agents/cursor/wakes'
import { parseTurnEnd } from '../../../../src/core/agents/shared/turn-end'

const EMAIL = 'someone@example.invalid'
const SESSION = '0b7d4c2e-1f0a-4e55-9b1a-2a3c4d5e6f70'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function where(classifier: boolean): HookPaths {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'cursor-hook-'))
  const state = join(root, 'config', 'state.json')
  mkdirSync(join(root, 'config'), { recursive: true })
  writeFileSync(
    state,
    JSON.stringify({ settings: { classify_since: classifier ? 1_795_000_000 : null } }),
  )
  return {
    cache: join(root, 'cache'),
    turnEnds: join(root, 'cache', 'control', 'turn-ends'),
    state,
    held: join(root, 'cache', 'control', 'held-wakes'),
  }
}

// What Cursor sends: the common fields, the account's email among them, and the event's own.
function event(name: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    conversation_id: SESSION,
    generation_id: 'gen-1',
    model: 'default',
    session_id: SESSION,
    hook_event_name: name,
    cursor_version: '2026.11.13-eacade1',
    workspace_roots: ['/home/demo/api'],
    user_email: EMAIL,
    transcript_path: '/home/demo/.cursor/projects/x/agent-transcripts/a/a.jsonl',
    ...extra,
  })
}

const pane = { MENKAR_PANE: 'pane-7', CURSOR_USER_EMAIL: EMAIL }
const logLines = (paths: HookPaths) =>
  readFileSync(join(paths.cache, HOOK_LOG), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>)

// Every file under a folder, with its text.
function everything(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => readFileSync(join(e.parentPath, e.name), 'utf8'))
}

test('outside a Menkar pane, and in a pane of the other flavour, it writes nothing and prints nothing', () => {
  const paths = where(true)
  expect(runHook(event('stop'), {}, paths)).toBe('')
  expect(ownPane({ MENKAR_PANE: 'pane-7', MENKAR_FLAVOR: 'sandbox' })).toBeNull()
  expect(runHook(event('stop'), { ...pane, MENKAR_FLAVOR: 'sandbox' }, paths)).toBe('')
  expect(existsSync(paths.cache)).toBe(false)
  vi.stubGlobal('__MENKAR_FLAVOR__', 'sandbox')
  expect(runHook(event('stop'), pane, paths)).toBe('')
  expect(existsSync(paths.cache)).toBe(false)
  expect(ownPane({ MENKAR_PANE: 'pane-7', MENKAR_FLAVOR: 'sandbox' })).toBe('pane-7')
})

test("a prompt and its turn's end are logged with their times and tokens, and the pane's record names the session", () => {
  const paths = where(false)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 0, 0))
  expect(
    runHook(
      event('beforeSubmitPrompt', { prompt: 'List the files', attachments: [] }),
      pane,
      paths,
    ),
  ).toBe('')
  vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 0, 12))
  // the stop hook prints nothing: it never holds the turn
  expect(
    runHook(
      event('stop', {
        status: 'completed',
        loop_count: 0,
        input_tokens: 11652,
        output_tokens: 45,
        cache_read_tokens: 11520,
        cache_write_tokens: 0,
      }),
      pane,
      paths,
    ),
  ).toBe('')
  const [prompt, stop] = logLines(paths)
  expect(Object.keys(prompt ?? {})).toEqual([...PROMPT_KEYS])
  expect(Object.keys(stop ?? {})).toEqual([...STOP_KEYS])
  expect(prompt).toEqual({
    event: 'prompt',
    at: Date.UTC(2026, 10, 23, 12, 0, 0) / 1000,
    session_id: SESSION,
    generation_id: 'gen-1',
    origin: 'human',
  })
  expect(stop).toMatchObject({ at: Date.UTC(2026, 10, 23, 12, 0, 12) / 1000, input_tokens: 11652 })
  const record = parseTurnEnd(readFileSync(join(paths.turnEnds, 'pane-7.json'), 'utf8'))
  expect(record?.sessionId).toBe(SESSION)
})

test("a prompt Menkar posted is the peer's", () => {
  const paths = where(false)
  runHook(event('beforeSubmitPrompt', { prompt: '  [Menkar] worker finished' }), pane, paths)
  expect(logLines(paths)[0]?.origin).toBe('peer')
})

test("the prompt's text is kept only while the classifier is on", () => {
  const off = where(false)
  runHook(event('beforeSubmitPrompt', { prompt: 'List the files' }), pane, off)
  expect(existsSync(join(off.cache, PROMPTS_DIR))).toBe(false)
  expect(everything(off.cache).join('')).not.toContain('List the files')
  const on = where(true)
  runHook(event('beforeSubmitPrompt', { prompt: 'List the files' }), pane, on)
  expect(readFileSync(join(on.cache, PROMPTS_DIR, 'gen-1.txt'), 'utf8')).toBe('List the files')
})

test("the account's email Cursor sends is never kept, in any file the hook writes (D21)", () => {
  const paths = where(true)
  runHook(event('sessionStart'), pane, paths)
  runHook(event('beforeSubmitPrompt', { prompt: 'Fix the build' }), pane, paths)
  runHook(event('afterAgentResponse', { text: 'Done.', input_tokens: 10 }), pane, paths)
  runHook(event('stop', { status: 'completed', input_tokens: 10 }), pane, paths)
  const written = everything(paths.cache)
  expect(written.length).toBeGreaterThanOrEqual(3)
  for (const text of written) expect(text).not.toContain(EMAIL)
  expect(written.join('')).not.toContain('example.invalid')
})

test('a payload it cannot read, or an event it does not take, writes nothing and prints nothing', () => {
  const paths = where(true)
  expect(runHook('not json', pane, paths)).toBe('')
  expect(runHook('[]', pane, paths)).toBe('')
  expect(runHook(event('afterAgentResponse', { text: 'Done.' }), pane, paths)).toBe('')
  expect(runHook(event('stop', { session_id: '../x' }), pane, paths)).toBe('')
  expect(existsSync(paths.cache)).toBe(false)
})

// What main holds for the pane, as its waker writes it: one file per text.
function hold(paths: HookPaths, texts: Record<string, string>): void {
  mkdirSync(join(paths.held, 'pane-7'), { recursive: true })
  for (const [name, text] of Object.entries(texts))
    writeFileSync(join(paths.held, 'pane-7', `${name}.txt`), text)
}

const record = (paths: HookPaths) =>
  parseTurnEnd(readFileSync(join(paths.turnEnds, 'pane-7.json'), 'utf8'))

// D1: a wake for a working Cursor session goes as the completed turn's followup_message, the team
// update first, then the wakes in the order they came, and the hook never waits for anything.
test("a completed turn's stop answers what main holds for the pane as one followup, and takes it", () => {
  const paths = where(false)
  hold(paths, {
    [`${WAKE_PREFIX}2`]: '[Menkar] menkar-t3 is waiting',
    [`${WAKE_PREFIX}1`]: '[Menkar] menkar-t2 ended its turn',
    [`${TEAM_PREFIX}1`]: '[Menkar] team update: your facts are now…',
  })
  const out = runHook(event('stop', { status: 'completed' }), pane, paths)
  expect(JSON.parse(out)).toEqual({
    followup_message:
      '[Menkar] team update: your facts are now…\n\n[Menkar] menkar-t2 ended its turn\n\n[Menkar] menkar-t3 is waiting',
  })
  expect(readdirSync(paths.held)).toEqual([])
  expect(record(paths)?.sessionId).toBe(SESSION)
  // nothing held: nothing printed
  expect(runHook(event('stop', { status: 'completed', generation_id: 'gen-2' }), pane, paths)).toBe(
    '',
  )
})

// Cursor ignores a followup answered at either stop of an interrupted turn (`cursor`, 2026-11-23).
test("an interrupted turn's stops leave what main holds for the next completed one", () => {
  const paths = where(false)
  hold(paths, { [`${WAKE_PREFIX}1`]: '[Menkar] menkar-t2 ended its turn' })
  expect(runHook(event('stop', { status: 'aborted' }), pane, paths)).toBe('')
  expect(runHook(event('stop', { status: 'error' }), pane, paths)).toBe('')
  expect(readdirSync(join(paths.held, 'pane-7'))).toHaveLength(1)
  expect(
    JSON.parse(
      runHook(event('stop', { status: 'completed', generation_id: 'gen-2' }), pane, paths),
    ),
  ).toEqual({ followup_message: '[Menkar] menkar-t2 ended its turn' })
})

// Esc and Ctrl+C end a turn with two stops of one generation, 20 ms apart: main hears of its end
// once, so a parent is not woken twice nor a pending stop or renew run twice.
test("an interrupted turn's second stop leaves the turn-end record as the first wrote it", () => {
  const paths = where(false)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 0, 0))
  runHook(event('stop', { status: 'aborted' }), pane, paths)
  const first = record(paths)
  vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 0, 0, 20))
  runHook(event('stop', { status: 'error' }), pane, paths)
  expect(record(paths)).toEqual(first)
  // both are in the log, which the usage source reads
  expect(logLines(paths).map((l) => l.status)).toEqual(['aborted', 'error'])
  vi.setSystemTime(Date.UTC(2026, 10, 23, 12, 1, 0))
  runHook(event('stop', { status: 'completed', generation_id: 'gen-2' }), pane, paths)
  expect(record(paths)?.at).not.toBe(first?.at)
})
