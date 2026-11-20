// Writes Codex's fixture home (`home/.codex`) and the notify arguments (`notify/`): invented
// conversations in the shapes codex-cli 0.169.0 writes, never copied from a real home.
// Run it from the repository's root, then format what it wrote as the tree is:
//   node tests/data/agents/codex/make.mjs && npx biome format --write tests/data/agents/codex/notify
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { zstdCompressSync } from 'node:zlib'

const here = import.meta.dirname
const codex = join(here, 'home', '.codex')

// UUIDv7 ids, as Codex gives its threads, turns and items.
const A = '019a4f2c-1e00-7a11-8a01-00000000000a' // paginated, named twice, compacted
const B = '019a5400-2b00-7b22-8b02-00000000000b' // legacy events, unnamed
const C = '0199fe10-3c00-7c33-8c03-00000000000c' // older than 7 days: compressed
const D = '019a4f30-4d00-7d44-8d04-00000000000d' // a subagent of A
const TITLE = '019a4f2c-1d00-7e55-8e05-0000000000ee' // the title thread: notifies, no rollout

const line = (timestamp, type, payload) => JSON.stringify({ timestamp, type, payload })
const usage = (input, cached, output, reasoning) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
})
const meta = (id, at, cwd, extra = {}) =>
  line(at, 'session_meta', {
    session_id: id,
    id,
    timestamp: at,
    cwd,
    originator: 'codex-tui',
    cli_version: '0.169.0',
    source: 'cli',
    thread_source: 'user',
    model_provider: 'openai',
    base_instructions: { text: 'You are a coding agent.' },
    history_mode: 'paginated',
    git: {
      commit_hash: '4b825dc',
      branch: 'main',
      repository_url: 'https://example.invalid/demo.git',
    },
    ...extra,
  })

// One paginated turn: its context, start, the user's and the agent's items, tokens and end.
function turn(thread, turnId, at, cwd, text, reply, tokens) {
  const ms = Date.parse(at)
  const startedS = ms / 1000
  return [
    line(at, 'turn_context', {
      turn_id: turnId,
      cwd,
      approval_policy: 'on-request',
      model: 'gpt-6.1-sol',
      effort: 'low',
    }),
    line(at, 'event_msg', {
      type: 'task_started',
      turn_id: turnId,
      started_at: startedS,
      model_context_window: 258400,
      collaboration_mode_kind: 'default',
    }),
    line(at, 'event_msg', {
      type: 'item_completed',
      thread_id: thread,
      turn_id: turnId,
      item: {
        type: 'UserMessage',
        id: `${turnId.slice(0, -2)}u1`,
        client_id: `${turnId.slice(0, -2)}c1`,
        content: [{ type: 'text', text, text_elements: [] }],
      },
      completed_at_ms: ms,
    }),
    line(new Date(ms + 2000).toISOString(), 'event_msg', {
      type: 'item_completed',
      thread_id: thread,
      turn_id: turnId,
      item: {
        type: 'AgentMessage',
        id: `msg_${turnId.slice(-4)}`,
        content: [{ type: 'Text', text: reply }],
      },
      completed_at_ms: ms + 2000,
    }),
    line(new Date(ms + 2100).toISOString(), 'event_msg', {
      type: 'token_count',
      info: {
        total_token_usage: tokens.total,
        last_token_usage: tokens.last,
        last_usage_includes_reasoning: true,
        model_context_window: 258400,
      },
      rate_limits: null,
    }),
    line(new Date(ms + 2200).toISOString(), 'event_msg', {
      type: 'task_complete',
      turn_id: turnId,
      root_turn_id: turnId,
      last_agent_message: reply,
      started_at: startedS,
      completed_at: startedS + 2,
      duration_ms: 2200,
      time_to_first_token_ms: 700,
    }),
  ]
}

const seconds = (iso) => Date.parse(iso) / 1000
const jsonl = (lines) => `${lines.join('\n')}\n`

rmSync(join(here, 'home'), { recursive: true, force: true })
rmSync(join(here, 'notify'), { recursive: true, force: true })

const files = {}

// A: two turns in /home/demo/api, a compaction between them. Its file name is local time (UTC-3).
const a1 = usage(14786, 11904, 52, 12)
const a2 = usage(9120, 8000, 31, 0)
const aTotal = usage(14786 + 9120, 11904 + 8000, 52 + 31, 12)
files[`sessions/2026/11/02/rollout-2026-11-02T09-15-00-${A}.jsonl`] = jsonl([
  meta(A, '2026-11-02T12:15:00.000Z', '/home/demo/api'),
  ...turn(
    A,
    '019a4f2c-1e10-7000-8000-0000000000a1',
    '2026-11-02T12:15:04.000Z',
    '/home/demo/api',
    'List the API routes',
    'There are three routes: /health, /items and /items/:id.',
    { last: a1, total: a1 },
  ),
  line('2026-11-02T12:40:00.000Z', 'compacted', {
    message: 'The user asked for the API routes; there are three.',
    replacement_history: [],
    window_number: 1,
    first_window_id: 'w-a-1',
    previous_window_id: 'w-a-1',
    window_id: 'w-a-2',
  }),
  ...turn(
    A,
    '019a4f2c-1e20-7000-8000-0000000000a2',
    '2026-11-02T12:41:00.000Z',
    '/home/demo/api',
    'Add a test for /health',
    'Added a test for /health in tests/health.test.ts.',
    { last: a2, total: aTotal },
  ),
])

