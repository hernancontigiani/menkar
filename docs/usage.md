# Usage — how it is measured and kept

How long each agent worked and how many tokens it used, per session and project. All of it lives in
`src/core/usage/`, and every figure the app or `menkar usage` shows is read from there. The code
says what each step does. This file keeps why it is shaped this way, and what was rejected. What the
user sees in the Usage window is `docs/spec/usage.md`.

## The shape

- **Two files.** The **cache** (`<cache>/usage.sqlite`, `cache.ts`) is derived data, rebuilt from
  the transcripts whenever its layout version changes; each agent other than Claude Code keeps its
  own beside it (Codex's `usage-cache-codex.sqlite`). The **history** (`<data>/history.sqlite`,
  `history.ts`) is the only file reports read, one row per turn, never pruned: it keeps what Claude
  Code deletes with its transcripts.
- **A pass** (`pass.ts`): the cache reads what each transcript gained since the last pass. Then every
  turn the pass may have changed is copied whole into the history, together with the turn before it
  in its session, because a turn read later takes responses from it. A turn the cache no longer has
  is never touched.
- **A failed write loses nothing.** The turns a pass changed are recorded as pending in the cache, in
  the same transaction as the new read offsets. They leave the pending set only after the history
  commits. A history locked past the 30-second busy timeout, a full disk, or a history from a newer
  Menkar leaves them for the next pass, and writing a turn twice is the same as writing it once.
- **Off the UI path.** `node:sqlite` and the transcript reads are synchronous. In the app a pass
  runs on a worker thread (`src/main/usage-worker.ts`, a second main entry in
  `electron.vite.config.ts`). `PassRunner` runs one pass at a time, and a request made during a pass
  waits for it, since both would read the same appended bytes. Main starts a pass on launch and
  every hour. For now it passes no memberships, because projects do not exist yet: such turns are
  written with no project and take their session's project once it has one.
- **`menkar usage`** is the app's own binary. When main sees `usage` as the first argument (after
  Chromium's switches and, unpackaged, the app's folder), it runs the report synchronously, prints
  it and exits before `ready`, so no window opens and no display is needed. Checked on 2026-11-08
  under `env -i`, with no `DISPLAY`.
- **Two openers at once.** The app's workers and a poller of `menkar usage now` may open the cache
  and the history together. `BEGIN IMMEDIATE` and the busy timeout serialize their writes, and each
  history migration step, the history's creation and the cache's rebuild read the version again
  inside their transaction and do nothing when another opener moved it first.
- **Turns imported at an earlier first start** stay in the history like any other (decision 1.68,
  2026-11-11: there is no import any more). Their statusline log, copied into the data directory
  then (`importedStatuslineLogPath`), keeps its fixed name and is read before Menkar's own
  `usage.jsonl`, so those turns keep their exact cost; a machine without it reads nothing there.

## Per agent

- **A pass reads every agent whose data exists** (`runPass` loops each kit's `UsageSource`, which
  opens a `TurnSource` over the agent's own cache), installed or not, so the history keeps an
  agent's turns after its CLI is removed. A source whose root does not exist reads nothing and
  creates no file. Claude Code's source is the cache described here, its bytes unchanged.
- **Every agent's turns land in the one history**, with the same definition of a turn, one per
  user message (decision 1.143). How Codex's tokens, turns and context are read from its rollouts
  is in `docs/agents.md`, "Codex: usage and context".
- **Prices**: Anthropic's and OpenAI's rows live in `prices.ts`, each table with its source and the
  date it was copied. A model with a long-prompt row takes it per request: Haiku's over 100,000
  prompt tokens, OpenAI's over 272,000.

## Rejected, and why

Each was measured or decided by the human:

- **Rereading the transcripts on every report**: 3.6 s for 2 GB on the human's machine, and growing.
- **Making the cache permanent** instead of a history beside it: one row per response and per gap,
  and every layout change would need a migration of data that can be recomputed.
- **Writing a turn only once it is finished**: there is no end marker, so a turn left open would
  never arrive. Rewriting every turn a pass touched needs no such state.
- **Reports reading the cache and the history together**: two sources, two definitions of a turn.
- **JSON for either file**: sums over months of rows, and whole-file rewrites.
- **Tokens only for transcripts older than `turnOrigin`**: a month with tokens and no hours
  misleads a comparison by month.
- **Hooks to time turns**: they only cover the sessions the app starts, from the day they are
  installed.
- **Wall-clock time** (`total_duration_ms`): it counts the nights a session sat open.
- **Grouping by UTC day**: the human is at UTC−3. Days are local midnights built from calendar
  dates, never start + 24 h.
- **A live price lookup**: the app makes no network connections, so the table carries its date and
  source (`prices.ts`).
- **Writing an inherited category into the history**: a late classification would then need a
  second write to every turn after it. Categories are resolved when a report is built.

For Menkar (2026-11-08):

- **A worker per pass rather than a long-lived one**: one pass an hour, and a worker that exits
  holds no SQLite handle between passes.
- **Electron's main process for `menkar usage` instead of `ELECTRON_RUN_AS_NODE`**: the same
  binary, and no wrapper for the package to install.

## Limits

- US-only inference (1.1×) is not applied: the transcript does not say where a request ran.
- Tokens are kept per UTC hour. A day boundary splits them exactly in a whole-hour zone; in a
  half-hour zone a day is off by up to half an hour of tokens. Time is kept as spans and is exact.
- Haiku 5.5's long-prompt rate is decided per request (decision 1.26, 2026-11-09): a request whose
  prompt (input + cache reads + cache writes) is over 100,000 tokens has its tokens stored under
  the model key `claude-haiku-5-5@long` and priced at the long row; a sum of requests is never
  sized. The window, the report and its JSON sum both keys into one model, Haiku 5.5. Turns written
  before 1.26 were re-derived once from the cache's requests; a turn with no transcript left (one
  imported at an earlier first start, or deleted before the cache read it), or whose transcript
  changed since, keeps the old pricing of its summed rows.
