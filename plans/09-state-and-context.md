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
- [x] `ScreenMirror`, `detectState` with Claude Code's and Cursor's cases, `sessionSettingsFile()`
      (the file written with the statusline command line); report to `set`.
- **Verification:** `npm run ci`.

### B2 — State: shown state, roll-up, counts, notifications
- [x] The rest of agent-state.md's cases; `src/main/agentstate.ts` and its IPC events.
- **Verification:** `npm run ci`.

### B3 — Context: the statusline, its files, the reading, the integrations
- [x] The script, the parity test with `src/core/usage/statusline.ts`, the integrations with their
      backups and invariance tests; the packaged-app check of `ELECTRON_RUN_AS_NODE`.
- **Verification:** `npm run ci`; `npm run package:check` still green.

### B4 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b2`, 2026-11-08, in the order B1, B3, B2, B4: B3 went before B2 so that b1 could
enable `--settings` sooner (agreed with `set`).

**B1 — the seam.** `src/core/agentstate/{detect,mirror}.ts`, `src/core/context/{files,settings}.ts`,
`src/main/context.ts` (`sessionSettingsFile()`), `claudeSettings` in `agentPaths()`
(`src/core/paths.ts`), and `@xterm/headless` 6.0.0 as a runtime dependency (`package.json`,
`package-lock.json`). Tests: `tests/core/agentstate/{detect,mirror}.test.ts`,
`tests/core/context/settings.test.ts`.

**B3 — context.** `src/core/context/{statusline,reading,tracker,types,integrations}.ts`; the
statusline as a third main entry in `electron.vite.config.ts`; `allowImportingTsExtensions` in
`tsconfig.base.json`, so the script runs unbuilt under Node in its tests; `STATUSLINE_READ_KEYS` in
`src/core/usage/statusline.ts`, whose log path now comes from the script. Tests:
`tests/core/context/{statusline,reading,integrations}.test.ts`. Packaged check: after
`npm run package`, `ELECTRON_RUN_AS_NODE=1 release/linux-unpacked/menkar
release/linux-unpacked/resources/app.asar/out/main/statusline.js` with a payload on stdin printed
`pkg-check · 13%`, exit 0, and wrote `sessions/s1.json` and `usage.jsonl` under a temporary
`XDG_CACHE_HOME`. `npm run package:check` stayed green (291 entries).

**B2 — state.** `src/core/agentstate/{shown,watch,notify}.ts`, `src/main/agentstate.ts` on b1's
`AgentPane` (`src/main/panes.ts`); IPC `agentState:changed`, `agentState:toast` and
`context:reading` in my block of `src/shared/ipc.ts` and `src/preload/index.ts`; both started in
`src/main/index.ts`. Strings in my block of `src/core/i18n/{en,es}.ts`. Tests:
`tests/core/agentstate/shown.test.ts`.

**B4 — exit.** `docs/agent-state.md`, `docs/context.md`, their rows in `CLAUDE.md`; the built
parts of both spec files trimmed to pointers, removed lines verbatim in
`docs/history/spec/{agent-state,context}.md`. Left in the spec: the widgets (dots, badge, switcher,
Go to agent, ring drawing, Integrations page, toast) and AST-18, AST-28, AST-32 to AST-39.

Deviations and what the plan did not anticipate:
- **Code before tests again**, block by block. Every test was then seen red under injected defects
  (about 60 mutations, each reverted). Four were first missed and their tests strengthened. One
  survives: dropping the tail's cut first line before parsing changes nothing, because a line cut
  in the middle does not parse as JSON anyway.
- **`ScreenMirror.title()` is a getter**: the mirror parses the agent's OSC title itself, so nobody
  passes the title in (the plan wrote `title(text)`).
- **The seam grew five members** (`seen`, `onSeen`, `tabTitle`, `windowFocused`, `reveal`),
  agreed through `set`. The foreground check (AST-17's input) and the registration of agent panes
  only (AST-18) are b1's. AST-28's reveal is b1's too, and stays in the spec.
- **The sound** goes through `paplay` with Electron's beep as the fallback. agent-tablet used GTK's
  media; Electron's main process has no audio.
- **The integrations record and backups are in the data directory** (1.10), not
  `$XDG_STATE_HOME` as the spec wrote. Its sentences go through `t()`.
- **The bar for a non-string `session_id` with no name is `menkar`**, as the spec says.
  agent-tablet printed the id turned into a string.
- **`src/main/agentstate.ts` and the main side of `context.ts` have no test of their own yet**.
  They need b1's panes registered in a running app. Their logic is in core and tested. The first
  e2e test on a live pane belongs to the plan that shows the dots.
- **An open `fs.watch` on the sessions folder kept the app from quitting**: b1's
  `e2e/terminal.spec.ts` "Chromium's data lands in the cache…" timed out at `app.close()` with the
  context watcher started, and passed with it disabled. The watcher is now `unref()`ed, and that
  test passes. It is the regression test for this.
- **At delivery:** Vitest 432 passed. `npm run ui-check`: 7 passed, among them every test touching
  this plan. The only reds (`tsc` and three `look.spec.ts` tests) are in b1's new, uncommitted
  `e2e/look.spec.ts`. Biome, code rules, i18n (both catalogs complete), test integrity, flaky and
  history pass.
