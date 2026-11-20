// Decision 1.195: Menkar names the Codex sessions the orchestration starts through Codex's own
// call, `thread/name/set` on a `codex app-server --disable plugins` of the same home, and the
// sessions' bind is hastened by a watch on the folder their rollout appears in. Driven with the
// stand-in `codex`, whose server appends the name to session_index.jsonl as Codex 0.169 does.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { codexStandIn } from '../../../../e2e/standins/codex'
import { mainKitOf } from '../../../../src/main/agents/registry'

const THREAD = '019a4c2e-7b1d-7e3f-9a5b-0c1d2e3f4a5b'
const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-namer')
const home = join(root, 'home')
const codexHome = join(home, '.codex')
const bin = join(root, 'bin')
const index = join(codexHome, 'session_index.jsonl')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  codexStandIn(bin)
  mkdirSync(codexHome, { recursive: true })
  vi.stubEnv('HOME', home)
  vi.stubEnv('CODEX_HOME', codexHome)
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

function rollout(id: string): void {
  const dir = join(codexHome, 'sessions', '2026', '11', '20')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `rollout-2026-11-20T10-00-00-${id}.jsonl`), '')
}

const names = (): { id: string; thread_name: string }[] =>
  existsSync(index)
    ? readFileSync(index, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : []
const runs = (): string[] => {
  const file = join(home, 'codex-args.txt')
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n') : []
}

const namer = () => {
  const n = mainKitOf('codex').namer
  if (!n) throw new Error('Codex has a namer')
  return n
}

describe("Codex's namer", () => {
  test('names a thread through codex app-server with plugins disabled: no git folder left', async () => {
    rollout(THREAD)
    expect(await namer().after(THREAD, 'menkar-t9')).toBe('named')
    expect(names().map((n) => [n.id, n.thread_name])).toEqual([[THREAD, 'menkar-t9']])
    expect(runs()).toEqual(['app-server --disable plugins'])
    expect(existsSync(join(codexHome, '.tmp'))).toBe(false)
  })

  test('a title Codex generated is overwritten: the last line names the thread', async () => {
    rollout(THREAD)
    writeFileSync(index, `${JSON.stringify({ id: THREAD, thread_name: 'Fix the login' })}\n`)
    expect(await namer().after(THREAD, 'menkar-t9')).toBe('named')
    expect(names().at(-1)?.thread_name).toBe('menkar-t9')
  })

  test('a thread that has the name already is kept, and codex is not run', async () => {
    rollout(THREAD)
    writeFileSync(index, `${JSON.stringify({ id: THREAD, thread_name: 'menkar-t9' })}\n`)
    expect(await namer().after(THREAD, 'menkar-t9')).toBe('kept')
    expect(runs()).toEqual([])
    expect(names()).toHaveLength(1)
  })

  test('a thread with no rollout yet is no session, and nothing is written', async () => {
    expect(await namer().after(THREAD, 'menkar-t9')).toBe('no session')
    expect(names()).toEqual([])
  })

  test('any other refusal rejects', async () => {
    rollout(THREAD)
    await expect(namer().after(THREAD, '   ')).rejects.toThrow(/must not be empty/)
  })

  test("Menkar's own session variables are not handed to codex app-server", async () => {
    rollout(THREAD)
    vi.stubEnv('CODEX_THREAD_ID', 'the-thread-menkar-runs-in')
    expect(await namer().after(THREAD, 'menkar-t9')).toBe('named')
    const env = JSON.parse(readFileSync(join(home, 'codex-env.json'), 'utf8'))
    expect(env.CODEX_THREAD_ID).toBeUndefined()
    expect(env.CODEX_HOME).toBe(codexHome)
  })

  test('the watch calls back when the rollout appears in a day folder made after it started', async () => {
    const since = new Date(2026, 10, 20, 23, 59, 58).getTime()
    let calls = 0
    const stop = namer().watch(since, () => {
      calls += 1
    })
    try {
      const day = join(codexHome, 'sessions', '2026', '11', '20')
      mkdirSync(join(codexHome, 'sessions'), { recursive: true })
      await vi.waitFor(() => expect(calls).toBeGreaterThan(0))
      mkdirSync(day, { recursive: true })
      await new Promise((resolve) => setTimeout(resolve, 50))
      const seen = calls
      writeFileSync(join(day, `rollout-2026-11-20T23-59-58-${THREAD}.jsonl`), '')
      await vi.waitFor(() => expect(calls).toBeGreaterThan(seen))
    } finally {
      stop()
    }
    const after = calls
    writeFileSync(join(codexHome, 'sessions', '2026', '11', '20', 'later.jsonl'), '')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(calls).toBe(after)
  })

  test("Claude's and Cursor's sessions are named at start, so they have no namer after it", () => {
    expect(mainKitOf('claude').namer).toBeNull()
    expect(mainKitOf('cursor').namer).toBeNull()
  })
})
