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
- [x] Which turns, the input, the invocation, the prompt, the answer, inheritance; the runner and its
      lock; main wiring after the usage pass.
- **Verification:** `npm run ci`.

### B2 — Earlier turns
- [x] Estimate, run, progress, stop, resume; the IPC for the dialog to come.
- **Verification:** `npm run ci`.

### B3 — The evaluation
- [x] The script; run once over the labelled set if the human agrees to copy it and to spend the
      quota (about five calls), its figures in the log beside agent-tablet's.
- **Verification:** the script runs; `npm run ci`.

### B4 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-08.

**B1 — the hourly pass.** `src/core/classifier/{prompt,input,turns,run,lock,settings,text}.ts`.
`unclassified`, `setCategories` and `countTry` in `src/core/usage/history.ts`; `extent` and
`previousHuman` in `src/core/usage/cache.ts`. `src/main/classifier.ts`,
`src/main/classifier-worker.ts` (a fourth main entry in `electron.vite.config.ts`), the `after`
hook of `startUsagePasses` in `src/main/usage.ts`, and its registration in `src/main/index.ts`.
Tests: `tests/core/classifier/{pass,lock}.test.ts`, the stand-in `tests/data/classifier/claude`,
and `e2e/classifier.spec.ts` (the real app, the start-up pass then the classification; red without
the hook).

**B2 — earlier turns.** In the same files: `estimate`, `classifyEarlier` with progress and stop,
and the IPC `classifier:status`, `:set`, `:estimate`, `:classify-earlier` and `:stop` in my block of
`src/shared/ipc.ts` and `src/preload/index.ts`. Strings in my block of both catalogs. Tests:
`tests/core/classifier/earlier.test.ts`, and a second e2e test calling the estimate and the run
through `window.menkar.classifier` (red with the handler disabled).

**B3 — the evaluation.** `scripts/classify-eval.mjs` and `/eval/` in `.gitignore`. Test:
`tests/scripts/classify-eval.test.ts`, against the stand-in `claude`: usage and exit 2, two files
of 50 and 91 → 6 calls and every output line, the user's data folder untouched. **The real run**
(approved by the human, 2026-11-08): agent-tablet's labelled set (`sample.json`, 50 random turns;
`silver.json`, 91 more) was copied to the git-ignored `/eval/classifier/`, and
`node scripts/classify-eval.mjs eval/classifier/sample.json eval/classifier/silver.json` was run
once. 6 calls on the human's login, 73 s, exit 0, every turn answered:

```
sample     36/50 = 72%
silver     53/91 = 58%
all        89/141 = 63%
answered   141/141
  plan      recall 9/13 = 69%
  design    recall 25/33 = 76%
  build     recall 10/16 = 63%
  test      recall 15/22 = 68%
  deploy    recall 7/15 = 47%
  maintain  recall 17/25 = 68%
  other     recall 6/17 = 35%
```

Beside agent-tablet's figures for the same prompt and code path ("Haiku with the app's code",
2026-11-07): 74% on the 50 random turns and 66% on all 141. Menkar's 72% and 63% are within what
one rerun of a sampled model moves (one or two turns on the 50, four on the 141). `other` is still
the weak spot (6 of 17, agent-tablet 3–7). Menkar's `/eval/` copy was deleted after the run.

**B4 — exit.** `docs/classifier.md`, its row in `CLAUDE.md`, the evaluation script in
`README.md`; the built parts of `docs/spec/classifier.md` trimmed to pointers, removed lines
verbatim in `docs/history/spec/classifier.md`. Left in the spec: the categories, the switch, the
earlier-turns dialog, the settings, the Look, and CLS-1, CLS-25, CLS-26, CLS-30 to CLS-32.

Deviations and what the plan did not anticipate:
- **Code before tests once more**, with every test seen red under injected defects (about 50). Six
  were first missed and their tests strengthened, among them CLS-28's, which had recomputed the
  estimate with the code's own constants.
- **The `unknown` gap** (the spec's "Menkar must decide"), resolved by decision 1.10: an `unknown`
  turn shows its own category. Its "previous prompt" is still the latest *human* prompt, as in
  agent-tablet, so a transcript from before `turnOrigin` sends none. Changing that is a new
  measurement.
- **The classifier runs in a worker thread per job**, with a `SharedArrayBuffer` for Stop and
  progress, instead of agent-tablet's threads with an Event.
- **State writes go through `sessions.updateState()`**, since b1's sessions service holds
  `state.json` in memory and a separate write would be lost at its next save.
- **`input.ts` imports `prompt.ts` with its extension**, so the evaluation script runs the app's
  own code unbuilt under Node 22 (the system's Node 18 cannot strip types: the script is run with
  the project's Node).
- **At delivery:** `npm run ci` passes (475 Vitest tests). `npm run ui-check` passes all 16 tests.
