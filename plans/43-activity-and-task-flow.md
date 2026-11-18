# Plan 43 — The human's activity and the task flow: record first, then the views

> **Status:** written 2026-11-18 by `menkar-t87` (task 87), **to review**; design accepted by `set`
> (2026-11-18), Q3–Q5 decided by `set` the same day. Blocks 1–3 (recording) are executable now;
> `claude-cli`'s measurement is §2.7; block 3b needs `workspace.ts` and its slot from `set`. Blocks
> 5–7 (views) wait on Q7, block 4's mock-ups and the human's placement (Q6). Q1 and Q2 decided by the
> human (topic 56), with presence marks and away periods added.
> **Comes from:** decision 1.180 (the human, 2026-11-18, topic 55, read whole), which folds in 1.156's
> task flow metrics and reads 1.164's whom-a-review-waits-on; `docs/NOT_BUILT_YET.md`, "Task flow
> metrics". **Replaces or modifies:** no plan. It removes the "Task flow metrics" entry of
> `docs/NOT_BUILT_YET.md`: block 3 rewrites it, block 7 removes it.
>
> **Exit, when executed:**
>
> | Part | Goes to |
> |---|---|
> | What is recorded, where, how it is batched, why a journal and not main writing SQLite, what was rejected (§2.1–2.4, 2.9) | `docs/usage.md`, a new section "The human's activity and the task flow" |
> | The burst: its definition, the gap with set's measurement as evidence, read-time only (§2.5) | `docs/usage.md`, same section |
> | `claude-cli`'s measurement of which `human` turns no human typed, and mid-turn messages (§2.7) | `docs/usage.md`, same section and its limits |
> | The new export rows and their key tables (§2.6), Q4 (a) | `docs/usage.md`, "Exporting for analysis" |
> | 1.180's row in `plans/00-STATUS.md` | its destination changes from "this row (until built)" to `docs/usage.md`, `docs/spec/usage.md`; its text leaves for `docs/history/plans/00-STATUS.md` per §5 there |
> | "Task flow metrics" in `docs/NOT_BUILT_YET.md` | deleted when block 7 lands, its text verbatim to `docs/history/NOT_BUILT_YET.md` (or the history file `docs/history/README.md` names) in the same change; block 3 rewrites it to "recorded since ‹date›, the view is not built" |
> | The nudge after a long burst (1.180: deferred until the human has seen the data) | `docs/NOT_BUILT_YET.md`, a new entry with its trigger, written by block 3 |
> | What the views show and where (blocks 5–7), after the human places them | `docs/spec/usage.md` (what the user sees), `docs/usage.md` (how) |
> | The rest (the code's shape) | `git log` |

## 1. Goal, and what already exists

**Goal.** Start recording, as soon as possible and with no text, each action of the human and each
task state change, so data accumulates while the views are designed. Then, from mock-ups the human
approves, show it in the Usage window: a day by the hour and a week, per project and for all, and
the task flow over 7 and 30 days.

**What exists, read from the tree on 2026-11-18:**

- **The usage history** — `<data>/history.sqlite`, `src/core/usage/history.ts`. `HISTORY_VERSION =
  3` (`:16`), schema in `HISTORY_SCHEMA` (`:19–39`), `MIGRATIONS` keyed by the version they leave
  (`:42–49`). The constructor (`:146–190`) creates, migrates, leaves a newer file untouched
  (`tooNew`, every write a no-op) and moves an unreadable one aside (`moveAside`, `:212–218`). Times
  are Unix **seconds** as REAL (`turns.opened`, `spans.start/end`).
- **Who opens it.** Only workers and the CLI: the hourly pass (`src/main/usage-worker.ts` →
  `runPass`, `src/core/usage/pass.ts`), the classifier (`src/main/classifier-worker.ts`), the
  queries (`src/main/usage-query-worker.ts`), `menkar usage` (`src/core/usage/cli.ts:323,329,400,406`).
  `src/core/db.ts:5–6`: node:sqlite is synchronous and is never opened on main's thread. Writers
  share it through the 30 s busy timeout and `BEGIN IMMEDIATE` (`db.ts:21`).
- **The human's messages** are already there: a turn of `origin = 'human'` with its `opened`
  (`history.ts:19–22`, `transcript.ts:166–169`). They reach the history with the pass (start and
  hourly, and before every Usage window report, `src/main/usage.ts:113`). **Only Claude's
  transcripts** feed it (`pass.ts:13`, `agentPaths().claudeProjects`), from every Claude session on
  the machine, started by Menkar or not. Cursor's turns are not there until plan 39 P1a.6.
- **Blocked time is already in the history, per tool call**: `feed` (`transcript.ts:187–200`) closes
  a `blocked` span for each tool result the human decided (`permissionDecision.source` starting
  `user`) or a tool that asks the human (`AskUserQuestion`); `mergedSpans` (`history.ts:655`) never
  merges blocked spans. This is §2.9's rejected alternative for "a prompt answered".
- **The shown state.** `SHOWN_STATES = working | blocked | idle | done`
  (`src/core/agentstate/shown.ts:6`). Main tracks one state per agent pane and calls every
  `onShownChange` listener with `(paneId, sessionId, previous, next)` on each change
  (`src/main/agentstate.ts:163–183`). Its one listener today is the wake code
  (`src/main/workspace.ts:2150`). Every agent with a pane goes through it (Claude, Cursor).
- **Tasks**: `Task { number, assignee?, state, waitingOn?, reviewWait?, created, updated, closed? }`
  (`src/core/orchestration/tasks.ts:16–36`); `TASK_STATES = queued | in progress | waiting | to
  review | done | dropped`, `REVIEW_WAITERS = orchestrator | human | pr-approval | pr-merge`
  (`taskState.ts:2–13`). `waitingOn` is free text, "topic 4" or a session's name (`tasks.ts:485–486`).
  **Every change, by a tool or by the UI, goes through `setTasks`** (`src/main/tasks.ts:19–22`;
  callers `workspace.ts:1630,1982,2289,3019`). Loading at start does not call it (`tasks.ts:7–12`).
- **Topics**: `Topic { number, from, task?, status: open | discussing | closed, … }`
  (`src/core/orchestration/topics.ts:6–24`). Discussing comes from the double-click
  (`discussTopic`, `workspace.ts:3105–3115`) or `topic_update` (`topics.ts:334`); closing from
  `topic_close`. **Every change goes through `setTopics`** (`src/main/topics.ts:24–27`).
- **The clock**: `now()` in ms (`src/core/clock.ts:1`); days are built from local midnights
  (`src/core/usage/periods.ts:20–29`, `midnight`, `localDay`, `addDays`), never start + 24 h.
- **The export**: `menkar usage export`, one JSON object per **turn**, `schema: 1`, keys held by a
  test to exactly the table of `docs/usage.md` (`tests/core/usage/export.test.ts:54–68,279`). The
  schema "changes only when a field changes meaning or goes away, never when one is added".
- **An append-only log in the data directory already exists**: the statusline's `usage.jsonl`
  (`statuslineLogPath`, `src/core/usage/statusline.ts:8`). The journal of §2.3 follows it.
- **The stand-in agent** prints a permission question on `ASK` (`e2e/fixtures.ts:164`) and the pane
  turns blocked (`e2e/agent-panes.spec.ts:39`).

**The human's activity data, measured by `set`** (2026-11-18, read-only on a deleted copy of the
human's history, with their ok; 6,305 human-origin turns over 53 active days, 2026-09-19 to
2026-11-18). Gaps between consecutive human messages: 30% ≤ 1 min, 53% ≤ 2, 66% ≤ 3, 79% ≤ 5,
89% ≤ 10, 92.5% ≤ 15, 94% ≤ 20, 96% ≤ 30, 98% ≤ 60.

