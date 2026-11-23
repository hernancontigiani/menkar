# 47 — Pane state events: how many sessions are blocked and working, now and per 15 minutes

> **Status:** written, 2026-11-21, by `menkar-t190` (task 190); revised the same day on
> `menkar-t195`'s review (its findings 1–16, folded in). Not executed. Nine decisions, **D1–D9 (§6), decided as recommended
> (1.207, the human, 2026-11-23)** change details of blocks 1–5, not the shape; the blocks are written with the
> recommended options, and each D-item names the lines a different answer changes.
>
> **Comes from:** decision 1.204 (b) (the human, 2026-11-21, topic 91): a new activity event for
> each change of a pane's shown state, with no content; `menkar usage now --json` carries the
> counts of sessions blocked and working at that moment; `menkar usage export` rebuilds them per
> 15-minute window; global counts; new fields under the schemas' add-only rule; (c), phone or
> Remote Control versus desk, is not done. The consumer is cogload; its orchestrator, `cog-orch`,
> chose the 15-minute rows' shape (§2.7).
>
> **Exit when executed:**
> - What the user runs → `README.md`, "Usage in the terminal": one example line for
>   `--rows panes` and one sentence (block 6); and the public site's
>   `site/src/content/docs/usage/cli.md` and `site/src/content/docs/es/usage/cli.md`: one sentence
>   on `--rows panes` beside `--rows activity` and `--rows tasks` (lines 39–40), and the two counts
>   in what `now --json` prints (lines 47–50). Text only, no capture changes.
> - What is recorded, where it is stored, how the counts are read, the 15-minute rows, what was
>   rejected and why, the measured rate and cost (dated, as "Its cost" is), and the limits →
>   `docs/usage.md` (block 6): rows `pane_state` and `watch` in "What is recorded"; a new subsection
>   "Panes' states and Menkar's watch" under "The human's activity and the task flow"; one bullet in
>   "Where each event is seen"; the two new fields in `now`'s table; a new subsection "Pane rows"
>   under "Exporting for analysis". Three recorded lines change there and their old text goes
>   verbatim to `docs/history/usage.md` in the same change: "Where it is stored"'s "In the usage
>   history, since version 4, tables `activity` and `task_states`" (now version 6 and four tables),
>   its "quitting needs no flush" (a quit now writes one line) and its last sentence on `newer-*`
>   batches (now read again by the Menkar that can).
> - One line in `docs/agent-state.md`, "The shape", under `src/main/agentstate.ts`: its shown
>   changes also feed the activity journal (block 6).
> - The USG ids of the new tests → `docs/spec/usage.md`, "`menkar usage` (F41)" (block 6).
> - Deferred, with their triggers → `docs/NOT_BUILT_YET.md` (block 6): the raw pane rows in the
>   export; per-project counts; chat tabs' states; folding old pane rows (D8); and, per D6, a
>   measurement of the real rate on the human's data.
> - `plans/00-STATUS.md`: plan 47's row in §3 (`set`); 1.204's "Where it lives" becomes
>   `docs/usage.md` for (b) (`set`, at closing); D1–D9 take rows of their own when the human answers.
> - The rest (the measurement's raw numbers beyond what `docs/usage.md` keeps, the block order) →
>   `git log`.
>
> **Replaces or modifies:** no plan. It amends three lines of `docs/usage.md` (above); no decision.

---

## 1. Goal, and what already exists

**Goal.** Menkar journals each change of every agent pane's shown state, with no content, so that
`menkar usage now --json` says how many sessions are blocked and how many are working at that
moment, and `menkar usage export --rows panes` gives, for each 15-minute window, how long and at
most how many at once sessions were in each state, over the part of the window Menkar was watching.
**A count never sticks**: a pane closed without saying so, an app that crashed or quit, a machine
that slept, all end the states they held, by rules a test asserts.

**What exists, verified in the tree at `main` 219d4c6 on 2026-11-21** (re-checked by the review
at 7b579e7):

- **One place sees every shown change, for every agent.** `setState` in `src/main/agentstate.ts`
  (176–183) calls each `onShownChange` listener with `(paneId, sessionId, previous, next)`; the
  activity journal already listens there for `prompt_answered` (`shownChanged`,
  `src/main/activity.ts`). Each agent's rules are its kit's `state.detect`
  (`src/core/agentstate/detect.ts` → `kitOf(agent).state`), so the listener names no agent. On the
  branch `multi-agent` (plan 39 P2.5, c63467f) OpenCode's server-side runs reach the same place:
  `PaneWatcher.check` reads `serverRunning?()` beside the screen, and `startAgentState` subscribes
  every kit's `runs?.onChange` over `AGENT_IDS`; both end in `setState`. **This plan adds nothing
  per agent.**
- Shown states: `SHOWN_STATES = ['working', 'blocked', 'idle', 'done']`
  (`src/core/agentstate/shown.ts:6`); a tracked pane starts `idle` (`track`, `agentstate.ts`);
  `done` is idle after working while unseen, until seen (`nextShown`, `afterSeen`). A raw state is
  read 250 ms after the first change of a burst of screen changes (`CHECK_DELAY_MS`,
  `src/core/agentstate/watch.ts:7`) and only a change is reported.
- Pane ids are random, 12 hex characters (`newId`, `src/main/workspace.ts:343`), registered in one
  place (`workspace.ts:1184`) and closed only when the pty exits (`workspace.ts:1222`): a tab moved
  between windows, sent to the background or to the peek keeps its pane; a renew closes the old pane
  and registers a new one; every window shares one registry (`src/main/panes.ts:43`). A session is in
  at most one tab, and only agent panes are registered (shell splits and chat tabs have no shown
  state), so a pane is a session for counting.
- `AGENT_IDS` on `main` is `claude`, `cursor`, `codex` (`src/core/agents/ids.ts:1`); OpenCode is on
  `multi-agent`.
- The journal: `src/core/usage/activity.ts`. `JOURNAL_VERSION = 1`; `Line.v` is
  `typeof JOURNAL_VERSION`; main's `stamp` writes `v: JOURNAL_VERSION` on every line
  (`src/main/activity.ts:50-52`); `parseJournalLine` returns `'newer'` for `v > JOURNAL_VERSION` and
  `'bad'` for an unknown kind; `task_state` has its own line type and table. `importBatch` inserts
  by id (`INSERT OR IGNORE`) in one transaction, then deletes the batch, or **renames it `newer-*`
  when it held a newer line — and no code reads a `newer-*` file again** (`batchFiles` lists
  `batch-*` only). `readJournal` (for `now`) keeps activity events and drops `task_state`.
- An older Menkar meeting a newer history opens nothing: `importActivityDir` returns `null` and
  every batch stays (`history.ts:238-243`, `766-771`), and its `now` prints `history_too_new`
  (`cli.ts:470-473`).
- Main's journal writer: one promise chain (`enqueue`) for every append and rename; `rotate` after
  each usage pass and at start; `app_start` written at start after setting a left journal aside.
  `startActivity` returns a stop function called at `will-quit` (`src/main/index.ts:153`), which
  writes nothing; appends in flight at quit are not awaited.
- Quitting: a window refuses to close unless allowed (`workspace.ts:3147-3162`), so a quit can be
  cancelled after `before-quit` was emitted; `will-quit` is emitted only once every window closed.
  The reaper defers in `before-quit` (`index.ts:235-239`). Several `will-quit` handlers stop
  services (`index.ts:122-165`) and are not written to run twice. Nothing in `src/main` listens to
  `powerMonitor`.
- History: `HISTORY_VERSION = 5` (`src/core/usage/history.ts:21`); `ACTIVITY_SCHEMA` and
  `AGENT_SCHEMA` are `CREATE … IF NOT EXISTS` so two openers racing a migration are harmless
  (`MIGRATIONS[3]`, `[4]`); `taskStateRows` is the precedent for "rows in a range plus each key's
  last row before it".
- `now`: `src/core/usage/now.ts`, `NOW_SCHEMA = 1`; `runNow` reads the live journal and batches in
  place (`readJournal`), then the history, and takes `running` from `menkarAliveSync`
  (`src/core/control/files.ts:111-126`, 140: `process.kill(pid, 0)` on `alive.json`'s pid).
- Export: `runExport` imports the batches a pass set aside and never reads the live journal
  (`cli.ts:324-332`, 377); `--rows turns|activity|tasks` (`cli.ts:160-161`, 173), the period flags
  take days; each kind has its own `*_SCHEMA = 1` and its `*_KEYS` held exactly by a test.
- Tests set `process.env.TZ = 'America/Argentina/Buenos_Aires'` at the file's top; time comes from
  `src/core/clock.ts` or is passed in. The last USG id is USG-74.

## 2. The design

### 2.1 What is journaled

Two new line kinds, each with its own row type, as `task_state` has:

| Line | Fields | Written when |
|---|---|---|
| `pane_state` | `paneId`, `seq`, `state`: `working` · `blocked` · `idle` · `done` · `closed` | A pane is registered (its state then, `idle` for a new one); its shown state changes; it closes (`closed`) |
| `watch` | `sign`: `start` · `tick` · `suspend` · `quit` | `start` beside `app_start`; `tick` at every quarter hour of the clock and on resume; `suspend` when the machine suspends; `quit` at `will-quit` (§2.4) |

- **No content, no session.** A pane id, a per-process sequence number, a state, a time. Counts are
  global (1.204), and no reading needs the session (D9, recommended: no session id; a per-project
  reading is deferred and would start recording then).
- **`seq`** is a counter main keeps for the process, so two rows of one pane with the same `at`
  keep their order once stored (ids are random).
- **The open row** (the state at registration) is what lets the reading know an idle pane exists;
  the `closed` row pairs with it.
- **`done` is recorded as itself** (D1, recommended): the row mirrors the shown state with no
  mapping; it costs one row per turn whose end was unseen, when it is seen.
- **`start` is its own sign**, not `app_start`: `app_start` rows have been stored since history
  version 4, long before any pane row; read as signs they would make every past start a covered
  window with no session in it (review finding 1). Coverage reads `watch_signs` only.

### 2.2 The journal's version

`JOURNAL_VERSION` becomes 2 and **every line is written with `v: 2`** (`stamp` unchanged).
`parseJournalLine` accepts `v` 1 and 2 for every kind (a `v: 1` file left by the previous Menkar
is read as today). **`newer-*` files are read again**: `batchFiles` lists `newer-*` beside
`batch-*`, so the Menkar that can read them imports them (by id) and deletes them, or keeps them
`newer-*` (the name unchanged) while they still hold a line newer than it; `readJournal` reads them
too. `batchesWaiting` still looks for `batch-*` only, so a `newer-*` file from a future Menkar does
not start a worker every hour; it is imported whenever a worker runs, every pass in practice.

When this matters: an older Menkar meets this one's history first and opens nothing (§1), so it
sees these lines only when the history is missing or moved aside. Then it keeps every batch that
holds a `v: 2` line as `newer-*` instead of deleting it, and this Menkar, back, imports it.
Rejected: a version per kind (only the new kinds at 2) — it changes `stamp` and `Line` for that
rare case, and a `present` at the wrong version would be deleted with its batch (review findings 5,
8).

### 2.3 Volume: no hold

**What makes rows.** Per pane, from the state rules: a turn is `idle → working` at its start and
`working → done` (unseen) or `working → idle` (seen) at its end, plus `done → idle` when an unseen
end is seen; each permission card is `working → blocked → working`. A turn with `p` cards and `f`
spurious flips (working → idle → working inside it) makes **2 + d + 2p + 2f** rows, `d` being 1
when its end was unseen.

**Measured** (§2.9): `f` is **0** for Claude Code, Codex and OpenCode: the working signal, as
Menkar reads it, does not drop inside a turn, whatever the tools, hooks, subagents, compaction or
streaming. The premise that a pane flips working↔idle many times per turn does not hold on the
measured versions. Cursor was not measured. A turn makes **2 or 3 rows, plus 2 per card**.

**No hold** (D4, recommended): every shown change is one row, stamped when it happened; a change to
the state last journaled for the pane writes nothing. The watcher's 250 ms re-read is the only
debounce, as for the dots and the notifications. **The real bound** is the watcher's: at most one
change per 250 ms per pane, so a pane of a future agent version that flickered would write up to
**14,400 rows an hour** until it was seen (D6) and a hold taken (D4 (b)). The recorder lives in core
(`src/core/activity/panes.ts`, `PaneStateRecorder`): it keeps each pane's last journaled state and
turns opens, changes and closes into rows.

### 2.4 Menkar's watch: what "covered" means

A state counts only while Menkar watched. **Signs**: `start`, `tick`, `suspend`, `quit`, all in
`watch_signs`.

- **Ticks** at every quarter hour of the clock (`epoch mod 900 = 0`, local quarter hours in every
  zone, since every UTC offset in use is a multiple of 15 minutes), scheduled by main from `now()`
  each time. **On resume** (Electron's `powerMonitor` `resume`) main writes a tick at once and
  reschedules: Node's timers run on the monotonic clock, which on Linux stops while suspended, so a
  timer alone would fire up to 15 minutes after the resume (review finding 7). **On suspend**
  (`powerMonitor` `suspend`) it writes `suspend`, stamped when the event came.
- **Coverage**: a `start` or a `tick` at `s` covers `[s, min(next sign, s + 960))` — the next tick
  is due 900 s later, and **60 s of grace** absorbs a busy main thread. A `suspend` or a `quit`
  covers nothing after it. So after a crash, coverage ends at most 960 s after the last sign.
- **Pane states end with their run**: a pane's state at `t` is its last row (by `at`, then `seq`) at
  or before `t` and **at or after** the latest `start` at or before `t`; a `closed` row ends it.
  A `start` voids every earlier pane (a restored tab gets a new open row), so a crash's last
  `working` cannot survive into the next run. A `quit` or `suspend` does not void panes: it ends
  coverage, which is enough (after a quit the next `start` voids them; after a suspend the panes
  are still there on resume).
- **A quit writes its sign at `will-quit`**, when every window has closed and the quit cannot be
  cancelled any more (D7, recommended): one line appended **synchronously** to the journal there.
  Writing it at `before-quit` was wrong both ways (review finding 3): a quit cancelled by the
  window's "sessions are running" dialog would end coverage while Menkar runs on, and the real quit
  later would write nothing. Deferring `will-quit` instead (prevent, flush the chain, quit again)
  would run every other `will-quit` handler twice (`index.ts:122-165`). **This departs from
  AGENTS.md's "never block the main process"**, whose reason is that the UI must not stall: at
  `will-quit` there is no window left, and the write is one line of about 100 bytes. What
  replaces the guarantee: nothing else is written synchronously, ever; the line goes through the
  same path (`journal.jsonl`), so an append of the chain still in flight lands before or after it
  in the file or in the batch a rename just made, both read the same; and if the write fails, the
  quit reads as a crash (coverage ends ≤ 960 s later), logged once.
- **The machine's clock set back**: rows are read sorted by `at` and each sign covers to the next
  one by time; a tick earlier than the previous one only shortens a coverage. Tested. A pane's rows
  across a clock set back may be read out of order: a limit (§2.11).

### 2.5 The counts now (`menkar usage now --json`)

Two fields, **`sessions_blocked`** and **`sessions_working`** (names: D5): the number of panes whose
state at `now` (§2.4) is `blocked` / `working`. **`null` when Menkar is not running or `now` is not
covered** (D3, recommended): `null` says "not measured", which cogload must not read as a calm
moment. Coverage as well as `menkar_running` (review finding 11): a stale `alive.json` whose pid
another process took, or a frozen main process, would otherwise show a dead run's last rows; with
the resume tick (§2.4) coverage holds after a suspend too.

Read from the live journal's and batches' rows, then the history's (the files first, as `runNow`
does), merged by id in memory: the last row per pane and the set of signs are the same whether a
row is read once or twice, so no history lookup by id is needed. The history gives each pane's last
row since the latest `start` (`UsageHistory.paneStatesSince`); finding those panes scans the rows
since that `start`, which block 4 times at the worst case. Global; `now` names no pane.

### 2.6 The 15-minute rows (`menkar usage export --rows panes`)

One row per window `[w, w + 900)`, `w` a multiple of 900 s (so `:00 :15 :30 :45` local), from the
window holding the range's start, or the one holding the first `watch` sign ever recorded if later
(before recording began nothing is known: those windows are not "Menkar not running"), to the window
holding the range's end or now, whichever is first. **Every window gets a row**, covered or not.

**The export reads the live journal and the batches too**, as `now` does (review finding 2): a sign
already in the history covers 960 s past itself, into time whose pane rows may still be in the
journal, so reading the history alone would give a window covered with nothing in it. After
`importLeftActivity`, `runExport` reads the files in place (`readJournal`), then the history, and
merges by id. **The row of the window holding `now` is partial and changes** as the window goes on;
every earlier row is final once Menkar has written past it (a reader polling incrementally re-reads
the last row).

| Field | What it holds |
|---|---|
| `schema` | The row format's version: 1 |
| `window_start` / `window_start_epoch` | The window's start, local ISO with its offset / Unix seconds |
| `covered_seconds` | How much of the window Menkar watched (§2.4), 0–900 |
| `blocked_max` / `blocked_seconds` | The most panes blocked at once in the covered part / the pane-seconds spent blocked there |
| `working_max` / `working_seconds` | The same for working |
| `idle_max` / `idle_seconds` | The same for idle (D2) |
| `done_max` / `done_seconds` | The same for done (D1, D2) |

With `covered_seconds` 0 every count is `null`. `seconds / covered_seconds` is the mean number of
panes in the state. A window across a daylight-saving change is still 900 real seconds, keyed by its
epoch; the two windows labelled 02:00 in a fall-back hour have different offsets. Never in a row: a
project, a session, a pane, a name, a path. `--project` with `--rows panes` is an error (exit 2,
"Pane rows are counted over every project; --project does not apply to them."): 1.204 makes the
counts global. CSV: the same columns, `null` as an empty field.

### 2.7 Why that row shape (from `cog-orch`, 2026-11-21)

Asked for the shape it reads best, `cog-orch` chose the peak and the pane-seconds per state over a
snapshot at the window's start: its features are about how long a load was sustained, and a
snapshot misses a session blocked at :03 and answered at :12, the common case. It asked for idle
in the same shape if cheap, so cogload can decide whether a finished session sitting idle is
"waiting on the user" without a Menkar change (D2), and for one row per window always, with
`covered_seconds`: cogload reads no activity as a possible break, so "Menkar wasn't running" must
never read as "nothing was happening", and a missing row cannot be told from a truncated export.

### 2.8 Where it is stored

History version 6: `MIGRATIONS[5]` creates, `IF NOT EXISTS` (the race of two openers):

```sql
CREATE TABLE IF NOT EXISTS pane_states (
  id TEXT PRIMARY KEY, at REAL NOT NULL, seq INTEGER NOT NULL, pane_id TEXT NOT NULL,
  state TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pane_states_time ON pane_states (at);
CREATE INDEX IF NOT EXISTS pane_states_pane ON pane_states (pane_id, at);
CREATE TABLE IF NOT EXISTS watch_signs (id TEXT PRIMARY KEY, at REAL NOT NULL, sign TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS watch_signs_time ON watch_signs (at);
```

and `HISTORY_SCHEMA` includes it. `importBatch` inserts the two new kinds there. **Kept for good**
(D8, recommended), like every other row of the history; folding old rows into windows is deferred
with its trigger.

### 2.9 What was measured

**Flips inside a turn**, asked of each agent's consultant, measured 2026-11-21 in throwaway homes
with a scripted stand-in model, the pane judged by Menkar's own rule after each burst's 250 ms of
quiet (Claude Code), or sampled every 50 ms (Codex) or ~57 ms with the server's events beside
(OpenCode, branch `multi-agent`'s rule):

| Agent, version | Case | Working-signal drops inside the turn |
|---|---|---|
| Claude Code 2.1.330 | 4 Bash calls with text between, 1.5 s and 0 ms model latency | 0 (5 burst ends judged; working 9.0 s, then idle) |
| Claude Code 2.1.330 | Slow hooks (PreToolUse 2 s, PostToolUse 2 s, Stop 1.5 s) and a statusline | 0 (working 15.9 s; the hooks' waits read working) |
| Claude Code 2.1.330 | A subagent (Agent tool) | 0 (the spinner runs until the agent ends) |
| Claude Code 2.1.330 | 2 permission cards | working 0.27 s → blocked 3.9 s → working 1.1 s → blocked 4.0 s → working 1.0 s → idle: 6 changes |
| Codex 0.169.0 | Slow turn (tool runs, 3 s streamed reply), fast turn (3 tools), a compaction mid-turn | 0 at 50 ms resolution |
| Codex 0.169.0 | An approval card (title blinking `[ ! ]`/`[ . ]` every 1.0 s) | 0 while blocked: both blink titles read blocked |
| OpenCode 2.3.0 | 4 tool calls (1 s shell each) and a reply, 8.2 s; a compaction | 0 at ~57 ms (the footer busy throughout, one server execution) |
| OpenCode 2.3.0 | A subagent, one or two in parallel | 0 in Menkar: with the real server's frames the child's execution starts ~850 ms before the root's ends, and Menkar's executions hold a root as running while a child under it runs (the child's `session.created` `parentID`); the root restarts 3–5 ms after the last child ends. A gap first seen came from the stand-in server, whose child frames lacked `parentID` (fixed in plan 39 P2.6, 156978f) |

**Not measured**: Cursor (on `main`, no consultant asked); Claude Code's compaction. **Changes with
no turn**: a background shell or monitor left running keeps a Claude pane working after its turn and
gives one working → idle when it ends (2.1.329); a Codex TUI starting with a slow MCP server shows
working while it initialises (4.0 s for a server answering in 4 s; Menkar's own server answers in
47–65 ms, under the 250 ms re-read).

**The rate.** Per turn `2 + d + 2p` rows (§2.3). The stated worst case (`set`, 2026-11-21: no
measured turn volume exists, and the human's data is not read to get one): 10 panes, one turn a
minute each, every end unseen and one card per turn → 10 × 60 × 5 = **3,000 rows an hour**, below
the 5,000 journal lines at which `now`'s reading was measured unchanged (`docs/usage.md`, "Its
cost"); signs add 4 an hour. **The size** (measured 2026-11-21 in a scratchpad, SQLite 3, to be
re-measured on the final schema in block 4 and kept dated in `docs/usage.md`): 100,000 rows in
`pane_states` with its two indexes took 20.3 MB after `VACUUM`, about **200 bytes a row**, so
0.4–1 KB of history per turn; the worst case held for a 10-hour day is 30,000 rows, 6 MB. The real
figure is D6's.

### 2.10 Rejected, and why

- **A snapshot of every pane at each window's start** instead of rows per change: misses what
  happens inside a window, the common case (§2.7), and still needs the changes for `now`.
- **The counts kept in memory by the app and asked for by `now`**: a control request every minute
  was rejected for `now` already (`docs/usage.md`, "The burst in progress", rejected); and the
  export needs the history anyway.
- **Columns added to `activity`** (a pane id, a tick flag): `--rows activity` would grow kinds its
  readers never saw, and `activity` would hold rows that are not the human's; `task_state` set the
  precedent of a table per line kind.
- **`app_start` as a sign**: stored for months before any pane row (§2.1).
- **A heartbeat every minute** for finer coverage: 1,440 rows a day for a bound that matters only
  after a crash; the quarter-hour tick costs 96 and matches the windows.
- **Expiring a state after a fixed time with no tick**: a pane genuinely working for an hour would
  vanish; the tick is a sign of Menkar, not of the pane.
- **`quit` voiding every pane**: a quit already ends coverage, and the next `start` voids them; the
  pane rule only made a cancelled quit a wrong count.
- **The quit's sign at `before-quit`**, and **deferring `will-quit`**: §2.4.
- **A version per line kind**: §2.2.
- **The export from the history alone**: §2.6.
- **Counting by session id**: a pane not yet joined has none; one session is one pane.
- **A `--project` scope**: 1.204 makes the counts global.

### 2.11 Limits

- A crash overstates coverage by at most 960 s after its last sign; so does a quit whose line could
  not be written.
- A future agent version that flickers writes a row per flip, up to 14,400 an hour per pane, until
  D4 (b) is taken; D6's count is how it would be seen.
- A clock set back while panes change may order a pane's rows wrongly across the jump.
- Chat tabs are not counted (they have no shown state): a chat waiting on its permission card is
  not in `sessions_blocked`. `cog-orch` is told so with the fields' names.
- An older Menkar's `now` and export read none of this (it opens no version-6 history).
- Cursor's rate was not measured (§2.9).

## 3. Product decisions and the tests that assert them

Each test is written in its block before the code it tests; the sentence goes in its comment.
Times are local (Buenos Aires) unless a test says its zone; "A", "B" are pane ids.

| # | Decision | Test (file) | Concrete case |
|---|---|---|---|
| USG-75 | The journal reads versions 1 and 2, and a `newer-*` batch is read again | `tests/core/usage/activity.test.ts` | A `newer-*` file with a `v: 1` `present` and a `v: 2` `pane_state`: `importActivityDir` inserts 1 activity row and 1 pane row and deletes the file; run again, nothing new; a `newer-*` file also holding a `v: 3` line is imported and kept under the same name |
| USG-76 | A window's counts are the peak and pane-seconds over its covered part | `tests/core/usage/panes.test.ts` | §3.1 |
| USG-77 | A crash ends coverage 960 s after the last sign | same | `start` 09:00, ticks 09:15 … 11:00, A open `idle` 09:00, `working` 10:50, nothing after: window 11:00 → covered 900, working 900 s, max 1, idle 0 s; 11:15 → covered 60, working 60 s, max 1; 11:30 → covered 0, every count `null` |
| USG-78 | A quit ends coverage; the next `start` voids the panes | same | `start` 09:00, ticks 09:15, 09:30, 09:45, 10:00, A open `idle` 09:00, `working` 09:55, `quit` 10:07: window 10:00 → covered 420, working 420 s, max 1; 10:15 → covered 0, `null`s; `start` 10:30 with B open `idle` 10:30 → window 10:30: working 0 s, idle 900 s, max 1 (A gone) |
| USG-79 | A `start` voids every earlier pane, at or after counts | same | A `working` 11:50 (`start` 11:00, ticks to 11:45), no `quit`, `start` 12:00, B open `idle` at 12:00 exactly: window 12:00 → covered 900, working 0 s, idle 900 s, idle max 1 |
| USG-80 | `now` counts panes by state, `null` when not running or not covered | `tests/core/usage/now.test.ts` | `start` 10:00, tick 10:15, now 10:20; panes A `blocked`, B `working`, C `done`, D `idle`, E `closed`, F `working` before the `start` → `sessions_blocked` 1, `sessions_working` 1; the same with `running` false → both `null`; `running` true but the last sign at 10:00 and now 10:20 (no tick) → both `null` |
| USG-81 | Windows are 900 real seconds keyed by epoch, aligned to local quarter hours | `tests/core/usage/panes-madrid.test.ts` (`TZ` `Europe/Madrid`), `tests/core/usage/panes-kolkata.test.ts` (`TZ` `Asia/Kolkata`) | Madrid, 2026-10-25: two rows with `window_start` `…T02:00:00+02:00` and `…T02:00:00+01:00`, epochs 3,600 apart; Kolkata (+05:30): every `window_start`'s minutes in {00, 15, 30, 45} |
| USG-82 | Every shown change is one row at its moment; the open and the close are rows | `tests/core/activity/panes.test.ts` | A opened `idle` at t → (`idle`, t, seq 1); `working` t+1 → row; `working` again t+2 → nothing; `done` t+5, `idle` t+9 (seen) → two rows; closed t+10 → (`closed`, t+10); a change after the close → nothing; two changes at the same t → seq 1, 2, read back in that order |
| USG-83 | Every window gets a row, covered or not; none before recording began; old `app_start`s are not signs | `tests/core/usage/panes.test.ts` | `paneWindows` over 08:00–10:00 with an `app_start` in `activity` at 08:10 and signs `start` 09:00, `tick` 09:45 → 4 rows, 09:00 … 09:45, `covered_seconds` 900, 60, 0, 900 |
| USG-84 | Pane rows are global | `tests/core/usage/cli.test.ts` | `export --rows panes --project X` → exit 2 and the sentence; the row keys are exactly `PANE_EXPORT_KEYS` |
| USG-85 | The export reads the live journal | `tests/core/usage/cli.test.ts` | History holds `start` 10:00 and `tick` 10:00 (imported); the live journal holds A open `idle` 10:00, `blocked` 10:07; now 10:14 → window 10:00: covered 840, blocked 420 s, max 1 |
| USG-86 | A suspend ends coverage; the resume tick starts it again | `tests/core/usage/panes.test.ts` | `start` 09:00, ticks to 10:00, A `blocked` 09:58, `suspend` 10:05, `tick` 13:00 (resume), `tick` 13:15: window 10:00 → covered 300, blocked 300 s; 10:15 … 12:45 → covered 0; 13:00 → covered 900, blocked 900 s, max 1 |
| USG-87 | The quit's line is written whole and readable | `tests/core/activity/panes.test.ts` | `quitLine(at)` → one line that `parseJournalLine` reads as `watch`/`quit` at `at`, ending in `\n` |

### 3.1 USG-76's case (window 10:00–10:15, every value in it asserted)

`start` 09:00, ticks 09:15 … 10:00; pane A open `idle` 09:00, `working` 10:03, `blocked` 10:05,
`working` 10:08, `done` 10:12; pane B open `idle` 09:00, `working` 09:50, `done` 10:06.
→ `covered_seconds` 900; `blocked` 180 s, max 1; `working` 720 s (A 120 + 240, B 360), max 2
(10:03–10:05); `done` 720 s (A 180, B 540), max 2; `idle` 180 s (A 10:00–10:03), max 1. The
pane-seconds add up to 2 × 900.

## 4. Out of scope

- Phone or Remote Control versus desk (1.204 (c): not done).
- Per-project or per-session counts (global by 1.204); deferred, its trigger cogload or the human
  asking for one.
- The raw pane rows in the export: deferred, its trigger a consumer asking.
- Chat tabs' states: deferred, its trigger a chat tab getting a shown state.
- Any window, view or chart in the app; any notification.
- Telling `cog-orch` the fields' names and the chat-tab limit: `set` does it when the plan lands.

## 5. Do not touch

- The state rules, `PaneWatcher`, `nextShown`, the notifications: this plan only listens.
- Each agent's kit (`src/core/agents/*`) and on `multi-agent` OpenCode's `runs`: nothing per agent.
- `prompt_answered`'s tracking, `app_start`, `now`'s existing fields and their meaning,
  `NOW_SCHEMA`, `EXPORT_SCHEMA`, `ACTIVITY_EXPORT_SCHEMA`, `TASK_EXPORT_SCHEMA`.
- The reaper's `before-quit` handler (`src/main/index.ts:235`) and the existing `will-quit`
  handlers.
- `src/main/agentstate.ts` and `src/core/agentstate/watch.ts`, which the branch `multi-agent`
  changes (plan 39 P2.5). The only file both this plan and that branch touch is
  `src/main/index.ts` (that branch: 7 lines); block 2 adds a few lines there.
- `~/.claude` and every agent's files: nothing here reads or writes them.

## 6. Decisions for the human

**D1 — Is `done` journaled as itself?** (a) Yes, the row mirrors the shown state; +1 row per turn
whose end was unseen (recommended: no mapping, and the moment a finished turn is first seen is
attention data that cannot be rebuilt later). (b) Folded into `idle`: fewer rows, `done` lost.
*Changes:* block 2's recorder (map `done` → `idle`, dropping `done → idle`), block 5's `done_*`.

**D2 — Which states the 15-minute rows carry.** (a) blocked, working, idle and done, each `_max`
and `_seconds` (recommended: `cog-orch` asked for idle; the rows already hold all four, it costs two
columns each). (b) Only blocked and working, as 1.204 names them. *Changes:* block 5's keys.

**D3 — `now`'s counts when not measured.** (a) `null` when Menkar is not running or `now` is not
covered (recommended: cogload treats a quiet signal as a possible break). (b) `0`: true of Menkar's
sessions, but reads as calm. *Changes:* block 4, one line and USG-80's last two cases.

**D4 — A hold before a change is journaled.** (a) None: the watcher's 250 ms only (recommended:
§2.9 measured no flip inside a turn on Claude Code 2.1.330, Codex 0.169.0 and OpenCode 2.3.0, and
a hold would drop a card answered faster than it). (b) 2 s: a change is written once it held 2 s,
stamped when it began; a flicker in a future agent version leaves no rows. *Changes:* block 2's
recorder gains a timer per pane and USG-82 gains "`working` at t, `idle` at t+0.5, `working` at
t+1 → no new row".

**D5 — The names.** `now`: `sessions_blocked`, `sessions_working` (recommended; "sessions" as 1.204
words it, beside `sessions_last_30_minutes`). The export: `--rows panes` (recommended) or
`--rows load`. *Changes:* names only.

**D6 — Measuring the real rate on the human's own data**, with their consent. (a) A week after the
build is installed, `set` (with the human's go) runs one read-only count over the human's
`pane_states` (rows per hour, p50, p95 and max; no ids printed) against §2.9's worst case and the
14,400-an-hour bound (recommended: with no hold, it is the only way a flickering agent version would
be seen). (b) Not measured.

**D7 — How a quit writes its sign.** (a) One synchronous line at `will-quit`, a stated exception to
"never block the main process" (§2.4; recommended: no window is left, it is ~100 bytes, and the
alternatives are wrong or wider). (b) Defer `will-quit` until the chain has written it: every
`will-quit` handler in `index.ts` must first be made safe to run twice. (c) No quit sign: every
quit reads as a crash, up to 16 minutes of phantom states. *Changes:* block 2's quit step.

**D8 — Keeping the pane rows.** (a) For good, like the rest of the history; folding old rows into
15-minute windows deferred, its trigger the history's size noticed or D6's count above the worst
case (recommended: the real volume is unknown, and folding loses what a later reading may need).
(b) Rows older than 90 days folded into windows at each pass. *Changes:* (b) adds a block.

**D9 — A session id on each row.** (a) None (recommended: 1.204 says global, and no reading needs
it; per-project counts would start recording then). (b) Kept, as `prompt_answered` carries, so a
per-project reading later covers the past. *Changes:* one field in block 1 and §2.8.

**Not a decision, shown so it is seen:** quitting writes one line; nothing else about quitting
changes. A worker never knows the human's sessions from these rows: no session, project or name.

## 7. Execution blocks

Each block ends with `npm run ci` green, plus its own checks. No block changes the UI, so none runs
`npm run ui-check`.

### Block 1 — The journal lines and history version 6 (core)

- [ ] Tests first: USG-75; `parseJournalLine` for each new kind (a valid line, a missing `paneId`
      or `seq`, an unknown `state`, an unknown `sign`, `v: 1` and `v: 2` of an old kind both read);
      `HISTORY_VERSION` 6 opens a version-5 file and migrates it, twice in a row harmlessly (as
      `history.test.ts`'s migration-3 race test).
- [ ] `src/core/usage/activity.ts`: `JOURNAL_VERSION = 2`; `Line.v` is `1 | 2`; `PANE_STATES` (the
      four shown states and `closed`), `PaneStateEvent`, `WATCH_SIGNS`, `WatchEvent`; `JournalEvent`
      grows; the parser accepts `v` 1 and 2; `batchFiles` lists `batch-*` and `newer-*`;
      `importBatch` inserts the two kinds and renames only a `batch-*` to `newer-*`; `readJournal`
      returns `panes` and `signs` beside `events`. `quitLine(at)` for block 2 (USG-87).
- [ ] `src/core/usage/history.ts`: `PANE_SCHEMA` (§2.8), `MIGRATIONS[5]`, `HISTORY_VERSION = 6`,
      `HISTORY_SCHEMA` includes it.
- [ ] Verify: `npm run ci`; each new test seen failing once against an injected defect (e.g.
      `batchFiles` without `newer-*`), then passing.

### Block 2 — Recording in main (open and closed rows, changes, signs)

- [ ] Tests first: USG-82, USG-87; the tick schedule (`nextTick(nowMs)` → the next multiple of
      900,000 ms strictly after; at exactly 10:15:00.000 → 10:30:00.000; a clock set back gives the
      next boundary after the new time).
- [ ] `src/core/activity/panes.ts`: `PaneStateRecorder` with `opened(paneId, state, at)`,
      `changed(paneId, next, at)`, `closed(paneId, at)`, its `seq`, and a `write` callback (no
      hold, D4); `nextTick`.
- [ ] `src/main/activity.ts`: in `startActivity`, `start` written right after `app_start`; for each
      pane (existing and `onAgentPane`) an open row with `paneShown(id) ?? 'idle'`, its close a
      `closed` row; `onShownChange` also feeds the recorder; a tick timer from `now()` through
      `nextTick`; `powerMonitor` `suspend` → `suspend` sign, `resume` → a tick at once and the timer
      rescheduled; the stop function clears the timer and both listeners. `writeQuit()` appends
      `quitLine(seconds())` with `appendFileSync` to the journal's path, catching and logging a
      failure once. Lines otherwise through the same `enqueue` and `stamp`. Nothing names an agent
      (`scripts/check-code-rules.mjs` passes).
- [ ] `src/main/index.ts`: `writeQuit()` called from the existing `will-quit` handler at line 153,
      before `stopActivity()`.
- [ ] Verify: `npm run ci`. Then with Playwright on the real Electron app under `xvfb-run` (the e2e
      harness, a throwaway `XDG_*`, never the human's instance): open one agent pane with the e2e
      stand-in agent, close its tab (so its pty exits first), then quit through
      `electronApp.evaluate(({ app }) => app.quit())`; the journal (or its batch) holds `app_start`,
      `start`, an open `idle` row, a `closed` row and `quit`, in that order. Paste the lines in the
      report.

### Block 3 — The reading: coverage, a state at a moment, the windows (core)

- [ ] Tests first: USG-76, 77, 78, 79, 81, 83, 86; a clock set back (a `tick` at 10:00 after one
      at 10:15 in the file) changes no pane's state and only shortens coverage as §2.4 says.
- [ ] `src/core/usage/panes.ts`: `COVER_SECONDS = 960`, `WINDOW_SECONDS = 900`; `coverage(signs)` →
      covered intervals; `stateAt(rows, signs, t)` → panes by state; `paneWindows(rows, signs,
      bounds, nowSeconds)` → the windows of §2.6 (one sweep over the rows sorted by `at`, `seq`).
- [ ] `UsageHistory`: `paneRows(low, high)` — the rows in `[low, high)` and each pane's last row
      before `low` at or after the latest `start` before `low`; `watchSigns(low, high)` — the signs
      in `[low, high)` and the last one before `low`; `firstWatchSign()`; `paneStatesSince(t)` —
      each pane's last row at or after `t`. A merge of the files' rows and signs over the history's,
      by id.
- [ ] Verify: `npm run ci`.

### Block 4 — `now --json`'s two counts

- [ ] Tests first: USG-80; the existing `now` tests unchanged; a pane row only in the live journal
      counts, and one both in the journal and the history counts once.
- [ ] `NowReading` gains `sessions_blocked` and `sessions_working` (`number | null`); `readNow`
      takes the pane rows and signs; `runNow` reads them with `readJournal` (files first, then the
      history).
- [ ] Verify: `npm run ci`; time `readNow` in process over a history with 50,000 pane rows **after
      the latest `start`** and a journal of 3,000 pane lines (§2.9's worst hour), three runs of 60;
      write the medians before and after in the report. Re-measure the bytes per row on the final
      schema (100,000 rows, `VACUUM`). Both go to `docs/usage.md`, dated.

### Block 5 — `export --rows panes`

- [ ] Tests first: USG-84, USG-85; the JSONL and CSV of USG-76's case, whole.
- [ ] `src/core/usage/export.ts`: `PANE_EXPORT_SCHEMA = 1`, `PANE_EXPORT_KEYS`, `exportPaneRows`,
      `exportPaneCsv`. `cli.ts`: `panes` in `ROWS`; for it, the files read in place after
      `importLeftActivity` and merged over the history; the refusal with `--project`; the usage line
      and `usage.cli.exportHelp` through `t()` (English, and every catalog the i18n check requires).
- [ ] Verify: `npm run ci`; `menkar usage export --rows panes --period today` run from the built
      tree against block 2's throwaway home: rows aligned, `covered_seconds` as expected; pasted in
      the report.

### Block 6 — The documents

- [ ] `docs/usage.md`, `docs/agent-state.md`, `docs/spec/usage.md` (USG-75…87), `README.md`,
      `site/src/content/docs/usage/cli.md` and its `es/` page, `docs/NOT_BUILT_YET.md`, as the
      header's exit says; the three replaced lines verbatim to `docs/history/usage.md`.
- [ ] Verify: `npm run ci` (its history check); the site's own checks (`docs/site.md`).

## 8. Execution log

Executed 2026-11-23 by `menkar-t202` (task 202), blocks 1–6 on `main`, D1–D9 as recommended (1.207).
Every block ended with `npm run ci` green except `test integrity`, which flags 4 `expect(` lines
rewritten on purpose (`set` accepted them, listed in the report); each new test was seen red against
an injected defect.

**Deviations from the blocks, and why:**

- **Block 3's history readings are one method**, `UsageHistory.paneReading(low, high)`, not four
  (`paneRows`, `watchSigns`, `firstWatchSign`, `paneStatesSince`). It returns the range's rows and
  signs plus each pane's last row since the latest `start` before `low`, the last sign before `low`
  **and that latest `start`**: with the files' rows laid over the history's, the reading must see
  the start that voids an old journal's rows, which "the last sign before low" alone may not be.
  `firstWatchSign` had no consumer: the first window is the earliest of the signs passed, which holds
  a sign before the range whenever one exists. `now` reads `paneReading(now, MAX_VALUE)` instead of a
  `paneStatesSince`.
- **The lookup of each pane's last row is a `GROUP BY` on `max(at)`**, not a rank: the rank sorted
  every row since the start, 43 ms at block 4's worst case against 10.6 ms. Two rows of one pane
  in its last second both come back; the one with the higher `seq` is kept in code.
- **USG-84 and USG-85 are in `tests/core/usage/export.test.ts`**, beside the other `--rows` tests and
  their CLI helper, not in `cli.test.ts`.
- **`e2e/activity.spec.ts`** (not named by the plan) expected `v: 1` on journal lines in three places;
  every line is `v: 2` now, so the three values changed. Run: 3 passed.
- **Block 2's hand check** ran a temporary spec with the e2e harness (deleted after): closing the tab
  first gives `closed` before `quit`, as finding 14 said it must be arranged.

**What the plan did not anticipate:**

- A `newer-*` batch kept because it still holds a newer line is read again by every import, and its
  broken lines are counted (and logged) again each time: harmless, rare.
- `now` with the pane reading: medians 2.4–2.9 ms before, 16.0–16.5 ms after (block 4's case); a pane
  row is about 170 bytes after `VACUUM` (the plan's scratch figure was 200).
- The export rounds seconds to the millisecond (my choice; float sums otherwise leak noise).