- When Claude Code deletes one of a session's files while another file of the same session survives,
  a turn the next pass rewrites loses the deleted file's tokens: the history copies a turn from what
  the cache has.
- Figures are rounded half to even (`2.5m` prints as `2m`).
- **`menkar usage` counts a Codex rollout that is already compressed (`.jsonl.zst`) when it was
  first seen only after the app's next pass**: zstd is streamed asynchronously, and only the app's
  usage worker does that (`TurnSource.catchUp`) before its pass; `menkar usage`, its export and the
  classifier run the pass synchronously and skip compressed rollouts they have not read. A rollout
  read while plain and compressed later is not counted again. A turn whose rollout became `.zst`
  gives the classifier no text, as a deleted transcript does.

## The Usage window

How it is wired is in `docs/preferences.md`. The window reads `src/core/usage/` only.

**Three sections** (decision 1.184, 2026-11-18), in a left bar: **Spend** (the Totals and By day
below), **Your time** (the bursts' day and week, "Bursts") and **Task times** (the flow, "The task
flow"). The scope at the bar's foot is one flag, `allProjects`, sent with every ask and kept across
sections.

- **The periods carry** (`src/core/usage/sections.ts`, the reading of 1.184 decided 2026-11-18). A
  period's span is Today, 7 days, 30 days or none: Spend's Today, 7 days and 30 days are theirs,
  Month none; a Day is Today only when it is today, a Week is 7 days only when it is the current
  one (the seven days ending today, the same days as 7 days); Task times' Today, 7 days and 30 days
  are theirs (Today added 2026-11-19). On entering a
  section, if the section left shows a period picked there on this visit, or carried into it, and
  the new one has that span, the new one takes it; otherwise it keeps its own and carries nothing on
  until a period is picked in it. A step of the month, the day or the week is a pick. So Spend's
  30 days opens Task times on 30 days, while Your time keeps the day or week it showed; Spend's
  Today, or Your time on today's day, opens Task times on Today, and Task times' Today opens Spend on Today and
  Your time on today's day.
- **Inside Your time**: the Day toggle reads Today while the day it shows (or, from a week, would
  open) is today, and Day otherwise (decision 1.200). Day → Week shows the week holding the day
  shown; Week → Day shows today on the current week, else the week's last day. Weeks step by seven
  days on a grid ending today. The arrows stop at today and at the history's first day.
- **The periods live in the page's memory for the window's life**, as Totals' expanded rows do: not
  in `localStorage` and not in `state.json`. A remembered stepped-back day would reopen stale, a
  window's scope depends on its opener, and the window always opens on today: Spend's Today, Your
  time on today's day, Task times' Today (decision 1.200).

Spend's figures: the Totals are `buildReport`, the bars `buildSeries` (folded by category while classification
is on), both from one reading of the statusline logs per request (`buildUsage`), the chart's
series, axis and labels `src/core/usage/chart.ts`, the month stepper
`src/core/usage/stepper.ts`. The types the page receives (`UsageView`, `UsageWhich`) and the shared
formats live in `src/core/usage/nodes.ts`, which imports no Node module, so the renderer can use
them.

The chart, as the human decided it (2026-11-08):

