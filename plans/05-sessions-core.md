# Plan 05 — sessions in `core`: discovery, names, badges, hidden

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 06 (`b2`): no
> shared file.
>
> **Exit, when executed:** how sessions are found and named, and why → `docs/sessions.md` with its
> row in `CLAUDE.md`'s docs table; the parts of `docs/spec/sessions.md` this plan built are trimmed
> to a pointer to it; the rest → `git log`.

## Goal

The app knows every Claude Code and Cursor session on the machine, with the name, folder, times and
badges agent-tablet shows, kept current as transcripts change, and hands that list to the renderer
over typed IPC — the base the window, projects and usage plans read. No UI in this plan.

## What it builds, from the spec

`docs/spec/sessions.md` (read whole first), these parts:

- **Discovery (F1)**, **A session's name (F2)**, **Waiting and interrupted badges (F3)**, **Hide and
  show hidden (F11)** — the data side only (the hidden set in `state.json`; the menu items come with
  the window).
- **Data contracts**: Paths, Claude Code transcript lines, Cursor transcript lines (including
  rebuilding a Cursor `cwd` against the filesystem), Formats shown, Menkar's `state.json` (this
  area's keys).
- **Acceptance cases** of those parts: every case whose feature is F1, F2, F3 or F11's data, written
  as Vitest tests named after the case id, before the code, each seen red.

Not here: the history browser and every dialog (the window plans), details/export/replay
(later), trash/delete, select mode, the agent-tablet import (plan with projects).

## The design

- `src/core/sessions/`: `discover(paths)` → sessions from both agents; `scan(file)` reads only what
  the spec says a row needs (first lines for `cwd`, name lines, the tail for badges), **incrementally**
  (offset and inode kept, a growing file read from where it stopped), never the whole of a large
  transcript on every change; `name(session, appNames)` with the spec's precedence; `badges(...)`.
  Pure functions over file contents where possible, so the cases test them without a filesystem.
- `src/main/sessions.ts`: watches the two projects directories (`fs.watch` recursive where it works,
  a poll otherwise — the log says which), debounces, runs the scan off the event loop's hot path
  (async I/O; a `worker_threads` worker if a full first scan of the human's 2 GB takes over 200 ms
  of blocking — measure it on a scratch copy, never on the human's files), and pushes
  `sessions:changed` with the full list or a diff.
- `src/shared/ipc.ts` gains `sessions:list` and `sessions:changed` with their types (the only file
  shared with nobody else this round: `b2` does not touch IPC).
- Paths: `agentPaths()` from `src/core/paths.ts` (already there; do not change it — ask `set` if a
  path is missing).
- The agents' files are **read only**: a test asserts by invariance that a pass leaves every
  transcript's bytes and mtime unchanged.

## Out of scope

Projects, the window, every dialog, the agent-tablet import, Cursor's chat.

## Do not touch

`src/core/usage/`, `src/core/prices*`, the CLI entry and `docs/spec/usage.md` (`b2`, plan 06);
`src/core/paths.ts`.

## Execution blocks

### B1 — Reading
- [x] The cases of F1/F2/F3 as tests; `discover`, `scan` (incremental), `name`, `badges`; Cursor's cwd.
- **Verification:** `npm run ci`; the invariance test.

### B2 — Watching and IPC
- [x] `main/sessions.ts`, the IPC channels, the hidden set in `state.json` via `jsonstate`; the first
      scan measured on a scratch copy of a large tree (generated, or copied with the human's OK only).
- **Verification:** `npm run ci`; an e2e check that the renderer receives the list from a temporary
      `HOME` with two fake transcripts and an update when one grows.

### B3 — Exit
- [x] `docs/sessions.md`, its `CLAUDE.md` row, the spec trimmed to a pointer for what was built.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B3.

**How it was built:**
- Pure functions over file contents: `lines.ts`, `head.ts`, `badges.ts`, `names.ts` and
  `cursor.ts`. Around them, `scanner.ts`, which reads files incrementally and keeps the inode, the
  offset of the names read, and whether the head is final. `installed.ts` holds the PATH check.
  `src/core/format.ts` and `src/core/state.ts` hold the formats and the state keys.
- The SES cases were written as Vitest tests named after their ids before the code, and seen red
  first because the modules did not exist. Then injected defects:
  - non-incremental reading fails SES-14;
  - a partial last line applied fails SES-15;
  - a read that touches the file's times fails the invariance test;
  - a request dropped during a scan (agent-tablet's way) fails SES-5;
  - watching only once fails SES-4;
  - no debounce fails SES-3;
  - the broadcast disabled fails the e2e.

**Deviations:**
- **The service lives in `src/core/sessions/service.ts`, not in `src/main/`.** Watching,
  debouncing and coalescing need Node, not Electron, so they are tested in Vitest with real
  `fs.watch`. `src/main/sessions.ts` only creates it with `agentPaths()` and broadcasts to every
  window.
- **Watches are non-recursive `fs.watch`, as the spec lists them**, set again after each scan. Not
  recursive, because `subagents/` and `tool-results/` churn while a session runs.
- **No worker thread.** Measured on a generated tree (400 transcripts, 2 GB, in the scratchpad,
  deleted after): a first scan took 1.7 s with a longest event-loop stall of about 8 ms. A rescan
  with nothing changed took 11 ms. The cache was warm because the tree had just been written.
- **`SessionInfo` lives in `src/core/sessions/info.ts`, types only**: the renderer's compile sees it
  through `src/shared/ipc.ts` and has no Node types.
- **IPC:** `sessions:list`, `sessions:changed` (the whole list each time) and
  `sessions:set-hidden`. `SessionsService.refresh()` (the history's refresh button) and
  `setAppName()` (Rename) are built and tested in `core`; their IPC comes with the dialogs that
  call them.
- The spec's Formats shown are built (`format.ts`). The relative "last active" belongs to the
  history row (F4) and is not built.

**Not anticipated (for `set`):**
- **`state.json` and the first-start import.** The import runs only when neither `state.json` nor
  `projects.json` exists, and hiding a session writes `state.json`. Nothing hides yet (no UI). But
  once a hide exists, a user who hides before the import plan ships would lose the import. The
  import plan should land before, or with, the first UI that writes `state.json`.
- **A projects directory that does not exist when Menkar starts** (Claude installed later) is not
  watched, and its parent is not watched either. Its sessions appear on the next scan another
  event or a refresh causes, or on a restart. Watching `~/.claude` for `projects/` to appear would
  close that gap.
- The tree's full `npm run ci` was red during this work on `b2`'s files in progress
  (`src/core/usage/`, `tests/core/usage/`, `tests/factories/usage.ts`: format and lint). Every step
  passes on this plan's paths.
