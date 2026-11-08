# History of `docs/spec/usage.md`

## Where the numbers come from

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
Claude Code's transcripts under `~/.claude/projects/`, **read only**, past sessions included,
through two of Menkar's files:

- **the cache**, `$XDG_CACHE_HOME/menkar/usage.sqlite`: derived data. Each transcript is read from
  where the last pass stopped, and responses are deduplicated there. Its schema carries a version;
  on any mismatch the cache is **dropped and rebuilt** from the transcripts.
- **the history**, `$XDG_DATA_HOME/menkar/history.sqlite`: permanent, **the only thing reports
  read**. One row per turn, never pruned. It keeps what Claude Code deletes with its transcripts.

Only Claude Code transcripts count: `~/.claude/projects/*/*.jsonl` (the session is the file's name
without `.jsonl`) and `~/.claude/projects/*/*/subagents/*.jsonl` (a subagent's transcript, which
**counts for its parent**: the session is the name of the directory two levels up). Cursor sessions
have no usage.

## The turn

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
- A **turn opens** at a `user` entry carrying a string `turnOrigin` — who started it: `human`,
  `peer` (another session), `task_notification` (a background task finished), `system`, `sdk`. The
  value is kept as written; any other string is kept as its own origin.
- **Transcripts written before Claude Code wrote `turnOrigin`** (Claude Code 2.1.27x and earlier):
  until a file shows its first `turnOrigin`, a `user` entry that is **not a tool result** (no
  `toolUseResult` and no `tool_result` content block), **not `isMeta`** and **not `isSidechain`**
  opens a turn whose origin is **`unknown`**. A slash command's echo counts as a prompt there: an
  overcount of turn starts, never of time. Once a file has shown one `turnOrigin`, only
  `turnOrigin` entries open turns in it, for the rest of that file.
- A turn's id is its opening entry's `uuid` (`none:<sessionId>:<timestamp>` when it has none); it
  **opened** at that entry's `timestamp`.
- **An entry whose `timestamp` is missing or does not parse is ignored** for turns and time.
- **A response belongs to the latest turn of its session opened at or before it** (ties broken by
  turn id). This also files subagent responses, whose transcripts open no turn. Responses before
  the session's first turn go to a turn `pre:<session id>` with origin `unknown`, opened at the
  first such response: tokens, no time.

## Execution and blocked time

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
Menkar's own definition (other tools have none):

- **Execution** of a turn runs from its opening entry to Claude's last activity before the next
  turn: the **sum of the gaps between consecutive agent activities** — assistant responses and
  tool results — starting from the opening entry. A long tool counts whole.
- **A gap over 2 hours (7,200 s) is idle**, not execution (a session left hanging and resumed the
  next day). A gap of exactly 7,200 s counts. The longest real tool measured ran 2 h 1 m.
- Other entries (meta entries, notes, commands, a `user` entry without `turnOrigin` in a marked
  file) are not activities: they neither add time nor move "last activity".
