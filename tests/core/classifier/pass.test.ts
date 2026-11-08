// The hourly classification pass: which turns, what is sent, how it is sent, how the answer is
// read, inheritance (docs/spec/classifier.md, CLS-3 to CLS-24, CLS-38). `claude` is never run: a
// Call stands in, or the fake executable in tests/data/classifier.
process.env.TZ = 'America/Argentina/Buenos_Aires'

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  batchInput,
  command,
  environment,
  parseReply,
  type TurnText,
} from '../../../src/core/classifier/input'
import { SYSTEM_PROMPT } from '../../../src/core/classifier/prompt'
import {
  type Call,
  classifierFolder,
  classifyPass,
  claudeCall,
  findClaude,
} from '../../../src/core/classifier/run'
import { statusText } from '../../../src/core/classifier/text'
import { readTurn } from '../../../src/core/classifier/turns'
import { UsageCache } from '../../../src/core/usage/cache'
import { UsageHistory } from '../../../src/core/usage/history'
import { runPass } from '../../../src/core/usage/pass'
import { midnight } from '../../../src/core/usage/periods'
import { buildReport } from '../../../src/core/usage/report'
import { at, memberships, prompt, response, usageDirs } from '../../factories/usage'

const FAKE = resolve('tests/data/classifier/claude')
const secs = (time: string, day = '2026-11-08') => new Date(`${day}T${time}`).getTime() / 1000
const NOW = secs('18:00:00')

type Dirs = ReturnType<typeof usageDirs>

function human(time: string, text: string, extra: Record<string, unknown> = {}) {
  return { ...prompt(time), message: { content: text }, ...extra }
}

function tool(time: string, name: string, input: Record<string, unknown>) {
  return {
    type: 'assistant',
    timestamp: at(time),
    requestId: `req_${time}_${name}`,
    message: {
      id: `msg_${time}_${name}`,
      model: 'claude-opus-5-5',
      usage: { output_tokens: 1 },
      content: [{ type: 'tool_use', id: `t_${time}_${name}`, name, input }],
    },
  }
}

function open(dirs: Dirs) {
  runPass(memberships(), {
    claudeProjects: dirs.claudeProjects,
    cache: dirs.cache,
    history: dirs.history,
  })
  const history = new UsageHistory(dirs.history)
  const cache = new UsageCache(dirs.cache)
  return {
    history,
    cache,
    close() {
      history.close()
      cache.close()
    },
    rows: () =>
      Object.fromEntries(
        (
          history.handle?.raw.prepare('SELECT uuid, category, category_tries FROM turns').all() ??
          []
        ).map((r) => [String(r.uuid), [r.category, r.category_tries]]),
      ),
  }
}

