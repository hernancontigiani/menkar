# Plan 07 — projects in `core`: the model, the layout, `projects.json`, the agent-tablet import

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 06 (`b2`): no
> shared file.
>
> **Exit, when executed:** how projects, membership and the layout are kept, and why →
> `docs/projects.md` with its row in `CLAUDE.md`'s docs table; the parts of `docs/spec/projects.md`
> and of `docs/spec/sessions.md` ("First start: importing") this plan built are trimmed to pointers,
> their removed lines to `docs/history/spec/`; the rest → `git log`.

## Goal

Everything the project view and the windows will need, without any UI: projects with their groups
and members, the rules that keep a session in one project and one tab and a project in one window,
the saved layout of windows and tabs and what reopens on start, `projects.json` read and written as
the spec says — and the first-start import of agent-tablet's `projects.json` and `state.json`
(decision 1.8), which has to exist before any UI writes `state.json` (plan 05's finding).

## What it builds, from the spec

`docs/spec/projects.md` (read whole first): **The model**, **Membership (F23, F5)**, the rules of
**Tabs (F24)** and **Several windows (F25, 1.18)** as a layout model (which session is in which
tab of which window, at most two panes, a project in at most one window), **Reopening on start
(F26)** as the computation of what reopens, **An unreadable projects file (F28)**, and the **Data
contracts** (`projects.json` version 1). `docs/spec/sessions.md`: **First start: importing
agent-tablet's data (decision 1.8)** and its Data contracts for agent-tablet's `projects.json` and
`state.json` — everything but the usage history (`b2`'s plan 06).

Every acceptance case of those parts that does not need a widget becomes a Vitest test named after
its id, before the code, each seen red. Cases that need the window are listed in the log as left
for the window plan.

Also, plan 05's second finding: when `~/.claude/projects` (or Cursor's) does not exist at start, the
sessions service watches its parent and starts watching the directory when it appears.

## The design

- `src/core/projects/`: the model and its operations (create, rename, delete, add/move/remove a
  member, groups, set group) returning a new state or our own error sentence key; `layout.ts` (windows,
  tabs, panes, the invariants, what reopens); `store.ts` reads and writes `projects.json` through
  `jsonstate` (whole, a broken file moved aside, unknown keys kept).
- `src/core/importer.ts` (or `src/core/projects/import.ts`): the first-start rule, the read-only
  reads of agent-tablet's files from `agentPaths()`, partial validity, the two toasts' keys, and the
  write of both Menkar files even when nothing was imported. A test asserts agent-tablet's files'
  bytes and mtimes are unchanged.
- Main runs the import before creating the first window, then loads the projects; IPC for projects
  comes with the window plan (only `projects:get` now if the e2e needs it).

## Out of scope

Every widget (dropdown, rows, menus, tabs on screen); starting or stopping sessions; usage.

## Do not touch

`src/core/usage/`, `tests/core/usage/`, `tests/factories/usage.ts`, the CLI entry,
`docs/spec/usage.md` (`b2`, plan 06); `src/core/paths.ts` (ask `set`).

## Execution blocks

### B1 — The model, the layout, the file
- [ ] The cases as tests; `core/projects/`.
- **Verification:** `npm run ci` on your paths (the tree's may be red on `b2`'s files in progress).

### B2 — The import, and watching a projects directory that appears later
- [ ] The import with its cases and the invariance test; main runs it before the first window; the
      watcher fix with its test.
- **Verification:** `npm run ci`; an e2e: a temporary HOME with an agent-tablet `projects.json` and
      `state.json` → Menkar's files written with the imported projects, agent-tablet's unchanged.

### B3 — Exit
- [ ] `docs/projects.md`, its `CLAUDE.md` row, the spec trimmed with its history.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
