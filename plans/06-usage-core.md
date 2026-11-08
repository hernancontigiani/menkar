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
- [ ] The cases as tests; the reader, the cache, the price table.
- **Verification:** `npm run ci`.

### B2 — The history and its passes
- [ ] The history file, its rules, the passes off the UI path, the failed-write case.
- **Verification:** `npm run ci`.

### B3 — `menkar usage` and the import
- [ ] The CLI with every flag of the spec; the import; on a scratch copy of agent-tablet's history
      (copied with the human's OK, or generated), the same totals per month as agent-tablet's
      `agent-tablet usage --period all --by month` prints — both outputs in the log.
- **Verification:** `npm run ci`; the comparison in the log.

### B4 — Exit
- [ ] `docs/usage.md`, its `CLAUDE.md` row, `README.md`'s `menkar usage`, the spec trimmed.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