- **Its scope** (decision 1.15): the project the opener window shows. Totals and By day are that
  project's alone, and "All projects" in the header switches to every project and back; the period
  and the stepper work alike in both. A window always shows a project (a first start has
  "Default"), so a Usage window always opens scoped; a caller that is not a Usage window gets
  every project, unscoped, and no toggle. One project's By day stacks by category while
  classification is on and is its plain bar otherwise. The filter is `ReportOptions.project`, in
  `buildReport`, so the totals and every bar apply the same one.
- **It fills the window.** The plot takes the height left between the controls and the legend and
  footer, measured after layout and redrawn on resize; Totals' card takes the same room and
  scrolls inside.
- **The axis** (decision 1.14, replacing "the smallest 1, 2 or 5 × a power of ten at or above the
  tallest bar"): the top is the first multiple of a 1, 2, 2.5 or 5 × 10^n step at or above the
  tallest bar, the step the smallest that leaves at most five intervals, a grid line and a label on
  each. Time is stepped in the unit its labels show, hours from one hour up and minutes below, so a
  2.9 h bar tops out at 3 h, not at 5.6 h. The same for Exec, Tokens and Cost.
- **The labels under the bars** (decision 1.13): 7 days, every bar, weekday and day ("Mon 2",
  "lun 2"); 30 days and Month, day and month ("Nov 2", "2 nov") from the first bar on, every 1, 2,
  3, 7 or 14 days, the smallest stride whose labels do not collide at the plot's width (8 pt sans
  taken as 5.5 px a character, 4 px apart); Today and All, every n-th bar as before. All through
  `Intl.DateTimeFormat` in the app's language: no month or day name is written by hand.
- **Totals' tree** (decision 1.130): projects open expanded and their category rows open
  collapsed, so a classified project shows its categories and a click shows a category's sessions;
  without classification a project's sessions show as before. What is expanded or collapsed is
  kept while the window is open, not across openings.
- **While a report is on its way** (decision 1.131): whatever asks for new figures (the period, the
  month stepper, "All projects") replaces the table or the chart, and the footer whose figures are
  all the report's, with the app's turning star until they arrive; the header stays usable and a
  late answer to an older choice is still dropped. Switching Totals and By day, or the metric,
  reuses the figures already there and shows no star.

## By model

Tokens and cost are kept by model all the way up: every node of a report carries `models`, each
model's tokens and list-price cost, summed exactly as `tokens` and `cost` are, so the two cannot
disagree (a test holds it: the models add up to the tokens always, and to the cost wherever the
cost is the estimate). The history already stores tokens by turn, model and hour; nothing new is
stored.

- **Time is per turn, never per model** (decision 1.16). A turn can run on several models at once,
  the main answer on Opus while a subagent runs on Haiku, and splitting its seconds between them
  would invent data. So the window's Model stack is offered only for Tokens and Cost: under Exec
  its button is disabled with a tooltip saying why, and choosing Exec while Model is chosen goes
  back to Project.
- **A model's cost is always the list-price estimate.** An exact cost reported by the statusline
  comes per session, never per model; a session's exact cost and the sum of its models' estimates
  differ, and the window marks every per-model cost "~".
- **The Model stack** shows the five models with the most tokens (or cost) in the period, by name,
  and the rest as "Other", the project series' rule; it respects the window's scope (decision
  1.15). A model the price table knows shows as its family and version ("Opus 4.5", whether the id
  is dated or `[1m]`); any other id shows as stored.
- **Totals** add no column: a row's tokens and cost cells list its models in their tooltip.
- **`menkar usage --json`** gives each node `models`, keyed by model id as stored, with the token
  fields in snake_case as `tokens` has them, `cost_usd` and `priced`. The text report is unchanged.

## The human's activity and the task flow

Decision 1.180 (2026-11-18): Menkar records, with no text, what the human does and how each task
moves, so the data accumulates while its views are designed. **Recording, the bursts' and the task
flow's readings, and their views are built** (2026-11-18): Your time and Task times, in the Usage
window.

### What is recorded

Each event is one instant: a random id, its time in Unix seconds (`src/core/clock.ts`), its
project's id or none. The journal line's type and its parser are `src/core/usage/activity.ts`; the
events are computed in `src/core/activity/`.

| Kind | When |
|---|---|
| `prompt_answered` | A pane's shown state leaves `blocked` for any other (refusing is the human acting too), with how long it was blocked; never negative, a clock set back gives 0 |
| `topic_discussed` / `topic_closed` | A topic's status becomes `discussing` / `closed`; Menkar's own permission topics are left out, their answer is already a prompt answered |
| `app_start` | Menkar starts |
| `prompted_start` | Menkar starts or resumes a session with a first prompt on its command line — `start_session`, `resume_session` or a renew with a prompt, and the orchestration card's first prompt, which is Menkar's text: the session's next turn is not the human's |
| `present` | A key, a click or a scroll in a focused main window, with that window's project: at most one a minute across every window, never any content |
| `away` / `back` | Each change of the human's presence, by the chip, `Ctrl+B a`, the banner, `human_away` or `human_back` (`recordPresence` from `askPresence`) |
| `task_state` | A task appears, or its state, whom its wait names, or its review's waiter changes |

