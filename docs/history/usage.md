# History of `docs/usage.md`

## Limits

> Replaced 2026-11-09 by decision 1.26: Haiku 5.5's long-prompt rate is decided per request.
- Haiku 5.5's long-prompt rate applies to what is priced at once, which is a (model, UTC hour,
  project, session) group. The history keeps no per-request tokens, so a busy hour of short
  requests can be priced at the long rate.

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
- Figures are rounded half to even (`2.5m` prints as `2m`), as agent-tablet printed them, so the two
  apps print the same report.

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
  imported from agent-tablet, or deleted before the cache read it), or whose transcript changed
  since, keeps the old pricing of its summed rows.

## The export

> Replaced 2026-11-09 by decision 1.26: the long-prompt key is documented.
| `models` | By model id as stored: `input`, `output`, `cache_write`, `cache_write_1h`, `cache_read`, `cost_usd` (list price) and `priced` |

> Replaced 2026-11-14: the logs are read once per request, by `readStatusline`; `statuslineIncrements` remains for the export.
- **What the running total grew by** (2026-11-10, `statuslineIncrements`, shared by the window,

## The Usage window

> Replaced 2026-11-14: the Totals and the bars share one reading of the statusline logs per request.
is on), the chart's series, axis and labels `src/core/usage/chart.ts`, the month stepper

## Checked against agent-tablet

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
## Checked against agent-tablet
On 2026-11-08, 60 synthetic sessions were generated (118 transcripts over three months). They mixed
legacy prompts, every origin, duplicate and sidechain copies, subagents, decided tools,
`AskUserQuestion`, two-hour gaps, unknown and synthetic models, Haiku 5.5 and bad lines. Both apps'
`usage --period all --by month` printed identical text, and their `--json` matched to 1e-9.
After a third of the transcripts were deleted, Menkar's first start imported agent-tablet's history
and its statusline log and printed the same report as agent-tablet, exact cost and limits included.

## Rejected, and why

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
These were inherited from agent-tablet, where each was measured or decided by the human:

## The shape

> Left on 2026-11-11: agent-tablet leaves Menkar; what named it is said in Menkar's own terms or dropped (decision 1.68).
  Code deletes with its transcripts. Its tables and columns are agent-tablet's version 2, so
  importing agent-tablet's history is a copy.
- **The import** (`importer.ts`): the first time Menkar opens its history and finds no file at its
  path, it copies agent-tablet's `history.sqlite` (versions 1 and 2, opened read only) into a
  temporary file. The file is renamed into place once committed. agent-tablet's `usage.jsonl` is
  copied too, to `<data>/agent-tablet-usage.jsonl`, which sits in the data directory because it
  cannot be rebuilt. Reports read it before Menkar's own `usage.jsonl`. A copy that fails leaves no
  history, and the opening throws, so the next start tries again. When there is nothing to import
  (no file, an unreadable one, or one from a newer agent-tablet), Menkar starts empty and does not
  try again.

## The human's activity and the task flow

> Replaced 2026-11-18 (decision 1.180): main journals `present` marks.
The journal's format already has `present` (a mark a minute while the human works in a focused
window), `away` / `back` (1.167) and `prompted_start` (a session started with a prompt on its
command line); main does not journal them yet.

> Replaced 2026-11-18 (decision 1.180): main journals `prompted_start`.
The journal's format already has `away` / `back` (1.167) and `prompted_start` (a session started
with a prompt on its command line); main does not journal them yet.

## The human's activity and the task flow

