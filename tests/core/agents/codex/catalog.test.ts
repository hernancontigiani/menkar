// Codex's catalog beyond its contract fixture: what changes between two reads, and the files Codex
// leaves side by side while it compresses, restores or reverts a thread.
import { appendFileSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { catalog } from '../../../../src/core/agents/codex/catalog'
import { readRange } from '../../../../src/core/agents/shared/jsonl'

const T = '019a6000-0000-7000-8000-000000000001'
const ROLLOUT = `rollout-2026-11-10T09-00-00-${T}`

const line = (type: string, payload: object) =>
  `${JSON.stringify({ timestamp: '2026-11-10T12:00:00.000Z', type, payload })}\n`
const meta = line('session_meta', {
  id: T,
  cwd: '/home/demo/api',
  source: 'cli',
  thread_source: 'user',
  history_mode: 'paginated',
})
const typed = (text: string) =>
  line('event_msg', {
    type: 'item_completed',
    item: { type: 'UserMessage', content: [{ type: 'text', text }] },
  })

function home(): { sessions: string; day: string; index: string } {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-catalog-'))
  const sessions = join(root, 'sessions')
  const day = join(sessions, '2026', '11', '10')
  mkdirSync(day, { recursive: true })
  return { sessions, day, index: join(root, 'session_index.jsonl') }
}

const name = (id: string, thread_name: string) => `${JSON.stringify({ id, thread_name })}\n`

async function listed(sessions: string, reader = catalog.reader(readRange)) {
  const out = []
  for (const found of await catalog.find(sessions)) {
    const session = await reader.read(found)
    if (session) out.push(session)
  }
  return out
}

test('a rollout no one has typed into is not listed, and is once the first message is written', async () => {
  const { sessions, day } = home()
  const file = join(day, `${ROLLOUT}.jsonl`)
  writeFileSync(file, meta)
  const reader = catalog.reader(readRange)
  expect(await listed(sessions, reader)).toEqual([])
  appendFileSync(file, typed('Hello there'))
  expect((await listed(sessions, reader)).map((s) => s.preview)).toEqual(['Hello there'])
})

test('a name appended to the index after a read is the name at the next read', async () => {
  const { sessions, day, index } = home()
  writeFileSync(join(day, `${ROLLOUT}.jsonl`), meta + typed('Hello'))
  writeFileSync(index, name(T, 'first'))
  const reader = catalog.reader(readRange)
  expect((await listed(sessions, reader))[0]?.customTitle).toBe('first')
  appendFileSync(index, name(T, 'second'))
  expect((await listed(sessions, reader))[0]?.customTitle).toBe('second')
  // An index written anew, shorter, is read from its start.
  writeFileSync(index, name(T, 'x'))
  expect((await listed(sessions, reader))[0]?.customTitle).toBe('x')
})

test('a plain rollout hides its compressed sibling', async () => {
  const { sessions, day } = home()
  writeFileSync(join(day, `${ROLLOUT}.jsonl`), meta + typed('plain'))
  writeFileSync(
    join(day, `${ROLLOUT}.jsonl.zst`),
    zstdCompressSync(Buffer.from(meta + typed('old'))),
  )
  const found = await catalog.find(sessions)
  expect(found.map((f) => f.locator)).toEqual([join(day, `${ROLLOUT}.jsonl`)])
})

test("a reverted thread's newer file is its rollout, listed under the thread's id", async () => {
  const { sessions, day } = home()
  const reverted = `${ROLLOUT}_019a6000-0000-7000-8000-0000000000ff.jsonl`
  writeFileSync(join(day, `${ROLLOUT}.jsonl`), meta + typed('before'))
  writeFileSync(join(day, reverted), meta + typed('after'))
  utimesSync(join(day, `${ROLLOUT}.jsonl`), 1, 1)
  const read = await listed(sessions)
  expect(read.map((s) => [s.id, s.preview])).toEqual([[T, 'after']])
})

test("nothing is watched before Codex's home exists, and its folders once it does", async () => {
  const root = join(mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-watch-')), '.codex')
  const sessions = join(root, 'sessions')
  expect(await catalog.watchTargets(sessions)).toEqual([])
  mkdirSync(root)
  expect(await catalog.watchTargets(sessions)).toEqual([root])
  const day = join(sessions, '2026', '11', '10')
  mkdirSync(day, { recursive: true })
  expect(await catalog.watchTargets(sessions)).toEqual([
    root,
    sessions,
    join(sessions, '2026'),
    join(sessions, '2026', '11'),
    day,
  ])
})

// A compaction shows only in the rollout: the reader counts the `compacted` lines a rollout grows
// by, never those it held when first read.
test('the compactions a rollout grows by are counted, those it held when first read are not', async () => {
  const { sessions, day } = home()
  const file = join(day, `${ROLLOUT}.jsonl`)
  writeFileSync(file, meta + typed('Hello') + line('compacted', { message: 'old' }))
  const reader = catalog.reader(readRange)
  expect((await listed(sessions, reader))[0]?.compactions).toBe(0)
  appendFileSync(file, typed('more') + line('compacted', { message: 'new' }))
  expect((await listed(sessions, reader))[0]?.compactions).toBe(1)
  expect((await listed(sessions, reader))[0]?.compactions).toBe(1)
  appendFileSync(file, line('compacted', { message: 'again' }) + typed('after'))
  expect((await listed(sessions, reader))[0]?.compactions).toBe(2)
})
