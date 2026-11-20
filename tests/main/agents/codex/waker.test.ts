// §2.3 of the multi-agent architecture: Codex's waker is `codex queue`, Codex's own channel into a
// thread, so nothing is typed into its terminal. The outcome is read from the command's exit
// status; a thread with no rollout (no first message yet, or a provisional id) is 'no session'
// and the command is not run. Driven with the stand-in `codex`, whose queue is the SQLite table
// Codex 0.169 writes: the row's text is the bytes the session will read.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { codexStandIn } from '../../../../e2e/standins/codex'
import { wakeText } from '../../../../src/core/control/post'
import { mainKitOf } from '../../../../src/main/agents/registry'

const THREAD = '019a4c2e-7b1d-7e3f-9a5b-0c1d2e3f4a5b'
const root = join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-waker')
const home = join(root, 'home')
const codexHome = join(home, '.codex')
const bin = join(root, 'bin')
const failing = join(root, 'failing-bin')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  codexStandIn(bin)
  mkdirSync(failing, { recursive: true })
  writeFileSync(join(failing, 'codex'), '#!/bin/sh\necho "Error: the queue is busy" >&2\nexit 3\n')
  chmodSync(join(failing, 'codex'), 0o755)
  vi.stubEnv('HOME', home)
  vi.stubEnv('CODEX_HOME', codexHome)
  vi.stubEnv('PATH', `${bin}:${process.env.PATH}`)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function rollout(id: string): void {
  const dir = join(codexHome, 'sessions', '2026', '11', '20')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `rollout-2026-11-20T10-00-00-${id}.jsonl`), '')
}

function queued(): { thread_id: string; text: string }[] {
  const file = join(codexHome, 'queue_1.sqlite')
  if (!existsSync(file)) return []
  const db = new DatabaseSync(file)
  try {
    const rows = db
      .prepare('SELECT thread_id, payload_json FROM queued_items ORDER BY queue_order')
      .all() as { thread_id: string; payload_json: string }[]
    return rows.map((r) => ({
      thread_id: r.thread_id,
      text: JSON.parse(r.payload_json).UserInput.content[0].text,
    }))
  } finally {
    db.close()
  }
}

const waker = () => {
  const w = mainKitOf('codex').waker
  if (!w) throw new Error('Codex has a waker')
  return w
}

describe("Codex's waker", () => {
  test("queues Menkar's text to the thread, byte for byte, newlines and counts included", async () => {
    rollout(THREAD)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 58))
    const counts = { topics: 2, working: 1, waiting: 0 }
    const text =
      'from orchestrator (Claude Code); reply with send_message: "look"\nat `a.txt` -- $HOME'
    expect(await waker().wake(THREAD, text, counts)).toBe('posted')
    expect(queued()).toEqual([{ thread_id: THREAD, text: wakeText(text, counts) }])
    expect(queued()[0]?.text).toBe(
      '[Menkar] from orchestrator (Claude Code); reply with send_message: "look"\nat `a.txt` -- $HOME (23:59:58) · 2 topics · 1 working · 0 waiting',
    )
  })

  test('a thread with no rollout yet is no session, and codex is not run', async () => {
    expect(await waker().wake(THREAD, 'hello', undefined)).toBe('no session')
    expect(existsSync(join(home, 'codex-args.txt'))).toBe(false)
    expect(queued()).toEqual([])
  })

  test('a provisional id, a session not yet bound, is no session', async () => {
    rollout(THREAD)
    expect(
      await waker().wake('pending:4e1f9c2a-0b3d-4c5e-8f6a-7b8c9d0e1f2a', 'hello', undefined),
    ).toBe('no session')
    expect(existsSync(join(home, 'codex-args.txt'))).toBe(false)
  })

  test('codex queue ending with an error rejects, so the wake is counted as failed', async () => {
    rollout(THREAD)
    vi.stubEnv('PATH', `${failing}:${process.env.PATH}`)
    await expect(waker().wake(THREAD, 'hello', undefined)).rejects.toThrow(/ended with 3/)
  })

  test('codex queue runs with plugins disabled: no marketplace sync, no git folder left', async () => {
    rollout(THREAD)
    expect(await waker().wake(THREAD, 'hello', undefined)).toBe('posted')
    const runs = readFileSync(join(home, 'codex-args.txt'), 'utf8').trim().split('\n')
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatch(/^queue --disable plugins --thread /)
    expect(existsSync(join(codexHome, '.tmp'))).toBe(false)
  })

  test("with Codex's daemon running, its refusal of the override is answered by the plain call", async () => {
    rollout(THREAD)
    vi.stubEnv('FAKE_CODEX_DAEMON', '1')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 58))
    expect(await waker().wake(THREAD, 'hello', undefined)).toBe('posted')
    const runs = readFileSync(join(home, 'codex-args.txt'), 'utf8').trim().split('\n')
    expect(runs.map((r) => r.split(' --message')[0])).toEqual([
      `queue --disable plugins --thread ${THREAD}`,
      `queue --thread ${THREAD}`,
    ])
    expect(queued()).toEqual([{ thread_id: THREAD, text: wakeText('hello', undefined) }])
    expect(existsSync(join(codexHome, '.tmp'))).toBe(false)
  })

  test('any other failure is not retried', async () => {
    rollout(THREAD)
    const runs = join(root, 'runs.txt')
    writeFileSync(
      join(failing, 'codex'),
      `#!/bin/sh\necho run >> ${runs}\necho "Error: the queue is busy" >&2\nexit 3\n`,
    )
    vi.stubEnv('PATH', `${failing}:${process.env.PATH}`)
    await expect(waker().wake(THREAD, 'hello', undefined)).rejects.toThrow(/ended with 3/)
    expect(readFileSync(runs, 'utf8')).toBe('run\n')
  })

  test("Menkar's own session variables are not handed to codex queue", async () => {
    rollout(THREAD)
    vi.stubEnv('CODEX_THREAD_ID', 'the-thread-menkar-runs-in')
    expect(await waker().wake(THREAD, 'hello', undefined)).toBe('posted')
    const env = JSON.parse(readFileSync(join(home, 'codex-env.json'), 'utf8'))
    expect(env.CODEX_THREAD_ID).toBeUndefined()
    expect(env.CODEX_HOME).toBe(codexHome)
  })

  test("its team delivery is not built yet: Codex's team block is P1b.5's", () => {
    expect(mainKitOf('codex').team).toBeNull()
  })
})