- **Whom a task waits on.** `topic` with the topic's number when the wait reads `topic N`; `session`
  with the session's **id** when it names a member of the task's project (a renewed session keeps
  its name under a new id: the newest wins, `src/core/activity/names.ts`); else `other`, with
  nothing. For `to review`, the waiter as is (`orchestrator`, `human`, `pr-approval`, `pr-merge`).
  The text typed, the review's note and the titles are never stored: a session's name changes, and
  an id or a number says whom.
- **Not a state change**: the assignee alone (a renew), the note, the steps, the star.
- **The baseline.** The first start that records journals one `task_state` per open task, flagged
  `baseline`, so a task already open is counted from that moment. A marker file, `activity/baseline`,
  is written once those lines are on disk: a crash before it gives a baseline at the next start, and
  a second one is harmless (each row is an instant; a row in the same state adds no transition).
- **The human's messages are not recorded again**: they are the history's turns of origin `human`.

### Bursts

A burst is a maximal run of the human's actions, sorted by time, each at most **10 minutes** after
the one before (the human, 2026-11-18: one constant, changed without rewriting data). It is computed
when read, never stored. The actions: turns of origin `human` (less the one after each
`prompted_start`), prompts answered, topics discussed or closed, and presence marks; task changes
are not the human's. An away period ends a burst and counts nothing inside it, a message sent by
Remote Control included; it runs to the next `back` or `app_start`. A burst crossing midnight is one
burst; a day's view clips it at the local midnights. The evidence for 10 minutes was the human's
own messages (2026-11-18): no sharp knee; at 10 minutes 89% of the gaps between messages fall
inside a burst.

The reading is `src/core/usage/bursts.ts`: `UsageHistory.humanActions` returns the rows of a range
(the human turns, the actions, every `away`, `back` and `app_start` with the last one before the
range, and each `prompted_start` with its session's first turn at or after it), and
`activityDay` / `activityWeek` turn them into the hours, the clipped bursts and each day's totals
(the types the page receives are in `nodes.ts`). `readActivity` reads a day more on each side, and
another while a burst still reaches the edge read, so a burst begun the evening before is whole.
Scoped to a project, the bursts are made from that project's actions alone; away is every
project's. The presence marks and the topics shape the bursts but are not counted: a day counts
messages and prompts answered, outside away.

What Your time draws comes from the same reading: each day's away periods clipped to it (`away`,
in the day and in each week day; one that only touches the day's edge is not that day's), each
week day's clipped bursts, and each burst's messages per project (`byProject`, most first, ties by
id, a turn with no project last; for it `humanActions` reads each message's `project_id`, only
reading). The day's count axis and its positions are `src/core/usage/timeline.ts`: the axis is
1.14's rule without the 2.5 step, counts having none, with a top of at least 5; a moment's x is its
share of the day's seconds, so a 23- or 25-hour day is drawn true.

**Focus in the week** (decision 1.203, the human, 2026-11-21): a switch is the one `menkar usage
now` counts — the human's next message in a burst going to a different session than the one
before; a burst's first message, and so one after a gap or an away, switches nothing. `bursts`
records each burst's switches as the moments of the messages that made them (`Burst.switches`), so
`burst.switches` and the week read one definition. A day counts the switches whose message is
that day's (a burst crossing midnight gives each side its own), and Switches/h is a day's switches
over its Active hours (`switchesPerHour`, null with no Active time, shown "—"); the Total's is the
week's switches over the week's Active, so the days add up to it. Under the table, `activityWeek`'s
`focus` and `before` (the week before, read in the same rows: a week's reading starts seven days
earlier) give switches per hour and the share of the week's messages to the orchestrator
(`orchestratorShare`). The orchestrator is the project's marked one with its earlier conversations
(`orchestratorIds`, `src/core/projects/earlier.ts`), so a renew does not lose its messages; with
the mode off, none marked, or All projects, `toOrchestrator` is null and the line leaves that part
out. `before` is null when the week before has no message ("no data"). Scoped to a project,
messages and switches are that project's; in All projects a switch may cross projects. Computed
when read, nothing stored. A renew is a switch: the renewed session's next message goes to a new
id.

### The task flow