- **Blocked** is apart: from a tool call (the `tool_use` block's assistant entry) to its result
  when **the human decided it** — the result entry carries `permissionDecision` whose `source`
  starts with `user` — or when **the tool asks the human** (`AskUserQuestion`), however long it
  took (no 2-hour rule). That stretch is blocked, not execution; the result becomes the last
  activity. When one result entry holds several results, the first that qualifies makes the
  blocked span and the entry adds no execution.
- **Subagents add no time of their own**: a turn waiting for them already holds their time; when
  they finish in the background after Claude answered, their completion opens a
  `task_notification` turn that counts like any other. Their tokens do count, for the parent.
- Time is **stored as spans** (start, end) and clipped to the period when reported: a day is two
  **local** midnights, so a turn across midnight splits there. Execution spans of a turn that touch
  (one ends where the next starts) are stored merged.
- Execution is reported **by origin** (who started the turn); blocked is one figure.

## Tokens and deduplication

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
- Every `assistant` entry with a `message` object holding a string `id` and a `usage` object counts,
  **except** `isApiErrorMessage: true` and model `<synthetic>`. Responses with only cache tokens
  count.
- Fields: `input_tokens`, `output_tokens`, `cache_creation_input_tokens` (cache write),
  `cache_creation.ephemeral_1h_input_tokens` (the part of the cache write held for an hour, priced
  higher), `cache_read_input_tokens`. A missing or non-integer value counts 0. **Total tokens** =
  input + output + cache write + cache read (the 1-hour part is inside cache write).
- **Deduplicated by (message id, request id) across all files**: a response is written once per
  content block and copied into resumed and forked transcripts — without this the totals are 2–3×
  too high. Rules:
  - a missing or empty `requestId` becomes `none:<session id>`, plus `:<timestamp>` when the
    message id does not start with `msg_` (ids from the API are unique; others need their time);
  - of two copies with the same key, the **non-sidechain** one wins; between two of the same kind,
    the one with the **larger total** wins; an equal or smaller one is dropped;
  - a **sidechain** copy of a message id the main thread already has (under another request id) is
    dropped; a main-thread copy arriving later removes such sidechain copies.
- Tokens are kept **per model and UTC hour** in the history (the hour floor of the response's time).

## Cost

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
- **An estimate at list price**, from the price table (Data contracts), each response priced at
  the rate in force on its date. 5-minute cache writes (cache write − the 1-hour part) and 1-hour
  cache writes are priced apart.
- A model the table does not know adds nothing and marks the figure with `+`.
- **The exact cost**: when the statusline reported a session's cost (`usage.jsonl`,
  `context.md`), that figure **replaces the estimate** for that session in that period. The
  statusline's `cost_usd` is a running total per session that `/clear` resets: each line adds
  `cost − previous` when it did not drop, and `cost` itself when it dropped (a new stretch from 0);
  the first line of a session adds its whole `cost`. The running total is followed through every
  line in the file; only lines whose `at` falls in the period are summed. The exact amount goes to
  the project (and, with categories, the category) of the session's turn in effect at that line's
  time — the session's first turn when the line is earlier than all its turns. It replaces the
  estimate only for a (project, session, category) that has history rows in the period.
- Shown as `~$0.68` (estimate), `$0.68` (exact: every session under the row reported), with a `+`
  appended when some model had no price (`~$0.68+`).
- On a subscription it is not a bill: the footer says so; the 5-hour and 7-day limits, when the
  statusline reported them, are shown beside it.

## Names and projects

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
- **A session's label**: in the window, the name Menkar shows for the session (Claude's name, or
  the one set in the app for an unnamed session — `sessions.md`); else Claude's name kept in the
  history; else the first 8 characters of its id. In the terminal (`menkar usage`): the history's
  name, else the 8 characters.
- **Claude's name in the history**: a `custom-title` entry's `customTitle` (given, `-n` /
  `/rename`) wins over an `ai-title` entry's `aiTitle` (generated); among names of the same kind
  the latest read wins. Blank names are ignored.
- **A turn's project is the one it had when it happened, unless it had none**: a turn is filed
  under its session's project when it is first written and keeps it, so moving a session from X to
  Y leaves its past in X and the session shows under both, each with its own turns. A turn written
  with no project takes the project its session joins later, even when its transcript is gone.
- **A project's label**: its current name while it exists; else the name it last had (the name
  stored on its most recently opened turn); else its id. Turns with no project go under
  **"(no project)"**.
- Projects come from Menkar's projects (`projects.md`); `menkar usage` reads `projects.json` read
  only.

## The usage history file (F39)

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
**Opening it.** Every opening — the app's passes, the window's reports, `menkar usage` — does:

1. Open the file (created if missing) with a **30-second busy timeout**, so the app and
   `menkar usage` running at once wait for each other.
2. Run SQLite's `PRAGMA quick_check`. An error on open, on the check, or a result other than `ok`
   → the file is **unreadable**: it is renamed `history.sqlite.broken-<YYYYMMDD-HHMMSS>` (local
   time) beside it — `…-2`, `-3` … appended when that name exists — a warning is logged with the
   new path, and a new empty history is started. **It is never deleted.**
3. Read `PRAGMA user_version`. **Above the version this Menkar knows** → the file is from a newer
   Menkar: it is **not modified at all** (closed at once), a warning is logged with the path, and
   the history is "too new": reports show only "Usage history is from a newer version of Menkar",
   and passes write nothing (the cache keeps their turns pending, below).
4. Version 0 (a new file) → the current schema is created and the version set, in one transaction.
5. **An older version is migrated in place**, one transaction per version step, its rows kept
   (agent-tablet's one step: version 1 → 2 added `category` (null) and `category_tries` (0) to
   `turns`).

All writes are transactions. For this file SQLite's transaction is the atomic write that "JSON
written whole through a temporary file" is for the app's other state.

**Writing it (after each pass).**

- The pass reads what each transcript gained into the cache. Every (session, turn) the pass may
  have changed is recorded as **pending in the cache, in the same transaction as the new read
  offsets**: a turn it opened or added time to, **the turn before it in its session** (a turn read
  later takes responses from it), and the turn in effect for every copy of every response it read
  (before and after deduplication); plus each session it read from (for its name).
- Then each pending turn is **copied whole** from the cache into the history in one transaction:
  its rows in `turns`, `spans` and `tokens` deleted and inserted again. Kept from the old row: its
  project when it had one, its `category` and `category_tries`. A turn the cache no longer has
  (Claude Code deleted its transcript) is **never touched**, so the history keeps what the
  transcripts lose, and two passes write what one does.