| Gap | Bursts a day | Median length | p90 | Bursts of 2 h or more |
|---|---|---|---|---|
| 10 min | 12.7 | 9 min | — | — |
| 15 min | 9.0 | 18 min | 87 min | 28 |
| 20 min | 7.1 | 24 min | 118 min | 36 |
| 30 min | 4.8 | 49 min | 197 min | 64 |
| 45 min | 3.2 | 92 min | — | — |

No sharp knee. These figures stay in prose only as the human's data on that date; no test asserts
them (they are the evidence for a constant the human picks, not a property of the code).

## 2. The design

### 2.1 What is recorded

Nine kinds of event, none with text. Each carries a random id, its time in Unix seconds through
`src/core/clock.ts` (`now() / 1000`), and its project's id (or none).

| Kind | When | Fields |
|---|---|---|
| `prompt_answered` | A pane's shown state leaves `blocked` (Q3) | session id (or none: an unjoined tab), `next` (`working`, `idle`, `done`), `blocked_seconds` (how long it was blocked, from main's own record of when it entered `blocked`) |
| `topic_discussed` | A topic's status becomes `discussing` | topic number, `task` number if the topic has one |
| `topic_closed` | A topic's status becomes `closed` | topic number, `task` if any |
| `present` | A key, click or scroll in a focused Menkar main window, at most one a minute (§2.2) | none: the project the window shows |
| `away` / `back` | The human's presence switches (1.167: the chip, the banner, `Ctrl+B a`, `human_back`) | none |
| `app_start` | Menkar starts (every away ends here: away is not kept across a quit) | none |
| `prompted_start` | Menkar starts or resumes a session with a first prompt on its command line (§2.7) | session id |
| `task_state` | A task appears, or its `state`, its `waitingOn` or its `reviewWait.on` changes | task number, `state`, `wait_kind` (below), `wait_ref`, assignee session id (or none), `baseline` (Q5) |

- **`wait_kind`**: for `waiting`, `topic` when `waitingOn` matches `^topic (\d+)$` (then `wait_ref`
  is the number), `session` when it names a session Menkar knows (then `wait_ref` is its **id**,
  never the name typed), else `other` with no `wait_ref` — the text itself is never stored. For
  `to review`, `reviewWait.on` as is (`orchestrator`, `human`, `pr-approval`, `pr-merge`), no ref
  (the PR's note is text: not stored). Otherwise none.
- **A task's assignee changing alone** (a renew, `followTasks`) is not a state change: not recorded.
- **The human's messages are not recorded again**: the turns of origin `human` are read from the
  history when bursts are built. One source, one definition of a message.
- **A topic the app raises and closes itself** — plan 42's `kind: 'permission'` topics, raised when
  a worker blocks and closed when it is answered — is not recorded: its answer is already a
  `prompt_answered`. See the seam in §4.
- **Project**: tasks and topics are per project already. A prompt's project is its session's, read
  through `projectOf(currentProjects(), sessionId)` when the event happens. Only the id is stored;
  names come from `projects.json` when read, as the Usage window's names already do
  (`currentMemberships`, `src/main/usage.ts:96–104`). A deleted project's events keep its id and
  show under "No project" (my choice: a name kept beside it would be a second copy of a name the
  app owns; turns keep one only because they predate projects).

### 2.2 Where each event is seen: two funnels, one listener, the renderer's marks, two calls in `workspace.ts`

- **Tasks and topics**: `setTasks(next)` and `setTopics(next)` already hold the previous value.
  Each calls a recorder with `(before, after)` before replacing it. The diff is pure core
  (`src/core/activity/record.ts`): `taskEvents(before, after)` and `topicEvents(before, after)`,
  per project, per number. Whatever path changed the value — a tool, the Board, a renew — is seen
  once, and nothing calls the recorder twice.
- **Prompts answered**: a new `src/main/activity.ts` registers an `onShownChange` listener. It keeps
  `enteredBlocked: Map<paneId, seconds>`; on `next === 'blocked'` it sets it; on `previous ===
  'blocked'` and `next !== 'blocked'` it emits `prompt_answered` and deletes the entry. A pane that
  closes while blocked emits nothing (the human did not answer; the entry is dropped on the next
  change of that pane id or never read — pane ids are not reused within a run). The rule is pure
  core (`src/core/activity/prompts.ts`, `PromptTracker`), main only connects it.
- **Presence marks**: a new `src/renderer/presence.ts`, started from the main window's entry
  (`src/renderer/main.ts`), adds three listeners on `window` — `keydown`, `pointerdown`, `wheel` —
  each `{ capture: true, passive: true }`, which **only observe**: they never call
  `preventDefault` or `stopPropagation`, so xterm's custom key handler (`terminals.ts:272`) and the
  app's shortcuts see every event as before; nothing is added to that handler (AGENTS.md: a key
  the app handles is blocked for every event type — this module handles none). A tab change is a
  click or a key, so it is covered. On an event, if `document.hasFocus()` and a minute has passed
  since the window's last mark (`src/core/activity/marks.ts`, pure, time from
  `src/core/clock.ts`), it sends `activity:present` with no payload. Main resolves the window's
  shown project (`windowState(event.sender)?.shown`, `workspace.ts:704`, exported already) and
  journals a `present` event, at most one a minute across all windows (the same `marks.ts` rule).
  **Cost**: per event one `hasFocus()` and one subtraction — wheel events come at ~60 a second
  while scrolling, keys at typing speed; at most one IPC message a minute per window and one
  journal line a minute in all: about 500 lines on a 8-hour day. The Usage and Settings windows
  send none (my choice: they are where the data is read, not where work happens).
- **Away and back**: every change of presence goes through `askPresence` (`workspace.ts:1584–1598`;
  the chip, the banner, the shortcut and `human_back` all call it). It calls
  `recordPresence(away)` from `src/main/activity.ts` when the state changed (block 3b).
  `app_start` is journaled by `src/main/activity.ts` when it starts (block 3).
- **Who acted is not recorded.** The funnel cannot tell the human's double-click from the
  orchestrator's `topic_update`, nor the human's close from the orchestrator's `topic_close`, without
  editing every call site in `workspace.ts` (plan 41's and 42's file). The human decided (Q2 (a))
  that bursts use them anyway: a topic is the human's subject even when the orchestrator closes it.

### 2.3 Where it is stored, and what it costs

**In the usage history, version 4**, two new tables (migration `3:` creates them; a new file gets
them from `HISTORY_SCHEMA`):

```sql
CREATE TABLE activity (
  id TEXT PRIMARY KEY, at REAL NOT NULL, kind TEXT NOT NULL, project_id TEXT,
  session_id TEXT, topic INTEGER, task INTEGER, next TEXT, blocked_seconds REAL
);
CREATE INDEX activity_time ON activity (at);
CREATE TABLE task_states (
  id TEXT PRIMARY KEY, at REAL NOT NULL, project_id TEXT NOT NULL, task INTEGER NOT NULL,
  state TEXT NOT NULL, wait_kind TEXT, wait_ref TEXT, assignee TEXT, baseline INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX task_states_task ON task_states (project_id, task, at);
CREATE INDEX task_states_time ON task_states (at);
```

The version rules are the history's own and are not rewritten: the constructor already leaves a
newer file untouched and moves an unreadable one aside. A version-3 Menkar opening a version-4
file sees it as too new and stops writing turns to it (the cache keeps them pending): the same
downgrade rule as every earlier bump.

**How it gets there — a journal, then a batch import off the UI path:**

