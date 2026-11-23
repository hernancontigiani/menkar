// Writes OpenCode's fixture database in two of its three states: invented sessions in the shapes
// opencode v2.3.0 writes (`opencode`, measured 2026-11-21), never copied from a real database.
// - `home/.local/share/opencode/opencode.db`: no writer. OpenCode's server checkpoints and removes
//   both sidecars when it stops cleanly, so the database is left alone.
// - `killed/.local/share/opencode/opencode.db`, `-wal` and `-shm`: a writer killed with SIGKILL.
//   OpenCode keeps both sidecars while its server lives and a kill leaves both; the last writes
//   (a third turn of the first session, and its rename) are only in the `-wal`.
// The third state, a live writer, is a process: a test opens one over a copy of `home`.
// Run it from the repository's root: node tests/data/agents/opencode/make.mjs
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const here = import.meta.dirname
const folder = (state) => join(here, state, '.local', 'share', 'opencode')
const home = folder('home')
const killed = folder('killed')
for (const dir of [home, killed]) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}

const PROJECT = '5b1e0c9a7d3f4e2b8a6c1d0e9f8a7b6c5d4e3f2a'
const DIR = '/home/demo/shop'
const S1 = 'ses_fx01aaaaaaaaaaCheckoutFix' // two turns, a tool step, a team entry; a third in the -wal
const S2 = 'ses_fx02bbbbbbbbbbQueueSteer0' // a steered and a queued message in one execution
const S3 = 'ses_fx03ccccccccccSubagent000' // a subagent of S1
const S4 = 'ses_fx04ddddddddddArchived000' // archived
const S5 = 'ses_fx05eeeeeeeeeeInterrupted' // its turn interrupted; a message still in its inbox

const T = Date.UTC(2026, 10, 18, 14, 0, 0)
const at = (minutes, ms = 0) => T + minutes * 60_000 + ms
let n = 0
const msgId = () => {
  n += 1
  return `msg_fx${String(n).padStart(4, '0')}Zz9Yy8Xx7Ww6Vv5`
}
const snapshot = { start: '1'.repeat(40), end: '2'.repeat(40), files: [] }
const tokens = (input, output, read = 0) => ({
  input,
  output,
  reasoning: 0,
  cache: { read, write: 0 },
})

const user = (created, text) => ({ type: 'user', created, data: { time: { created }, text } })
const step = (created, ms, content, finish, used, cost = 0) => ({
  type: 'assistant',
  created,
  data: {
    time: {
      created,
      firstToken: created + 300,
      streamed: created + ms - 50,
      completed: created + ms,
    },
    agent: 'build',
    model: { id: 'sonnet-demo', providerID: 'demo' },
    content,
    snapshot,
    finish,
    rawFinish: finish,
    cost,
    tokens: used,
  },
})
const reply = (created, ms, text, used, cost) =>
  step(created, ms, [{ type: 'text', text }], 'stop', used, cost)
const tool = (created, ms, id, name, input, output, used, cost) =>
  step(
    created,
    ms,
    [
      {
        type: 'tool',
        id,
        name,
        executed: true,
        state: {
          status: 'completed',
          input,
          content: [{ type: 'text', text: output }],
          metadata: {},
        },
      },
    ],
    'tool-calls',
    used,
    cost,
  )
const idle = (created, outcome) => ({ type: 'idle', created, data: { time: { created }, outcome } })

function create(path) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode=WAL')
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'))
  return db
}