// B: an older thread with legacy events, in /home/demo/web.
files[`sessions/2026/11/03/rollout-2026-11-03T18-02-10-${B}.jsonl`] = jsonl([
  meta(B, '2026-11-03T21:02:10.000Z', '/home/demo/web', { history_mode: 'legacy' }),
  line('2026-11-03T21:02:12.000Z', 'turn_context', {
    turn_id: '019a5400-2b10-7000-8000-0000000000b1',
    cwd: '/home/demo/web',
    approval_policy: 'on-request',
    model: 'gpt-6.1-sol',
    effort: 'medium',
  }),
  line('2026-11-03T21:02:12.000Z', 'event_msg', {
    type: 'task_started',
    turn_id: '019a5400-2b10-7000-8000-0000000000b1',
    started_at: seconds('2026-11-03T21:02:12.000Z'),
    model_context_window: 258400,
    collaboration_mode_kind: 'default',
  }),
  line('2026-11-03T21:02:12.000Z', 'event_msg', {
    type: 'user_message',
    message: 'Why is the header blue?',
    local_images: [],
    text_elements: [],
  }),
  line('2026-11-03T21:02:15.000Z', 'event_msg', {
    type: 'agent_message',
    message: 'The header takes --accent from theme.css.',
    phase: null,
    memory_citation: null,
  }),
  line('2026-11-03T21:02:15.100Z', 'event_msg', {
    type: 'token_count',
    info: null,
    rate_limits: null,
  }),
  line('2026-11-03T21:02:15.200Z', 'event_msg', {
    type: 'task_complete',
    turn_id: '019a5400-2b10-7000-8000-0000000000b1',
    root_turn_id: '019a5400-2b10-7000-8000-0000000000b1',
    last_agent_message: 'The header takes --accent from theme.css.',
    started_at: seconds('2026-11-03T21:02:12.000Z'),
    completed_at: seconds('2026-11-03T21:02:15.000Z'),
    duration_ms: 3200,
    time_to_first_token_ms: 900,
  }),
])

// D: a subagent A started; the list leaves it out.
files[`sessions/2026/11/02/rollout-2026-11-02T09-20-00-${D}.jsonl`] = jsonl([
  meta(D, '2026-11-02T12:20:00.000Z', '/home/demo/api', {
    source: 'subagent',
    thread_source: 'subagent',
    parent_thread_id: A,
    agent_nickname: 'scout',
    agent_role: 'explorer',
  }),
  ...turn(
    D,
    '019a4f30-4d10-7000-8000-0000000000d1',
    '2026-11-02T12:20:01.000Z',
    '/home/demo/api',
    'Find the route table',
    'src/routes.ts',
    { last: usage(3000, 0, 8, 0), total: usage(3000, 0, 8, 0) },
  ),
])

const cText = jsonl([
  meta(C, '2026-10-20T14:00:00.000Z', '/home/demo/api'),
  ...turn(
    C,
    '0199fe10-3c10-7000-8000-0000000000c1',
    '2026-10-20T14:00:03.000Z',
    '/home/demo/api',
    'Write notes on the release',
    'Notes written to NOTES.md.',
    { last: usage(5000, 0, 20, 0), total: usage(5000, 0, 20, 0) },
  ),
])
files[`sessions/2026/10/20/rollout-2026-10-20T11-00-00-${C}.jsonl.zst`] = zstdCompressSync(
  Buffer.from(cText),
)

// Names: append-only, the last line for an id wins.
files['session_index.jsonl'] = jsonl([
  JSON.stringify({
    id: C,
    thread_name: 'release-notes',
    updated_at: '2026-10-20T14:05:00.120000000Z',
  }),
  JSON.stringify({
    id: A,
    thread_name: 'List the API routes',
    updated_at: '2026-11-02T12:15:09.004211873Z',
  }),
  JSON.stringify({
    id: A,
    thread_name: 'api-routes',
    updated_at: '2026-11-02T12:16:30.500000000Z',
  }),
])

for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(codex, path)), { recursive: true })
  writeFileSync(join(codex, path), content)
}