1. Main appends each event, as it happens, as one JSON line `{"v":1, …}` to
   `<data>/activity/journal.jsonl` through one async append queue (a promise chain in
   `src/main/activity.ts`, `fs.promises.appendFile`). A busy day is about 500 presence marks plus
   hundreds of prompts: a thousand small appends a day, nothing. Hundreds of `prompt_answered` a
   day stay small for the same reason: the cost is per append, never per SQLite write.
2. Every **5 minutes**, if the journal is not empty, main renames it (in the same queue, so no
   append is in flight) to `<data>/activity/batch-‹fileStamp›.jsonl` and starts
   `activity-worker` (a short-lived worker, a third entry beside `usage-worker` in
   `electron.vite.config.ts`). Also once at start, for what a previous run left.
3. The worker imports **every** `batch-*.jsonl` there, oldest first: one transaction per file,
   `INSERT OR IGNORE` by id, then deletes the file. A line that does not parse, or a `v` it does not
   know, is skipped and counted in the log. A history too new: the files are left for a later
   Menkar. A failed import: the files stay and the next run retries.

What this buys: **a crash loses nothing appended** (the journal is on disk); **quitting needs no
flush** (`will-quit` cannot await, `src/main/index.ts:113–150`; the journal is imported at the next
start); **an import twice is an import once** (ids); **no SQLite on main's thread**; and **one write
transaction per 5 minutes at most**, so the pass and the classifier wait on it for milliseconds.
The view's latency is at most 5 minutes, and the Usage window, which already runs a pass before a
report (`usage.ts:113`), also asks for an import first (block 7).

`menkar usage` (the CLI) imports leftover `batch-*` files before a report or an export, as it runs
a pass first; it never touches `journal.jsonl` (the running app owns it). Two importers on one batch
file are safe (ids; a missing file on delete is not an error).

**Task baseline (Q5 (a), decided)**: at start, when `<data>/activity/` does not exist yet (the
first run that records), main creates it and journals one `task_state` event with `baseline: 1`
for every open task, in its current state and wait, at that moment. Only main knows the open
tasks, and the directory's absence is the one signal main can read without SQLite. The view counts
such a task from its baseline and marks its figure "since recording began". A data dir whose
`activity/` was deleted by hand gets a second baseline: harmless, as each row is an instant and a
baseline row in the same state adds no transition.

### 2.4 Midnight, restarts, the clock

- Every event is one instant; nothing is a span until read. Midnight never splits a record.
- A restart is a silence in the journal; a pane blocked across a restart gives no
  `prompt_answered` (its `enteredBlocked` is gone, and the answer may have been given while Menkar
  was down). Said in `docs/usage.md`'s limits.
- **A clock jumping back** writes events out of order; every reader sorts by `at`. A negative
  `blocked_seconds` (the clock jumped back while blocked) is stored as 0.
- A task's time in a state is the next row's `at` minus its own; the last row of an open task runs
  to `now()`; a window clips rows at its bounds, as spans are clipped (`history.ts:405–408`).

### 2.5 Bursts: computed when read, never stored

**A burst** is a maximal run of the human's actions, sorted by time, where each is at most **G**
after the one before. Its start is its first action, its end its last; a single action is a burst of
length 0 (shown as a tick, not a band). **G is one constant** in `src/core/usage/bursts.ts`
(`BURST_GAP_SECONDS`); changing it rewrites no data.

**G = 10 minutes**, decided by the human (2026-11-18, topic 56, row 1.180), as one constant. The
evidence is set's measurement (§1): there is no knee; at 10 min 89% of the gaps between messages
fall inside a burst, 12.7 bursts a day with a median of 9 min. My proposal was 15 min (92.5% inside,
9 a day); the human chose to start at 10, and the presence marks below — one a minute while the
human works in a focused window — fill many of the gaps that messages alone leave, so the measured
figures are an upper bound on how fragmented the bands will look. Changing G later rewrites nothing.

