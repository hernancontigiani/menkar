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
- [x] The cases as tests; `core/projects/`.
- **Verification:** `npm run ci` on your paths (the tree's may be red on `b2`'s files in progress).

### B2 — The import, and watching a projects directory that appears later
- [x] The import with its cases and the invariance test; main runs it before the first window; the
      watcher fix with its test.
- **Verification:** `npm run ci`; an e2e: a temporary HOME with an agent-tablet `projects.json` and
      `state.json` → Menkar's files written with the imported projects, agent-tablet's unchanged.

### B3 — Exit
- [x] `docs/projects.md`, its `CLAUDE.md` row, the spec trimmed with its history.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B3.

**Built:**
- `src/core/projects/model.ts`, `layout.ts`, `store.ts` and `import.ts`, plus `info.ts` (the
  snapshot types, with no Node import, for the renderer's compile).
- `src/main/projects.ts` and `projects:get`. Main runs the import before the sessions' first scan
  and before the first window.
- The watch on an absent projects directory's nearest existing ancestor
  (`src/core/sessions/service.ts`).
- Every case without a widget is a Vitest test named after its id, seen red first (the modules
  missing). Then injected defects:
  - the import renaming an unreadable source fails SES-73;
  - reopening without the taken-project rule fails PRJ-51;
  - no ancestor watch fails the late-directory test;
  - the import left out of main fails the e2e.

**Cases built in `core`, as tests:**
- PRJ-1 (data), 3–10, 11–16 and 22–25 (the model's refusals and changes), 18 and 19 (switching),
  27–35 (open, open beside, the F5 pick), 36 and 37 (`joinTarget`), 38–40, 44, 47, 49–55, 57
  (data).
- SES-47 (the layout part), SES-71–84.

**Left for the window plan** (they need a widget, a toast, a key or a running terminal):
- PRJ-1 and PRJ-2 on screen, and PRJ-2's toast (its text and moved name are in
  `projects:get`'s notices);
- the dropdown, dialogs and error dialogs of PRJ-11–16;
- PRJ-17 (stopping sessions in another window);
- PRJ-20 and 21 (the list's sections and folder lines);
- the menus of PRJ-22–26;
- every on-screen part of PRJ-27–35, 41–43, 45, 46 and 48 (vertical shown stacked);
- PRJ-36 and 37's watching for the first typed message;
- PRJ-56 (the sidebar);
- the toasts of SES-72–75.

**Deviations:**
- **`jsonstate.readJsonReport`** (my plan 03 module, extended). A `parse` may throw
  `UnreadableShape` to have a JSON file of the wrong shape moved aside like a non-JSON one, and the
  moved name comes back for the notice. `readJson` keeps its signature.
- **`Projects.windows` holds the saved windows as the file had them** (`unknown[]`). `reopen()`
  checks each entry by the spec's rules, and a save writes the live layout (`toSaved`).
- **`check-i18n` counts a key written as a string literal under `src/` as used**: `core` returns
  refusal keys that the UI will pass to `t()`. Without that, every refusal would warn as unused.
- **Notices travel as data**: the import's two notices and an unreadable `projects.json` are
  returned in `projects:get`, `{ key, params }`, for the window plan to show.
- **Writing both files on the first start:** `state.json` goes first; if `projects.json` then
  fails, `state.json` is removed, so the next start is a first start again (SES-83).
- **Settings imported** keep agent-tablet's keys, which are Menkar's. `remote_control` and
  `settings` are written only when not empty.

**For a person reading the diff (`npm run ci`'s test-integrity step is red on purpose):**
`e2e/terminal.spec.ts`'s config-directory assertion
`expect(existsSync(config) ? readdirSync(config, { recursive: true }) : []).toEqual([])` became
false by design: the first start now writes `projects.json` and `state.json` there. It is replaced
by an assertion that the directory holds exactly those two files, with nothing of Chromium's. The
guard has no override; once this change is committed the baseline moves and the step is green.

**Not anticipated:**
- `docs/history/spec/sessions.md` received its new sections at the end rather than in the
  document's section order: moving committed lines would read as a loss to the history check. The
  file only grows.
- `src/core/i18n/en.ts` and `es.ts` were written whole once in this plan, before `b2`'s `usage.*`
  block existed. Since `set`'s coordination message, they have been edited only in place.
