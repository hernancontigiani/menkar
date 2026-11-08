# The classifier — how turns get a development stage

The opt-in classification of the turns the human types into one of seven stages, through Claude
Haiku run as `claude -p` with the user's own login. The code says what each step does. This file
keeps why it is shaped this way. The switch, its status line, the earlier-turns dialog and the
categories in the Usage window are still `docs/spec/classifier.md` and `docs/spec/usage.md` until
they are built.

## The shape

- **`src/core/classifier/`**, plain Node, tested without `claude`:
  - `prompt.ts`: the system prompt, kept word for word as agent-tablet measured it, and the
    constants.
  - `input.ts`: the batch's text (an index per turn, never an id or a name, the previous prompt,
    the shaped prompt, the tools line), the command and environment, and reading the reply.
  - `turns.ts`: which turns are ready, and reading a turn's text from its transcript at the byte
    the usage cache recorded.
  - `run.ts`: the hourly pass (at most ten batches of thirty), the earlier-turns run (no cap, a
    stop between calls, progress) and the estimate.
  - `lock.ts`: one classification at a time.
  - `settings.ts`: `classify_since` and `classify_last` in `state.json`.
  - `text.ts`: the status line and the estimate's lines, through `t()`.
- **The history** keeps a turn's `category` and `category_tries`. The classifier writes only those
  two columns. A turn the human did not start takes the category of the session's latest human turn
  before it when a report is built, never written. An `unknown` turn shows its own category
  (decision 1.10).
- **`src/main/classifier.ts`** runs each job in `src/main/classifier-worker.ts`, a worker thread,
  because its SQLite reads and its calls to `claude` are synchronous. The hourly pass runs after
  every usage pass while the switch is on (`startUsagePasses`'s `after`). The earlier-turns run
  shares a `SharedArrayBuffer` with main for Stop and the "sent of total" progress, since the
  worker's loop does not read messages while it waits on `claude`. The IPC for the page and the
  dialog: `classifier:status`, `:set`, `:estimate`, `:classify-earlier`, `:stop`.
- **State** goes through `sessions.updateState()`, the one holder of `state.json` in memory, so
  the classifier's writes and the names and hidden set never save from different copies.
- **The evaluation**, `node scripts/classify-eval.mjs <labels.json>…`, imports the app's own
  `input.ts` and `prompt.ts` unbuilt (they import only each other, with `.ts` extensions) and calls
  `claude` from a temporary data folder. It is run by hand, never in CI, over a git-ignored `/eval/`.

## Why

- **Haiku through the user's own login, not a local model**: on agent-tablet's 141 hand-labelled
  turns, Haiku agreed 62–74% against 44–52% for the best local model, which also needed a download
  of hundreds of megabytes to gigabytes.
- **The prompt and the input's exact bytes as measured.** Rewording a line, or sending the batch's
  JSON with other separators, is a new measurement. That is why the input keeps Python's `", "`
  and `": "` separators and cuts by code points.
- **A batch's turns are numbered, not named**, so no session id, uuid or session name leaves the
  machine. The reply maps back by index.
- **A try per unanswered turn, none per failed call.** A turn Haiku cannot place stops being sent
  after three tries. A `claude` that fails or times out is no fault of the turn, so the run stops
  and records the failure.
- **Ready means its tools are known**: a later turn in the session, or an hour of quiet.
- **Earlier turns are counted by file size, not read.** Reading thousands of turns made
  agent-tablet's dialog wait.
- **A fake `claude`** (`tests/data/classifier/claude`) answers the invocation tests from reply
  files written by hand in the documented shape. The real one is never run in a test.