How long tasks spend in each state, read from their `task_state` rows (`src/core/usage/flow.ts`,
`taskFlow`). A row holds until the task's next row, the last one until now: two rows in a row in
the same state are one stretch, and a task done or dropped while waiting ends its wait there.
`UsageHistory.taskStateRows` returns the rows of a range and each task's last row before it, which
says what the task was in when the range began. For each of `queued`, `in progress`, `waiting` and
`to review`, and within waiting and to review for each waiter as recorded (`topic`, `session`,
`other`; `orchestrator`, `human`, `pr-approval`, `pr-merge`), the figure is the **median per task**
of each task's whole time in it inside the range, however many stretches it took, and their
**total**. A stretch crossing the range's start counts only its part inside, for the median as for
the total, so both describe the same time. A task whose first row is a baseline inside the range
is counted from the baseline and marked (`sinceBaseline`): what it did before recording began is
not known; one whose baseline is before the range is whole inside it. Tasks are told apart by
project and number; the types the page receives are in `nodes.ts`.

- **The counts**: of the tasks counted, each one's state at the range's end or now, whichever is
  first (its last row at or before it), gives `done`, `dropped` or `open`; they add up to `tasks`.
  `baselineAt` is the earliest baseline that marked a task, for the footnote's date, else null.
- **`flowTable`** turns the flow into the rows Task times draws: each state in order, then its
  waiters. To review always lists its four waiters, a zero one included; waiting always lists topic
  and session, then `other` and none only when they hold a task. A row's share is its total over
  the largest state's.
- **The view waits for a pass, then imports the journal**, before every answer: the rows reach the
  history only from the callback after a pass, and an import must never run beside a pass. Without
  it, the flow would lag the Board by up to an hour, against the human's own memory of what just
  happened.

### Where each event is seen

- **Tasks and topics**: every change goes through `setTasks` / `setTopics` (`src/main/tasks.ts`,
  `src/main/topics.ts`), whatever made it — a tool, the Board, a renew — and each calls the recorder
  once with the value before and after. Who acted is not known there: the orchestrator's
  `topic_close` and the human's double-click look the same.
- **Prompts answered**: one `onShownChange` listener (`src/main/activity.ts`) feeds a
  `PromptTracker`. A pane closed while blocked gives nothing, and so does a pane whose agent is no
  longer in its foreground: the question was left, not answered.
- **Presence marks**: the main window's renderer (`src/renderer/presence.ts`) listens on `window`
  for `keydown`, `pointerdown` and `wheel`, in the capture phase and passive, and only observes: it
  never cancels or stops an event, so xterm's key handler and the app's shortcuts see every one as
  before. With the window focused and a minute past its last mark (`src/core/activity/marks.ts`;
  a clock set back gives one at once), it sends `activity:present`, empty; main applies the same
  rule across windows and journals the window's shown project. The Usage and Settings windows send
  none. Marks are journaled while away too; the reading counts nothing inside an away period.
- **A session named in a wait** is resolved after the event's time is taken, from the sessions'
  list, which is read asynchronously; the line is written once it is resolved.

### Where it is stored

In the usage history, version 4, tables `activity` and `task_states`. Main never opens SQLite:

1. Main appends each event as a JSON line to `<data>/activity/journal.jsonl`, through one promise
   chain, so lines are written in the order they happened.
2. **After each usage pass**, on start and hourly, in the pass's `after` callback: the journal is
   renamed, in that same chain, to a batch whose name cannot repeat (a stamp and a random part), and
   if any batch waits, a short-lived worker (`src/main/activity-worker.ts`) imports every one, one
   transaction per file, `INSERT OR IGNORE` by id, and deletes it. Never beside a pass: both open
   the history, and the first open after an upgrade migrates it.
3. **At start**, before `app_start` is written, a journal a crash or a quit left is set aside as a
   batch: a last line torn by a power loss would otherwise swallow `app_start`.
4. `menkar usage` and its export import the batches left there before reading. `menkar usage now`
   reads the live journal and the batches where they lie and moves or imports nothing: the running
   app owns them.

A crash loses nothing appended; quitting needs no flush (the journal is imported after the next
start's pass); an import twice is an import once. A history from a newer Menkar keeps every batch
for it; a line of a newer journal version keeps its batch, renamed `newer-*`.

### Rejected, and why

- **The history's blocked spans as prompts answered**: Claude only, one per tool call (a parallel
  batch is several spans for one answer), and the decision names the shown state.
- **Main writing SQLite**: it is synchronous, and a busy history blocks for up to 30 s.
- **A long-lived worker fed by messages**: what it holds is lost on a crash and at quit; the
  journal is not.
