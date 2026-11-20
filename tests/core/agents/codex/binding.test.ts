// Binding a Codex pane to its thread (§2.5.2 of the multi-agent architecture, corrected by codex's
// measurements of 2026-11-20): the rollout appears at the first user message and its process holds
// it open, keeping a /new thread's old rollout open beside the new one; a thread id is a UUIDv7
// minted when the thread is made; a fork is a new thread whose first line names its source.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  findRollout,
  heldThread,
  mintedAt,
  rolloutThread,
} from '../../../../src/core/agents/codex/binding'
import { kitOf } from '../../../../src/core/agents/registry'

const SESSIONS = '/home/ana/.codex/sessions'
const A = '019a4f2c-1e00-7a11-8a01-00000000000a'
const B = '019a5400-2b00-7b22-8b02-00000000000b'
const rollout = (id: string, day = '2026/11/02') =>
  `${SESSIONS}/${day}/rollout-${day.replaceAll('/', '-')}T09-15-00-${id}.jsonl`

afterEach(() => vi.unstubAllEnvs())

describe('the thread a Codex process holds open', () => {
  test('a rollout under the sessions folder names its thread; any other file does not', () => {
    expect(rolloutThread(rollout(A), SESSIONS)).toBe(A)
    expect(rolloutThread(`${SESSIONS}/2026/11/02/rollout-x-${A}_019a.jsonl`, SESSIONS)).toBe(A)
    expect(rolloutThread(`/elsewhere/2026/11/02/rollout-x-${A}.jsonl`, SESSIONS)).toBeNull()
    expect(rolloutThread(`${rollout(A)}.zst`, SESSIONS)).toBeNull()
    expect(rolloutThread(`${SESSIONS}/2026/11/02/notes-${A}.jsonl`, SESSIONS)).toBeNull()
    expect(rolloutThread('/dev/pts/3', SESSIONS)).toBeNull()
  })

  test('before the first message it holds none, and the pane is not bound yet', () => {
    expect(heldThread(['/dev/pts/3', '/home/ana/.codex/log/codex-tui.log'], SESSIONS)).toBeNull()
  })

  test('after the first message, its one rollout binds the pane, however many fds point at it', () => {
    expect(heldThread(['/dev/pts/3', rollout(A), rollout(A)], SESSIONS)).toBe(A)
  })

  test('after a /new it holds both rollouts, and which is the pane’s cannot be told from them', () => {
    expect(heldThread([rollout(A), rollout(B, '2026/11/03')], SESSIONS)).toBeNull()
  })
})

describe("a pane's thread changing", () => {
  const follow = kitOf('codex').follow
  const STARTED = mintedAt(A) ?? 0

  test('a UUIDv7 tells when it was minted; anything else does not', () => {
    const at = Date.UTC(2026, 10, 20, 14, 4, 50, 100)
    const hex = at.toString(16).padStart(12, '0')
    expect(mintedAt(`${hex.slice(0, 8)}-${hex.slice(8)}-7a11-8a01-00000000000a`)).toBe(at)
    expect(mintedAt('3f1e7c2d-0000-4000-8000-000000000000')).toBeNull()
    expect(mintedAt('not-an-id')).toBeNull()
  })

  test('a thread older than the pane is a /resume: another session', async () => {
    expect(await follow?.classify(null, { to: A, paneStartedAt: STARTED + 1 })).toBe('resume')
  })

  test("a thread made after the pane started is a /new, which takes the old one's place", async () => {
    const home = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-follow-'))
    const day = join(home, 'sessions', '2026', '11', '03')
    mkdirSync(day, { recursive: true })
    writeFileSync(
      join(day, `rollout-2026-11-03T18-02-10-${B}.jsonl`),
      `${JSON.stringify({ type: 'session_meta', payload: { id: B, cwd: '/w' } })}\n`,
    )
    vi.stubEnv('CODEX_HOME', home)
    expect(await follow?.classify(null, { to: B, paneStartedAt: STARTED })).toBe('clear')
  })

  test('a fork, however new, is another session: the tab follows it and the source stays a row', async () => {
    const home = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-follow-'))
    const day = join(home, 'sessions', '2026', '11', '03')
    mkdirSync(day, { recursive: true })
    writeFileSync(
      join(day, `rollout-2026-11-03T18-02-10-${B}.jsonl`),
      `${JSON.stringify({ type: 'session_meta', payload: { id: B, forked_from_id: A, cwd: '/w' } })}\n`,
    )
    vi.stubEnv('CODEX_HOME', home)
    expect(await follow?.classify(null, { to: B, paneStartedAt: STARTED })).toBe('resume')
  })

  test('nothing told of the change, nothing followed', () => {
    expect(follow?.classify('clear')).toBeNull()
  })
})

test('a thread’s rollout is found in its day folder, newest days first; the title thread has none', async () => {
  const sessions = join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'data',
    'agents',
    'codex',
    'home',
    '.codex',
    'sessions',
  )
  expect(await findRollout(sessions, A)).toMatch(new RegExp(`2026/11/02/rollout-.*-${A}\\.jsonl$`))
  expect(await findRollout(sessions, '0199fe10-3c00-7c33-8c03-00000000000c')).toMatch(
    /\.jsonl\.zst$/,
  )
  expect(await findRollout(sessions, '019a4f2c-1d00-7e55-8e05-0000000000ee')).toBeNull()
  expect(await findRollout(join(sessions, 'missing'), A)).toBeNull()
})
