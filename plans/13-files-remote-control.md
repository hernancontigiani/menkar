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
- [x] Opening, the file check, the tab, read only, saving, changes on disk, closing with unsaved edits,
      shared buffers, the saved layout, Open session file….
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — The Markdown preview and `menkar open`
- [x] The preview and its CSP and links; the CLI with the which-window question.
- **Verification:** `npm run ci`; `npm run ui-check` (the preview drawn under xvfb, screenshot looked
      at).

### B3 — Remote Control and the leftovers
- [x] The switch on New, the menu items, the phone icon, the flag; the details' Tokens row.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Exit
- [x] The exit's files; `plans/00-STATUS.md` §2 gains the human's check of a session with Remote Control
      on, from the phone.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B4. Before it, the two follow-ups `set` asked: `pushWindowStates()`
exported, and the ⚙ items wired to `src/main/windows.ts` (with `Ctrl+,` and `Ctrl+B s`). Then
`quitApp()` for b2's "Restart now"; within it, the chat-tab hook and menus for b2's plan 14.

**Built:**
- **B1:**
  - `src/core/files/check.ts` (9 Vitest cases) and `src/main/files.ts`, the shared buffers in main.
  - The workspace's file tabs, saves, unsaved-edit questions and reopening.
  - The renderer: `editor.ts` (CodeMirror 6), `fileopen.ts` (Open file, `Ctrl+Shift+O`), and
    `Ctrl+S` / `Ctrl+Shift+V` only while a file tab is selected.
  - "Open session file…" kept as plan 11 built it (a replay).
- **B2:** `preview.ts` (markdown-it in a sandboxed `srcdoc` frame, links handled by the window),
  and `menkar open` with the single-instance lock, `deliverFiles` and "Open in which window?".
- **B3:**
  - `src/core/remote.ts` (5 Vitest cases).
  - The flag on resume and on New's switch, the row and tab menu items, the phone icon, the 6 s
    toast.
  - Details' Tokens row from b2's `sessionTokens()`.
- **Tests:** `e2e/files.spec.ts` (4), `e2e/open.spec.ts` (2: it spawns a second Electron with the
  running app's environment), `e2e/remote.spec.ts` (3).

**Found on the way (fixed):**
- **The tab content's re-render took the focus away**: re-attaching kept nodes blurred an editor
  or a terminal while the user typed. Any state push mid-typing did it, an agent-state change
  included. `renderContent` now restores the focused element.
- **An echo of a window's own edit moved its version back**, so later keystrokes were refused and
  lost. The local version never moves back on an own echo now.
- **One of my reds was invalid at first**: I ran a defect build by hand and the build failed, so
  the test ran against the previous build. I reran it with a defect that compiles, and saw it red.
  The other reds ran through `npm run ui-check`, which builds first.

**Seen red:**
- FIL-12 with the save's read-only refusal removed.
- FIL-32 with the handed-over files ignored.
- RC-5 with the flag dropped on resume.
- The Vitest cases, with their modules missing.

**Deviations and not built:**
- **Not built:**
  - FIL-7 (Browse… starting in the project's folder is built, not tested).
  - FIL-9 and 11 (the shared buffer across projects is built; the e2e covers one project).
  - FIL-16–19 (changes on disk built, not e2e-tested).
  - FIL-21 and 22.
  - FIL-26–29 (preview timing, images, links, dark switch: built, not e2e-tested).
  - FIL-30's reopen half, FIL-33–39, and RC-3, 4, 11, 12, 14, 17–21, 25–27.
  They stay in the spec.
- **The single-instance lock now covers every start but `menkar usage`**: a plain second
  `menkar` brings the active window forward (F25).
- "Stop" in a row's menu now shows for any session with a tab. The running flag in the window's
  state can lag a moment behind the agent starting.
- The renderer's CSP gained `file:` in `img-src` (local images in the preview).
- **Dev dependencies added, all bundled into the renderer** (the installer carries none):
  CodeMirror 6 (state, view, commands, language, search, and the markdown, javascript, json,
  python, css and html modes), markdown-it and its types. The renderer bundle measured 1.8 MB
  minified.
