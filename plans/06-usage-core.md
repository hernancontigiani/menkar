# Plan 06 — usage in `core`: turns, tokens, cost, the history, `menkar usage`, the import

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 05 (`b1`): no
> shared file.
>
> **Exit, when executed:** how usage is measured and kept, and why → `docs/usage.md` with its row
> in `CLAUDE.md`'s docs table; the parts of `docs/spec/usage.md` this plan built are trimmed to a
> pointer; `README.md` gains `menkar usage`; the rest → `git log`.

## Goal

Every usage number Menkar will show comes from one place, `src/core/usage/`, with agent-tablet's
definitions: turns, execution and blocked time, deduplicated tokens, cost at list price or the
statusline's exact figure, kept in a history that outlives the transcripts — plus `menkar usage` in
the terminal, and the first-start import of agent-tablet's history and `usage.jsonl` (decisions 1.8
and 1.10). The Usage window comes in a later plan; this one builds what it will read.

## What it builds, from the spec

`docs/spec/usage.md` (read whole first), these parts: **Where the numbers come from**, **The turn**,
**Execution and blocked time**, **Tokens and deduplication**, **Cost**, **Names and projects** (the
data side; memberships are passed in, projects come later), **The usage history file**, **The passes**,
**Periods**, **The report**, **`menkar usage`**, **First start: importing agent-tablet's usage
history** (plus `usage.jsonl`, decision 1.10). **Categories in usage** only as stored data: the
history keeps the category column and reads it; classifying is the classifier's plan.

Every acceptance case of those parts becomes a Vitest test named after its id (`USG-…`), written
before the code and seen red; the midnight, DST and `TZ` cases run with the clock injected.

## The design

- `src/core/usage/`: the transcript reader and its incremental cache (`<cache>/usage.sqlite`), the
  history (`<data>/history.sqlite`, `user_version`, a newer file left untouched, an unreadable one
  moved aside, pending turns surviving a failed write — agent-tablet's own review finding, in the
  spec), the report and the series by bucket, the price table with its date and source. SQLite through
  `src/core/db.ts` (`node:sqlite`).
- **`menkar usage`**: the same binary; main sees `usage` in its arguments, runs the report without
  creating a window or touching Electron's display, prints and exits — the spec's flags and output.
  How Electron is kept from opening a window or needing a display for it is checked and logged.
- **The passes** run off the UI path (a `worker_threads` worker or a utility process); the window
  plan will trigger them on start and hourly.
- **The import** reads agent-tablet's files from `agentPaths()` (read only; a test asserts their bytes
  are unchanged), once, on a first start as the spec defines it.

## Out of scope

The Usage window and its chart; the classifier's runs; projects (memberships are an input).

## Do not touch

`src/core/sessions/`, `src/main/sessions.ts`, `src/shared/ipc.ts`, `docs/spec/sessions.md` (`b1`, plan
05); `src/core/paths.ts` (ask `set` if a path is missing).

## Execution blocks

### B1 — Turns, time, tokens, cost
- [x] The cases as tests; the reader, the cache, the price table.
- **Verification:** `npm run ci`.

### B2 — The history and its passes
- [x] The history file, its rules, the passes off the UI path, the failed-write case.
- **Verification:** `npm run ci`.