// A Call that answers every turn of each batch with a category, and remembers what it was sent.
function answering(category = 'build') {
  const inputs: string[] = []
  const call: Call = (input) => {
    inputs.push(input)
    const turns = JSON.parse(input.slice(input.indexOf('\n') + 1)) as { id: number }[]
    return JSON.stringify({
      result: JSON.stringify(turns.map((t) => ({ id: t.id, category, confidence: 0.9 }))),
    })
  }
  return { call, inputs, sent: () => inputs.map((i) => JSON.parse(i.slice(i.indexOf('\n') + 1))) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('which turns', () => {
  test('CLS-3 only turns opened since the switch was turned on are sent', () => {
    const dirs = usageDirs('cls3')
    dirs.transcript('s1', [
      human('09:59:00', 'before'),
      response('09:59:30'),
      human('10:01:00', 'after'),
      response('10:01:30'),
      human('11:00:00', 'later'),
    ])
    const db = open(dirs)
    const fake = answering()
    classifyPass(db.history, db.cache, secs('10:00:00'), NOW, fake.call)
    expect(
      fake
        .sent()
        .flat()
        .map((t: { prompt: string }) => t.prompt),
    ).toEqual(['previous: before\nprompt: after', 'previous: after\nprompt: later'])
    expect(db.rows()['u-09:59:00']).toEqual([null, 0])
    db.close()
  })

  test('CLS-4 the last turn of a session waits until it is more than an hour old', () => {
    const dirs = usageDirs('cls4')
    dirs.transcript('s1', [human('17:30:00', 'fresh'), response('17:30:10')])
    const db = open(dirs)
    const fake = answering()
    classifyPass(db.history, db.cache, secs('00:00:00'), NOW, fake.call)
    expect(fake.inputs).toEqual([])
    classifyPass(db.history, db.cache, secs('00:00:00'), secs('18:31:00'), fake.call)
    expect(fake.inputs).toHaveLength(1)
    db.close()
  })

  test('CLS-5 turns the human did not start are never in an hourly batch', () => {
    const dirs = usageDirs('cls5')
    dirs.transcript('s1', [
      ...['peer', 'task_notification', 'system', 'unknown'].map((origin, i) =>
        human(`1${i}:00:00`, origin, { turnOrigin: origin }),
      ),
    ])
    const db = open(dirs)
    const fake = answering()
    classifyPass(db.history, db.cache, 0, NOW, fake.call)
    expect(fake.inputs).toEqual([])
    db.close()
  })

  test('CLS-6 350 ready turns: ten calls of 30 oldest first, the other 50 in the next pass', () => {
    const dirs = usageDirs('cls6')
    const lines = []
    for (let i = 0; i < 350; i += 1) {
      const h = String(Math.floor(i / 60) + 10).padStart(2, '0')
      const m = String(i % 60).padStart(2, '0')
      lines.push(human(`${h}:${m}:00`, `prompt number ${i} with enough text to stand alone`))
    }
    dirs.transcript('s1', lines)
    const db = open(dirs)
    const first = answering()
    classifyPass(db.history, db.cache, 0, secs('23:59:00'), first.call)
    expect(first.inputs).toHaveLength(10)
    expect(first.sent().map((b: unknown[]) => b.length)).toEqual(Array(10).fill(30))
    expect(first.sent()[0][0].prompt).toBe('prompt number 0 with enough text to stand alone')
    const second = answering()
    classifyPass(db.history, db.cache, 0, secs('23:59:00'), second.call)
    expect(second.sent().map((b: unknown[]) => b.length)).toEqual([30, 20])
    db.close()
  })
})

describe('what is sent', () => {
  const turn = (
    prompt: string,
    previous = '',
    tools: Record<string, unknown>[] = [],
  ): TurnText => ({ prompt, previous, tools })

  test('CLS-7 the input starts with its line, numbers the turns, and names no id or session', () => {
    const dirs = usageDirs('cls7')
    dirs.transcript('session-abc', [
      human('10:00:00', 'first prompt long enough to stand alone'),
      { type: 'custom-title', customTitle: 'secret-name' },
      human('10:10:00', 'second prompt long enough to stand alone'),
      human('10:20:00', 'x'.repeat(50)),
    ])
    const db = open(dirs)
    const fake = answering()
    classifyPass(db.history, db.cache, 0, NOW, fake.call)
    const input = fake.inputs[0] ?? ''
    expect(input.startsWith('Classify these turns:\n[')).toBe(true)
    expect(fake.sent()[0].map((t: { id: number }) => t.id)).toEqual([0, 1, 2])
    for (const secret of ['u-10:00:00', 'session-abc', 'secret-name'])
      expect(input).not.toContain(secret)
    db.close()
  })

  test('CLS-8 a long prompt keeps its first and last 750 characters', () => {
    const text = `${'a'.repeat(750)}${'m'.repeat(500)}${'z'.repeat(750)}`
    const [sent] = JSON.parse(
      batchInput([turn(text)])
        .split('\n')
        .slice(1)
        .join('\n'),
    )
    expect(sent.prompt).toBe(`${'a'.repeat(750)}\n[...]\n${'z'.repeat(750)}`)
  })

  test('CLS-9 a short prompt carries its previous one', () => {
    const [sent] = JSON.parse(
      batchInput([turn('ok, go on', 'Add a retry to the upload worker')]).slice(22),
    )
    expect(sent.prompt).toBe('previous: Add a retry to the upload worker\nprompt: ok, go on')
    expect(sent.previous).toBe('Add a retry to the upload worker')
  })

  test('CLS-10 the tools line: name and file, command or pattern; at most 12; (none)', () => {
    const tools = [
      { type: 'tool_use', name: 'Read', input: { file_path: '/src/app/main.ts' } },
      { type: 'tool_use', name: 'Bash', input: { command: 'npm test\n--watch=false' } },
    ]
    expect(
      JSON.parse(
        batchInput([turn('a long enough prompt to stand on its own', '', tools)]).slice(22),
      )[0].tools,
    ).toBe('Read: /src/app/main.ts; Bash: npm test --watch=false')
    const fifteen = Array.from({ length: 15 }, (_, i) => ({
      name: 'Grep',
      input: { pattern: `p${i}` },
    }))
    const line = JSON.parse(
      batchInput([turn('a long enough prompt to stand on its own', '', fifteen)]).slice(22),
    )[0].tools
    expect(line.split('; ')).toHaveLength(12)
    expect(JSON.parse(batchInput([turn('x'.repeat(50))]).slice(22))[0].tools).toBe('(none)')
  })

  test('CLS-11 a long command is cut to 70 characters', () => {
    const tools = [{ name: 'Bash', input: { command: 'c'.repeat(200) } }]
    expect(JSON.parse(batchInput([turn('x'.repeat(50), '', tools)]).slice(22))[0].tools).toBe(
      `Bash: ${'c'.repeat(70)}`,
    )
  })

  test("the input's JSON has Python's separators and keeps non-ASCII text, as measured", () => {
    expect(batchInput([turn('arreglá el login, por favor, que no anda bien')])).toBe(
      'Classify these turns:\n[{"id": 0, "previous": "", "prompt": "arreglá el login, por favor, que no anda bien", "tools": "(none)"}]',
    )
  })

  test("the turn's text and tools come from its transcript; the previous prompt is the human's", () => {
    const dirs = usageDirs('read')
    dirs.transcript('s1', [
      human('10:00:00', 'Add a retry to the upload worker'),
      tool('10:00:05', 'Read', { file_path: '/src/upload.ts' }),
      human('10:05:00', 'peer says hi', { turnOrigin: 'peer' }),
      human('10:10:00', [
        { type: 'text', text: 'ok' },
        { type: 'image' },
        { type: 'text', text: 'go on' },
      ] as unknown as string),
      tool('10:10:05', 'Bash', { command: 'npm test' }),
    ])
    const db = open(dirs)
    expect(readTurn(db.cache, 'u-10:10:00')).toEqual({
      prompt: 'ok\ngo on',
      previous: 'Add a retry to the upload worker',
      tools: [
        { type: 'tool_use', id: 't_10:10:05_Bash', name: 'Bash', input: { command: 'npm test' } },
      ],
    })
    db.close()
  })
})

describe('the invocation', () => {
  function withFake(name: string, setup: (replies: string) => void = () => {}) {
    const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', `fake-${name}-`))
    const log = join(root, 'log')
    const replies = join(root, 'replies')
    mkdirSync(log)
    mkdirSync(replies)
    setup(replies)
    vi.stubEnv('FAKE_CLAUDE_LOG', log)
    vi.stubEnv('FAKE_CLAUDE_REPLIES', replies)
    return {
      log,
      replies,
      call: (n: number, file: string) => readFileSync(join(log, `call-${n}`, file), 'utf8'),
    }
  }

  test('CLS-12 the argv, the empty folder of its own and the environment', () => {
    const fake = withFake('cls12', (replies) =>
      writeFileSync(join(replies, '1.json'), '{"result": "[]"}'),
    )
    vi.stubEnv('CLAUDECODE', '1')
    vi.stubEnv('CLAUDE_CODE_ENTRYPOINT', 'cli')
    vi.stubEnv('CLAUDE_CODE_SSE_PORT', '1234')
    rmSync(classifierFolder(), { recursive: true, force: true })
    expect(claudeCall(FAKE)('Classify these turns:\n[]')).toBe('{"result": "[]"}')
    expect(fake.call(1, 'argv').split('\0').slice(0, -1)).toEqual([
      '-p',
      '--model',
      'haiku',
      '--output-format',
      'json',
      '--tools',
      '',
      '--no-session-persistence',
      '--strict-mcp-config',
      '--system-prompt',
      SYSTEM_PROMPT,
    ])
    expect(fake.call(1, 'cwd').trim()).toBe(classifierFolder())
    expect(classifierFolder()).toBe(join(process.env.XDG_DATA_HOME ?? '', 'menkar', 'classifier'))
    const env = fake.call(1, 'env').split('\n')
    expect(env.filter((l) => l.startsWith('CLAUDECODE='))).toEqual([])
    expect(env.filter((l) => l.startsWith('CLAUDE_CODE_'))).toEqual([
      'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
    ])
    expect(env).toContain('DISABLE_TELEMETRY=1')
    expect(env).toContain('DISABLE_ERROR_REPORTING=1')
    expect(fake.call(1, 'stdin')).toBe('Classify these turns:\n[]')
    expect(command()).toHaveLength(11)
    expect(environment({ CLAUDE_CODE_X: 'a', HOME: '/h' })).toEqual({
      HOME: '/h',
      DISABLE_TELEMETRY: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      DISABLE_ERROR_REPORTING: '1',
    })
  })

  test('CLS-17 a failing call stops the run: earlier batches stay, no try for the failed one', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const dirs = usageDirs('cls17')
    const lines = []
    for (let i = 0; i < 70; i += 1)
      lines.push(
        human(
          `1${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}:00`,
          `prompt ${i} long enough to stand on its own`,
        ),
      )
    dirs.transcript('s1', lines)
    const db = open(dirs)
    withFake('cls17', (replies) => {
      const all = Array.from({ length: 30 }, (_, id) => ({ id, category: 'build' }))
      writeFileSync(join(replies, '1.json'), JSON.stringify({ result: JSON.stringify(all) }))
    })
    vi.stubEnv('FAKE_CLAUDE_FAIL_CALL', '2')
    const result = classifyPass(db.history, db.cache, 0, secs('23:00:00'), claudeCall(FAKE))
    expect(result).toEqual({ at: secs('23:00:00'), classified: 30, failed: true })
    const rows = Object.values(db.rows()) as [string | null, number][]
    expect(rows.filter(([c]) => c === 'build')).toHaveLength(30)
    expect(rows.filter(([c, tries]) => c === null && tries > 0)).toEqual([])
    expect(statusText(result, secs('23:30:00'))).toBe('Could not run Claude (see the log) · 23:00')
    db.close()
  })

  test('CLS-18 a call that outlives its timeout fails like CLS-17', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    vi.resetModules()
    vi.doMock('../../../src/core/classifier/prompt', async (original) => ({
      ...(await original<typeof import('../../../src/core/classifier/prompt')>()),
      TIMEOUT_MS: 300,
    }))
    const { claudeCall: shortCall } = await import('../../../src/core/classifier/run')
    withFake('cls18', (replies) => writeFileSync(join(replies, '1.json'), '{"result": "[]"}'))
    vi.stubEnv('FAKE_CLAUDE_SLEEP', '2')
    expect(shortCall(FAKE)('x')).toBeNull()
    vi.doUnmock('../../../src/core/classifier/prompt')
  })

  test('CLS-19 with no claude on the PATH the pass fails at once, even with nothing ready', () => {
    expect(findClaude('/nonexistent:/also-not')).toBeNull()
    expect(findClaude(resolve('tests/data/classifier'))).toBe(FAKE)
    const dirs = usageDirs('cls19')
    const db = open(dirs)
    expect(classifyPass(db.history, db.cache, 0, NOW, null)).toEqual({
      at: NOW,
      classified: 0,
      failed: true,
    })
    db.close()
  })

  test('CLS-38 a classification call leaves nothing under ~/.claude and no transcript changed', () => {
    const dirs = usageDirs('cls38')
    const path = dirs.transcript('s1', [
      human('10:00:00', 'a prompt long enough to stand on its own'),
      human('11:00:00', 'next one'),
    ])
    const before = readFileSync(path)
    const db = open(dirs)
    withFake('cls38', (replies) =>
      writeFileSync(
        join(replies, '1.json'),
        JSON.stringify({ result: '[{"id":0,"category":"plan"}]' }),
      ),
    )
    classifyPass(db.history, db.cache, 0, NOW, claudeCall(FAKE))
    expect(readFileSync(path)).toEqual(before)
    expect(existsSync(join(process.env.HOME ?? '', '.claude'))).toBe(false)
    expect(readdirSync(classifierFolder())).toEqual([])
    db.close()
  })
})

