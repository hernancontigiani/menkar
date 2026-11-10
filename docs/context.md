# Context — the statusline, `--settings`, the reading, the integrations

How full each session's context window is, and what Menkar adds to Claude Code's settings. The
code says what each step does. This file keeps why it is shaped this way. The ring and the
Integrations page are still `docs/spec/context.md` until they are built.

## The shape

- **The statusline** (`src/core/context/statusline.ts`) is a program of its own. It is built to
  `out/main/statusline.js` by a third main entry in `electron.vite.config.ts`. Claude Code runs it
  after each assistant message as `ELECTRON_RUN_AS_NODE=1 '<menkar binary>' '<…/statusline.js>'`.
  It writes the session file (`<cache>/sessions/<id>.json`) and appends one line to
  `<cache>/usage.jsonl`, which the usage report reads. It prints the bar, or the user's own
  statusline when there is one to chain to.
- **`--settings`** (`src/main/context.ts` `sessionSettingsFile()`): before each Claude command, the
  app rewrites `<config>/claude-settings.json` (Menkar's statusline) and
  `<config>/chained-statusline.json` (the user's own command, or null), each only when its content
  changed. Nothing is written under `~/.claude` for this.
- **The cost since the last compaction** (2026-11-10): the bar shows it before the total
  (`set · 22% · $12.40 · $246.50 total`). The total is Claude Code's `cost.total_cost_usd`, which
  counts on across resumes. The cost since is the total minus a baseline, with no transcript read.
  - **The hook.** The `--settings` file also declares a SessionStart hook, two entries, matchers
    `startup` and `compact`. Its command is the statusline's own, with the argument
    `session-start` (`sessionStartHooks` in `settings.ts`). Checked in Claude Code 2.1.322's
    binary: the hook's stdin carries `session_id` and `source` (one of `startup`, `resume`,
    `clear`, `compact` or `fork`), and the matcher is compared with `source`.
  - **The record.** The hook writes `<cache>/session-starts/<id>.json` (`session_id`, `source`,
    `at`). It is not under `sessions/`, which main watches for readings.
  - **The baseline.** On its next run the statusline sees a record it has not used and keeps a
    baseline in `<cache>/cost-baselines/<id>.json` (`baseline_usd`, `start_at`): 0 after
    `startup`, the current total after `compact`. A resume leaves it, so the count goes on from the
    last compaction.
  - **Unknown.** `clear` and `fork` are not kept: whether their total starts again is not
    Menkar's to know. A session first seen with no record is taken as new when its total is below a
    cent, and otherwise as unknown, so its bar shows the total alone until it compacts. That covers
    sessions started outside Menkar, and those whose last compaction came before this.
  - **What it misses.** The baseline is the total at the first statusline run after the
    compaction, so the cost of that first turn falls before it.
  - **"total"** is the bar's only word. The bar is not translated: the statusline runs inside
    Claude Code, and reads none of the app's settings.
- **The reading** (`reading.ts`, `tracker.ts`): the session file when it is newer than the
  transcript's last assistant message, otherwise an estimate from that message. At most one read is
  in flight per session, plus one re-read. Main watches the sessions folder and sends every window
  `context:reading`. The window calls `trackContext(sessionId, transcript)` for each session it
  shows.
- **The levels** (`levels.ts`, decision 1.22): one definition, `level(percentage, thresholds)`,
  read by the ring (`src/core/ring.ts`) and re-exported by `reading.ts`. The thresholds are the
  settings `ring_warn` and `ring_full` (defaults 60 and 90), kept only as a pair (whole numbers
  1–100, yellow below red) when `state.json` is read and when Settings saves one; anything else
  is both defaults. The window redraws its rings from the settings it is pushed, so a change in
  Settings shows at once. The agent-tablet import has no such settings, so they start at the
  defaults.
- **The integrations** (`integrations.ts`): turning the statusline on or off in
  `~/.claude/settings.json` keeps a byte copy of the file first and records what was installed and
  what it replaced in `<data>/integrations.json`. It refuses to remove a statusline the user changed
  since. The other keys of both files are kept. The record and the backups live in the data
  directory (decision 1.10), since the cache can be cleared.
- **Transcript retention** (2026-11-10) is a second piece of the same kind, the record's
  `retention` key.
  - **Why it exists:** Claude Code deletes a transcript 30 days after its last change unless
    `cleanupPeriodDays` says otherwise, and with it go the details, the export and the
    classifier's input.
  - **Turning it on** sets that key to `RETENTION_DAYS`, 3650. Ten years reads as "keep them" and
    stays an ordinary number; `0` does not mean "forever" there. A larger value the user already
    set is kept, so turning it on never shortens retention.
  - **The record** keeps `{ installed, previous }`.
  - **Turning it off** puts `previous` back, or deletes the key when there was none. It is refused
    when the file no longer holds `installed`.
  - **What the section says first** (`retentionStatus`, read-only, again each time it is shown and
    after each change): the value in the file, which is never a constant. When the key is absent,
    Claude Code's own default applies, `CLAUDE_DEFAULT_CLEANUP_DAYS` (30, its documented default),
    and the text says "Not set" so it never reads as a value from the file. A file it cannot read,
    or a value that is not a number, gets our sentence.

## Why

- **Electron's own binary as Node.** Windows has no `python3` or `node` to count on, and the
  statusline must run whether or not Menkar's window is open. On 2026-11-08 the packaged app
  (`release/linux-unpacked/menkar`) was checked running the script straight from inside `app.asar`
  under `ELECTRON_RUN_AS_NODE=1`: it printed the bar and wrote both files, so nothing has to be
  unpacked from the asar.
- **The script imports only Node's modules, `paths.ts` and `clock.ts`** (with their `.ts`
  extensions), so the tests run it unbuilt, as a real process with real stdin, under plain Node. A
  statusline that throws shows an error in every Claude session, so every failure ends in a bar.
- **One declaration per boundary.** The session file's keys (`SESSION_KEYS`) and the usage line's
  keys (`USAGE_KEYS`) are declared in the script. The readers declare the keys they use
  (`CONTEXT_READ_KEYS`, `STATUSLINE_READ_KEYS`), and a parity test holds each reader's keys inside
  the writer's.
- **`Reading` lives in a Node-free file** (`types.ts`), so the renderer can type the event.
- **Integrations' errors are our own sentences.** A file the user edited by hand is never
  overwritten on removal.