**The human's actions** (Q2 (a), decided by the human, 2026-11-18): the turns of origin `human`
(from the history, less §2.7's prompted starts), `prompt_answered`, `topic_discussed`,
`topic_closed`, and `present` marks. Task changes are not actions of the human.

**Away (1.167)**: an away period runs from an `away` event to the next `back` or `app_start` (away
is not kept across a quit). It **ends a burst** — the burst before it ends at its last action
before `away`, whatever G says — and **every action inside it counts nothing**: no message, no
prompt, no mark, no burst. This includes a message sent by Remote Control while away (a turn of
origin `human` in that interval): 1.180 says the human is not present then.
**Midnight**: a burst crossing midnight is one burst; a day's view clips it at the day's local
midnights (`midnight(localDay(…))`), its full length shown in its tooltip; the week's per-day burst
time counts each day's clipped part. **A restart** is no different from a silence: bursts are made
from timestamps only.

### 2.6 `menkar usage export`

Per its rules (`docs/usage.md`, "Exporting for analysis"): one object per **turn**, schema 1, keys
held to the table. Adding activity rows into that stream would make "one object per turn" false.
**Recommended (Q4 (a))**: a `--rows turns|activity|tasks` option, `turns` the default (today's
output unchanged, byte for byte), each kind with its own key table in `docs/usage.md`, its own
`schema: 1`, the same period and `--project` flags (a row is in range by its `at`), JSONL and CSV.
Never in a row: text of any kind, a path, a typed session name (`wait_ref` is an id or a topic
number). This is also how the human or a session checks G against their own data later.

### 2.7 Which `human` turns are not the human's — measured by `claude-cli`

Measured by `claude-cli` on Claude Code 2.1.327 (2026-11-18, throwaway homes, its probe harness),
from the transcripts' user records:

| Case | `turnOrigin` | Distinguishable? |
|---|---|---|
| New session with a command-line prompt (`claude "…"`, with or without `--session-id`) | `human` (`promptSource: "typed"`) | No: the same fields as a typed message |
| `claude --resume <id> "…"` | `human` (`promptSource: "typed"`) | No |
| A message typed at an idle prompt | `human` | — |
| A `[Menkar]` frame or a peer's SendMessage, session idle | `peer` (`isMeta: true`) | Yes |
| A message typed **mid-turn**, or a frame mid-turn | **no turn at all**: a `queued_command` attachment (`humanTurn: true` when typed) | — |

**So every `start_session`, `resume_session` and `renew` with a prompt adds one turn of origin
`human` that no human typed** — every worker start would count as a message of the human's. Menkar
is the only one who knows: every command-line prompt comes from a tool (`prompted`,
`src/main/workspace.ts:1367`, its callers `:1511,1808,1957`) and reaches the command line through
`startPane`'s `promptFile` (`workspace.ts:1000–1008`). The design:

- **Recorded**: `startPane`, when `spec.promptFile` is set, journals a `prompted_start` event with
  the session id and the moment, **before** the pty is spawned (block 3b, one call).
- **Excluded when read**: for each `prompted_start` of a session at `at`, that session's **first
  turn opened at or after `at`**, if its origin is `human`, is not one of the human's messages. No
  time constant: the command-line prompt is the first thing the agent processes after the start,
  and `at` is taken before the spawn, on the same machine's clock. A start whose agent dies before
  its first turn excludes nothing that is the human's unless the human then types first in that
  session — accepted, and said in the limits.
- **Not filtered in the history**: the turn stays `human` there (the history copies what the
  transcript says, and the report's time keyed by origin is unchanged); only the burst and message
  counts of §2.5 apply the exclusion, in `src/core/usage/bursts.ts`'s reading.
- **Before block 3b lands**, `prompted_start` is not recorded: the turns of those days are
  overcounted. Block 3b is therefore wanted before the human starts reading the data, not before
  recording starts.

**Mid-turn messages are missing** from the history's human turns (Q7): a message typed while the
agent works is absorbed into the running turn and leaves only a `queued_command` attachment. The
message counts of the day view undercount by that many; bursts are less affected (the human is
already inside one while the turn runs). Counting them means teaching the cache to read that
attachment — `src/core/usage/{transcript,cache}.ts`, plan 39 P1a.6's files.

### 2.8 The views (blocks 4–7), placed by the human

**Placed by the human, 2026-11-18 (topic 62, decision 1.184), from block 4's mock-ups:**

- **The Usage window gets a left bar**, like Settings', with three sections: **Usage**, **Activity**,
  **Task flow**. Totals and By day stay inside Usage (they are usage's measures; activity and the
  flow are other measures). Neither placement A (own tabs) nor B (views beside By day).
- **Activity**: the day by the hour as mocked (messages and prompts answered as bars, bursts as
  bands above with their length, the hover); **the week as strips per day, a click on a day opens
  that day** (variant a).
- **Task flow**: **median and total** per state and per whom it waits on (variant a), over 7 or 30
  days.
- **The period across sections**: each section remembers its own last period. On a switch, the
  chosen period is carried when the other section has it — Usage *today* ↔ Activity's day, Usage
  *7 days* ↔ Activity's week ↔ Task flow *7 days*, Usage *30 days* ↔ Task flow *30 days* —
  otherwise the other section keeps its own, and the choice is not overwritten (Usage on *all*,
  to Task flow on its last 7 or 30, back to Usage still on *all*). **The project scope** (this
  project / all projects) applies to all three and is always carried.
- **A new mock-up of the window with the left bar** (block 4b) comes before block 7.
- **Block 4b's mock-up approved** (the human, 2026-11-18, topic 63, task 107's
  `$MENKAR_FILES/menkar-t107-sheet.png`): the left bar as drawn, 180 px; **the project scope
  (this project / all projects) sits at the foot of the left bar** (variant b,
  `menkar-t107-6-scope-place-*`), not in the header; the header holds only the section's period.
- **The day's and the week's message count is labelled "Messages sent"** (the human, 2026-11-18):
  they are the turns the human opened, not what reached them to read.

What follows is what block 4 was asked for. Block 4 produced the mock-ups (by the session `set` names, e.g.
`designer-40`), each in both themes at the Usage window's default size, with the human's figures
replaced by invented ones. **Each mock-up must show:**

1. **A day by the hour** — 24 hourly columns, local time, the day's date and a stepper; per hour:
   messages sent (count), prompts answered (count, distinguishable from messages), and **bursts as
   bands** across the hours they cover with their length labelled; the scope switch (this project /
   all projects) the window already has (decision 1.15); a day crossing midnight shown clipped; an
   empty day; a day with one 4-hour burst; what a hover on a band shows (start, end, length,
   messages and prompts inside).
2. **A week** — 7 days, each day's total burst time, messages and prompts answered, per project
   and for all; how the week relates to the day view (a click on a day opens it, or not).
3. **The task flow** — over 7 and 30 days: time per state (queued, in progress, waiting, to review),
   and within waiting and to review, per whom it waits on (`topic`/the human, a session,
   `orchestrator`, `human`, `pr-approval`, `pr-merge`); the unit (median per task, total, or both);
   tasks counted since their baseline marked; a project with no tasks; where it sits relative to
   the Usage window's existing Totals and By day.
4. **Where they live**: a new tab or period of the Usage window, or elsewhere — shown as two
   placements side by side for the human to choose.

### 2.9 Rejected, and why

- **The history's blocked spans as "prompts answered"** (they exist, `transcript.ts:187–200`):
  Claude only, written per tool call (a parallel batch of calls is several spans for one answer),
  hourly, and 1.180 names the shown state. Kept as a cross-check the executor may run on the
  stand-in, not as a source.
- **Main writing SQLite directly**: node:sqlite is synchronous (`db.ts:5–6`) and a busy history
  blocks for up to 30 s.
- **A long-lived activity worker fed by `postMessage`**: what it holds in memory is lost on a crash
  and at quit (`will-quit` cannot await it); the journal is not.
- **Riding the hourly pass**: an hour of events in memory, and `pass.ts`/`history.ts`'s `write` are
  plan 39 P1a.6's.
- **A separate `activity.sqlite`**: the bursts join the history's human turns; one file, one version,
  one export path.
- **Recording at each call site in `workspace.ts`**: four task paths, three topic paths, two plans
  editing that file now; the funnels see every path once.
- **Recording the human's messages again from the terminal**: a second definition of a message;
  the history's turns are the one (AGENTS.md: usage numbers come only from `src/core/usage/`).
- **Storing bursts**: a change of G would need a rewrite; computed at read time they cost one sorted
  scan of a day's or a week's events.
- **Storing `waitingOn`'s text or the PR note**: text, and a session's name changes; an id or a
  topic number is enough to say whom.

### 2.10 Decisions the code must hold, and their tests

Each sentence goes in its test's comment; the case is the assertion. Written before the code.

| Decision | Test (file) | Case |
|---|---|---|
| A task's state change is recorded once, with whom it waits on | `tests/core/activity/record.test.ts` | before: task 3 `in progress`; after: `waiting`, `waitingOn: "topic 4"` → one `task_state` {task 3, state waiting, wait_kind topic, wait_ref "4"} |
| A typed session name is never stored | same | `waitingOn: "reviewer"` naming a known session id `s1` → wait_ref `s1`; naming none → wait_kind `other`, wait_ref absent; no field of the event equals `"reviewer"` |
| A review's waiter is recorded; its note is not | same | `to review` with `{on: 'pr-merge', note: '#12'}` → wait_kind `pr-merge`; no field contains `#12` |
| A new task is recorded; a closed one too | same | absent → `queued` gives one event; `to review` → `done` gives one |
| An assignee change alone is not a state change | same | `followTasks` before/after → no event |
| A note or step change is not a state change | same | `in progress` step 1 → step 2 → no event |
| Discussing and closing a topic are recorded; other edits are not | same | `open → discussing` → `topic_discussed`; `discussing → closed` → `topic_closed`; a title change → none; `open → closed` → `topic_closed` |
| A permission topic is not recorded (after plan 42 block 1) | same | `kind: 'permission'` raised then closed → no event |
| A prompt answered is a pane leaving blocked, with how long it was blocked | `tests/core/activity/prompts.test.ts` | `idle→blocked` at 100, `blocked→working` at 112.5 → one event, blocked_seconds 12.5, next `working`; `blocked→idle` → one event (Q3 (a)); `working→idle` → none; blocked→blocked → none |
| A clock jumping back never gives a negative wait | same | blocked at 100, answered at 90 → blocked_seconds 0 |
| A pane closed while blocked is not an answer | same | blocked, then `closed(pane)` → no event |
| An import twice is an import once; a bad line is skipped | `tests/core/usage/activity.test.ts` | a batch of 3 lines imported twice → 3 rows; a batch with a broken line and a `v: 2` line → the good ones only, the file deleted |
| A newer history is left untouched and the batch kept | same | `user_version` 5 → no row written, the batch file still there |
| Version 3 migrates to 4 keeping every turn | `tests/core/usage/history.test.ts` | a v3 file with 2 turns → v4, 2 turns, both new tables empty |
| A command-line prompt is not the human's message | `tests/core/usage/bursts.test.ts` | session s1: `prompted_start` at 100, turns `human` at 103 and 400 → only 400 counts; a `peer` turn at 103 then `human` at 400 → 400 counts (the first turn after the start was not human); a `prompted_start` with no turn after it → nothing excluded |
| An away period ends a burst and counts nothing | `tests/core/usage/bursts.test.ts` | G 10 min: actions 10:00, 10:05; `away` 10:06; a `human` turn 10:08 (Remote Control); `back` 10:30; action 10:31 → bursts 10:00–10:05 and 10:31–10:31; the 10:08 turn counts in no message figure; `away` 10:06 with no `back` and `app_start` 12:00 → away until 12:00 |
| Presence marks count as actions | same | marks at 10:00 and 10:09, a message at 10:18 → one burst 10:00–10:18 |
| Bursts at read time, by the gap, across midnight | `tests/core/usage/bursts.test.ts` | actions at 23:50, 23:58, 00:05 local with G 10 min → one burst 23:50–00:05; the day view of the first day clips it to 23:50–24:00; 10:00 and 10:11 → two bursts; 10:00 and 10:10 → one; one action → a burst of length 0 |
| Time per state comes from consecutive rows; the open one runs to now | `tests/core/usage/flow.test.ts` | task 1 queued 09:00, in progress 09:30, to review (pr-merge) 11:00, now 12:00 → queued 30 min, in progress 90 min, to review/pr-merge 60 min; a 7-day window starting at 10:00 clips in progress to 60 min |
| Today's export is unchanged | `tests/core/usage/export.test.ts` | the existing tests pass untouched (Q4 (a)); `--rows activity` keys equal its documented table |

## 3. Out of scope

- The views until block 4's mock-ups are approved and Q6 is answered.
- The nudge after a long burst (1.180): deferred, entered in `docs/NOT_BUILT_YET.md` by block 3.
- Cursor's (and later agents') messages as human actions: they enter with plan 39 P1a.6's turns,
  with no change here. Their prompts answered are recorded already (the shown state is agent-agnostic).