describe('reading the answer', () => {
  test('CLS-13 each valid answer is written; no try is counted', () => {
    const reply = JSON.stringify({
      result: '[{"id":0,"category":"build","confidence":0.9},{"id":1,"category":"test"}]',
    })
    expect([...parseReply(reply, 2)]).toEqual([
      [0, 'build'],
      [1, 'test'],
    ])
  })

  test('CLS-14 the array is found inside other text and a code fence', () => {
    const reply = JSON.stringify({
      result: 'Here you go:\n```json\n[{"id":0,"category":"plan"}]\n```',
    })
    expect([...parseReply(reply, 1)]).toEqual([[0, 'plan']])
  })

  test('CLS-15 unknown categories and ids out of the batch are no answer; each unanswered turn gets a try', () => {
    const dirs = usageDirs('cls15')
    dirs.transcript(
      's1',
      ['a', 'b', 'c'].map((x, i) =>
        human(`1${i}:00:00`, `${x} prompt long enough to stand on its own`),
      ),
    )
    const db = open(dirs)
    const reply = JSON.stringify({
      result:
        '[{"id":0,"category":"design"},{"id":1,"category":"refactor"},{"id":7,"category":"build"}]',
    })
    expect(classifyPass(db.history, db.cache, 0, NOW, () => reply).classified).toBe(1)
    expect(db.rows()).toEqual({
      'u-10:00:00': ['design', 0],
      'u-11:00:00': [null, 1],
      'u-12:00:00': [null, 1],
    })
    db.close()
  })

  test('CLS-16 an answer with no array charges every turn; at 3 tries a turn is never sent again', () => {
    const dirs = usageDirs('cls16')
    dirs.transcript('s1', [human('10:00:00', 'a prompt long enough to stand on its own')])
    const db = open(dirs)
    const calls: string[] = []
    const refusing: Call = (input) => {
      calls.push(input)
      return JSON.stringify({ result: 'I cannot help' })
    }
    for (let i = 0; i < 5; i += 1) classifyPass(db.history, db.cache, 0, NOW, refusing)
    expect(calls).toHaveLength(3)
    expect(db.rows()['u-10:00:00']).toEqual([null, 3])
    expect(parseReply('not json at all', 2).size).toBe(0)
    db.close()
  })

  test("CLS-20 the status line shows the run's time today, its date another day", () => {
    const run = { at: secs('14:05:00', '2026-11-07'), classified: 12, failed: false }
    expect(statusText(run, secs('20:00:00', '2026-11-07'))).toBe('12 turns classified · 14:05')
    expect(statusText(run, secs('09:00:00', '2026-11-08'))).toBe(
      '12 turns classified · 2026-11-07 14:05',
    )
    expect(statusText(undefined, NOW)).toBe('')
  })

  test('CLS-21 a turn whose transcript is gone counts a try and is left out; the rest are sent', () => {
    const dirs = usageDirs('cls21')
    dirs.transcript('s1', [
      human('10:00:00', 'kept prompt long enough to stand on its own'),
      human('11:00:00', 'next'),
    ])
    const gone = dirs.transcript('s2', [
      { ...human('10:30:00', 'lost prompt long enough to stand on its own'), uuid: 'lost' },
      { ...human('11:30:00', 'x'), uuid: 'lost-2' },
    ])
    const db = open(dirs)
    rmSync(gone)
    const fake = answering()
    classifyPass(db.history, db.cache, 0, NOW, fake.call)
    expect(db.rows().lost).toEqual([null, 1])
    expect(fake.sent()[0].map((t: { prompt: string }) => t.prompt)).toContain(
      'kept prompt long enough to stand on its own',
    )
    db.close()
  })
})