- **A timer of its own every 5 minutes**: it raced the start's pass on the history's migration and
  opened the history twelve times an hour; nothing reads the rows sooner than the views will.
- **A separate database**: the reading joins the history's human turns; one file, one version.
- **Recording at each call site**: four task paths and three topic paths; the two funnels see each
  change once.
- **Storing the text of a wait or a review's note**: text, and a name changes.

### Limits

- **Up to an hour late in `menkar usage` and its export**: the rows reach the history after the
  next pass, and those commands import only the batches a pass set aside, not the live journal.
  Your time and Task times import it before each answer; `menkar usage now` reads it in place.
- **A pane blocked across a restart** gives no `prompt_answered`: its entry time is gone, and the
  answer may have been given while Menkar was down. A pane not yet joined to a session records no
  session and no project.
- **A worker just started**, whose transcript is not in the sessions' list yet, is recorded as
  `other` when a wait names it.
- **A deleted project's** events keep its id; its name comes from `projects.json` when read.
- **Command-line prompts count as the human's messages**: every `start_session`, `resume_session`
  or `renew` with a prompt adds a turn of origin `human` no human typed, and a message typed while
  the agent works leaves no turn at all. The first is corrected by the reading, which leaves out the
  session's first turn after each `prompted_start` when it is of origin `human` (a start whose
  agent dies before its first turn leaves out the human's next message in that session instead);
  the second is not counted.

### The burst in progress (`menkar usage now`)

Decision 1.185 (the human, 2026-11-19): Menkar does not alert. `menkar usage now --json` prints
the human's burst in progress as one JSON object, for a service of the human's own that polls it
about once a minute and keeps its own thresholds and snooze. `--json` is required; without it, or
with any other argument, the usage line goes to standard error and the exit code is 2.

**How it reads** (`runNow` in `cli.ts`, `src/core/usage/now.ts`). A pass runs first, as for every
`menkar usage`, so the human's messages are in. Then the live journal and the batches are read where
they lie (`readJournal`) and their events laid over the history's rows in memory (`withJournal`):
nothing in `<data>/activity/` is renamed, written or deleted. **The order is what keeps it right
while the app rotates and imports**: the journal first, then the batches' listing and contents,
then the history. An event only moves journal → batch → history, and a batch is deleted only after
its rows committed, so whatever left the journal before it was read is in a batch read after it or
in the history read after that. A batch gone between the listing and its read was imported. An
event read from a file that the history already holds is dropped by id
(`UsageHistory.knownActivityIds`). A torn last line (an append in progress) and a newer Menkar's
line are skipped without a log line: the command runs every minute. For the one presence row before
the range, the later of the history's and the files' is kept, since a journal a quit left can hold
the `away` still open; a `prompted_start` from the files gets its session's first turn from the
history (`UsageHistory.firstTurnAt`, the same subquery `humanActions` uses). Every project's, with
no `--project`. It never runs `importLeftActivity`.

**What it prints**, `schema` 1, pretty-printed: a field changes meaning or goes away only with a
new `schema`, and one may be added without it. Times are whole Unix seconds with the same moment as
local ISO with its offset.

| Field | What it holds |
|---|---|
| `schema` | 1 |
| `status` | `ok`, `history_too_new` or `history_unavailable`; on anything but `ok`, the object holds only `schema`, `status`, `now`, `now_epoch` |
| `now`, `now_epoch` | The moment of the reading |
| `menkar_running` | Whether a Menkar app runs now: `alive.json`'s pid answers (`menkarAliveSync`, the same check the MCP server makes) |
| `away` | `null`, or `{ "since", "since_epoch" }`: the start of the away still open (no `back` and no `app_start` after it) |
| `last_action` | `null`, or `{ "at", "at_epoch" }`: the latest action counted (outside away), from yesterday's local midnight at least |
| `burst` | `null`, or `{ "start", "start_epoch", "last_action", "last_action_epoch", "length_seconds", "messages", "prompts", "switches" }` |
| `today` | `{ "active_seconds", "messages", "prompts" }`: today's bursts clipped at midnight, its messages and prompts answered, outside away |
| `sessions_last_30_minutes` | How many distinct sessions the human messaged in `[now − 30 minutes, now]`, outside away; `0` when none |

- **The burst in progress** is the last burst while the human is not away, no away started since
  its last action, and `now − last action ≤ 10 minutes`: a burst lasts until the gap that would end
  it has passed. While away there is none.
- **`length_seconds` is `last_action − start`**, the burst as Menkar defines it; the service has
  `now` for `now − start`. A clock set back gives no negative length.
- **A burst crossing midnight** is whole in `burst`; only its part since midnight counts in
  `today.active_seconds`.