- The human's activity that is not a message, a prompt or a topic (typing in a file tab, switching
  tabs, reading).
- Backfilling task history before recording began beyond Q5's baseline (`created`/`updated`/`closed`
  in `tasks.json` do not say when each state was entered).
- Who performed a topic change (§2.2).

## 4. Do not touch

- `src/main/workspace.ts`, `src/shared/workspace.ts` and every renderer file but `main.ts` and the
  new `presence.ts`, while plan 41 block 3 (`menkar-t84`) and plan 42 are in flight: blocks 1–3 and
  3c edit none of them; block 3b's two calls wait for the slot `set` names.
- xterm's custom key handler (`src/renderer/terminals.ts:272`) and the shortcut code: presence
  only observes.
- `src/main/agentstate.ts` and `src/core/agentstate/**`: only `onShownChange` is used.
- `src/core/orchestration/{tasks,topics}.ts`: types imported only (plan 42 block 1 edits
  `topics.ts`).
- `src/core/usage/history.ts`'s `write`, `rederive` and `pass.ts` (plan 39 P1a.6): block 1 adds the
  schema, the migration and the version at the top, and appends its methods at the end of the class.
- The turns' export output, byte for byte, and its key table.
- The human's `history.sqlite` and their running Menkar: tests use temporary data dirs; e2e run the
  app under `xvfb-run` with its own homes.
- **The seam with plan 42**: whichever lands second adds the `kind === 'permission'` skip in
  `topicEvents` (`src/core/activity/record.ts`) with its test row of §2.10. If plan 43 block 2 runs
  first, plan 42's block 3 owns that line; `set` puts it in plan 42's launch prompt.

## 5. Execution blocks

One worker per block. Every block ends with `npm run ci` green, its output in the report. Blocks
1–3 are the recording: once block 3 is committed and a package is installed, data accumulates.
**Blocks 1–3 and 3c may run beside plan 41 block 3 and plan 42 blocks 1–2** (no shared file); 3b
waits for its `workspace.ts` slot; not beside
another plan touching `src/core/usage/history.ts` or `src/main/{tasks,topics,index}.ts` or
`electron.vite.config.ts`. `npm run ui-check` (block 3) under the lock `set` names.

### Block 1 — the storage, core only (needs no answer)

Files: `src/core/usage/history.ts` (schema, migration `3:`, `HISTORY_VERSION = 4`, two methods at the
end of the class), new `src/core/usage/activity.ts` (the journal line's type and parser, `v: 1`; the
import of one batch file into a `Db`; `activityDir()` through `appDirs()`), new
`tests/core/usage/activity.test.ts`, `tests/core/usage/history.test.ts`.

- [ ] Tests first (§2.10 rows: import twice, bad line, newer history, v3 → v4). See each fail once
  against an injected defect (`INSERT` for `INSERT OR IGNORE`; the version check skipped), then
  remove it.
- [ ] The schema and migration; `UsageHistory.importActivity(path)` and the parser.
- Verify: `npm run ci`. Nothing calls it yet.

### Block 2 — the events, core only (Q3 decided; needs no open answer)

Files: new `src/core/activity/record.ts` (`taskEvents`, `topicEvents`, the `wait_kind` resolution
taking a `sessionIdByName` function), new `src/core/activity/prompts.ts` (`PromptTracker`, time
injected), new `tests/core/activity/record.test.ts`, `tests/core/activity/prompts.test.ts`.