function session(db, s) {
  db.prepare(
    `INSERT INTO session_v2 (id, project_id, parent_id, slug, directory, path, title, version, cost,
       tokens_input, tokens_output, tokens_cache_read, time_created, time_updated, time_busy,
       time_idle, time_viewed, idle_outcome, time_archived)
     VALUES (?, ?, ?, ?, ?, '', ?, '2.3.0', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    s.id,
    PROJECT,
    s.parent ?? null,
    s.slug,
    DIR,
    s.title,
    s.cost,
    s.input,
    s.output,
    s.read,
    s.created,
    s.updated,
    s.busy,
    s.idle,
    s.idle,
    s.outcome,
    s.archived ?? null,
  )
}

function messages(db, id, rows, firstSeq) {
  let seq = firstSeq
  for (const row of rows) {
    seq += 3
    db.prepare('INSERT INTO session_message VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      msgId(),
      id,
      row.type,
      seq,
      row.created,
      row.data.time.completed ?? row.created,
      JSON.stringify(row.data),
    )
  }
  return seq
}

// The sessions' totals are the sums of their steps: a reader may take either.
function totals(rows) {
  const steps = rows.filter((r) => r.type === 'assistant').map((r) => r.data)
  const sum = (f) => steps.reduce((a, s) => a + f(s), 0)
  return {
    cost: sum((s) => s.cost),
    input: sum((s) => s.tokens.input),
    output: sum((s) => s.tokens.output),
    read: sum((s) => s.tokens.cache.read),
  }
}

const s1 = [
  user(at(0), 'Why does checkout fail on an empty cart?'),
  tool(
    at(0, 500),
    2000,
    'call_fx1',
    'read',
    { filePath: `${DIR}/src/checkout.ts` },
    'export function checkout(cart) { return cart.items[0].price }',
    tokens(4200, 60, 3000),
    0.0141,
  ),
  reply(
    at(0, 2600),
    3000,
    'It reads the first item without checking that the cart has one.',
    tokens(4400, 40, 4200),
    0.0039,
  ),
  idle(at(0, 5700), 'succeeded'),
  user(at(3), 'Add a test for it'),
  tool(
    at(3, 400),
    1500,
    'call_fx2',
    'shell',
    { command: 'npm test', description: 'Run the tests' },
    '1 passed',
    tokens(4600, 80, 4400),
    0.0028,
  ),
  reply(
    at(3, 2000),
    2500,
    'Added tests/checkout.test.ts; it passes.',
    tokens(4700, 30, 4600),
    0.0021,
  ),
  idle(at(3, 4600), 'succeeded'),
]
// A steered message reaches the model in the same execution, after the tool's result; a queued one
// runs after that step ends; one idle closes all three.
const s2 = [
  user(at(10), 'Rename the cart module'),
  tool(
    at(10, 300),
    3500,
    'call_fx3',
    'shell',
    { command: 'git mv src/cart.ts src/basket.ts', description: 'Rename the module' },
    '',
    tokens(4800, 70),
    0.0049,
  ),
  user(at(10, 2000), 'Keep the old name as an alias'),
  reply(
    at(10, 3900),
    5000,
    'Renamed it to basket, with cart kept as an alias.',
    tokens(5000, 90, 4800),
    0.0027,
  ),
  user(at(10, 6000), '[Menkar] a queued note from set'),
  reply(at(10, 9600), 1200, 'Noted.', tokens(5200, 5, 5000), 0.0011),
  idle(at(10, 10900), 'succeeded'),
]
const s3 = [
  user(at(1), 'Find every caller of checkout()'),
  reply(at(1, 300), 1500, 'Two callers: src/cart.ts and src/api.ts.', tokens(1800, 20), 0.0012),
  idle(at(1, 1900), 'succeeded'),
]
const s4 = [
  user(at(-2880), 'Set up the project'),
  reply(at(-2880, 400), 2000, 'Done.', tokens(1500, 4), 0.0009),
  idle(at(-2880, 2500), 'succeeded'),
]
const s5 = [user(at(20), 'Refactor the whole payment flow'), idle(at(20, 8000), 'interrupted')]

const sessions = [
  { id: S1, slug: 'brave-otter', title: 'checkout-fix', rows: s1 },
  { id: S2, slug: 'calm-heron', title: 'Rename the cart module', rows: s2 },
  { id: S3, slug: 'quick-lynx', title: 'explore checkout', rows: s3, parent: S1 },
  { id: S4, slug: 'old-maple', title: 'project setup', rows: s4, archived: at(-1440) },
  { id: S5, slug: 'loud-finch', title: 'payment refactor', rows: s5 },
]

const db = create(join(home, 'opencode.db'))
db.prepare(
  `INSERT INTO project (id, worktree, vcs, name, time_created, time_updated, sandboxes)
   VALUES (?, ?, 'git', NULL, ?, ?, '[]')`,
).run(PROJECT, DIR, at(-2880), at(20))
for (const s of sessions) {
  const first = s.rows[0].created
  const last = s.rows.at(-1)
  session(db, {
    ...s,
    ...totals(s.rows),
    created: first - 200,
    updated: last.created,
    busy: first,
    idle: last.created,
    outcome: last.data.outcome,
  })
  messages(db, s.id, s.rows, 0)
}
db.prepare('INSERT INTO instruction_entry VALUES (?, ?, ?, 0, ?, ?)').run(
  S1,
  'menkar.team',
  'You are `demo-worker`, a session of the Menkar project "shop".',
  at(0) - 100,
  at(0) - 100,
)
db.prepare('INSERT INTO session_inbox VALUES (?, ?, ?, ?, ?, ?, ?)').run(
  msgId(),
  S5,
  'user',
  JSON.stringify({ text: '[Menkar] waiting for the next turn' }),
  'queue',
  40,
  at(20, 9000),
)
db.close()

// The killed writer: the same database, then a third turn of S1 and its rename written with the
// checkpoint held back, and the three files copied while the writer still holds them.
copyFileSync(join(home, 'opencode.db'), join(killed, 'opencode.db'))
const writer = new DatabaseSync(join(killed, 'opencode.db'))
writer.exec('PRAGMA wal_autocheckpoint=0')
const third = [
  user(at(30), 'Now handle a cart with only free items'),
  reply(at(30, 400), 2200, 'Free items now total zero.', tokens(4900, 25, 4700), 0.002),
  idle(at(30, 2700), 'succeeded'),
]
messages(writer, S1, third, 300)
writer
  .prepare(
    "UPDATE session_v2 SET title = 'checkout-fix, with tests', time_updated = ?, time_busy = ?, time_idle = ? WHERE id = ?",
  )
  .run(at(30, 2700), at(30), at(30, 2700), S1)
const scratch = join(here, 'killed', '.copy')
mkdirSync(scratch, { recursive: true })
for (const name of ['opencode.db', 'opencode.db-wal', 'opencode.db-shm'])
  copyFileSync(join(killed, name), join(scratch, name))
writer.close()
for (const name of ['opencode.db', 'opencode.db-wal', 'opencode.db-shm'])
  copyFileSync(join(scratch, name), join(killed, name))
rmSync(scratch, { recursive: true })