- In the same transaction: every turn of a session that now has a project and whose `project_id`
  is null takes that project; every turn's `project_name` is updated to its project's current name;
  Claude's names are copied for the sessions read (a given name never replaced by a generated one).
- **Only after the commit** are those turns removed from pending. **A failed write loses
  nothing**: the history locked past the timeout, a full disk, or a too-new history leaves them
  pending for the next pass; writing a turn twice is the same as once.

**The cache's reading rules.** Per transcript it keeps the inode, the byte offset read up to, and
the turn being read (its id, origin, last activity time, tool calls awaiting their result, whether
the file has shown `turnOrigin`), so the next pass resumes mid-turn. Only complete lines are read
(a last line without its newline waits). A line that is not JSON, or not an object, is skipped. A
file whose inode changed or that is now shorter than the offset is **read again from 0**, its old
turns and spans dropped first. A file unchanged in size is not opened.

## The passes

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
- **On start and every hour** (3,600 s) the app runs a pass in the background: the history keeps
  what Claude Code deletes with its transcripts only if they are read before that, not only when
  Usage is opened. The memberships passed are each session's current project (id, name) and each
  project's current name.
- **One pass at a time**: a request while a pass runs waits for that pass to end instead of
  starting a second (both would read the same appended bytes).
- **Opening or refreshing the Usage window** runs a pass first (the same one-at-a-time runner),
  then reads the history.
- With "Classify turns" on, the classifier runs after the hourly pass (`classifier.md`).
- A pass that fails (a SQLite or file error) is logged as a warning ("usage pass failed") and shows
  nothing; the next pass retries.
- Measured on agent-tablet's human's machine (2026-11-07): the first pass ~30 s, later ones under
  half a second.

## Periods

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
All bounds are local midnights, built from the calendar date (never by adding 24 h, which is an
hour off across a daylight-saving change); a period is [start, end).

| Period | Start | End | By-day bucket |
|---|---|---|---|
| Today | today 00:00 | tomorrow 00:00 | hour |
| 7 days | 00:00 six days before today | tomorrow 00:00 | day |
| 30 days | 00:00 twenty-nine days before today | tomorrow 00:00 | day |
| Month (YYYY-MM) | the 1st, 00:00 | the 1st of the next month, 00:00 | day |
| All | the 1st of the month of the first turn the history holds, 00:00 (today 00:00 when empty) | tomorrow 00:00 | month |

`--from A --to B` is [A 00:00, (B + 1 day) 00:00): `--to` is included.

**Buckets** cut [start, end) into local hours (each 3,600 s from start; the last one clipped to
end), days, or months (the last clipped to end). Each bucket is a full report on its own bounds,
so **a bar and a total cannot disagree**. Spans are clipped to a bucket exactly; tokens fall in a
bucket by their UTC hour (a day boundary splits tokens exactly in a whole-hour zone; in a half-hour
zone a day is off by up to half an hour of tokens).

## The report

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
For [start, end), from the history only:

- Time: every span overlapping the period, clipped; execution summed per origin, blocked apart.
- Tokens: every (model, hour) row whose hour is in [start, end), priced at that hour's date.
- Grouped per (project, session) — or (project, session, category) with categories.
- **Order**: projects by label, case-insensitive, "(no project)" last; sessions within a project
  (or category) by execution, largest first, then by label case-insensitive; categories in their
  fixed order, "(unclassified)" last.
- A project's (or category's) figures are the sums of its children; its cost is exact only when
  every child's is; "all priced" only when every child's is.
- **Limits**: the 5-hour and 7-day percentages of the **last** line of `usage.jsonl` that has both
  as numbers — whatever the period.
- A report from a too-new history holds nothing and says so.

## `menkar usage` (F41)

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
`menkar usage [--period today|7d|30d|all | --month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD] [--by hour|day|month] [--json]`

The usage report in the terminal, no window. It first runs a pass (the same rules as the app's; it
waits up to 30 s for the history if the app is writing it), then prints.

| Flag | Meaning |
|---|---|
| `--period today\|7d\|30d\|all` | the period; **default `7d`** |
| `--month YYYY-MM` | that calendar month |
| `--from YYYY-MM-DD` / `--to YYYY-MM-DD` | from the first day to the last, **included**; must come together |
| `--by hour\|day\|month` | one report per bucket of the period, instead of one total |
| `--json` | JSON instead of text |

- `--period`, `--month` and `--from` are mutually exclusive (a usage error, exit 2). `--from`
  without `--to`, or `--to` without `--from` (also with `--month` or `--period`) → usage error
  `--from and --to go together`, exit 2. A malformed date, month or choice → usage error, exit 2.