- [ ] Tests first: every §2.10 row of these two files; the permission-topic row only if plan 42
  block 1 is committed (else §4's seam). Each new test seen failing once.
- [ ] The two modules: pure, importing types from `../orchestration/*` and nothing from Electron or
  the DOM.
- Verify: `npm run ci`.

### Block 3 — recording in main (Q5 decided); a .deb after it starts the data

Files: new `src/main/activity.ts` (the append queue, the 5-minute rotation, the worker's start, the
`onShownChange` listener, the baseline, `app_start`), new `src/main/activity-worker.ts`,
`electron.vite.config.ts` (its entry), `src/main/tasks.ts` and `src/main/topics.ts` (one call each in
`setTasks`/`setTopics` with `before` and `next`), `src/main/index.ts` (start it after `startTasks`
and `startAgentState`; stop the timer at `will-quit`), `src/core/usage/cli.ts` (import leftover
batches before a pass), new `e2e/activity.spec.ts`, `docs/usage.md` (the new section, §2.1–2.5,
2.7 and 2.9, the limits), `docs/NOT_BUILT_YET.md` (Task flow metrics rewritten; the nudge entered),
`plans/00-STATUS.md` only if `set` asks (it owns 1.180's row).

- [ ] e2e first, on the stand-in, in the test's own data dir: a pane typed `ASK` turns blocked,
  then answered → `activity/journal.jsonl` gains one `prompt_answered` line with the pane's session
  id and `blocked_seconds > 0`; a topic double-clicked (`discussTopic`) → a `topic_discussed` line;
  `TASKADD` then `WORKT`, `STEPS` → `task_state` lines `queued`, `in progress`; the first line of
  the run is `app_start`; the app quit and
  started again → the journal is gone, a `menkar usage` run (or the worker's log line) shows the
  rows imported. No line contains the topic's title or the task's title (asserted).
- [ ] Main's module and the worker; the funnels' calls.
- Verify: `npm run ci`; `npm run ui-check` under the lock; the e2e's journal and export lines in
  `$MENKAR_FILES/‹worker›-43-b3-journal.txt` (no screenshot: nothing visible changes).

### Block 3b — prompted starts and away/back (two calls in `workspace.ts`; when `set` grants it)

Files: `src/main/workspace.ts` (`startPane`: one call to `recordPromptedStart(sessionId)` when
`spec.promptFile` is set, before the spawn; `askPresence`: one call to `recordPresence(away)` when
the state changed), `src/main/activity.ts`, `e2e/activity.spec.ts`. **Not beside any block holding
`workspace.ts`** (plan 41 block 3 and later; plan 42 block 3 rewrites `askPresence` — run 3b after
it, or have plan 42's block 3 carry the one call): `set` names the slot.

- [ ] e2e first: the stand-in's `SPAWN1` (start_session with a prompt) → one `prompted_start` line
  with the worker's session id; a session started from the UI → none; `Ctrl+B a` twice → an
  `away` line then a `back` line; the stand-in's `AWAY` word (`human_back`) after away → a `back`
  line.
- [ ] Check while there that no path from the UI starts a session with a prompt (every `promptFile`
  comes from `prompted`); if one does, report it before going on.
- Verify: `npm run ci`; `npm run ui-check` under the lock.

### Block 3c — presence marks from the renderer

Files: new `src/core/activity/marks.ts` (`markDue(lastMs, nowMs)`, one a minute) and
`tests/core/activity/marks.test.ts`, new `src/renderer/presence.ts`, `src/renderer/main.ts` (its
start), `src/shared/ipc.ts` (`'activity:present': Record<string, never>` in `SendChannels`),
`src/preload/index.ts` (the send), `src/main/index.ts` (`on('activity:present', …)`),
`src/main/activity.ts`, `e2e/activity.spec.ts`. None is plan 41's or 42's file; it may run beside
them, not beside block 3 or 3b (same `activity.ts`, `index.ts`).

- [ ] Tests first: `markDue` at 0 → yes; at 59,999 ms after → no; at 60,000 → yes; a clock jumping
  back (now < last) → yes, and the next mark a minute after that.
- [ ] e2e first: type into a terminal pane → one `present` line with the window's project, and the
  pane still received every key typed (the existing typing assertions of `agent-panes.spec.ts`
  still pass with the module loaded); type again within the minute → no second line; scroll in
  the sidebar after a minute → a second line. A source test (TypeScript compiler API) that
  `presence.ts` calls neither `preventDefault` nor `stopPropagation` and passes `passive: true` to
  each listener, seen failing once against an injected `preventDefault`.
- Verify: `npm run ci`; `npm run ui-check` under the lock (no visible change: no screenshot; the
  journal lines in `$MENKAR_FILES/‹worker›-43-b3c-journal.txt`).

### Block 4 — the mock-ups (needs Q6's candidates; builds nothing)

By the session `set` names. The four mock-ups of §2.8, in `$MENKAR_FILES`, both themes, invented
figures. The human chooses; the chosen placement and any change to §2.8 are written into this plan
(blocks 5–7 rewritten to it) before block 5 starts.

### Block 4b — the mock-up of the window with the left bar (builds nothing)

By a worker `set` names, as block 4 (its script is `$MENKAR_FILES/menkar-t106-script/`). The Usage
window with the left bar (Usage / Activity / Task flow) in both themes, invented figures: each
section selected once; Usage with Totals and By day inside; Activity on a day and on the week;
Task flow on 7 days; and a pair showing the period carried (Usage 7 days → Task flow 7 days) and
not carried (Usage *all* → Task flow on its own). The human approves it before block 7.

### Block 5 — bursts and the day/week reading, core only (needs Q1, Q2)

Files: new `src/core/usage/bursts.ts` (`BURST_GAP_SECONDS = 600`, `bursts(actions, away)`,
`awayPeriods(events)`, `clipToDay`, the prompted-start exclusion), the reading methods on
`UsageHistory` (`humanActions(low, high, project?)` joining `turns` of origin `human` and
`activity`), new `tests/core/usage/bursts.test.ts`; `src/core/usage/nodes.ts` for the
types the page receives; the export's `--rows activity` if Q4 (a) (`export.ts`, `cli.ts`,
`export.test.ts`, `docs/usage.md`'s table).

- [ ] Tests first (§2.10's burst and export rows), each seen failing once.
- [ ] **A case from the human's hand check (task 104, 2026-11-18):** `present` marks journaled
  while away (the human clicking in Menkar after setting away, 11:48–11:50) are dropped by
  `bursts(actions, away)`: they neither extend nor start a burst. Seen failing first.
- Verify: `npm run ci`.

### Block 6 — the flow reading, core only

Files: new `src/core/usage/flow.ts` (`taskFlow(rows, bounds, now)`), new
`tests/core/usage/flow.test.ts`; `--rows tasks` if Q4 (a).

- [ ] Tests first (§2.10's flow row, plus: a task whose first row is a baseline is counted from it
  and marked; two consecutive rows in the same state are one stretch; a task dropped while waiting ends its wait there; the 30-day window).
- Verify: `npm run ci`.

### Block 7 — the views (written in full after block 4)

Files to be named after the placement: the Usage window's renderer files, `src/main/usage.ts` (an
import request before the report, beside the pass), `src/main/usage-query-worker.ts`, i18n
catalogs, an `e2e/usage-*.spec.ts`, `docs/spec/usage.md`, `docs/NOT_BUILT_YET.md` (Task flow
metrics removed, to its history), `docs/usage.md`.

- Verify: `npm run ci`; `npm run ui-check`; screenshots of each view in both themes in
  `$MENKAR_FILES` as `‹worker›-43-b7-*`.

## 6. Decisions and questions

Asked of `set` on 2026-11-18. Q1–Q5 are decided; Q7 is open; Q6 waits for block 4's mock-ups. My
pick first where open.

| # | Question | Options (pick first) | Needed by |
|---|---|---|---|
| Q1 | The burst gap G | **Decided by the human, 2026-11-18 (topic 56): 10 min**, one constant. (My proposal was 15 min; 20 and 30 min were offered) | Block 5 |
| Q2 | What a burst is made of | **Decided by the human, 2026-11-18 (topic 56): (a)** messages, prompts answered, topics discussed or closed — **plus presence marks** in the focused window, and away periods end a burst and count nothing. (Rejected: (b) messages and prompts only; (c) task changes too) | Block 5 |
| Q3 | What "a prompt answered" is | **Decided by `set`, 2026-11-18: (a)** blocked → any other state, with `blocked_seconds` stored so a flicker can be filtered when read. (Rejected: (b) only blocked → working: refusing is the human acting too) | Block 2 |
| Q4 | The new data in `menkar usage export` | **Decided by `set`, 2026-11-18: (a)** `--rows turns\|activity\|tasks`, turns the default and unchanged, documented in `docs/usage.md`. (Rejected: (b) not exported — the human could not check G on their data; (c) mixed into the turns' stream — breaks "one object per turn") | Block 5 |
| Q5 | Tasks already open when recording starts | **Decided by `set`, 2026-11-18: (a)** one baseline row each at the first recording start, flagged in the view. (Rejected: (b) none — the tasks open on the first day would be missing from the first weeks' flow) | Block 3 |
| Q7 | Messages typed mid-turn (no turn of their own, §2.7) | **(a)** counted: a later block teaches the cache to read the `queued_command` attachment as a human message instant, sequenced after plan 39 P1a.6 (its files) · (b) not counted, said in the view's limits | Block 5 (the view can ship with (b) and gain (a) later) |
| Q6 | Where the views go | **Decided by the human, 2026-11-18 (topic 62): a left bar in the Usage window, Usage / Activity / Task flow**, the period carried where it applies (§2.8). (Rejected: (A) own tabs; (B) views beside Totals and By day) | Block 7 |

## 7. Execution log

(Written by the executing sessions.)

### Review (task 90, `prompts/reports/menkar-t90-review-43.md`): decided by `set`, 2026-11-18

- **F1** (block 3's `wait_kind: session`): as the review proposes — `src/main/activity.ts` resolves
  after the event's `at` through `sessions.list()`, among the task's project's members with that
  exact name; several → the newest; none → `other`; a worker known only to `startedNames` records
  `other`, written in the limits.
- **F2, F3, F4** go with block 1, each as the review proposes.
- **F5, F6:** block 3b is split. Its `startPane` call (`prompted_start`, at the launch plan, with
  `spec.sessionId ?? spec.start.id`) is built right after plan 41's block 4 is committed, and the
  first .deb that records anything carries it, so no day is recorded without it. The
  `askPresence` call rides with plan 42's block 3.

### Block 1 — `menkar-t92` (task 92), 2026-11-18

Built: `HISTORY_VERSION = 4`; the two tables in `HISTORY_SCHEMA` and as migration `3:`, all
`IF NOT EXISTS` (F2 (a)); `UsageHistory.importActivity(path)` and `importActivityDir(dir)` at the
end of the class (null when the history is too new, every file left as it was); new
`src/core/usage/activity.ts` with the line types, `parseJournalLine`, `importBatch(db, path)`,
`activityDir()`, `batchPath(dir, ms)` and `batchFiles(dir)`. F3: `batchPath` names a batch
`batch-‹fileStamp›-‹8 hex›.jsonl`, so block 3 must take its names from it. F4: a batch holding a
line of a higher `v` is imported for what is known and renamed `newer-*`, which `batchFiles` does
not list; the §2.10 row was built that way. N9: a batch missing on read or on delete is no error.
Every new test was seen red against an injected defect (`INSERT` for `INSERT OR IGNORE`, the
too-new check skipped, `IF NOT EXISTS` removed, migration 3 emptied, `newer` deleted, no random
part in the name).

Choices the plan left open (mine):
- The journal line's keys are camelCase (`projectId`, `sessionId`, `blockedSeconds`, `waitKind`,
  `waitRef`), and `baseline` is a boolean (`true`), not `1`: the line is a TypeScript object main
  serializes; the columns stay snake_case. Block 3 writes `JournalEvent` as typed here.
- `next` and `state` are stored as any non-empty string, not checked against the shown states or
  `TASK_STATES`: the history copies what was journaled, as it copies what a transcript says.
- A line of the current `v` with an unknown kind, or missing a required field, is `bad` (skipped,
  counted, the file deleted); empty lines are not counted.
- Not done (pre-existing, outside F2 (a)): two workers creating a **brand-new** history at once
  still race on `HISTORY_SCHEMA`'s first `CREATE TABLE turns`; only the new tables are
  `IF NOT EXISTS`.

### Block 2 — `menkar-t93` (task 93), 2026-11-18

Built: new `src/core/activity/record.ts` (`taskEvents(before, after, sessionIdByName)`,
`topicEvents(before, after)`, the `waitKind` resolution) and `src/core/activity/prompts.ts`
(`PromptTracker`: `change(paneId, sessionId, previous, next, atSeconds)` and `closed(paneId)`),
both pure, importing only types from `../orchestration/*` and `../agentstate/shown`. Tests in
`tests/core/activity/{record,prompts}.test.ts`: every §2.10 row of the two files, the permission
row included (plan 42 block 1 is committed, `0762852`), and a parity test that each event,
stamped with `v`, `id` and `at`, comes back whole from block 1's `parseJournalLine`. Each was seen
red against an injected defect (16 in all: waits ignored, the typed name or the PR note stored,
the assignee or step as a state, no permission skip, `open` recorded, a negative wait, `closed`
not forgetting, only `blocked → working`, `blocked → blocked` restarting the wait, the resolver
asked outside the project, the topic pattern, a new task ignored, the topic kinds swapped, a
snake_case key).

Choices the plan left open (mine):
- The events carry neither `v`, `id`, `at` nor `baseline`: main stamps them (block 3). Their keys
  are block 1's camelCase journal keys, so `{ v, id, at, ...event }` is a `JournalEvent`.
- `sessionIdByName` takes `(projectId, name)`, so main can look only among that project's members
  (F1).
- A task absent before is recorded in its current state, whatever it is; a task that disappears
  records nothing. A change of `waitingOn` while waiting, or of `reviewWait.on` while to review,
  is recorded; a change of the review's note alone is not.
- A topic absent before that is already `discussing` or `closed` is recorded; a topic raised
  `open` is not. `closed → discussing` (reopened by `topic_update`) is a `topic_discussed`.
- `blocked → blocked` keeps the first entry time; a pane leaving `blocked` with no entry (blocked
  before the tracker existed) gives nothing.
- Not done: N6 (a pane leaving `blocked` because its agent exited) is not filtered here; the
  tracker has no way to know, and the review leaves it to main (`AgentPane.foreground()`).
- `taskStateEvent` (one task's event) is kept private; block 3's baseline can be
  `taskEvents(emptyTasks(), openOnly, …)` or export it then.

### Block 3 — `menkar-t96` (task 96), 2026-11-18

Built: new `src/main/activity.ts` (one promise chain for every append and rename of
`<data>/activity/journal.jsonl`; `recordTasks`/`recordTopics`, called once each from `setTasks` and
`setTopics` with the value before and after; the `onShownChange` listener feeding `PromptTracker`,
with `closed` on each agent pane's close; the baseline; `app_start`; `importActivity`) and
`src/main/activity-worker.ts` (a third worker entry in `electron.vite.config.ts`);
`src/main/index.ts` starts it after `startAgentState` and stops its listeners at `will-quit`;
`src/core/usage/cli.ts` imports leftover batches after opening the history, before a report or an
export. F1: the rule is `src/core/activity/names.ts` (pure); main feeds it `sessions.list()` and
`currentProjects()`, only when a wait names something that is not a topic; the event's `at` is
taken before. F3: batches are named by block 1's `batchPath`. Docs: `docs/usage.md`, a new section
"The human's activity and the task flow" (placed before "Exporting for analysis": the export's key
test reads that section to the end of the file, so block 5's activity key table must sit where that
test can tell it apart); `docs/NOT_BUILT_YET.md`, Task flow metrics rewritten and the nudge
entered, the old lines in its history.

Tests: `e2e/activity.spec.ts` (one launch and a restart: the start's import of `app_start` and the
baseline — task 3 waiting on `api` recorded as `session` with the orchestrator's id, the closed task
left out —, `prompt_answered` with `blockedSeconds > 0` after `ASK` then `TURN`, `topic_discussed`
on a double-click, `task_state` queued for `TASKADD` and in progress for `STEPS`, no title in the
journal or the history, and after a restart every row imported once, the journal and batches gone,
no second baseline); `tests/core/activity/names.test.ts`; one `test.each` in
`tests/core/usage/cli.test.ts`. Seen red: the e2e before the code and with the baseline's resolver
skipped (`wait_kind` other); the names tests with the oldest winning and with the membership check
removed; the cli case before the code.

Decided by `set`, 2026-11-18, on my questions:
- **F2 (b)**: no timer of its own. The journal is rotated and imported after every usage pass,
  start and hourly, in the pass's `after` callback (the import first, then the classifier). Rows
  reach the history up to an hour late.
- **N3**: a journal a crash or a quit left is rotated before `app_start` is appended.
- **N2**: the baseline is keyed on a marker file, `activity/baseline`, written after the baseline's
  lines are appended, not on the directory's absence.
- **N6**: no `prompt_answered` when the pane's agent is no longer in its foreground; in the limits.
- `src/core/activity/names.ts`, its test, and the case in `tests/core/usage/cli.test.ts`: files
  the block did not name, granted.

Choices the plan left open (mine):
- The baseline's rows take the same `at` as `app_start`.
- The task diff is first computed with a resolver that names nobody; `sessions.list()` (which
  waits for the first scan) is read only when that diff asked for a name, so a progress note costs
  no list.
- No worker starts when no `batch-*` file waits; the worker's result is logged by main
  (`activity imported`, with the counts).
- A `prompt_answered` takes its project from its session's membership at that moment; an unjoined
  pane's has none (N10, as the plan says).
- `cli.ts` logs and goes on when the import throws: the report never fails on the journal.

### Block 3c — `menkar-t98` (task 98), 2026-11-18

Built: new `src/core/activity/marks.ts` (`markDue(lastMs, nowMs)`, `MARK_INTERVAL_MS`; a clock set
back gives a mark at once); new `src/renderer/presence.ts` (`watchPresence()`, started in
`src/renderer/main.ts` beside `watchKeyboardLayout()`); `'activity:present': Record<string, never>`
in `SendChannels` and `menkar.activity.present()` in `MenkarApi` and the preload;
`src/main/index.ts` routes it to `recordPresent(() => windowState(event.sender)?.shown)`; in
`src/main/activity.ts`, `recordPresent` keeps one mark a minute across every window with the same
`markDue`, asks the window's shown project only for a mark it writes, and journals
`{kind: 'present', projectId}` at the time main received it.

How it listens without touching xterm's key handler: three listeners on `window` — `keydown`,
`pointerdown`, `wheel` — each `{ capture: true, passive: true }`. The window's capture phase runs
before the document's capture listener in `main.ts` that stops the app's own keys, and before
xterm's textarea, so every key is seen, including the ones the app takes; the listener reads
`document.hasFocus()` and the clock, and never calls `preventDefault`, `stopPropagation` or
`stopImmediatePropagation`. `setAppKeyFilter` and `terminals.ts` are untouched. The Usage and
Settings windows load their own entries, so they send none.

Tests: `tests/core/activity/marks.test.ts` — `markDue`'s cases, and a source test (TypeScript
compiler API) that `presence.ts` adds exactly those three listeners, each passive and capturing,
and calls none of the three blocking methods. `e2e/activity.spec.ts` gains one test: a key alone →
one `present` with the window's project; a double-click, a click and `ASK` typed into the pane
within the minute → still one, and the stand-in's question appears (the keys reached the pane);
a wheel over the sidebar once 61 s have passed → a second, ≥ 60 s after the first. It waits a real
minute (no clock is faked in the e2e). Block 3's test now leaves `present` out of its kinds list:
its clicks make marks. `agent-panes.spec.ts` was run with it (set's word). Seen red: `markDue`
without the clock-back rule, with `>` for `>=`; `presence.ts` with an injected `preventDefault`,
with one listener `passive: false`; the e2e with `markDue` always true (7 marks within the minute).

Choices the plan left open (mine):
- Marks are journaled while the human is away too; the bursts' reading already counts nothing
  inside an away period (§2.10), and main has no read of the away state outside `workspace.ts`.
- The e2e's first mark comes from a bare `Shift` press, once the session list is drawn: a key sent
  before the renderer's entry ran was lost in a first run.
- The source test lives in `marks.test.ts`, the one test file the block names.

### Block 3b, the `startPane` half — `menkar-t98` (task 98), 2026-11-18

Built: `recordPromptedStart(sessionId, projectId)` in `src/main/activity.ts`; in
`src/main/workspace.ts`, `startPaneHeld` calls it right after the launch plan is made, when
`spec.promptFile` is set, with `spec.sessionId ?? start.id` (F5). One call covers every path that
starts with a prompt: `start_session`, `resume_session`, a renew, and the orchestration card. The
`askPresence` half is not built here: it rides with plan 42's block 3 (F6).

The plan's check, "no path from the UI starts a session with a prompt", found one: the
orchestration first-time card (`src/renderer/orchestration.ts`, `startTeam`) sends `startNew` with
`orch.firstPrompt`, saved by `savePrompt`, not `prompted`. **Decided by `set`, 2026-11-18: (a)** it
records `prompted_start` too — the prompt is Menkar's text, so its first turn is not the human's;
the click on Start is a presence mark already. (Rejected: (b) a flag on `PaneSpec` to skip it.)

Tests: `e2e/activity.spec.ts`'s first test — after `WORKT` (`start_session` with a prompt; the
fixture's project has no group `pair`, so `SPAWN1` would be refused there), exactly one
`prompted_start` with the worker's id and the project; the session opened from the list before it
(a resume from the UI) gave none; after the restart the history holds it once. Seen red with
`recordPromptedStart` returning at once.

Choices the plan left open (mine):
- The event's project is the tab's, known in `startPaneHeld`, not `projectOf` the session: a new
  worker may not be a member yet when its pane starts.
- A pane that fails to find its CLI records nothing: the call sits where the command line is made.

### Block 5 — `menkar-t108` (task 108), 2026-11-18

Built: new `src/core/usage/bursts.ts` — `BURST_GAP_SECONDS = 600`, `awayPeriods(presence, end)`,
`humanActionsOf(rows)` (the prompted-start exclusion), `bursts(actions, away, gap?)`,
`clipToDay`, `activityDay(rows, day, now)`, `activityWeek(rows, first, now)` and
`readActivity(source, bounds, now, project?)`; `UsageHistory.humanActions(low, high, project?)`
and `activityRows(low, high)` at the end of the class (reading only: no write path, no schema
change); in `nodes.ts` the types the page receives (`ActivityBurst`, `ActivityHour`,
`ActivityDay`, `ActivityWeekDay`, `ActivityWeek`); `menkar usage export --rows turns|activity`
(`export.ts`: `ACTIVITY_EXPORT_KEYS`, `exportActivityRows`, `exportActivityCsv`; `cli.ts`: the
flag, `turns` the default and its output unchanged). Docs: `docs/usage.md` — the bursts' section
says how it is read, the limits' prompted-start line is corrected, the export's usage line and a
new "Activity rows" key table (after the turns' example, so the turns' key test reads up to it);
the replaced lines in `docs/history/usage.md` (the history check asked for them).

Tests: `tests/core/usage/bursts.test.ts` (every §2.10 burst row, the task-104 case of present
marks while away, an away of two minutes splitting a burst, an open away read at 23:59, a second
away while away, the day's 24 hours, the clip at the day's first instant, and three readings on a
real history: the join and the project scope, an away begun two days before the day read, a
burst begun more than a day before); in `tests/core/usage/export.test.ts`, `--rows activity`'s
rows, its project scope, its CSV, a bad value, and its documented table; the turns' table test now
stops at "### Activity rows". Seen red, each restored: away never holding (the task-104 test among
the three red), an away not splitting, `<` for `<=`, no prompted exclusion, no clip, no widening,
an open away dropped, a second away restarting, the last presence before the range not read,
messages not scoped; in the export, presence dropped from a project, a key undocumented, the turns'
table read to the end, the project's id for its name, the flag ignored.

Granted by `set`, 2026-11-18: `usage.cli.exportHelp` in `src/core/i18n/{en,es}.ts` names
`--rows activity` (files the block did not name).

Choices the plan left open (mine):
- An away with neither `back` nor `app_start` after it runs to the reading's `now`; a second
  `away` while away, or a `back` while present, changes nothing. An action at an away's first
  instant is inside it, at its last (the `back`) outside.
- Scoped to a project, the bursts are made from that project's actions alone (its messages by the
  turn's stored project, its marks, prompts and topics by theirs); away is every project's.
  Prompted starts are read for every project, since only the turn's uuid matters.
- A day counts messages and prompts answered; presence marks and topics shape bursts but are not
  counted. Each `ActivityBurst` carries the whole burst's messages and prompts (for the hover),
  not the day's part.
- A burst that only ends at a day's first instant is not in that day; a one-action burst there is.
- `readActivity` reads a day on each side and widens a day at a time while the first burst starts,
  or the last ends, within G of the edge read; the last presence event before the range says
  whether it opens away.
- The activity export: keys `schema, event, kind, at, at_epoch, project, session_id, topic, task,
  next, blocked_seconds`; `task_state` rows are not in it (block 6's `--rows tasks`); with
  `--project`, the project's rows plus `away`, `back` and `app_start`.

Not reached yet: nothing calls `readActivity` / `activityDay` / `activityWeek` outside the tests;
block 7 (the Usage window's Activity section, through `usage-query-worker.ts`) is their consumer.
