# Plan 10 — the classifier in `core`: the hourly pass, earlier turns, the evaluation

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 08 (`b1`): no
> shared file but the usual shared ones.
>
> **Exit, when executed:** how turns are classified, and why → `docs/classifier.md` with its row in
> `CLAUDE.md`'s docs table; the built parts of `docs/spec/classifier.md` trimmed to pointers, removed
> lines to `docs/history/spec/`; `README.md` names the evaluation script; the rest → `git log`.

## Goal

Everything of the opt-in SDLC classification except its widgets: with the switch's setting on,
the turns the human types after it was turned on go to Haiku through `claude -p` in batches after
the hourly usage pass, with agent-tablet's exact invocation and prompts; earlier turns on request,
with the estimate first, progress and stop; inheritance for the turns the human did not start; and
the evaluation script over `eval/`.

## What it builds, from the spec

`docs/spec/classifier.md` (read whole first), every part except the Look and the switch's and the
dialog's widgets: the categories, the switch's setting and what it starts (F42), which turns the
hourly pass sends, what is sent, the invocation (Claude Code's flags, `--no-session-persistence`, the
environment, the cwd in the data directory), the system prompt **verbatim**, reading the answer,
inheritance, classifying earlier turns (F43: estimate, run, progress, stop, resume after a stop), the
evaluation (F44). Every acceptance case of those parts becomes a Vitest test named after its id,
before the code, seen red; `claude` is never run in a test (a fake fed from recorded replies in
`tests/data/`, scrubbed).

## The design

- `src/core/classifier/`: pure parts (which turns, the batch input, parsing, inheritance, the
  estimate), the runner with its lock (shared with the backfill, so a turn is never sent twice), and
  the writes into the history's category columns (your `src/core/usage/history.ts`; the migration if
  the column is not there yet).
- `src/main/classifier.ts`: runs after each usage pass when the setting is on, off the UI path;
  exposes to the window (IPC in your block) the status line the Integrations page will show, the
  estimate, start/stop of the backfill and its progress.
- `scripts/classify-eval.mjs` (or `.ts` run with the app's runner): the app's own code over the
  labelled set in `eval/` (gitignored in agent-tablet; Menkar's `.gitignore` gets `/eval/`, and the
  set is copied from agent-tablet only with the human's OK — ask `set`), printing agreement as the
  spec says. Not in `npm run ci`.
- Shared files (`src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/index.ts`, the catalogs —
  English and Spanish both complete, decision 1.11): re-read right before each edit, targeted edits.

## Out of scope

The switch and its row, the earlier-turns dialog, the categories in the Usage window (its plan).

## Do not touch

`src/renderer/`, `src/main/terminal.ts`, `src/main/panes.ts`, `src/core/projects/`,
`src/core/sessions/` (`b1`, plan 08).

## Execution blocks

### B1 — The hourly pass
- [ ] Which turns, the input, the invocation, the prompt, the answer, inheritance; the runner and its
      lock; main wiring after the usage pass.
- **Verification:** `npm run ci`.

### B2 — Earlier turns
- [ ] Estimate, run, progress, stop, resume; the IPC for the dialog to come.
- **Verification:** `npm run ci`.

### B3 — The evaluation
- [ ] The script; run once over the labelled set if the human agrees to copy it and to spend the
      quota (about five calls), its figures in the log beside agent-tablet's.
- **Verification:** the script runs; `npm run ci`.

### B4 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