- **Focus** (decision 1.202, the human, 2026-11-21): `burst.switches` counts the burst's
  consecutive messages, oldest first, that went to a different session than the one before;
  `sessions_last_30_minutes` counts sessions whether or not a burst is in progress. A message is a
  turn of origin `human` less the one after each `prompted_start`, the bursts' definition, and a
  message sent while away counts in neither. Messages typed while the agent works leave no turn, so
  they are not seen here either. Example: messages to A, B, B, A, C, A in one burst are 4 switches;
  with the first two more than 30 minutes old, `sessions_last_30_minutes` is 3 (B, A, C). The human's
  own service decides any threshold.
- **With the app closed** the same reading runs on what a quit or a crash left; no burst can be in
  progress ten minutes after the last action, and an away left open runs to now. `menkar_running`
  tells the service which case it reads.
- **Never in it**: a project, a session, a name, a path, any text.

**Exit codes**: 0 with `ok`; 1 with `history_too_new` (nothing read, the batches left) or
`history_unavailable` (`Could not open the usage history.` on standard error); 2 for a bad
argument. A failed pass prints its sentence on standard error and the reading goes on from what the
history has.

**Rejected, and why:**

- **Asking the running app** through a control request: two paths, one with the app and one
  without; it would make the app rotate the journal and start an import worker every minute, the
  pattern rejected above as "a timer of its own", sixty times an hour; and 1.185 wants no local
  server.
- **`now` rotating and importing the journal itself**: the journal has one writer, the app's
  promise chain; a rename from another process lands between its `stat` and its `rename`, and on
  Windows renaming a file another process appends to is not dependable. It would also write the
  history every minute for a read.
- **No pass, only the journal** (about 50 ms cheaper): the human's messages reach the history only
  through a pass, so a burst of messages sent by Remote Control would lag up to an hour.
- **Taking Electron's single-instance lock to tell whether the app runs**: while `now` held it, an
  app being started would think another one runs and exit.

**Its cost** (2026-11-19, the command built from the tree, run three times under `env -i` against
a throwaway home of 20 synthetic transcripts, 2,000 human turns and a journal of 120 lines):

| Run | Wall time | Peak RSS |
|---|---|---|
| First (the pass ingests everything) | 0.95 s | 160 MB |
| Warm | 0.12–0.13 s | 126 MB |

On a copy of the human's real volume (339 transcripts, 2.8 GB) the steps measured at design time
were a pass with nothing new 51 ms and the reading 47–55 ms, whatever the journal's length up to
5,000 lines. The activity folder kept its listing, bytes and mtimes across the runs. The focus
fields (2026-11-21) left the reading as it was: in process, over 2,000 human turns in 20 sessions
and a journal of 120 lines, a median of 5.9 ms before and 6.2 ms after, three runs of 60 each. **The worst
case is waiting**: the pass and the history's open each wait up to the 30-second busy timeout when
the app's own pass holds the file, normally under a second but tens of seconds in the start's
catch-up after a long time off. A service gives the command a timeout of a minute or more, or skips
that poll.

## Exporting for analysis

`menkar usage export` writes the history's turns as rows for an LLM session or a spreadsheet to
analyse ("what did Opus cost me on project X in October"). It is the supported way to read usage
from outside the app (decision 1.16): `history.sqlite`, in the data directory, is internal and
migrates between versions, so nothing outside `src/core/usage/` reads it. An MCP server that would
answer such questions directly is deferred (`docs/NOT_BUILT_YET.md`).

```
menkar usage export [--period today|7d|30d|all | --month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD]
                    [--project NAME] [--rows turns|activity|tasks] [--format jsonl|csv] [--output FILE]
```

- **Which turns.** The period flags are the report's, parsed by the same code; 7 days by default.
  A turn is in the range by the moment it opened and goes out whole, its time and tokens never
  clipped at the range's ends; the report clips, so at the edges the two differ. `--project`
  takes a project's exact name (an unknown one is an error that lists them). Like the report, a
  pass runs first, so the latest turns are in.
- **Where.** Standard output, or `--output`, written whole through a temporary file.
- **JSONL** (the default): one object per turn, oldest first. `schema` is 1; it changes only when
  a field changes meaning or goes away, never when one is added.