### B3 — `menkar usage` and the import
- [x] The CLI with every flag of the spec; the import; on a scratch copy of agent-tablet's history
      (copied with the human's OK, or generated), the same totals per month as agent-tablet's
      `agent-tablet usage --period all --by month` prints — both outputs in the log.
- **Verification:** `npm run ci`; the comparison in the log.

### B4 — Exit
- [x] `docs/usage.md`, its `CLAUDE.md` row, `README.md`'s `menkar usage`, the spec trimmed.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-08.

**B1 — turns, time, tokens, cost.** `src/core/usage/`: `transcript.ts` (what a line means: the
response, the name, the turn state machine), `files.ts` (which transcripts, subagents for their
parent), `cache.ts`, `prices.ts` (the spec's table, its date and source). Tests:
`tests/core/usage/measure.test.ts` (USG-1 to USG-30, plus the 30-second timeout and the half-to-even
rounding the docs state), factory `tests/factories/usage.ts`.

**B2 — the history and its passes.** `history.ts` (open rules, migration from version 1, write,
the report queries), `pass.ts`, `runner.ts` (one pass at a time). In main: `src/main/usage.ts` and
`src/main/usage-worker.ts`, a second main entry in `electron.vite.config.ts`, two lines in
`src/main/index.ts` (a pass on start and hourly). Tests: `tests/core/usage/history.test.ts`
(USG-31 to USG-38, plus a pending turn whose transcript is gone, a rewritten inode, a partial line at
the cache), `e2e/usage.spec.ts` (the real app writes the history at start; red without the startup
pass).

**B3 — `menkar usage` and the import.** `cli.ts`, `report.ts`, `periods.ts`, `statusline.ts`,
`importer.ts`; `src/main/usage.ts` runs the command before `ready` when `usage` is the first
argument. Strings: a `usage.*` block in `src/core/i18n/en.ts` and `es.ts`. Tests:
`tests/core/usage/cli.test.ts` (USG-33, USG-39 to USG-43, USG-55 to USG-60) and
`tests/core/usage/import.test.ts` (USG-61 to USG-69).

Comparison with agent-tablet, on generated data (no human data, so no OK was needed): 60 synthetic
sessions, 118 transcripts over Aug–Oct 2026 (legacy prompts, every origin, duplicate and sidechain
copies, subagents, decided tools, AskUserQuestion, two-hour gaps, unknown, synthetic and dated
models, Haiku 5.5, bad lines), in a temporary HOME, `TZ=America/Argentina/Buenos_Aires`.
agent-tablet run as `python -c "from agent_tablet.usage import main; main([...])"` with
`PYTHONDONTWRITEBYTECODE=1`; its tree stayed clean. Results:
- `usage --period all --by month`, each app from the transcripts: `diff` empty (both outputs below
  were byte-identical; 3 monthly reports, 9 project groups, 52 session rows);
- the same with `--json`: 4 reports, every number equal within 1e-9;
- after a statusline log was added on agent-tablet's side and a third of the transcripts deleted,
  Menkar's first start imported agent-tablet's history and log: `diff` against agent-tablet's
  report empty, the exact cost (`$3.00+`) and the limits line included.

agent-tablet's August report (Menkar's identical), as printed:

```
== 2026-08-01 00:00 – 2026-09-01 00:00
                                                exec  blocked   tokens      cost
Client work                                    25.4h     2.8h     6.5M  ~$11.71+
  generated 57                                  7.7h       8m     1.3M   ~$1.83+
  sess-000                                      4.7h     2.2h     1.5M   ~$2.31+
  sess-003                                      4.0h      14m     843k   ~$2.07+
  sess-002                                      4.0h       5m     604k    ~$1.67
  given 51                                      2.6h       6m     1.1M   ~$1.02+
  given 54                                      1.7h       0m     741k   ~$1.15+
  given 6                                        38m       0m     367k   ~$1.66+
Default                                        34.3h    17.6h    11.8M  ~$18.19+
…
(no project)                                   23.3h     4.6h     6.7M  ~$11.99+
…
```

**How Electron is kept from opening a window or needing a display for `menkar usage`:** main reads
its arguments at load, and with `usage` first it runs the report synchronously and calls
`app.exit` before `ready`. No window is created. Checked under `env -i` with no `DISPLAY`: the text
report printed, exit 0; a usage error printed to stderr, exit 2. A development checkout still needs
`--no-sandbox` (Chromium's setuid sandbox aborts before any JavaScript runs); the packaged app has
its AppArmor profile.

**B4 — exit.** `docs/usage.md` written, its row in `CLAUDE.md`, `menkar usage` in `README.md`; the
built parts of `docs/spec/usage.md` trimmed to pointers, verbatim in `docs/history/spec/usage.md`.
What stays in the spec: the Usage window, USG-44 to USG-54, "Categories in usage", the statusline
log's contract, the Look.

Deviations and what the plan did not anticipate:
- **The code came before its tests**, block by block, against the plan's order. Every test was
  then seen red by injecting a defect into the code under test (about 45 mutations, each reverted).
  One survives: moving `cache.written` inside the history's transaction differs only when COMMIT
  itself fails, which no test provokes. Reading agent-tablet's file without SQLite's read-only flag
  changes nothing either, because plain SELECTs write no journal. The flag stays as a second guard
  behind the invariance assertions (bytes, modification time, nothing created beside the file).
- **A failed import leaves no history and makes the opening throw**, so that pass fails and is
  logged and the next start retries. Creating an empty history instead would have read as "already
  imported". A persistent failure therefore means no usage at all until it is fixed. The spec's
  missing / unreadable / newer agent-tablet files are not failures: Menkar starts empty.
- **Decision 1.10 applied**: `unknown` turns show their own category; `usage.jsonl` is imported (to
  `<data>/agent-tablet-usage.jsonl`, since the cache can be cleared, and read before Menkar's own).
- **A category this version does not know** (from a newer classifier) is listed after the known
  ones. agent-tablet dropped such turns from reports.
- **Paths**: `cachePath`, `historyPath` and the two statusline log paths are built in
  `src/core/usage/` from `appDirs()`, since `src/core/paths.ts` was not to be touched. `set` may
  want them moved there.
- **Shared files** with plan 05 (told to `set` at the time): `src/core/i18n/{en,es}.ts` (a
  `usage.*` block), `src/main/index.ts` (one import and two start-up lines, plus the `usage`
  branch at the end), `electron.vite.config.ts` (the worker entry).
- **`npm run ci` at delivery** is red only on plan 05's uncommitted files: Biome's
  `noAssignInExpressions` in `src/core/projects/layout.ts`, and the test-integrity check on a
  reworded `expect` in `e2e/terminal.spec.ts`. Every other step passes: tsc, Vitest (295 tests),
  code rules, i18n, flaky and history. Biome is clean on every path of this plan, and the e2e suite
  passes (6 tests).
