// Cursor's usage (§2.5.5 and §2.6 of the multi-agent architecture): its turns come from the log its
// hooks append in Menkar's cache, never from the transcript's bytes; the prompt's text kept for the
// classifier goes once the classifier is off; a pass exports its turns as Cursor's, with the
// human's response latency.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { lastClosedReply } from '../../../../src/core/agents/cursor/catalog'
import { HOOK_LOG, PROMPTS_DIR } from '../../../../src/core/agents/cursor/hooks'
import { CACHE_FILE, usage } from '../../../../src/core/agents/cursor/usage'
import type { TurnSource } from '../../../../src/core/agents/types'
import { statePath } from '../../../../src/core/state'
import { exportRows } from '../../../../src/core/usage/export'
import { UsageHistory } from '../../../../src/core/usage/history'
import { runPass } from '../../../../src/core/usage/pass'
import { memberships, usageDirs } from '../../../factories/usage'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'cursor')
const S1 = '5a1e0077'
const S2 = 'c0ffee01'
const T = Date.UTC(2026, 10, 23, 12, 0, 0) / 1000

afterEach(() => vi.unstubAllEnvs())

let n = 0
// The fixture's hook log in a fresh cache, and a Cursor projects folder beside it.
function fixture() {
  n += 1
  const dirs = usageDirs(`cursor-${n}`)
  const cache = join(dirs.root, 'cache')
  cpSync(join(DATA, 'cache'), cache, { recursive: true })
  const projects = join(dirs.root, 'cursor', 'projects')
  mkdirSync(projects, { recursive: true })
  const open = (): TurnSource => {
    const source = usage.open(projects, dirs.cache)
    if (source === null) throw new Error('no Cursor source')
    return source
  }
  return { dirs, cache, projects, open }
}

function classifier(on: boolean) {
  mkdirSync(join(statePath(), '..'), { recursive: true })
  writeFileSync(statePath(), JSON.stringify({ settings: { classify_since: on ? T - 60 : null } }))
}

describe("Cursor's turns", () => {
  test('nothing is opened or created without Cursor, or before its hooks logged anything', () => {
    const { dirs, cache, projects } = fixture()
    expect(usage.open(join(dirs.root, 'nowhere'), dirs.cache)).toBeNull()
    const empty = usageDirs('cursor-empty')
    expect(usage.open(projects, empty.cache)).toBeNull()
    expect(existsSync(join(empty.root, 'cache', CACHE_FILE))).toBe(false)
    expect(existsSync(join(cache, HOOK_LOG))).toBe(true)
  })

  test('a line still being written is read at the next pass, once whole', () => {
    const { cache, open } = fixture()
    const source = open()
    try {
      source.ingest()
      const before = source.pending().length
      const log = join(cache, HOOK_LOG)
      writeFileSync(
        log,
        `${readFileSync(log, 'utf8')}${T + 3900},"session_id":"${S2}","generation_id":"gen-b3","status":"completed","loop_count":0,"model":"default","input_tokens":5000,"output_tokens":9,"cache_read_tokens":4000,"cache_write_tokens":0}\n`,
      )
      source.ingest()
      expect(source.pending()).toHaveLength(before)
      const turn = source.turnUsage(S2, 'cursor:gen-b3')
      expect(turn?.spans).toEqual([{ kind: 'execution', start: T + 3800, end: T + 3900 }])
      expect(turn?.tokens.map((t) => [t.input, t.output, t.cacheRead])).toEqual([[1000, 9, 4000]])
    } finally {
      source.close()
    }
  })

  test("the prompt's text is the classifier's while it is on, and goes at the next pass once it is off", () => {
    const { cache, open } = fixture()
    mkdirSync(join(cache, PROMPTS_DIR), { recursive: true })
    writeFileSync(join(cache, PROMPTS_DIR, 'gen-b1.txt'), 'Make it faster')
    writeFileSync(join(cache, PROMPTS_DIR, 'gen-b2.txt'), 'ok')
    classifier(true)
    const source = open()
    try {
      source.ingest()
      expect(source.turnText('cursor:gen-b2')).toEqual({
        prompt: 'ok',
        previous: 'Make it faster',
        tools: [],
      })
      expect(source.textAt('cursor:gen-b1')).toEqual({
        file: join(cache, PROMPTS_DIR, 'gen-b1.txt'),
        start: 0,
      })
      expect(source.turnText('codex:gen-b1')).toBeNull()
      classifier(false)
      source.ingest()
      expect(existsSync(join(cache, PROMPTS_DIR))).toBe(false)
      expect(source.turnText('cursor:gen-b2')).toBeNull()
    } finally {
      source.close()
    }
  })
})

describe('a pass with Cursor', () => {
  test("its turns are exported as cursor's, with the human's response latency", () => {
    const { dirs, projects } = fixture()
    runPass(memberships(), {
      claudeProjects: dirs.claudeProjects,
      cursorProjects: projects,
      cache: dirs.cache,
      history: dirs.history,
    })
    const history = new UsageHistory(dirs.history)
    try {
      const rows = exportRows(history, { start: T - 60, end: T + 7200 }, { statuslineLogs: [] })
      const shown = rows
        .filter((r) => r.session_id === S1 || r.session_id === S2)
        .map((r) => [
          r.turn,
          r.agent,
          r.origin,
          r.response_seconds === null ? null : Math.round(r.response_seconds * 10) / 10,
        ])
      expect(shown).toEqual([
        // the next turn is Menkar's post, not the human's answer
        ['cursor:gen-a1', 'cursor', 'human', null],
        ['cursor:gen-a2', 'cursor', 'peer', null],
        // opened by the stop hook's answer, where the turn before it ended
        ['cursor:gen-a3', 'cursor', 'peer', null],
        // interrupted at 1 h 0 min 20 s; the human typed again 30 s later
        ['cursor:gen-b1', 'cursor', 'human', 30],
        ['cursor:gen-b2', 'cursor', 'human', 80],
        ['cursor:gen-b3', 'cursor', 'human', null],
      ])
    } finally {
      history.close()
    }
  })
})

describe("a Cursor session's last reply", () => {
  test("is the last text before the last turn's end, a turn still running leaving the one before", () => {
    const read = (name: string) => readFileSync(join(DATA, 'rewritten', name), 'utf8').split('\n')
    const before = read('before.jsonl')
    expect(lastClosedReply(before)).toBe('Should I include the test files too?')
    // the same chat rewritten by Cursor: its last turn alone
    expect(lastClosedReply(read('after.jsonl'))).toBe('Here they are: app.ts and main.ts.')
    const running = [
      ...before,
      '{"role":"user","message":{"content":[{"type":"text","text":"<user_query>\\nAnd the tests?\\n</user_query>"}]}}',
      '{"role":"assistant","message":{"content":[{"type":"text","text":"Looking."}]}}',
    ]
    expect(lastClosedReply(running)).toBe('Should I include the test files too?')
    expect(lastClosedReply(before.filter((l) => !l.includes('turn_ended')))).toBeNull()
  })
})