- Memberships and project names come from Menkar's `projects.json`, read only (missing or invalid
  → none). Categories come in **only with `--json`, and only while "Classify turns" is on** (read
  from `state.json`'s `classify_since` setting, read only).
- **The pass fails** (SQLite or file error): stderr gets `"Could not read the latest transcripts
  into the usage history; showing it as it was."` and the report is built from the history as it
  is. **The history cannot be opened either**: stderr `"Could not open the usage history."`, exit 1.
- **Text** (one report): a header line, then one line per node, depth-first, two spaces of indent
  per level; then, when limits exist, an empty line and `subscription: 5-hour {five}%, 7-day
  {seven}%`; then `~ = list-price estimate; + = a model without a price`. Columns: the label padded
  (and cut) to 44 characters, then `exec` (7 wide), `blocked` (8), `tokens` (8), `cost` (9), each
  right-aligned, separated by one space; the header has 44 blank characters then those four titles
  in the same widths. A too-new history prints only `Usage history is from a newer version of
  Menkar`.
- **Text with `--by`**: for each bucket that has nodes (or when the history is too new), an empty
  line, `== YYYY-MM-DD HH:MM – YYYY-MM-DD HH:MM` (start and end, local, an en dash), then that
  bucket's report as above. Empty buckets print nothing.
- **`--json`** (one report): one object, pretty-printed with 2-space indentation:

```json
{
  "start": "2026-11-02T00:00:00-03:00",
  "end": "2026-11-09T00:00:00-03:00",
  "nodes": [
    {
      "label": "Client work",
      "kind": "project",
      "execution_seconds": {"human": 8100.0, "peer": 1620.0},
      "blocked_seconds": 0.0,
      "tokens": {"input": 1200, "output": 51000, "cache_write": 90000, "cache_write_1h": 0, "cache_read": 314000},
      "cost_usd": 0.68,
      "cost_exact": false,
      "all_priced": true,
      "children": [ … ]
    }
  ],
  "limits": [41.0, 12.0],
  "history_too_new": false
}
```

  Each node: `label`, `kind` (`project` | `category` | `session`), **`category` only on category
  nodes** (one of the seven, or null for "(unclassified)", whose `label` is `(unclassified)`),
  `execution_seconds` (an object by origin), `blocked_seconds`, `tokens` (the five counts),
  `cost_usd`, `cost_exact`, `all_priced`, `children` (empty for a session). `limits` is
  `[five_hour, seven_day]` or null. A too-new history gives `nodes: []` and
  `history_too_new: true`, exit 0.
- **`--by` with `--json`**: a JSON array of such report objects, one per bucket, empty ones
  included.
- Exit 0 on any printed report.

## First start: importing agent-tablet's usage history (F14, Menkar decision 1.8)

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
On its first start Menkar copies agent-tablet's usage history into its own, **reading
agent-tablet's file only**, so the months agent-tablet recorded — including turns whose transcripts
Claude Code has since deleted — show in Menkar from the first day.

- **Source**: `$XDG_DATA_HOME/agent-tablet/history.sqlite` (`~/.local/share/agent-tablet/history.sqlite`
  by default).
- **When**: the first time Menkar opens its history and **no file exists at Menkar's history path**.
  An existing Menkar history — even an empty one, a too-new one, or one about to be moved aside as
  unreadable — means it is not the first start: **nothing is imported**. So the second start
  imports nothing, and a Menkar history moved aside as unreadable is replaced by an empty one, not
  by a second import.
- **Before the first pass**: the import completes before Menkar's first pass writes anything, so
  that pass rewrites the imported turns that still have transcripts keeping their imported project
  and category (the history's write rules above).
- **Read only**: agent-tablet's file is opened with SQLite's read-only mode; nothing is written to
  it or created beside it (no journal, no lock file left), its bytes and modification time are the
  same afterwards. agent-tablet may be running: the read waits up to the 30-second busy timeout for
  its writes.
- **Accepted versions**: agent-tablet's `PRAGMA user_version` **1** or **2**, after its
  `PRAGMA quick_check` returns `ok`.
- **What is copied**, row for row, values unchanged:
  - `turns`: `uuid`, `session_id`, `origin`, `opened`, `project_id`, `project_name`, `category`,
    `category_tries` (from a version-1 file, which has no category columns: `category` null,
    `category_tries` 0);
  - `spans`: every row (`uuid`, `kind`, `start`, `end`);
  - `tokens`: every row (`uuid`, `model`, `hour`, the five counts);
  - `names`: every row (`session_id`, `name`, `claude`).
  Project ids are kept as agent-tablet's, matching the projects imported from agent-tablet's
  `projects.json` (`projects.md`), so imported turns fall under the imported projects.
- **Not copied**: agent-tablet's cache (`usage.sqlite`, rebuilt by Menkar from the transcripts),
  and agent-tablet's `usage.jsonl` (decision 1.8 names only the history): imported turns therefore
  show the list-price estimate (`~`), not the statusline's exact cost, and limits appear once
  Menkar's own statusline reports them.
- **Atomic**: Menkar's history is built in a temporary file beside its final path (its schema, then
  the copied rows, in one transaction) and renamed into place only once committed. Any failure
  (agent-tablet's file vanishing mid-read, a full disk) leaves **no** Menkar history file, logs a
  warning with both paths, and the next start tries again.
- **Cases where nothing is imported** (Menkar starts with an empty history; agent-tablet's file is
  untouched in every case):

  | agent-tablet's file | Result |
  |---|---|
  | missing | nothing imported, nothing logged beyond an info line, nothing shown |
  | unreadable (open error, or `quick_check` not `ok`) | nothing imported, warning logged with the path; **not** moved aside (it is not Menkar's) |
  | `user_version` 0 (no tables) | nothing imported |
  | `user_version` above 2 (a newer agent-tablet) | nothing imported, warning logged with the path and version |

  In none of these cases is a message shown to the user; usage starts from what the transcripts
  still hold. (No user-visible string is attached to the import: agent-tablet has none for it.)

## Transcript fields read (`~/.claude/projects/**.jsonl`, never written)

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
| Field | Entry | Meaning |
|---|---|---|
| `type` | all | `user`, `assistant`, `custom-title`, `ai-title`, … |
| `timestamp` | all | ISO 8601; unparseable → the entry is ignored for time (a response's tokens then date from 1970-01-01 UTC) |
| `uuid` | `user` | the turn's id when it opens one |
| `sessionId` | `user` | used only in a fallback turn id |
| `turnOrigin` | `user` | who started the turn; its presence opens a turn |
| `isMeta`, `isSidechain` | `user` | excluded from opening an `unknown` turn |
| `toolUseResult` / `message.content[].type == "tool_result"` with `tool_use_id` | `user` | a tool result: an agent activity |
| `permissionDecision.source` | `user` (tool result) | starts with `user` → the human decided: blocked |
| `message.content[].type == "tool_use"`, `.id`, `.name` | `assistant` | a tool call; `AskUserQuestion` asks the human |
| `message.id`, `requestId`, `message.model`, `isSidechain`, `isApiErrorMessage` | `assistant` | dedup key and filters |
| `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}`, `message.usage.cache_creation.ephemeral_1h_input_tokens` | `assistant` | tokens |
| `customTitle` | `custom-title` | Claude's given name |
| `aiTitle` | `ai-title` | Claude's generated name |

## The history — `$XDG_DATA_HOME/menkar/history.sqlite`

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
The same tables and columns as agent-tablet's (version 2), so the import is a copy. Times are Unix
seconds (REAL). Menkar's `user_version` numbering is its own; the import recognises agent-tablet's
versions 1 and 2.

| Table | Columns | Key / indexes |
|---|---|---|
| `turns` | `uuid` TEXT, `session_id` TEXT, `origin` TEXT, `opened` REAL, `project_id` TEXT null, `project_name` TEXT null, `category` TEXT null, `category_tries` INTEGER default 0 | PK `uuid`; index (`session_id`, `opened`); index `project_id` |
| `spans` | `uuid` TEXT, `kind` TEXT (`execution` \| `blocked`), `start` REAL, `end` REAL | index `uuid`; index (`start`, `end`) |
| `tokens` | `uuid` TEXT, `model` TEXT, `hour` REAL (UTC hour start), `input`, `output`, `cache_write`, `cache_write_1h`, `cache_read` INTEGER | PK (`uuid`, `model`, `hour`); index `hour` |
| `names` | `session_id` TEXT, `name` TEXT, `claude` INTEGER (1 given, 0 generated) | PK `session_id` |

A `pre:<session>` turn has origin `unknown` and no spans. Writers of `category` / `category_tries`
other than the import: `classifier.md`.

## The cache — `$XDG_CACHE_HOME/menkar/usage.sqlite`

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
Derived; its layout is Menkar's choice. It must hold: per transcript path the inode, the offset
read up to and the in-progress turn state; the deduplicated responses (key, session, sidechain,
time, model, the five counts); Claude's names per session; the turns read (id, file, session,
origin, opened, the byte offset of the opening line — `classifier.md` reads the prompt there); the
spans; the pending (session, turn) set. A schema version that differs → dropped and rebuilt.

## The price table

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
USD per million tokens, copied from <https://platform.claude.com/docs/en/about-claude/pricing> on
**2026-11-06**. Every row below is in force from 2000-01-01 (no known start). A price change is a
new row with the day it took effect; each response is priced at the row in force on its UTC date
(the latest row whose start is on or before it; a date before every row uses the first).

| Model | Input | Cache write 5 m | Cache write 1 h | Cache read | Output |
|---|---|---|---|---|---|
| `claude-fable-5-1` | 10 | 12.50 | 20 | 0.25 | 50 |
| `claude-mythos-5-1` | 10 | 12.50 | 20 | 0.25 | 50 |
| `claude-fable-5` | 10 | 12.50 | 20 | 1 | 50 |
| `claude-mythos-5` | 10 | 12.50 | 20 | 1 | 50 |
| `claude-opus-5-5` | 4 | 5 | 8 | 0.20 | 20 |
| `claude-opus-5` | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-8` | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-7` | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-6` | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-5` | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-1` | 15 | 18.75 | 30 | 1.50 | 75 |
| `claude-opus-4` | 15 | 18.75 | 30 | 1.50 | 75 |
| `claude-sonnet-5-5` | 2 | 2.50 | 4 | 0.10 | 10 |
| `claude-sonnet-5` | 2 | 2.50 | 4 | 0.20 | 10 |
| `claude-sonnet-4-6` | 3 | 3.75 | 6 | 0.30 | 15 |
| `claude-sonnet-4-5` | 3 | 3.75 | 6 | 0.30 | 15 |
| `claude-sonnet-4` | 3 | 3.75 | 6 | 0.30 | 15 |
| `claude-haiku-5-5` | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 |
| `claude-haiku-5-5`, prompt over 100,000 tokens | 0.50 | 0.625 | 1 | 0.05 | 2.50 |
| `claude-haiku-4-5` | 1 | 1.25 | 2 | 0.10 | 5 |

- **Model id normalisation**: a `[1m]` suffix is removed (the 1M-token window is priced at the
  standard rate), then a trailing `-YYYYMMDD` date (`claude-sonnet-4-5-20250929` →
  `claude-sonnet-4-5`). Anything not in the table is unpriced.
- **Haiku 5.5's long prompt**: when input + cache read + cache write exceeds 100,000, the second row
  applies. *Note:* the table's own text says this is per request, but agent-tablet applies it to
  what it prices at once — the sum of a (model, UTC hour, project, session) group in the history —
  so a busy hour of short Haiku 5.5 requests is priced at the long rate. The history keeps no
  per-request tokens, so per-request pricing would need them stored.
- Cost = (input × in + output × out + (cache write − 1 h part, never below 0) × write 5 m +
  1 h part × write 1 h + cache read × read) / 1,000,000.
- US-only inference (1.1×) is not applied: the transcript does not say where a request ran.

## Memberships

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
A pass receives each session's current project (id, name) — every member of every project — and
each project's current name (`projects.md`). `menkar usage` builds them from `projects.json`:
`projects[]` with string `id`, string `name`, and `members[]` of session ids; anything else is
skipped.

## Paths and environment

> Left on 2026-11-08: built by plan 06, described in `docs/usage.md`.
| What | Path |
|---|---|
| Transcripts (read) | `~/.claude/projects/` |
| Cache | `$XDG_CACHE_HOME/menkar/usage.sqlite` (default `~/.cache`) |
| History | `$XDG_DATA_HOME/menkar/history.sqlite` (default `~/.local/share`) |
| Moved-aside history | `$XDG_DATA_HOME/menkar/history.sqlite.broken-YYYYMMDD-HHMMSS[-N]` |
| Statusline log (read) | `$XDG_CACHE_HOME/menkar/usage.jsonl` |
| Projects, settings (CLI, read) | `$XDG_CONFIG_HOME/menkar/projects.json`, `state.json` |
| agent-tablet's history (import, read only) | `$XDG_DATA_HOME/agent-tablet/history.sqlite` |

`TZ` decides local midnights. Time is read only through the clock module.

## Acceptance cases

> Left on 2026-11-08: built by plan 06; the Vitest tests carry these ids.

**Turns and time** (times are local, TZ = America/Argentina/Buenos_Aires unless said)

- **USG-1** A transcript: user `turnOrigin: "human"` at 10:00:00; assistant at 10:00:05; tool result
  at 10:00:20; assistant at 10:00:30 → one turn, origin human, execution 30 s, blocked 0.
- **USG-2** Same, but the next assistant entry comes at 12:00:31 (2 h 0 m 1 s after the last
  activity) → that gap adds nothing; execution stays 30 s. A gap of exactly 2 h 00 m 00 s adds
  7,200 s.
- **USG-3** Assistant `tool_use` id `t1` at 10:01:00; tool result for `t1` at 10:06:00 with
  `permissionDecision: {"source": "userTemporary"}` → 5 min blocked; the gap is not execution;
  the next activity's gap starts at 10:06:00.
- **USG-4** `tool_use` named `AskUserQuestion` at 10:00, its result at 13:30 → 3 h 30 m blocked
  (no 2-hour rule).
- **USG-5** A tool result with `permissionDecision.source: "config"` → its gap is execution, not
  blocked.
- **USG-6** A file with no `turnOrigin` anywhere: user prompt at 09:00 (not meta, not sidechain,
  not a result) → a turn with origin `unknown`. A `user` entry with `isMeta: true` there opens
  nothing.
- **USG-7** A file whose first `turnOrigin` appears on line 50: before it, plain prompts open
  `unknown` turns; after it, a plain `user` entry without `turnOrigin` opens nothing and adds no
  time.
- **USG-8** A turn running 23:30–00:30 → "Today" (the second day) shows 30 m; the first day shows
  30 m; "7 days" shows 1 h.
- **USG-9** Under TZ with a DST change, a "Today" on the change day has 23 or 25 hourly buckets and
  its end is the next local midnight, not start + 24 h.
- **USG-10** A user entry with `turnOrigin: "peer"` and no `uuid`, sessionId `s1`, timestamp
  `T` → a turn with id `none:s1:T`, origin peer.
- **USG-11** An entry with `"timestamp": "yesterday"` → it opens no turn and adds no span.

**Tokens**

- **USG-12** The same assistant response (`msg_1`, `req_1`) appears 3 times (one per content block)
  with output 10, 40, 40 → counted once, output 40.
- **USG-13** `msg_1`/`req_1` in a session's transcript and again in a resumed copy → counted once.
- **USG-14** A sidechain copy of `msg_1` under `req_9` when the main thread has `msg_1`/`req_1` →
  only the main copy counts; if the sidechain copy was read first, reading the main copy removes it.
- **USG-15** `model: "<synthetic>"` or `isApiErrorMessage: true` → no tokens. A response with input 0,
  output 0, cache read 5,000 → counted.
- **USG-16** `subagents/agent-x.jsonl` under session dir `abc` → its tokens count for session `abc`
  and fall to `abc`'s turn in effect at their time; they add no time.
- **USG-17** A response at 09:59 when the session's first turn opens at 10:00 → it goes to turn
  `pre:<session>` with origin `unknown` and no spans.
- **USG-18** Two responses with no `requestId` and message ids `local-1` at different times in one
  session → both counted (keys `none:<s>:<t1>` and `none:<s>:<t2>`).

**Cost**

- **USG-19** `claude-opus-5-5`, input 1,000,000, output 100,000 → $4 + $2 = $6.00, shown `~$6.00`.
- **USG-20** `claude-sonnet-4-5-20250929[1m]` prices as `claude-sonnet-4-5`.
- **USG-21** Cache write 1,000,000 of which 1-hour 400,000 on `claude-opus-4-5` → 600,000 × 6.25 +
  400,000 × 10 = $7.75.
- **USG-22** A model `claude-unknown-9` → cost adds 0, the session's and project's cost shows `+`
  (`~$0.00+`); the CLI marks it the same.
- **USG-23** `claude-haiku-5-5` group with input 60,000 + cache read 50,000 → the long-prompt row
  (0.50 / 0.05) applies.
- **USG-24** `usage.jsonl` for session `s1`: cost 1.00 at 10:00, 1.50 at 11:00, 0.20 at 12:00
  (after `/clear`), 0.70 at 13:00 → exact cost 1.00 + 0.50 + 0.20 + 0.50 = $2.20 for a period
  covering all four; a period covering only 12:00–14:00 → $0.70; shown `$2.20` (no `~`).
- **USG-25** A project with two sessions, one exact and one estimated → the project's cost shows `~`.

**Projects and names**

- **USG-26** Session `s1` in project X writes turns; then moved to Y and works more → X shows `s1`
  with its earlier turns, Y shows `s1` with the later ones.
- **USG-27** Turns written while `s1` had no project; later `s1` joins X → after the next pass all
  of them are under X, even turns whose transcript was deleted.
- **USG-28** Project X renamed to "Client work" → its turns show under "Client work" after the next
  pass (and at once in the window, which uses current names). Project X deleted → its turns show
  under the last name stored.
- **USG-29** A transcript with `ai-title` "Fix login" then `custom-title` "auth" then `ai-title`
  "Login fix" → the session's history name is "auth".
- **USG-30** A session with no name in the app or the history, id `0f3c9a12-…` → label `0f3c9a12`.

**History file**

- **USG-31** A transcript deleted after a pass → its turns stay in the history with their time and
  tokens; the next pass does not touch them.
- **USG-32** A pass runs while the history is locked longer than 30 s → the pass fails and logs; the
  turns stay pending in the cache; the next pass writes them; totals equal those of an unlocked run.
- **USG-33** A history with `user_version` 99 → it is not modified (same bytes and modification
  time); the window shows "Usage history is from a newer version of Menkar"; `menkar usage` prints
  that line; `--json` gives `nodes: []`, `history_too_new: true`; passes keep turns pending.
- **USG-34** A history file of random bytes → renamed `history.sqlite.broken-20261108-141500` (at
  that local time), a warning logged with that path, a new empty history created; with that name
  taken, `…-141500-2`.
- **USG-35** A Menkar history at an older version of Menkar's own schema → migrated in place, one
  transaction per version step, every row kept; the window and the CLI then read it normally.
- **USG-36** Running a pass twice over unchanged transcripts → every report gives the same totals;
  a transcript truncated and rewritten (new inode) → read from 0, no turn counted twice.
- **USG-37** A transcript whose last line has no newline yet → that line is not read; after the line
  is completed, the next pass reads it once.
- **USG-38** The app's hourly pass and the Usage window's refresh are requested at the same moment →
  one pass runs; the second request waits for it and does not start another.

**Categories in usage**

- **USG-39** Classification off → Totals is project → session; no Project/Category switch in By day;
  the hint line is shown; `menkar usage --json` has no category nodes.
- **USG-40** On; session `s1` turns: human (build) 10:00, peer 10:30, human (unclassified) 11:00,
  task_notification 11:20 → build: the 10:00 and 10:30 turns; Unclassified: the 11:00 and 11:20
  turns.
- **USG-41** On; a session whose only turns are `unknown`, one of them with category `plan` in the
  history → all its time shows under "Unclassified" (the code's behaviour; see the contradiction
  note).
- **USG-42** On; categories present: test, build and unclassified → Totals under a project lists
  Build, Test, Unclassified in that order; the Category stack's legend the same.
- **USG-43** On; `menkar usage` (text) → project → session, no category lines; `--json` → project →
  category → session, the unclassified node with `"category": null`, `"label": "(unclassified)"`.

**CLI**

- **USG-55** `menkar usage` → the 7-day text report, exit 0.
- **USG-56** `menkar usage --from 2026-11-01 --to 2026-11-03` → [Nov 1 00:00, Nov 4 00:00).
- **USG-57** `menkar usage --from 2026-11-01` → `--from and --to go together`, exit 2;
  `menkar usage --period today --month 2026-10` → usage error, exit 2.
- **USG-58** `menkar usage --period today --by hour --json` → a JSON array of 24 reports (23/25 on a
  DST day), empty ones included; without `--json`, only hours with data, each headed
  `== 2026-11-08 09:00 – 2026-11-08 10:00`.
- **USG-59** A node label of 60 characters → cut to 44 in the text report; a depth-2 label starts
  with four spaces.
- **USG-60** The history directory is not writable and no history exists → stderr "Could not read
  the latest transcripts into the usage history; showing it as it was." then "Could not open the
  usage history.", exit 1.

**Importing agent-tablet's history (first start)**

- **USG-61** No Menkar history; agent-tablet's history at version 2 with 1,200 turns, 5,000 spans,
  3,100 token rows, 80 names → Menkar's history has exactly those rows, values equal, including
  `project_id`, `project_name`, `category`, `category_tries`; agent-tablet's file has the same
  SHA-256 and modification time as before, and no `-journal`, `-wal` or `-shm` file was created
  beside it.
- **USG-62** Agent-tablet's history at version 1 → turns copied with `category` null and
  `category_tries` 0; spans, tokens and names copied.
- **USG-63** Second start (Menkar's history exists) with agent-tablet's history now holding more
  turns → nothing is imported; Menkar's turn count is unchanged.
- **USG-64** agent-tablet's history missing → Menkar starts with an empty history; no message shown;
  no file created under `~/.local/share/agent-tablet/`.
- **USG-65** agent-tablet's history is random bytes → nothing imported, a warning with its path
  logged, the file left in place with the same bytes (not renamed).
- **USG-66** agent-tablet's history at `user_version` 3 → nothing imported, a warning with the path
  and version logged, the file untouched.
- **USG-67** The import fails half-way (simulated write error) → no `history.sqlite` exists in
  Menkar's data directory; the next start imports again and succeeds.
- **USG-68** After an import, Menkar's first pass reads a transcript of an imported turn whose
  project in agent-tablet was X, while the session is now in no Menkar project → the rewritten turn
  keeps project X and its category.
- **USG-69** Menkar's history exists but is unreadable at the second start → it is moved aside, a new
  empty history is created, and agent-tablet's history is **not** imported again.