| Field | What it holds |
|---|---|
| `schema` | The row format's version: 1 |
| `turn` | The turn's id, as the transcript has it |
| `session_id` | Its session's id |
| `session_name` | The session's name, or `null` |
| `project` | The project the turn was filed under, by its current name, or `null` |
| `category` | Its category as reports show it (a turn the human did not start takes its session's), or `null` |
| `origin` | Who opened it: `human`, `peer`, `task_notification`, `system`, `sdk` or `unknown` |
| `opened` | When it opened, local time with its offset (`2026-11-08T10:42:05-03:00`) |
| `opened_epoch` | The same moment in Unix seconds |
| `execution_seconds` | Its working time, keyed by its origin, as the report's JSON keys it; `{}` with none |
| `blocked_seconds` | Its time waiting on the user |
| `models` | By model id as stored, with Haiku 5.5's long-prompt requests apart as `claude-haiku-5-5@long`: `input`, `output`, `cache_write`, `cache_write_1h`, `cache_read`, `cost_usd` (list price) and `priced` |
| `cost_usd` | The turn's cost: the statusline's exact figure when its session reported one, else the list-price estimate |
| `cost_exact` | Whether `cost_usd` is the statusline's figure |

- **What the running total grew by** (2026-11-10, `readStatusline`, shared by the window,
  `menkar usage` and the export). Claude Code keeps a session's total across a resume, so a
  session's first line can carry everything it cost before the log saw it: that line counts whole
  only when it falls in the session's first turn (`inFirstTurn`), and is the base otherwise. A
  total that drops is a resume recomputing it a little lower (every drop in the human's logs was a
  small dip at one of Menkar's restarts, never back near zero): the new value is the base and
  nothing counts. Both used to count whole, which added a session's lifetime cost to the day, many
  times its turns' cost. If a `/clear` ever reset a session's total, what it cost up to its first
  report after it would be missed.
- **Exact cost, turn by turn.** The statusline reports a session's running total; each increase
  goes to the turn in effect when it was reported, the rule categories use. A session with any
  report in the range is exact for every turn (one with none costs 0), so the rows' `cost_usd`
  add up to the report's cost for a range no turn crosses. A model's `cost_usd` is always the list
  price.
- **CSV**: the same scalar fields, one row per turn, with the turn's token totals as columns
  (`input` … `cache_read`) and `models` the model ids joined by `;`. Analysis by model uses JSONL.
- **Never in a row**: prompt or answer text (the history does not keep it, and the export does not
  reach for the transcripts), and any path. A test holds the keys to exactly the table above.

An example, for a Claude session in a terminal: *"Run `menkar usage export --month 2026-10` and
tell me the cost per model for each project, and which category used the most cache reads."*

### Activity rows

`--rows activity` writes the activity table instead of the turns (`--rows turns`, the default,
is the output above, unchanged): one row per event of "The human's activity and the task flow",
oldest first, in the range by its moment, with its own `schema`, 1, under the same rule. The
period, `--project`, `--format` and `--output` flags are the turns'. A project's rows keep the
human's `away`, `back` and `app_start`, which belong to no project. It is how the bursts' gap is
checked against one's own data. Never in a row: any text, any path, a session's name.

| Field | What it holds |
|---|---|
| `schema` | The row format's version: 1 |
| `event` | The event's random id |
| `kind` | `prompt_answered`, `topic_discussed`, `topic_closed`, `present`, `away`, `back`, `app_start` or `prompted_start` |
| `at` | When it happened, local time with its offset |
| `at_epoch` | The same moment in Unix seconds |
| `project` | Its project by its current name, or `null` |
| `session_id` | The session's id (`prompt_answered`, `prompted_start`), or `null` |
| `topic` | The topic's number (`topic_*`), or `null` |
| `task` | The topic's task number, or `null` |
| `next` | The state a pane left `blocked` for (`prompt_answered`), or `null` |
| `blocked_seconds` | How long that pane was blocked, or `null` |

The CSV has the same columns, `null` as an empty field.

### Task rows

`--rows tasks` writes the `task_state` rows instead, under the same rules as the activity rows,
with its own `schema`, 1: one row per recorded state of a task, oldest first, in the range by its
moment; `--project` keeps that project's tasks. Never in a row: the wait's text, the review's note,
a title, a session's name.

| Field | What it holds |
|---|---|
| `schema` | The row format's version: 1 |
| `event` | The row's random id |
| `at` | When the task entered the state, local time with its offset |
| `at_epoch` | The same moment in Unix seconds |
| `project` | The task's project by its current name |
| `task` | The task's number in its project |
| `state` | `queued`, `in progress`, `waiting`, `to review`, `done` or `dropped` |
| `wait_kind` | Whom it waits on: `topic`, `session` or `other` while waiting; `orchestrator`, `human`, `pr-approval` or `pr-merge` to review; else `null` |
| `wait_ref` | The topic's number or the session's id, or `null` |
| `assignee` | The assignee's session id, or `null` |
| `baseline` | Whether the row is the baseline of a task already open when recording began |
