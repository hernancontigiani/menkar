# Plan 09 — agent state and context: detection, counts, notifications; the statusline and `--settings`

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 08 (`b1`); the
> seam between them is named under "The design".
>
> **Exit, when executed:** how state and context are read, and why → `docs/agent-state.md` and
> `docs/context.md` with their rows in `CLAUDE.md`'s docs table; the built parts of
> `docs/spec/agent-state.md` and `context.md` trimmed to pointers, removed lines to
> `docs/history/spec/`; the rest → `git log`.

## Goal

Everything behind the dots, the counts and the context ring, built without the widgets that show
them: each running pane's state (working, blocked, idle, done, seen) from its title and screen as
agent-tablet reads them, the roll-up and the blocked count, desktop notifications and their sound;
and the context side: the statusline command Menkar's sessions run (Node, not Python — Windows has no
`python3` to count on), what it writes, the per-session `--settings` file, the context reading the
ring will draw, and the integrations' install and removal in `~/.claude/settings.json` with consent
and backups.

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions), `agent-state.md`,
`context.md`.

- **agent-state.md** — when the state is read (F30), Claude Code's and Cursor's rules, raw to shown
  (done and seen), the roll-up, the blocked count (F31), notifications and sound (F32) in main.
  The quick switcher (F33) and Go to agent (F34) are widgets: not here.
- **context.md** — the context ring's data (F35, the reading and its thresholds; the drawing is a
  widget, not here), the statusline (F36) as a Node script shipped with the app, `--settings`
  (F36), the Integrations page's logic (F37: install, remove, backups, the record — the page itself
  is Preferences' plan), and every data contract of the file (stdin, the session file, the usage log
  — which `src/core/usage/statusline.ts` already reads: one format, a parity test between writer and
  reader).
- Every acceptance case of those parts becomes a Vitest test named after its id, before the code,
  seen red. Writes under `~/.claude` happen only in the integrations' install and removal, each
  tested by invariance on everything else in the file.

## The design

- `src/core/agentstate/`: pure rules over (provider, title, screen text) and a `ScreenMirror` on
  `@xterm/headless` fed a pane's bytes (core may use it: it needs neither Electron nor the DOM);
  the roll-up and counts. `src/main/agentstate.ts`: per-pane mirrors, the timers of the spec,
  notifications through Electron's `Notification`, and IPC events for the widgets to come.
- `src/core/context/`: the statusline script (built to a single file in the app's resources, run as
  `node`-compatible by Electron's own binary with `ELECTRON_RUN_AS_NODE=1`, so no system Node is
  needed — check it works from the packaged `.deb` and log it), the session file and usage log it
  writes (paths from `appDirs()`; add what you need to `src/core/paths.ts` and tell `set`, who
  reviews it), the per-session settings file, the context reading, the integrations' logic.
- **The seam with plan 08 (`b1`):** deliver first (your B1) a small, documented API —
  `ScreenMirror` (`write(bytes)`, `title(text)`, `screen()`), `detectState(provider, title, screen)`,
  and `sessionSettingsFile()` returning the `--settings` path — then tell `set`, who passes it to
  `b1` to wire into `src/main/terminal.ts` and the command builder. Do not edit `b1`'s files
  (`src/main/terminal.ts`, the renderer, the command builder).
- **Shared files** (`src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/index.ts`,
  `src/core/i18n/{en,es}.ts`, `CLAUDE.md`, `electron.vite.config.ts`): re-read right before each edit,
  targeted edits only, your keys in your own block.

## Out of scope

Every widget: the dots, the ring, the counts on screen, the quick switcher, Go to agent, the
Integrations page.

## Do not touch

`src/main/terminal.ts`, `src/renderer/`, the command builder, `src/core/projects/`,
`src/core/sessions/` (`b1`).

## Execution blocks

### B1 — The API for the seam
- [ ] `ScreenMirror`, `detectState` with Claude Code's and Cursor's cases, `sessionSettingsFile()`
      (the file written with the statusline command line); report to `set`.
- **Verification:** `npm run ci`.

### B2 — State: shown state, roll-up, counts, notifications
- [ ] The rest of agent-state.md's cases; `src/main/agentstate.ts` and its IPC events.
- **Verification:** `npm run ci`.

### B3 — Context: the statusline, its files, the reading, the integrations
- [ ] The script, the parity test with `src/core/usage/statusline.ts`, the integrations with their
      backups and invariance tests; the packaged-app check of `ELECTRON_RUN_AS_NODE`.
- **Verification:** `npm run ci`; `npm run package:check` still green.

### B4 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
