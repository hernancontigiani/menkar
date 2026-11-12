# Usage — how it is measured and kept

How long Claude worked and how many tokens it used, per session and project. All of it lives in
`src/core/usage/`, and every figure the app or `menkar usage` shows is read from there. The code
says what each step does. This file keeps why it is shaped this way, and what was rejected. What the
user sees in the Usage window is still `docs/spec/usage.md` until the window is built.

## The shape

- **Two files.** The **cache** (`<cache>/usage.sqlite`, `cache.ts`) is derived data, rebuilt from
  the transcripts whenever its layout version changes. The **history** (`<data>/history.sqlite`,
  `history.ts`) is the only file reports read, one row per turn, never pruned: it keeps what Claude
  Code deletes with its transcripts. Its tables and columns are agent-tablet's version 2, so
  importing agent-tablet's history is a copy.
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
- **The import** (`importer.ts`): the first time Menkar opens its history and finds no file at its
  path, it copies agent-tablet's `history.sqlite` (versions 1 and 2, opened read only) into a
  temporary file. The file is renamed into place once committed. agent-tablet's `usage.jsonl` is
  copied too, to `<data>/agent-tablet-usage.jsonl`, which sits in the data directory because it
  cannot be rebuilt. Reports read it before Menkar's own `usage.jsonl`. A copy that fails leaves no
  history, and the opening throws, so the next start tries again. When there is nothing to import
  (no file, an unreadable one, or one from a newer agent-tablet), Menkar starts empty and does not
  try again.

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
  imported from agent-tablet, or deleted before the cache read it), or whose transcript changed
  since, keeps the old pricing of its summed rows.
- When Claude Code deletes one of a session's files while another file of the same session survives,
  a turn the next pass rewrites loses the deleted file's tokens: the history copies a turn from what
  the cache has.
- Figures are rounded half to even (`2.5m` prints as `2m`).

## The Usage window

Built by plan 12; how it is wired is in `docs/preferences.md`. The window reads `src/core/usage/`
only: the Totals are `buildReport`, the bars `buildSeries` (folded by category while classification
is on), the chart's series, axis and labels `src/core/usage/chart.ts`, the month stepper
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

## Exporting for analysis

`menkar usage export` writes the history's turns as rows for an LLM session or a spreadsheet to
analyse ("what did Opus cost me on project X in October"). It is the supported way to read usage
from outside the app (decision 1.16): `history.sqlite`, in the data directory, is internal and
migrates between versions, so nothing outside `src/core/usage/` reads it. An MCP server that would
answer such questions directly is deferred (`docs/NOT_BUILT_YET.md`).

```
menkar usage export [--period today|7d|30d|all | --month YYYY-MM | --from YYYY-MM-DD --to YYYY-MM-DD]
                    [--project NAME] [--format jsonl|csv] [--output FILE]
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

- **What the running total grew by** (2026-11-10, `statuslineIncrements`, shared by the window,
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
