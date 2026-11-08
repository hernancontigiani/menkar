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
- [ ] The cases of F1/F2/F3 as tests; `discover`, `scan` (incremental), `name`, `badges`; Cursor's cwd.
- **Verification:** `npm run ci`; the invariance test.

### B2 — Watching and IPC
- [ ] `main/sessions.ts`, the IPC channels, the hidden set in `state.json` via `jsonstate`; the first
      scan measured on a scratch copy of a large tree (generated, or copied with the human's OK only).
- **Verification:** `npm run ci`; an e2e check that the renderer receives the list from a temporary
      `HOME` with two fake transcripts and an update when one grows.

### B3 — Exit
- [ ] `docs/sessions.md`, its `CLAUDE.md` row, the spec trimmed to a pointer for what was built.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