test('a turn whose transcript holds another line at the recorded byte has no text', () => {
  const dirs = usageDirs('moved')
  const path = dirs.transcript('s1', [
    human('10:00:00', 'original prompt'),
    human('11:00:00', 'next'),
  ])
  const db = open(dirs)
  expect(readTurn(db.cache, 'u-10:00:00')?.prompt).toBe('original prompt')
  writeFileSync(path, readFileSync(path, 'utf8').replace('u-10:00:00', 'u-99:99:99'))
  expect(readTurn(db.cache, 'u-10:00:00')).toBeNull()
  db.close()
})

describe('inheritance', () => {
  function report(dirs: Dirs) {
    const history = new UsageHistory(dirs.history)
    const result = buildReport(
      history,
      {
        start: midnight({ year: 2026, month: 11, day: 8 }),
        end: midnight({ year: 2026, month: 11, day: 9 }),
      },
      { statuslineLogs: [], categories: true },
    )
    history.close()
    return Object.fromEntries(result.nodes[0]?.children.map((c) => [c.label, c.execution]) ?? [])
  }

  test("CLS-22 a turn the human did not start reports its previous human turn's category, never written", () => {
    const dirs = usageDirs('cls22')
    dirs.transcript('s1', [
      human('10:00:00', 'h1'),
      response('10:00:10'),
      human('10:20:00', 't', { turnOrigin: 'task_notification' }),
      response('10:20:20'),
      human('10:30:00', 'h2'),
      response('10:30:30'),
      human('10:40:00', 'p', { turnOrigin: 'peer' }),
      response('10:40:40'),
    ])
    const db = open(dirs)
    db.history.setCategories(new Map([['u-10:00:00', 'build']]))
    expect(report(dirs)).toEqual({
      build: { human: 10, task_notification: 20 },
      '(unclassified)': { human: 30, peer: 40 },
    })
    db.history.setCategories(new Map([['u-10:30:00', 'test']]))
    expect(report(dirs)).toEqual({
      build: { human: 10, task_notification: 20 },
      test: { human: 30, peer: 40 },
    })
    expect(db.rows()['u-10:40:00']).toEqual([null, 0])
    db.close()
  })

  test('a turn after another non-human turn still inherits from the human turn before both', () => {
    const dirs = usageDirs('cls22b')
    dirs.transcript('s1', [
      human('10:00:00', 'h1'),
      response('10:00:10'),
      human('10:20:00', 't', { turnOrigin: 'task_notification' }),
      response('10:20:20'),
      human('10:40:00', 'p', { turnOrigin: 'peer' }),
      response('10:40:40'),
    ])
    const db = open(dirs)
    db.history.setCategories(new Map([['u-10:00:00', 'build']]))
    expect(report(dirs)).toEqual({ build: { human: 10, task_notification: 20, peer: 40 } })
    db.close()
  })

  test('CLS-23 a peer turn with no human turn before it is unclassified', () => {
    const dirs = usageDirs('cls23')
    dirs.transcript('s1', [
      human('10:00:00', 'p', { turnOrigin: 'peer' }),
      response('10:00:10'),
      human('10:30:00', 'h'),
      response('10:30:30'),
    ])
    const db = open(dirs)
    db.history.setCategories(new Map([['u-10:30:00', 'plan']]))
    expect(report(dirs)).toEqual({ plan: { human: 30 }, '(unclassified)': { peer: 10 } })
    db.close()
  })

  test('CLS-24 the usage pass rewriting a turn keeps its category and tries', () => {
    const dirs = usageDirs('cls24')
    const path = dirs.transcript('s1', [human('10:00:00', 'h'), response('10:00:10')])
    const db = open(dirs)
    db.history.setCategories(new Map([['u-10:00:00', 'design']]))
    db.history.countTry(['u-10:00:00'])
    db.close()
    dirs.append(path, [response('10:00:50')])
    const again = open(dirs)
    expect(again.rows()['u-10:00:00']).toEqual(['design', 1])
    again.close()
  })
})
