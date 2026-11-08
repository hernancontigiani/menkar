# Plan 13 — file tabs and the Markdown preview; Remote Control; the session leftovers

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 12 (`b2`).
>
> **Exit, when executed:** `docs/files.md` (new) and `docs/window.md` / `docs/sessions.md` gain what
> was built; the built parts of `docs/spec/files.md`, `remote-control.md` and `sessions.md` trimmed to
> pointers, removed lines to `docs/history/spec/`; `README.md` updated (`menkar open`); the rest →
> `git log`.

## Goal

Files and Remote Control as agent-tablet has them, plus what plan 11 left: open any text file in a
tab of its project (the `+` menu, `Ctrl+Shift+O`, `menkar open <file>` into the window in use,
asking which when several), edit it with syntax colors, a read-only rendered Markdown preview, tabs
of one file sharing one buffer, saved and reopened with the project, the agents' data read only;
Remote Control per session (the switch on New off every time, the row and tab menu items, the phone
icon on the row, `--remote-control='<name>'` before `--settings`, nothing typed into a running
session — decision 1.9 and agent-tablet's plan 10 review); and the details dialog's Tokens row from
`src/core/usage/` (read through an API `b2` exposes; ask `set` if none fits).

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions), `files.md`,
`remote-control.md`, and what remains of `sessions.md`. Every acceptance case becomes a test (Vitest
for logic, e2e under `xvfb-run`), named after its id, before the code, seen red.

## The design

- **Editor:** CodeMirror 6 (smaller than Monaco, enough for syntax colors, search and a shared
  `EditorState` per file across tabs); the dependency is justified in the log with its size.
  **Markdown preview:** markdown-it with HTML off, rendered into a sandboxed view with a CSP allowing
  nothing remote; links open in the system browser; images relative to the file only.
- **`menkar open`:** the second instance hands its files to the running one (Electron's single-instance
  lock and `second-instance` event); relative paths resolved in the calling process.
- **Read only:** anything under `~/.claude` or `~/.claude.json`, resolved through symlinks (the trap
  agent-tablet's review found), and refused saves tested by invariance.
- **Remote Control:** the list in `state.json` through `sessions.updateState()`; the flag in the
  command builder.

## Do not touch

`src/main/windows.ts`, the Preferences / Usage / About pages and their modules, `src/core/usage/`,
`src/core/classifier/`, `src/core/context/`, `src/core/agentstate/` (`b2`; ask `set` for an API).

## Execution blocks

### B1 — File tabs
- [ ] Opening, the file check, the tab, read only, saving, changes on disk, closing with unsaved edits,
      shared buffers, the saved layout, Open session file….
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The Markdown preview and `menkar open`
- [ ] The preview and its CSP and links; the CLI with the which-window question.
- **Verification:** `npm run ci`; `npm run ui-check` (the preview drawn under xvfb, screenshot looked
      at).

### B3 — Remote Control and the leftovers
- [ ] The switch on New, the menu items, the phone icon, the flag; the details' Tokens row.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [ ] The exit's files; `plans/00-STATUS.md` §2 gains the human's check of a session with Remote Control
      on, from the phone.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