> Left on 2026-11-18: main journals away and back from askPresence (plan 43, block 3b, with plan 42's block 3).
The journal's format already has `away` / `back` (1.167); main does not journal them yet.

> Replaced 2026-11-18 (plan 43, block 5): the bursts' reading is built in core.
moves, so the data accumulates while its views are designed. **Recording is built; the reading and
the views are not** (`docs/NOT_BUILT_YET.md`, "Task flow metrics").

### Bursts, when the reading is built

> Replaced 2026-11-18 (plan 43, block 5): the reading leaves out the turn after each `prompted_start`.
  the agent works leaves no turn at all. The first is corrected when the reading excludes the turn
  after each `prompted_start`, which is not journaled yet; the second is not counted.

## The export

> Replaced 2026-11-18 (plan 43, block 5): `--rows turns|activity`.
                    [--project NAME] [--format jsonl|csv] [--output FILE]

## The human's activity and the task flow

> Replaced 2026-11-18 (plan 43, block 6): the task flow's reading is built in core.
moves, so the data accumulates while its views are designed. **Recording and the bursts' reading
are built; the task flow's reading and the views are not** (`docs/NOT_BUILT_YET.md`, "Task flow
metrics").

## The export

> Replaced 2026-11-18 (plan 43, block 6): `--rows turns|activity|tasks`.
                    [--project NAME] [--rows turns|activity] [--format jsonl|csv] [--output FILE]

## Usage — how it is measured and kept

> Left on 2026-11-18 (plan 43, block 7e): the Usage window is built; its spec is current.
says what each step does. This file keeps why it is shaped this way, and what was rejected. What the
user sees in the Usage window is still `docs/spec/usage.md` until the window is built.

## The Usage window

> Left on 2026-11-18 (plan 43, block 7e): the window has three sections; their carry and their state are described.
Built by plan 12; how it is wired is in `docs/preferences.md`. The window reads `src/core/usage/`
only: the Totals are `buildReport`, the bars `buildSeries` (folded by category while classification

## The human's activity and the task flow

> Left on 2026-11-18 (plan 43, block 7e): the views are built.
moves, so the data accumulates while its views are designed. **Recording, the bursts' reading and
the task flow's reading are built; the views are not** (`docs/NOT_BUILT_YET.md`, "Task flow
metrics").

## Bursts

> Left on 2026-11-18 (plan 43, block 7e): the day's away, each week day's bursts and `byProject` are read.
Scoped to a project, the bursts are made from that project's actions alone; away is every
project's. The presence marks and the topics shape the bursts but are not counted: a day counts
messages and prompts answered, outside away.

## The task flow

> Left on 2026-11-18 (plan 43, block 7e): the counts, `baselineAt` and `flowTable` are read, and why the view waits for a pass.
is counted from the baseline and marked (`sinceBaseline`): what it did before recording began is
not known; one whose baseline is before the range is whole inside it. Tasks are told apart by
project and number; the types the page receives are in `nodes.ts`.

## Limits

> Left on 2026-11-18 (plan 43, block 7e): the Usage window imports the journal before each answer.
- **Up to an hour late**: the rows reach the history after the next pass.

## The Usage window

> Left on 2026-11-19 (task 117): Task times gains Today, and Today carries to and from it.
  one (the seven days ending today, the same days as 7 days); Task times' are theirs. On entering a
  30 days opens Task times on 30 days, while Your time keeps the week it showed.

## The human's activity and the task flow

> Replaced 2026-11-19 (plan 44): `menkar usage now` reads the live journal in place, importing nothing.
4. `menkar usage` and its export import the batches left there before reading; never the live
   journal, which the running app owns.

## Limits

> Replaced 2026-11-19 (plan 44): `menkar usage now` reads the live journal in place.
- **Up to an hour late outside the Usage window**: the rows reach the history after the next
  pass, so `menkar usage` and its export, which import only the batches a pass set aside, lag the
  live journal. Your time and Task times import it before each answer.

## The shape

> Left on 2026-11-20: usage is read per agent; Codex keeps its own cache (plan 39, P1a.6).
How long Claude worked and how many tokens it used, per session and project. All of it lives in
  the transcripts whenever its layout version changes. The **history** (`<data>/history.sqlite`,

## The Usage window

> Replaced 2026-11-21 (task 172, decision 1.200): the window opens on today in each section; Your time's Day toggle reads Today on today.
  30 days opens Task times on 30 days, while Your time keeps the week it showed; Spend's Today, or
  Your time on today's day, opens Task times on Today, and Task times' Today opens Spend on Today and
- **Inside Your time**: Day → Week shows the week holding the day shown; Week → Day shows today on
  the current week, else the week's last day. Weeks step by seven days on a grid ending today. The
  arrows stop at today and at the history's first day.
  window's scope depends on its opener, and the window always opens on Spend, 7 days.

## The burst in progress

> Replaced 2026-11-21 (task 183, decision 1.202): `burst` gains `switches`, and the cost paragraph the focus fields' measure.
| `burst` | `null`, or `{ "start", "start_epoch", "last_action", "last_action_epoch", "length_seconds", "messages", "prompts" }` |
5,000 lines. The activity folder kept its listing, bytes and mtimes across the runs. **The worst

## The human's activity and the task flow

> Replaced 2026-11-21 (task 189, decision 1.204): history version 5 keeps each turn's agent beside the activity tables.
In the usage history, version 4, tables `activity` and `task_states`. Main never opens SQLite:

## The human's activity and the task flow

> Replaced 2026-11-23 (task 202, plan 47, decisions 1.204 (b), 1.207): history version 6 adds the panes' states and Menkar's watch signs; a quit writes its sign; `newer-*` batches are read again.
In the usage history, since version 4, tables `activity` and `task_states`. Main never opens SQLite:
A crash loses nothing appended; quitting needs no flush (the journal is imported after the next
start's pass); an import twice is an import once. A history from a newer Menkar keeps every batch
for it; a line of a newer journal version keeps its batch, renamed `newer-*`.

> Replaced 2026-11-23 (task 205): a journal left by a quit or a crash is set aside only at the next start, so its rows can be days late.
- **Up to an hour late in `menkar usage` and its export**: the rows reach the history after the
  next pass, and those commands import only the batches a pass set aside, not the live journal.
  Your time and Task times import it before each answer; `menkar usage now` reads it in place.
  `--rows panes` reads it in place too.

## Exporting for analysis

> Replaced 2026-11-23 (task 202, plan 47): `--rows panes`.
                    [--project NAME] [--rows turns|activity|tasks] [--format jsonl|csv] [--output FILE]
