// OpenCode's context reading (§2.3 of the multi-agent architecture): as its own footer counts it,
// every token of the session's last step after its last finished compaction, over the model's
// limit in the catalog OpenCode keeps in its database; none when that catalog does not know it.
import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test } from 'vitest'
import { context, readingOf } from '../../../../src/core/agents/opencode/context'
import { inProcessReads, useReads } from '../../../../src/core/agents/opencode/reads'

const DATA = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'opencode')
const S1 = 'ses_fx01aaaaaaaaaaCheckoutFix'
// The last step of S1: 4,700 in, 30 out, 4,600 read from the cache.
const S1_LAST = 4700 + 30 + 4600

// OpenCode's kv table, as v2.3.0 creates it.
const KV = `CREATE TABLE \`kv\` (
  \`key\` text PRIMARY KEY,
  \`value\` text NOT NULL,
  \`time_created\` integer NOT NULL,
  \`time_updated\` integer NOT NULL
)`

let n = 0
function fixture(catalog: Record<string, unknown> | null): { db: string; writer: DatabaseSync } {
  n += 1
  const home = join(process.env.MENKAR_TEST_ROOT ?? '', `opencode-context-${n}`)
  cpSync(join(DATA, 'home'), home, { recursive: true })
  const db = join(home, '.local', 'share', 'opencode', 'opencode.db')
  const writer = new DatabaseSync(db)
  writer.exec(KV)
  if (catalog !== null)
    // The body is a JSON text of its own inside the row's JSON, as OpenCode stores it.
    writer
      .prepare('INSERT INTO kv VALUES (?, ?, 0, 0)')
      .run(
        'models-dev:v2:catalog',
        JSON.stringify({ updatedAt: 0, digest: 'x', body: JSON.stringify(catalog) }),
      )
  return { db, writer }
}

const demo = (limit: number) => ({
  demo: { models: { 'sonnet-demo': { id: 'sonnet-demo', limit: { context: limit } } } },
  'wafer.ai': { models: { 'm.1/x:free': { limit: { context: 1 } } } },
})

afterEach(() => {
  useReads(inProcessReads())
})

const read = (db: string, id = S1) => context.read(id, `${db}#${id}`)

test("the last step's tokens over the model's limit in OpenCode's catalog, in whole percent", async () => {
  useReads(inProcessReads())
  const { db, writer } = fixture(demo(200_000))
  writer.close()
  expect(await read(db)).toEqual({
    percentage: Math.round((S1_LAST / 200_000) * 100),
    window: 200_000,
    source: 'statusline',
  })
})

test('after a finished compaction only the steps after it count, and none yet reads nothing', async () => {
  useReads(inProcessReads())
  const { db, writer } = fixture(demo(10_000))
  const row = writer.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)')
  row.run('msg_c1', S1, 'compaction', 900, 1, 1, JSON.stringify({ status: 'completed' }))
  expect(await read(db)).toBeNull()
  row.run(
    'msg_c2',
    S1,
    'assistant',
    901,
    2,
    2,
    JSON.stringify({
      model: { id: 'sonnet-demo', providerID: 'demo' },
      tokens: { input: 1000, output: 200, reasoning: 300, cache: { read: 500, write: 0 } },
    }),
  )
  // An interrupted step carries no tokens: the one before it is the reading.
  row.run(
    'msg_c3',
    S1,
    'assistant',
    902,
    3,
    3,
    JSON.stringify({ model: { id: 'sonnet-demo', providerID: 'demo' }, finish: 'error' }),
  )
  writer.close()
  expect((await read(db))?.percentage).toBe(20)
})

test('no catalog in the database, a model it does not know, or a session with no step reads nothing', async () => {
  useReads(inProcessReads())
  const none = fixture(null)
  none.writer.close()
  expect(await read(none.db)).toBeNull()
  const other = fixture({ demo: { models: {} } })
  other.writer.close()
  expect(await read(other.db)).toBeNull()
  const known = fixture(demo(200_000))
  known.writer.close()
  expect(await read(known.db, 'ses_fx05eeeeeeeeeeInterrupted')).toBeNull()
  expect(await read(known.db, 'ses_unknown')).toBeNull()
})

test('with no limit there is no reading', () => {
  expect(readingOf({ tokens: 10, limit: null })).toBeNull()
  expect(readingOf(null)).toBeNull()
  expect(readingOf({ tokens: 1500, limit: 10_000 })?.percentage).toBe(15)
})

test('a provider or a model whose name holds dots, a slash, a colon or an at is found', async () => {
  useReads(inProcessReads())
  const { db, writer } = fixture({
    'wafer.ai': { models: { 'org/m.1:free@eu': { limit: { context: 50_000 } } } },
  })
  writer.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    'msg_w1',
    S1,
    'assistant',
    950,
    5,
    5,
    JSON.stringify({
      model: { id: 'org/m.1:free@eu', providerID: 'wafer.ai' },
      tokens: { input: 5000, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    }),
  )
  writer.close()
  expect(await read(db)).toEqual({ percentage: 10, window: 50_000, source: 'statusline' })
})
