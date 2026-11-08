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
- **The reading** (`reading.ts`, `tracker.ts`): the session file when it is newer than the
  transcript's last assistant message, otherwise an estimate from that message. At most one read is
  in flight per session, plus one re-read. Main watches the sessions folder and sends every window
  `context:reading`. The window calls `trackContext(sessionId, transcript)` for each session it
  shows.
- **The integrations** (`integrations.ts`): turning the statusline on or off in
  `~/.claude/settings.json` keeps a byte copy of the file first and records what was installed and
  what it replaced in `<data>/integrations.json`. It refuses to remove a statusline the user changed
  since. The other keys of both files are kept. The record and the backups live in the data
  directory (decision 1.10), since the cache can be cleared.

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
