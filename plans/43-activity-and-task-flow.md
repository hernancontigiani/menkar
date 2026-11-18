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
- **The left bar's sections are named "Spend", "Your time" and "Task times"** (the human,
  2026-11-18, topic 64, option B; rejected: "Agents / You / Tasks", "Agent usage / Your activity
  / Task flow"): Spend holds Totals and By day (time, tokens, cost); Your time, the bursts; Task
  times, the flow. The window stays "Usage" (the menu, the header's button, `menkar usage`).
- **The day's and the week's message count is labelled "Messages sent"** (the human, 2026-11-18):
  they are the turns the human opened, not what reached them to read.
- **The carry, read from 1.184's example** (decided by `set`, 2026-11-18, told to the human): a
  period is carried only when it was **chosen** in the section left — picked there on this visit,
  or carried into it on entering — not merely shown there; so Spend on *All* → Task times on its
  own 7 days → back to Spend is still *All*. A day carries to Spend's *Today* only when it is
  today; a week carries to *7 days* (and Task times' 7 days) only when it is the current one, the
  seven days ending today; a day or week stepped back to leaves the other section on its own.
- **The remembered periods live in the page's memory** for the window's life, never across
  openings; the window opens on Spend, 7 days, as today (`set`, 2026-11-18).
- **What the approved mock-ups show that blocks 5–6 did not read**, added by block 7a (`set`,
  2026-11-18): the away periods of each day, each week day's bursts, a burst's messages per
  project (the hover's line in All projects), and the flow's done / dropped / open counts and its
  baseline's date.

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
| The carry: a chosen period is carried where the other section has it | `tests/core/usage/sections.test.ts` | today Wed 18 Nov: Spend 7d (chosen) → Task times → 7d; → Your time → the week 12–18 Nov; Spend 30d → Task times 30d; Spend 30d → Your time keeps its own (a day on 15 Nov stays 15 Nov); Spend Today → Your time → Day 18 Nov; Task times 30d → Spend 30d |
| A period merely shown is not carried (1.184's example) | same | Spend Month+All (chosen) → Task times (own 7d, `chosen` false) → Spend: still Month+All; Spend Month → Your time keeps its own |
| A stepped-back day or week is not *Today* or *7 days* | same | Your time Day 17 Nov (today 18) → Spend keeps its own; Week 5–11 Nov → Task times keeps its own; Week 12–18 Nov → Task times 7d; Day 18 Nov → Spend Today |
| Inside Your time | same | Day 15 Nov → Week → 12–18 Nov; Day 4 Nov → Week → 29 Oct–4 Nov; Week 5–11 Nov → Day → 11 Nov; current week → Day → today; next disabled on today and on the current week; previous disabled on `firstDay`, and on today when `firstDay` is null |
| The window opens on Spend, 7 days | `e2e/usage-sections.spec.ts`, and USG-44 unchanged | a fresh window: Spend selected, 7 days pressed; the left bar's column 180 px; Your time and Task times show their own header toggles |
| The scope sits at the foot and is carried always | `e2e/usage-sections.spec.ts` | the foot shows the project's name and "All projects"; All projects pressed in Spend → Your time and Task times ask with `allProjects` true and keep it pressed; a Usage window with no opener has no foot |
| A late answer to an older choice is dropped, across sections (1.131) | same | `usage:activity` held back 1.5 s: Your time, then Spend at once → the activity answer is never drawn (a MutationObserver sees no `[data-burst]`); the star shows while an answer is on its way, the left bar usable |
| A burst's messages per project | `tests/core/usage/bursts.test.ts` | unscoped, a burst of 3 messages in Shop and 1 in Blog → `byProject` [Shop 3, Blog 1]; a turn with no project → `null` |
| A day's and a week's away periods, clipped | same | away 23:30–00:30 across midnight → day 1 has 23:30–24:00, day 2 00:00–00:30; the week's two days the same; a week day's `bursts` equal that day's `activityDay` bursts |
| The flow's counts and baseline date | `tests/core/usage/flow.test.ts` | in a window: task 1 done, task 2 dropped, task 3 in progress → done 1, dropped 1, open 1, and `done + dropped + open = tasks`; a task done after `bounds.end` counts open; baseline rows at 11 Nov inside the window → `baselineAt` 11 Nov; none → null |
| The flow table lists to review's four waiters always | same, `flowTable` | to review with only `orchestrator` → four waiter rows, three of them tasks 0; waiting with only `topic` → topic and session rows, no `other`, no none; a `null` waiter in waiting → a "not said" row; shares: the largest state 1, the others its fraction |
| Counts' axis and a day's x | `tests/core/usage/timeline.test.ts` | `countAxis(3)` → top 5, step 1; `countAxis(12)` → 15, step 5; `countAxis(37)` → 40, step 10; `along` the middle of a 25-hour day → half the width, not 12/24 |
| Your time draws the reading | `e2e/usage-time.spec.ts` | yesterday seeded 10:05–14:09 one burst, away 12:00–12:20, 6 messages at 10:xx: the Day stepped back once shows `[data-burst]` bands, `[data-away]` hatched, the summary with "messages sent", hour 10 with 6; the hover shows start – end, length, counts, and in All projects "Shop n · Blog m"; the week shows seven `[data-day]` rows and a Total; a click on yesterday's row opens Day on yesterday; an empty day says "No activity on this day." |
| Task times draws the reading | `e2e/usage-tasks.spec.ts` | seeded: 4 tasks (one done, one dropped, one to review on `pr-merge`, one from a baseline) → the summary's counts and "◦ 1 from their baseline", the footnote with the baseline's date, to review's four waiter rows with "—" for the empty ones; 30 days pressed → the 30-day figures; a project with no tasks → the empty card and footer |
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

### Block 7 — the views: the left bar, Spend, Your time, Task times

Written in full by `menkar-t110` (task 110), 2026-11-18, from §2.8 (decision 1.184, topics 62–64)
and the approved mock-ups: task 107's `$MENKAR_FILES/menkar-t107-sheet.png` and its screens
`menkar-t107-*` (the window, the left bar, the scope at its foot, the carried period), and task
106's `menkar-t106-1-day-*` (the day as mocked, its hover) and `menkar-t106-2-week-strips-*` /
`menkar-t106-3-flow-7d-both-*` (the week and the flow picked). The drawing script,
`$MENKAR_FILES/menkar-t107-script/draw.js`, is the reference for sizes, colours and icons; it is
read, never imported. **The mock-ups' section names are the old ones**: the left bar reads
**Spend, Your time, Task times** (topic 64), and the counts read **"Messages sent"**.

**Five sub-blocks, one worker each.** Every one ends with `npm run ci` green, its output in the
report; 7b, 7c and 7d also run `npm run ui-check` (Playwright, under the lock `set` names) and
save their screenshots, both themes, as `$MENKAR_FILES/‹worker›-43-b7‹x›-*.png`.

| Sub-block | Needs | Files it touches (no other) | Runs beside |
|---|---|---|---|
| **7a** the readings the views need, core only | — | `src/core/usage/{bursts,flow,nodes,history}.ts` (history: one SELECT, below), new `src/core/usage/sections.ts`, new `src/core/usage/timeline.ts`, `tests/core/usage/{bursts,flow}.test.ts`, new `tests/core/usage/{sections,timeline}.test.ts` | anything not touching those files |
| **7b** the shell: the left bar, the scope at its foot, the carry, the two readings' path, Spend moved | 7a | `src/renderer/usage.ts`, new `src/renderer/usage-spend.ts`, new stubs `src/renderer/usage-time.ts` and `src/renderer/usage-tasks.ts`, `src/renderer/usage.css`, `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/preferences.ts` (the two handlers), `src/main/usage.ts`, `src/main/usage-query-worker.ts`, `src/core/i18n/{en,es}.ts` (**every** key of 7b–7d), `e2e/usage-window.spec.ts`, new `e2e/usage-sections.spec.ts` | nothing of plan 43 |
| **7c** Your time: the day and the week | 7b | `src/renderer/usage-time.ts`, new `src/renderer/usage-time.css`, new `e2e/usage-time.spec.ts` | **7d** |
| **7d** Task times | 7b | `src/renderer/usage-tasks.ts`, new `src/renderer/usage-tasks.css`, new `e2e/usage-tasks.spec.ts` | **7c** |
| **7e** the docs, and "Task flow metrics" closed | 7c, 7d | `docs/spec/usage.md`, `docs/preferences.md` (its Usage window part), `docs/usage.md`, `docs/NOT_BUILT_YET.md`, `docs/history/{NOT_BUILT_YET,usage,preferences}.md`, `docs/history/spec/usage.md` | anything not touching those files |

7c and 7d run in parallel because 7b writes every string they need and the empty modules they
fill: a worker of 7c or 7d that needs a key 7b did not write asks `set`, it does not add it (both
would edit `en.ts`). **No .deb is cut between 7b and 7d**: after 7b, Your time and Task times show
their header and an empty body.

**What exists, read from the tree on 2026-11-18:**

- **The page** — `src/renderer/usage.ts` (591 lines), one module: its `state` (`:42–58`; the
  period, the view, the metric, the stack, the month stepper, `allProjects`), one
  `askReport = latestOnly()` (`:60`), the header with the period's toggles and the scope button
  `[data-key="all-projects"]` shown only when the report carries a project (`:395–422`), the
  table (`:146–220`), the chart (`:237–373`), the footer (`:377–390`), the turning star while a
  report is on its way (`:534–549`, decision 1.131), `refresh` (`:552–562`), `main` (`:564–589`).
  Its CSS is `usage.css` (222 lines) over `windows.css`; its page `usage.html`.
- **Settings' left bar**, the precedent the human named: `src/renderer/settings.ts:505–575`
  (`nav.section-list` with `role="tablist"`, `button.section-item` with `role="tab"`,
  `aria-selected`, an icon and a label; Up and Down move through it, `:557–566`; the title in
  `.settings-header` over it) and `windows.css:63–127` (`.settings` is a 250 px grid column; the
  Usage window's is **180 px**, as approved).
- **The window** is 760 × 600 (`src/main/windows.ts:94–95`), the size the mock-ups were drawn at;
  it does not change.
- **The one path today**: `'usage:view'` (`src/shared/ipc.ts:104`), `MenkarApi.usage.view`
  (`ipc.ts:278–280`), the preload (`src/preload/index.ts:97–99`), the handler resolving the opener
  window's shown project (`src/main/preferences.ts:152–160`), `usageView` — a pass on the
  one-at-a-time runner, then the report in `usage-query-worker.ts` (`src/main/usage.ts:110–128`,
  `queryInWorker` `:70–85`) — and the worker's `Query` and `answer`
  (`src/main/usage-query-worker.ts:18–74`).
- **The journal reaches the history only after a pass**: `importActivity()`
  (`src/main/activity.ts:211–222`, one chain: rotate, then import in a worker) is called in the
  pass's `after` (`src/main/index.ts:136–141`, "never beside one: both open the history"), which
  `PassRunner` does **not** await (`src/main/usage.ts:44–48`). So `usageView`'s answer may not hold
  the last hour's activity.
- **The readings** (blocks 5–6): `readActivity` (`bursts.ts:198`), `activityDay` (`:162`),
  `activityWeek` (`:177`), the private `counted` (`:127`, which already computes the away
  periods); `taskFlow` (`flow.ts:71`); `UsageHistory.humanActions` (`history.ts:692`),
  `taskStateRows` (`:767`), `firstOpened` (`:645`); the types in `nodes.ts:152–219`. What they
  **lack** for the mock-ups: the away periods of a day (hatched in the day and the strips), each
  week day's bursts (the strips), a burst's messages per project (the hover's third line), and
  the flow's done / dropped / open counts and its baseline's date (the summary and the
  footnote). 7a adds exactly those (granted by `set`, 2026-11-18).
- **e2e**: `e2e/usage-window.spec.ts` (755 lines) — `openUsage` clicks `[data-key="all-projects"]`
  and waits for `aria-pressed="true"` (`:43–61`); `pressed(page, group)` reads
  `[data-toggles=…] [aria-pressed="true"]` (`:73–74`); `delayPeriod` holds one answer back by
  replacing the invoke handler (`:216–233`); USG-44 asserts the window opens on 7 days and Totals.
  `e2e/activity.spec.ts` writes and reads the journal in a launched app's data dir.

#### The design

**The window** (`menkar-t107-6-scope-place-*`, right):

- **Left bar, 180 px**, Settings' look and classes (`settings-side`, `settings-header`,
  `section-list`, `section-item`), with a modifier in `usage.css` for the width. Title "Usage"
  (`usage.title`, unchanged). Three tabs, `data-section` = `spend` | `time` | `tasks`, labels
  "Spend" / "Your time" / "Task times", icons the three paths of `draw.js:40–44` (usage, activity,
  flow) in `svg.icon`. Up and Down move through them as in Settings. The window opens on **Spend**.
- **The scope at the foot of the left bar** (topic 63): a small dim label "Projects" and two
  stacked buttons, the opener project's name (`data-key="this-project"`) and "All projects"
  (`data-key="all-projects"`), each with `aria-pressed`. Shown only when the last answer carries a
  project (as `usage.ts:411` today); a Usage window with no opener has no foot. The selector and
  `aria-pressed` of "All projects" are today's, so `openUsage` and the 1.15 tests run unchanged.
- **The header holds only the section's period**, one `[data-toggles="period"]` for every section
  so `pressed()` reads any of them: Spend — Today, 7 days, 30 days, Month (as today; the stepper
  and All stay in Spend's body); Your time — Day, Week (`data-value` `day` | `week`); Task times —
  7 days, 30 days (`7d` | `30d`).
- **Spend's body is today's**, moved, not changed: Totals and By day, the metric and the stack,
  the stepper, the footer. Its tests (USG-39 to USG-54, LOOK-50, LOOK-51, 1.15, 1.24, 1.131, plan
  17) keep passing; a test may change only to click Spend first if it switches sections.

**The periods across sections** (1.184; the reading of its example decided by `set`,
2026-11-18, now in §2.8):

- The state lives in **the page's memory for the window's life** (the `state` of `usage.ts`), as
  Totals' expanded rows do (`docs/usage.md`, "Totals' tree"). Not in `localStorage` and not in
  `state.json`: a remembered stepped-back day would reopen stale, a window's scope depends on its
  opener, and USG-44 holds that the window opens on Spend, 7 days (`set`, 2026-11-18).
- **`src/core/usage/sections.ts`** (new, Node-free, pure — the rule is tested in Vitest, the page
  only calls it):

  ```ts
  export type UsageSection = 'spend' | 'time' | 'tasks'
  export type SpendPeriod =
    | { readonly kind: 'today' | '7d' | '30d' }
    | { readonly kind: 'month'; readonly stepper: StepperState }
  export type TimePeriod =
    | { readonly kind: 'day'; readonly day: Day }
    | { readonly kind: 'week'; readonly first: Day } // seven days from `first`
  export type TasksPeriod = '7d' | '30d'
  export interface Sections {
    readonly shown: UsageSection
    readonly spend: SpendPeriod
    readonly time: TimePeriod
    readonly tasks: TasksPeriod
    // the shown section's period was picked there on this visit, or carried into it on entering
    readonly chosen: boolean
  }
  export function initialSections(today: Day): Sections   // the month stepper stays the page's
  export function choose(s: Sections, period: SpendPeriod | TimePeriod | TasksPeriod): Sections
  export function switchTo(s: Sections, to: UsageSection, today: Day): Sections
  export function currentWeek(today: Day): Day        // addDays(today, -6)
  export function weekOf(day: Day, today: Day): Day   // the week of the stepping grid holding day
  export function stepTime(p: TimePeriod, by: -1 | 1): TimePeriod  // a day, or seven days
  export function timeToggle(p: TimePeriod, kind: 'day' | 'week', today: Day): TimePeriod  // Day ↔ Week
  export function timeArrows(p: TimePeriod, firstDay: Day | null, today: Day):
    { readonly previous: boolean; readonly next: boolean }
  ```

  - `initialSections`: Spend 7 days, Your time the current week, Task times 7 days, shown Spend,
    `chosen` false.
  - **The carry.** A period's *span* is `today`, `7d`, `30d` or none: Spend's Today, 7 days and 30
    days are theirs, Month (and All) none; a Day is `today` **only when it is today**; a Week is
    `7d` **only when it is the current one** (the seven days ending today); Task times' are theirs.
    On `switchTo`, when `chosen` and the span is one the target has (Spend: all three; Your time:
    `today` → Day on today, `7d` → the current week; Task times: `7d`, `30d`), the target takes it
    and `chosen` stays true; otherwise the target keeps its own and `chosen` becomes false. `choose`
    sets the shown section's period and `chosen` true. A step of the month, the day or the week is a
    `choose`.
  - **Inside Your time** (my choice, not decided elsewhere): Day → Week shows `weekOf` the day
    shown; Week → Day shows today when the week is the current one, else the week's last day; a
    click on a week's day is `choose({kind: 'day', day})`. Weeks step by seven days on a grid
    ending today, so the current week and 7 days are the same days (`periodBounds('7d')`,
    `periods.ts:38–41`). The arrows: next stops at today (the current week); previous at the
    history's first day (`firstDay`, from `firstOpened`), or at today when the history is empty.
- **The scope** is one flag, `allProjects`, sent with every ask: it is carried always.

**The two readings, off the UI path, as the report is:**

- **Types** (`nodes.ts`, beside `UsageWhich`/`UsageView`; `Day` imported as a type from
  `periods.ts`):

  ```ts
  export type ActivityWhich =
    | { readonly kind: 'day'; readonly day: Day }
    | { readonly kind: 'week'; readonly first: Day }
  export interface ActivityView {
    readonly which: ActivityWhich
    readonly reading:
      | { readonly kind: 'day'; readonly day: ActivityDay }
      | { readonly kind: 'week'; readonly week: ActivityWeek }
    readonly firstDay: Day | null        // the history's first turn's day, for the arrows
    readonly projectNames: readonly (readonly [string, string])[]  // for the hover's line
    readonly tooNew: boolean
    readonly project: { readonly id: string; readonly name: string } | null
    readonly scoped: boolean
  }
  export interface TaskFlowView {
    readonly period: '7d' | '30d'
    readonly flow: TaskFlow
    readonly tooNew: boolean
    readonly project: { readonly id: string; readonly name: string } | null
    readonly scoped: boolean
  }
  ```
- **IPC** (`src/shared/ipc.ts`, beside `'usage:view'`): `'usage:activity': { request: { which:
  ActivityWhich; allProjects: boolean }; response: ActivityView }` and `'usage:flow': { request:
  { period: '7d' | '30d'; allProjects: boolean }; response: TaskFlowView }`; `MenkarApi.usage`
  gains `activity(which, allProjects)` and `flow(period, allProjects)`; the preload maps them. The
  handlers in `src/main/preferences.ts` resolve the opener's project exactly as `'usage:view'`
  does (`:152–160`).
- **Main** (`src/main/usage.ts`): `activityView(which, projectId, allProjects)` and
  `flowView(period, projectId, allProjects)` each `await usageRunner?.request()` (the human's turns
  reach the history; a request joins a running pass), **then `await importActivity()`** (the
  journal up to this moment; its one chain keeps it from running beside another import, and
  calling it after the pass keeps it from running beside the pass, the rule of `index.ts:136–137`),
  then `queryInWorker`. The flow waits for the pass too, for that same rule. Cost: one pass and one
  import before each answer, as Spend's pass today; the star covers the wait (1.131). Rejected:
  reading without the import (the flow would lag the Board by up to an hour, against the human's
  own memory of what just happened); a long-lived query worker (none exists; each query opens and
  closes the history, `usage-query-worker.ts:41–73`).
- **The worker** (`usage-query-worker.ts`): `Query` gains
  `{ kind: 'activity'; which; project; scoped; projectNames }` → bounds `midnight(day)` to
  `midnight(addDays(day, 1))`, or `midnight(first)` to `midnight(addDays(first, 7))`;
  `readActivity(history, bounds, now, scoped ? id : undefined)`; then `activityDay` or
  `activityWeek`; `firstDay` from `firstOpened()`. And `{ kind: 'flow'; period; project; scoped }`
  → `b = periodBounds(period, now)`; `taskFlow(history.taskStateRows(b.start, b.end, scoped ? id :
  undefined), b, now)`. Both carry `tooNew` and `project`/`scoped` as the report does (`:57–70`).
- **The page**: the one `askReport = latestOnly()` serves the three asks. Any newer ask — a
  period, a step, a section switch, the scope — drops an older answer, whatever section it was
  for (decision 1.131: a late answer to an older choice is dropped). While an answer is on its way
  the body gives way to the turning star; the left bar, its foot and the header stay usable.
  A section switch always asks (no cache): the figures change as the human works.

**7a's additions to the readings** (granted by `set`, 2026-11-18):

- `ActivityDay.away: readonly Bounds[]` and `ActivityWeekDay.away` — the away periods clipped to
  the day (from what `counted` already computes); `ActivityWeekDay.bursts: readonly
  ActivityBurst[]` — the day's clipped bursts, as `ActivityDay.bursts`.
- `ActivityBurst.byProject: readonly { project: string | null; messages: number }[]` — the whole
  burst's messages per project id, most first, ties by id; `null` for a turn with no project. For
  it, `humanActions`' message SELECT adds `project_id` (`history.ts:700`, reading only; the write
  path, `rederive` and the schema stay out — plan 39 P1a.6's), `ActivityRows.messages` gains
  `project: string | null`, `HumanAction` an optional `project`.
- `TaskFlow` gains `done`, `dropped` and `open` — of the `tasks` counted, each one's state at
  `min(now, bounds.end)` (its last row at or before it): `done`, `dropped`, anything else open;
  `done + dropped + open = tasks` — and `baselineAt: number | null`, the earliest `at` of a
  baseline row that marked a task (`sinceBaseline > 0`), else null.
- **`flowTable(flow): FlowRow[]`** in `flow.ts` (Node-free; the page draws its rows; `FlowRow` is
  `{kind: 'state', state, figure, share}` or `{kind: 'waiter', state, waiter, figure, share}`,
  `REVIEW_WAITERS` exported): per state in
  `FLOW_STATES` order a row, then its waiters' rows. **To review always lists its four waiters**,
  `REVIEW_WAITERS` order (orchestrator, human, pr-approval, pr-merge), a zero one with `tasks` 0
  (drawn dim, "—"), as the mock; **waiting always lists topic and session**, then `other` and none
  only when they hold a task. Each row has `share = totalSeconds / the largest state total`
  (0 when all are 0).
- **`src/core/usage/timeline.ts`** (new, Node-free): `countAxis(tallest)` — the top is the first
  multiple of a 1, 2 or 5 × 10^n step at or above `max(tallest, 5)`, the step the smallest that
  leaves at most five intervals (1.14's rule for counts, which have no 2.5); `along(at, bounds,
  width)` — a moment's x in a day by its share of the day's seconds, so a 23- or 25-hour day is
  drawn true (`ActivityDay.hours` has 23 or 25 entries, `nodes.ts:169`); `bandLabel(seconds,
  pixels)` — the length's text and whether it fits inside (as `draw.js:197–200`).

**Your time** (7c; `menkar-t106-1-day-*`, `menkar-t106-2-week-strips-*`, `menkar-t107-2-*`):

- **Day**: a stepper (`[data-key="previous"]`, `[data-key="day-name"]` — weekday, day and month
  long through `Intl.DateTimeFormat` in the app's language, the year only when not this year —,
  `[data-key="next"]`); a summary line (`[data-key="time-summary"]`): "Active 4.1h · 1 burst(s) ·
  38 messages sent · 6 prompts answered"; the plot filling the room left, as By day's
  (`usage.ts:235–249`): a lane on top with the **bursts as bands** (`[data-burst]`, the band's
  length inside it or under it when it does not fit, ‹ or › on an end the day clips), a burst of
  one action as a tick, **away hatched** (`[data-away]`), and per hour **messages sent and prompts
  answered** as two bars side by side (colours `SLOT_COLORS[scheme][0]` and `[3]`, bands `[6]`,
  away `GRAY`, as `draw.js:5–11`), the count axis from `countAxis`, the hours 00–23 under them
  (a DST day labels its hours from their bounds); a dashed "now" line on today; "No activity on
  this day." on an empty one; the legend (Bursts, Messages sent, Prompts answered, Away). **The
  hover on a band** (a card, not a `<title>`; `[data-key="burst-tip"]`): its whole start – end and
  length; "‹clipped part› on this day" when the day clips it; "N messages sent · M prompts
  answered"; in All projects only, its `byProject` as "Shop 29 · Blog 12" (names from
  `projectNames`, `usage.noProject` for null). The footer: the bursts' sentence and the Q7 line
  (mid-turn messages not counted yet), as `mock.spec.ts:17–18` with "messages sent".
- **Week**: a stepper (`[data-key="week-name"]`, "12 – 18 November" through
  `Intl.DateTimeFormat.formatRange`); a table on a card as Totals', one row per day
  (`[data-day="YYYY-MM-DD"]`): the day's short name (today's bold), its strip (bands, ticks, away
  hatched, the 6-hour grid, "now" on today), Active, Messages sent, Prompts; a Total row; the
  heading Day · 00 06 12 18 24 · Active · Messages sent · Prompts. **A click on a row opens that
  day** (a hover shows ›). The footer: the bursts' sentence, "Active: the time inside bursts.
  Click a day to see it by the hour.", the Q7 line.

**Task times** (7d; `menkar-t106-3-flow-7d-both-*`, `menkar-t107-3-flow-7d-*`, the empty one
`menkar-t106-3-flow-empty-*`):

- A summary line (`[data-key="flow-summary"]`): "14 tasks · 9 done · 1 dropped · 4 open", and
  "◦ 3 from their baseline" when `sinceBaseline > 0`.
- A table on a card (`flowTable`'s rows): State / waiting on · Tasks · Median · Total · Share (a
  bar `share` of the column's width, the state's colour — queued `GRAY`, in progress
  `SLOT_COLORS[0]`, waiting `[1]`, to review `[2]`, waiters at 0.7 opacity). States bold; waiting
  and to review fold their waiters (▾/▸, open at first, kept for the window's life). Labels:
  Queued, In progress, Waiting, To review; waiters: "on a topic (you)", "on a session", "on
  something else", "not said" (null); "the orchestrator", "you", "a PR's approval", "a PR's merge".
  Durations through `formatDuration` (`nodes.ts`).
- The footer: "Median: the middle task's time in that state. Total: every task's time added up.
  Open tasks count until now." and, when `sinceBaseline > 0`, "◦ N tasks were already open when
  recording started (‹baselineAt's date›): counted from then, not from their creation."
- **No task**: the card says "No tasks in this project in these 7 days." (or 30, or "in any
  project" in All projects), the summary "0 tasks", the footer "Tasks exist in projects with the
  orchestration mode on."
- `tooNew` in either new section shows Spend's too-new page (`usage.ts:430–440`).

**The strings** (7b writes all of them, English and Spanish, through `t()`): the section names
"Spend" / "Gasto", "Your time" / "Tu tiempo", "Task times" / "Tiempos de tareas" (`set`'s
pick, put to the human for a veto, 2026-11-18); "Projects"; Day, Week; the summary, legend,
hover, footer and empty sentences above; the flow's labels, waiters "on something else" and "not
said" (`set`, 2026-11-18). The catalogs have no plural forms: a count reads "{n} burst(s)", the precedent of `en.ts:181` (my choice); "messages sent" and "prompts answered" read the same for any number.

#### 7a — the readings the views need (core only)

- [x] Tests first, each seen failing once against an injected defect: §2.10's rows for
  `sections.ts` (the carry), `byProject`, the day's and week's away, the flow's counts and
  `baselineAt`, `flowTable`, `countAxis` and `along`. Update the existing `toEqual`s of
  `bursts.test.ts` and `flow.test.ts` for the new fields, changing no expected figure.
- [x] `sections.ts`, `timeline.ts`; the fields in `nodes.ts`; `away` and `bursts` per day and
  `byProject` in `bursts.ts`; `project_id` in `humanActions`' message SELECT; the counts,
  `baselineAt` and `flowTable` in `flow.ts`.
- Verify: `npm run ci`.

#### 7b — the shell, the scope, the carry and the two paths

- [x] The left bar (180 px), its foot, the header per section, the `Sections` state through
  `sections.ts`; Spend's body moved to `usage-spend.ts` unchanged; `usage-time.ts` and
  `usage-tasks.ts` as stubs exporting the functions 7c and 7d fill (`timeBody(view, ctx)` and
  `tasksBody(view, ctx)`, `ctx` giving `choose`, the locale, the scheme, the scope), drawing an
  empty body.
- [x] `'usage:activity'` and `'usage:flow'`: types, IPC, preload, the handlers, `activityView` /
  `flowView` with the pass and the import, the worker's two queries; one `latestOnly` for the three.
- [x] Every string of 7b–7d in `en.ts` and `es.ts`.
- [x] `e2e/usage-window.spec.ts` passes; changed only where a test must click Spend first.
  New `e2e/usage-sections.spec.ts`: the cases of §2.10's "window" rows below (the left bar and
  its 180 px, the foot, the carry and the keep through the headers' toggles, the scope carried,
  a late answer dropped across a section switch with `delayPeriod`'s pattern on `usage:activity`,
  the star while an answer is on its way). Screenshots of the three sections' headers, dark and
  light.
- Verify: `npm run ci`; `npm run ui-check`.

#### 7c — Your time

- [ ] The day and the week as above, in `usage-time.ts` and `usage-time.css`.
- [ ] New `e2e/usage-time.spec.ts`, over seeded data (below): §2.10's "Your time" rows.
  Screenshots, dark and light: a day with bursts and away, the hover, an empty day, the week,
  All projects' hover with its per-project line.
- Verify: `npm run ci`; `npm run ui-check`.

#### 7d — Task times

- [ ] The flow as above, in `usage-tasks.ts` and `usage-tasks.css`.
- [ ] New `e2e/usage-tasks.spec.ts`, over seeded data: §2.10's "Task times" rows. Screenshots,
  dark and light: 7 days, 30 days, a project with no tasks.
- Verify: `npm run ci`; `npm run ui-check`.

**Seeding the e2e** (7c, 7d): in `launchApp`'s `prepare`, transcripts with turns of origin `human`
(as `usage-window.spec.ts:10–40`), and a journal at `<data>/menkar/activity/journal.jsonl` holding
`JournalEvent` lines (`src/core/usage/activity.ts`) — `away`/`back`, `prompt_answered`, `present`,
`task_state` with and without `baseline` — plus the `activity/baseline` marker so the start adds
no baseline of its own. The start's pass imports it (`index.ts:138–141`), and each ask imports
again. Times are **yesterday and the days before, at fixed local hours** (10:00–14:09 and so on):
never relative to now within today, so a run near midnight or before 10:00 draws the same.
Invented names only ("Shop", "Blog").

#### 7e — the docs, and "Task flow metrics" closed

- [x] `docs/spec/usage.md`: the Usage window's three sections, what each shows, the carry and the
  scope (what the user sees), replacing "Built: … plan 12 built it" with the current pointer.
- [x] `docs/preferences.md`, its Usage window part (`:82–86`, the e2e list `:115–116`): the left
  bar, the three paths, the pass and the import before an answer, one `latestOnly`, the new specs.
- [x] `docs/usage.md`: "The Usage window" gains the sections, the carry rule with its date and
  why the periods live in the page's memory; "Bursts" and "The task flow" name `byProject`,
  `away` per day, the counts and `baselineAt`; why the flow waits for a pass.
- [x] `docs/NOT_BUILT_YET.md`: "Task flow metrics" deleted, verbatim to
  `docs/history/NOT_BUILT_YET.md`; every replaced line of the three other docs to its history
  file (`docs/history/README.md`), as `npm run ci`'s history check asks.
- Verify: `npm run ci`.

## 6. Decisions and questions

Asked of `set` on 2026-11-18. Q1–Q5 are decided; Q7 is open; Q6 waits for block 4's mock-ups. My
pick first where open.

Block 7's gaps (task 110: the carry's reading, where the periods live, the hover's per-project
line, the flow's counts, the new strings) were answered by `set` on 2026-11-18 and are written in
§2.8 and block 7; `set` puts the carry's reading and the strings to the human for a veto. No
question of block 7 is open.

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

### Block 6 — `menkar-t109` (task 109), 2026-11-18

Built: new `src/core/usage/flow.ts` — `TaskStateRow`, `FLOW_STATES`, `taskFlow(rows, bounds, now)`;
`UsageHistory.taskStateRows(low, high, project?)` at the end of the class (reading only: the rows in
range and each task's last row before `low`, one `UNION ALL`; no write path, schema or version
change); in `nodes.ts` the types the page receives (`FlowState`, `FlowFigure`, `FlowStateFigure`,
`TaskFlow`); `menkar usage export --rows tasks` (`export.ts`: `TASK_EXPORT_KEYS`,
`exportTaskRows`, `exportTaskCsv`; `cli.ts`: the choice). Docs: `docs/usage.md` — a section "The
task flow", the export's usage line, a "Task rows" key table at the end; the replaced lines in
`docs/history/usage.md`; `usage.cli.exportHelp` in `src/core/i18n/{en,es}.ts` names `--rows tasks`.
Granted by `set`, 2026-11-18: `docs/NOT_BUILT_YET.md`'s "Task flow metrics" now says only the view
is unbuilt, its old line in `docs/history/NOT_BUILT_YET.md`.

Tests: `tests/core/usage/flow.test.ts` (§2.10's flow row and its 10:00 clip, a baseline inside the
window counted from it and marked and one before it not, two rows in the same state as one
stretch, dropped and done ending a wait, the median per task across stretches, tasks told apart
by project and rows out of order, nothing past now or the window, a review with no waiter, and on
a real history the 30-day and 7-day windows with a task begun 40 days before, a task closed
before the window, the project scope and the baseline flag read back); in
`tests/core/usage/export.test.ts`, `--rows tasks`'s rows, scope, CSV and its documented table, and
the activity table test now stops at "### Task rows". Seen red, each restored: the baseline mark
ignoring the window, never marked, no clip at the window's start, the open stretch dropped, rows
unsorted, the median per stretch, terminal rows counted, tasks merged across projects, the
even median's upper middle, the last row before the window not read, `baseline` not read back;
the export tests before the code.

How §2.8 was read: it asks for "median and total per state and per whom it waits on" and says
nothing per stretch, so the median is per task (a task's whole time in that state, or with that
waiter, inside the window), as the task's brief proposed.

Choices the plan left open (mine):
- **The median is of the clipped part**, not the whole stretch: the view says "over 7 or 30 days",
  the total must be the window's time, and a median of whole stretches would describe time the
  total leaves out (a task queued for 40 days would show 40 days in a 7-day view). Both figures
  then describe the same time.
- **Marked** (`sinceBaseline`) only when the task's first row is a baseline **inside** the window:
  one whose baseline is before the window start is known for the whole window, so marking it
  would flag every old task forever.
- A task counts in a state only with time in it inside the window; zero-length stretches (two rows
  at one instant) count nothing. `done` and `dropped` count no time and end the stretch before them.
- Waiters are grouped by `wait_kind` as stored (`session`, not each session's id); a waiting or to
  review row with none recorded counts in its state under waiter `null`. Order: topic, session,
  other, orchestrator, human, pr-approval, pr-merge, any other, then null.
- An open stretch runs to `min(now, bounds.end)`; a window after now is empty.
- The task export: keys `schema, event, at, at_epoch, project, task, state, wait_kind, wait_ref,
  assignee, baseline` (`baseline` a boolean); in range by its `at`, so the last-row-before rows
  the reading needs are not exported.

Not reached yet: nothing calls `taskFlow` / `taskStateRows` outside the tests; block 7 (the Task
flow section, through `usage-query-worker.ts`) is their consumer.

### Block 7a — `menkar-t111` (task 111), 2026-11-18

Built: new `src/core/usage/sections.ts` — `UsageSection`, `SpendPeriod`, `TimePeriod`,
`TasksPeriod`, `Sections`, `initialSections(today)`, `choose`, `switchTo`, `currentWeek`, `weekOf`,
`stepTime`, `timeToggle`, `timeArrows`; new `src/core/usage/timeline.ts` — `countAxis`, `along`,
`bandLabel`; in `nodes.ts`, `ActivityBurst.byProject`, `ActivityDay.away`,
`ActivityWeekDay.{bursts,away}`, `TaskFlow.{done,dropped,open,baselineAt}`; in `bursts.ts`,
`HumanAction.project`, `ActivityRows.messages[].project`, `Burst.byProject`, the away periods
clipped per day and each week day's bursts (one `readDay` for both); in `history.ts`, `project_id`
in `humanActions`' message SELECT only; in `flow.ts`, the counts, `baselineAt`, `REVIEW_WAITERS`,
`FlowRow` and `flowTable`.

Deviations, agreed with `set` (2026-11-18): `initialSections(today)` takes no month (Spend starts on
7 days and a Month period carries its own stepper, so the stepper stays the page's); `timeToggle`
added for Day ↔ Week inside Your time, which 7b consumes. Block 7's signature list says both.

Tests: `tests/core/usage/sections.test.ts` (new: the window's start, every carry and keep of
§2.10, 1.184's example, a stepped-back day and week, a week chosen as current carrying nothing
past midnight, inside Your time, the arrows, a step across a year and across Santiago's
midnight daylight-saving change); `tests/core/usage/timeline.test.ts` (new: `countAxis`'s cases,
`along` on a 25-hour day, `bandLabel`); `bursts.test.ts` (`byProject`, the day's and week's away
across midnight, each week day's bursts equal that day's, the project read back from the
history); `flow.test.ts` (the counts with a task done after the window and now before its end,
`baselineAt`, `flowTable`'s rows and shares). The existing `toEqual`s needed no figure changed:
the bursts' compare spans or `objectContaining`, the flow's compare figures; the bursts' row
literals gained `project: null`. Seen red, each restored: the carry ignoring `chosen`, any day as
today, any week as current, `weekOf` rounding, the arrows with no history, Week → Day on its first
day, `byProject` unsorted, a null project first, away unclipped, a week day without bursts, the
project not read, a task's state read past the window's end, the latest baseline, a baseline before
the window marking, waiting without its session row, the share off, no floor of 5, a 2.5 step, a
24-hour day.

Choices the plan left open (mine):
- `byProject` ties sort by id, a turn with no project after every project; a burst with no
  message has an empty `byProject`.
- An away clipped to nothing in a day (it only touches the day's edge) is not in that day's `away`.
- `switchTo` the section already shown returns the state unchanged (`chosen` kept).
- `flowTable`: a waiter other than the always-listed ones is listed only because it holds a task
  (the flow's waiters exist only with time in the window); rows follow the flow's waiter order.
- `countAxis(6)` is top 6, step 2 (three intervals): the rule as written, the first multiple at or
  above; it does not round up to 10.

Not reached yet: nothing outside the tests calls `sections.ts`, `timeline.ts` or `flowTable`; 7b
(the page and the two paths), 7c and 7d are their consumers.

### Block 7b — `menkar-t112` (task 112), 2026-11-18

Built: the Usage window's left bar (180 px, Settings' classes, `data-section` spend | time | tasks,
Up and Down), the scope at its foot (`[data-key="this-project"]`, `[data-key="all-projects"]`,
shown only when the last answer carries a project), one `[data-toggles="period"]` per section in
the header, the `Sections` state through `sections.ts` (`choose`, `switchTo`, `timeToggle`), one
`latestOnly()` for the three asks. Spend's body moved to new `src/renderer/usage-spend.ts`
(`spendBody`, `spendWhich`, `spendAnswered`, `startStepper`; it also exports `toggles` and `svg`
for 7c and 7d); new stubs `usage-time.ts` (`timeBody(view, ctx)`) and `usage-tasks.ts`
(`tasksBody(view, ctx)`) drawing an empty body; `SectionContext` (locale, scheme, allProjects,
today, loading, `choose`, `render`, `star`) and `SectionBody` (`nodes`, optional `draw`) are
exported as types from `usage.ts`. The path: `ActivityWhich`, `ActivityView`, `TaskFlowView` in
`nodes.ts` (types only, granted by `set`), `'usage:activity'` and `'usage:flow'` in `ipc.ts`, the
preload, the two handlers in `preferences.ts` (one `openerProject` shared with `'usage:view'`),
`activityView` / `flowView` in `src/main/usage.ts` (the pass awaited, then `importActivity()`, then
the worker), the worker's `activity` and `flow` queries. Every string of 7b–7d in `en.ts` and
`es.ts` (`usage.section.*`, `usage.scope.projects`, `usage.readFailed`, `usage.time.*`,
`usage.tasks.*`).

Deviations, agreed with `set` (2026-11-18): the three view types added to `nodes.ts`, which the
file table did not list; the fill-the-window test measures By day's chart against the section's
pane, not the window (the left bar takes 180 px, decision 1.184) — one changed `expect`, which
`check-test-integrity` reports.

Tests: new `e2e/usage-sections.spec.ts` — the window opens on Spend, 7 days, the bar 180 px, each
section's own toggles, Up and Down (dark and light); the foot, All projects carried to Your time
and Task times' asks and kept pressed, back to this project; no opener, no foot; the carry and the
keep through the headers (Spend 30d → Task times 30d, Your time keeps its week, Month kept, Today →
Day on today, the current Week → 7 days in both); a late answer across sections dropped, the star
held while Spend's slower answer is on its way, the bar usable. Seen red, each restored: the
switch not carrying, Task times reset on entry, the scope reset on entering Your time, the guard
dropped from the flow's answer, a 250 px bar. `e2e/usage-window.spec.ts` passes with the one
changed `expect` above.

Choices the plan left open (mine):
- "All projects" still turns back to this project when pressed again (the 1.15 test clicks it
  twice); "this project" sets it.
- The foot is its own bordered group, not `.segmented` (a vertical stack would break the
  controls test's divider check, which reads left borders).
- A refused ask shows `usage.readFailed` in the body instead of a star turning for ever.
- The too-new page keeps the left bar; the header goes, as before.
- A section shown for the first time shows the star, not "Reading the transcripts…" (kept for
  Spend's first answer).
- The tab that had the focus keeps it across the redraw an answer brings (found by the Up/Down
  test: the bar is drawn again with every answer).
- "{n} task(s)" for the summary, as the plan's "{n} burst(s)"; Spanish "preguntas respondidas"
  for prompts answered, after `topics.permissionTitle`'s "pregunta de permiso".

Found, not changed: after `await usageRunner.request()`, a pass another ask starts while this
ask's `importActivity()` runs would open the history beside the import; the plan's ordering keeps
each ask's import after its own pass, not after every later one.

### Block 7c — `menkar-t113` (task 113), 2026-11-18

Built: Your time's day and week in `src/renderer/usage-time.ts` and new `usage-time.css`, as block 7 describes, over 7a's readings and 7b's shell. Test: new `e2e/usage-time.spec.ts`.

The seed is a history from yesterday and three days ago, at fixed local hours:
- Shop: messages at 10:05–10:52 (six in hour 10), 13:05 and 14:09.
- Blog: messages at 11:10 and 13:40.
- Presence marks in Shop that join them, away 12:00–12:20, prompts answered at 11:15 and 13:20, and a lone mark at 18:30.
- One message three days ago.

The transcripts are in the temporary HOME, and the journal is in its data dir before launch.

The spec checks:
- **The week**: seven `[data-day]` rows, today's last, a Total. Yesterday's strip has 3 bursts and 1 away, with 8 messages. › is disabled on the current week.
- **A click on yesterday's row**: Day on yesterday, with its name.
- **The day**:
  - The summary reads 3 burst(s), 8 messages sent, 2 prompts answered.
  - 3 bands, one of them a tick, and 1 away. Hour 10 has 6 messages and hour 11 one prompt.
  - 24 hours, and no "now" on a past day.
- **The hover** (scoped): "start – end · 1.9h", "6 messages sent · 1 prompts answered", no project line. It hides when the mouse leaves.
- **All projects**: 10 messages, and the hover reads "7 messages sent …" and "Shop 6 · Blog 1".
- **The steps**: one day back is empty ("No activity on this day.", 0 burst(s)). The history's first day disables ‹. Three steps with › reach today, which disables › and draws "now".

Seen red, each defect restored:
- a row click opening the wrong day: failed on the day's name;
- the per-project line dropped: failed on "Shop 6 · Blog 1";
- the day's away not drawn: failed on the `[data-away]` count.

Deviation from §2.10's row: it seeds "10:05–14:09 one burst, away 12:00–12:20". Away ends a burst (§2.5, the bursts' own test), so an away inside 10:05–14:09 makes two bursts: 10:05–11:58 and 12:21–14:09. The spec seeds and asserts two, plus a lone tick, so that the screen shows away ending a burst. Everything else in the row is asserted as written.

Choices the plan left open (mine):
- A band's label is the length drawn on this day (the clipped part). The hover gives the whole length and "… on this day".
- Clock times in the hover use the app language's own conventions (`Intl` with `hour: '2-digit'`), so en-US reads "10:05 AM". The mock showed 24-hour times.
- The week's name adds the year only when the week is not in this year, as the day's name does.
- The week's columns have 8 px gaps and Prompts is 7ch wide, so the strips keep about 190 px beside "Messages sent", which is wider than the mock's "Messages".
- A week row is `role="button"` with `tabindex="0"`, so Enter and Space open the day as a click does.
- One hatch pattern (`#usage-time-hatch`) in an out-of-flow SVG serves every plot on the page, because an id belongs to the whole document.
- Summary: "{n} burst(s)" counts ticks as bursts, as `ActivityDay.bursts` does.

### Block 7d — `menkar-t114` (task 114), 2026-11-18

Built:
- Task times in `src/renderer/usage-tasks.ts` and the new `usage-tasks.css`:
  - the summary;
  - `flowTable`'s rows, with median, total and share;
  - To review's four waiters always listed, empty ones dim with "—";
  - Waiting and To review folding, kept for the window's life;
  - the footer and the baseline's footnote with its date;
  - the empty card per scope and period.

Tests: new `e2e/usage-tasks.spec.ts` covers §2.10's "Task times" row, plus exact figures and the fold kept across periods, over a journal seeded at fixed local hours. Seen red, each restored: the median as the total, the empty text's scope, zero waiters hidden, the footnote dropped.

Choices the plan left open (mine): an unknown waiter reads "on something else"; the empty sentence follows `view.scoped`; a state with no task is listed dim; the date is day and short month. "Share of the time" wraps over the mock's 80 px column.

Found: in progress's median of 67.5 min reads "1.1h", because `formatDuration` switches to hours at 60 min. The spec's first expectation was wrong, not the code.

### Block 7e — `menkar-t115` (task 115), 2026-11-18

Built (docs only, plus one string): `docs/spec/usage.md` describes the Usage window's three
sections, the scope at the bar's foot, the header's periods, the carry and the star, and names the
three new specs and the sections' modules; `docs/preferences.md` the shell and its modules, the
three paths, the pass then the import, one `latestOnly()`, `usage.readFailed`, the new specs and the
Vitest files; `docs/usage.md` the sections, the carry rule with its date, why the periods live in
the page's memory, the day's away, each week day's bursts, `byProject`, `timeline.ts`, the flow's
counts, `baselineAt`, `flowTable` and why the view waits for a pass, and the "up to an hour late"
limit narrowed to `menkar usage`. "Task flow metrics" left `docs/NOT_BUILT_YET.md`; the nudge's
entry now points at Your time. Every replaced line is in its history file. `usage.tasks.colShare`
reads "Share" / "Parte" (granted by `set`): no e2e asserted the old text.

Not mine to change, left for `set`: `plans/00-STATUS.md`'s 1.156 row still cites
`docs/NOT_BUILT_YET.md`, "Task flow metrics", and 1.180's row's destination is still "this row
(until built)" (the plan's exit table).