// state_5.sqlite: the two tables a thread list reads, in WAL as Codex keeps it (its writer closed).
const db = new DatabaseSync(join(codex, 'state_5.sqlite'))
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE threads (
 id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 source TEXT NOT NULL, model_provider TEXT NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL,
 sandbox_policy TEXT NOT NULL, approval_mode TEXT NOT NULL, tokens_used INTEGER NOT NULL DEFAULT 0,
 has_user_event INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, archived_at INTEGER,
 git_sha TEXT, git_branch TEXT, git_origin_url TEXT, cli_version TEXT NOT NULL DEFAULT '',
 first_user_message TEXT NOT NULL DEFAULT '', agent_nickname TEXT, agent_role TEXT,
 memory_mode TEXT NOT NULL DEFAULT 'enabled', model TEXT, reasoning_effort TEXT, agent_path TEXT,
 created_at_ms INTEGER, updated_at_ms INTEGER, thread_source TEXT, preview TEXT NOT NULL DEFAULT '',
 recency_at INTEGER NOT NULL DEFAULT 0, recency_at_ms INTEGER NOT NULL DEFAULT 0,
 history_mode TEXT NOT NULL DEFAULT 'legacy', name TEXT, is_pinned INTEGER NOT NULL DEFAULT 0,
 thread_section_id TEXT, section_position INTEGER, section_entered_at_ms INTEGER, project_id TEXT,
 originator TEXT, daybreak_enabled BOOLEAN, creator_user_id TEXT, creator_account_id TEXT,
 attached_thread_parent_id TEXT);
CREATE TABLE thread_spawn_edges (parent_thread_id TEXT NOT NULL, child_thread_id TEXT NOT NULL PRIMARY KEY, status TEXT NOT NULL);`)
const insert =
  db.prepare(`INSERT INTO threads (id, rollout_path, created_at, updated_at, source, model_provider, cwd, title,
 sandbox_policy, approval_mode, tokens_used, has_user_event, cli_version, first_user_message, model, reasoning_effort,
 created_at_ms, updated_at_ms, thread_source, history_mode, name, originator) VALUES (?, ?, ?, ?, ?, 'openai', ?, ?,
 'workspace-write', 'on-request', ?, 1, '0.169.0', ?, 'gpt-6.1-sol', ?, ?, ?, ?, ?, ?, 'codex-tui')`)
const rows = [
  [
    A,
    '2026/11/02/rollout-2026-11-02T09-15-00',
    seconds('2026-11-02T12:15:00.000Z'),
    seconds('2026-11-02T12:41:02.000Z'),
    'cli',
    '/home/demo/api',
    'List the API routes',
    24089,
    'List the API routes',
    'low',
    'user',
    'paginated',
    'api-routes',
  ],
  [
    B,
    '2026/11/03/rollout-2026-11-03T18-02-10',
    seconds('2026-11-03T21:02:10.000Z'),
    seconds('2026-11-03T21:02:15.000Z'),
    'cli',
    '/home/demo/web',
    'Why is the header blue?',
    0,
    'Why is the header blue?',
    'medium',
    'user',
    'legacy',
    null,
  ],
  [
    C,
    '2026/10/20/rollout-2026-10-20T11-00-00',
    seconds('2026-10-20T14:00:00.000Z'),
    seconds('2026-10-20T14:00:05.000Z'),
    'cli',
    '/home/demo/api',
    'Write notes on the release',
    5020,
    'Write notes on the release',
    'low',
    'user',
    'paginated',
    'release-notes',
  ],
  [
    D,
    '2026/11/02/rollout-2026-11-02T09-20-00',
    seconds('2026-11-02T12:20:00.000Z'),
    seconds('2026-11-02T12:20:03.000Z'),
    'subagent',
    '/home/demo/api',
    'Find the route table',
    3008,
    'Find the route table',
    'low',
    'subagent',
    'paginated',
    null,
  ],
]
for (const [
  id,
  stem,
  created,
  updated,
  source,
  cwd,
  title,
  tokens,
  first,
  effort,
  threadSource,
  mode,
  name,
] of rows) {
  const suffix = id === C ? '.jsonl.zst' : '.jsonl'
  insert.run(
    id,
    `/home/demo/.codex/sessions/${stem}-${id}${suffix}`,
    created,
    updated,
    source,
    cwd,
    title,
    tokens,
    first,
    effort,
    created * 1000,
    updated * 1000,
    threadSource,
    mode,
    name,
  )
}
db.prepare("INSERT INTO thread_spawn_edges VALUES (?, ?, 'completed')").run(A, D)
db.close()

// What Codex hands `notify` as its one argument: A's second turn, and the title thread's turn
// that fires first on a new thread and has no rollout.
mkdirSync(join(here, 'notify'), { recursive: true })
writeFileSync(
  join(here, 'notify', 'turn.json'),
  `${JSON.stringify(
    {
      type: 'agent-turn-complete',
      'thread-id': A,
      'turn-id': '019a4f2c-1e20-7000-8000-0000000000a2',
      cwd: '/home/demo/api',
      client: 'codex-tui',
      'input-messages': ['List the API routes', 'Add a test for /health'],
      'last-assistant-message': 'Added a test for /health in tests/health.test.ts.',
    },
    null,
    2,
  )}\n`,
)
writeFileSync(
  join(here, 'notify', 'title.json'),
  `${JSON.stringify(
    {
      type: 'agent-turn-complete',
      'thread-id': TITLE,
      'turn-id': '019a4f2c-1d10-7000-8000-0000000000e1',
      cwd: '/home/demo/api',
      client: 'codex-tui',
      'input-messages': ['List the API routes'],
      'last-assistant-message': 'API routes',
    },
    null,
    2,
  )}\n`,
)
