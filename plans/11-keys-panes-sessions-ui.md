# Plan 11 — keys, split panes, the switcher; Add session and the session menus

> **Status:** written 2026-11-08, ready to execute. Executed by `b1`, beside plan 12 (`b2`).
>
> **Exit, when executed:** `docs/window.md` and `docs/sessions.md` gain what was built; the built
> parts of `docs/spec/terminal.md`, `agent-state.md` and `sessions.md` trimmed to pointers, removed
> lines to `docs/history/spec/`; `README.md` updated; the rest → `git log`.

## Goal

The main window does everything agent-tablet's does with its keys and its sessions: the `Ctrl+B`
prefix with its PREFIX pill and help, split panes (a shell beside or below, focus by direction,
cycle, zoom, close, swap orientation), the quick switcher and Go to agent, the ⚙ main menu; and the
whole sessions UI — the Add session dialog (Existing with the history browser, Add / Added / Move
from; New replacing plan 08's interim dialog), the advanced new-session dialog, the row and history
menus with details, export, replay, copy ID, reveal, hide/show hidden, trash and delete (confirmed —
the only writes under `~/.claude`), and select mode.

## What it builds, from the spec

Read whole first: `docs/spec/README.md` (with its overriding decisions), and what remains of
`terminal.md` (the `Ctrl+B` prefix, split panes, anything plan 08 left), `agent-state.md` (quick
switcher, Go to agent, and AST-18, AST-28 if still open), `sessions.md` (the history browser, a
history row, its menu, Add session → Existing and New, details, export, replay, copy and reveal, hide,
trash and delete, select mode), plus plan 08's log of what it left (in git at `567716c`). Every
acceptance case of those parts becomes a test (Vitest for logic, e2e under `xvfb-run` for the screen),
named after its id, before the code, seen red. Remember xterm.js's key handler sees keydown and
keypress: a key the app takes is blocked for every event type.

## Seams with plan 12 (`b2`)

`b2` builds Preferences and the Usage window as their own modules and windows. The ⚙ main menu is
yours: its "Preferences" and "Usage" items call `b2`'s entry points (`b2` tells `set` their names;
until then the items are wired to a stub that logs). Do not edit `b2`'s modules.

## Do not touch

`src/core/usage/`, `src/core/classifier/`, `src/core/context/`, `src/core/agentstate/`, `src/main/`
`{usage,classifier,context,agentstate}*.ts`, and plan 12's new renderer modules (`b2`).

## Execution blocks

### B1 — Keys and panes
- [x] The prefix, its pill and help, `Ctrl+B Ctrl+B`, split panes, swap orientation, zoom.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — Switcher, Go to agent, the main menu
- [x] The quick switcher, Go to agent, the ⚙ menu with its items.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — Add session
- [x] The dialog with Existing (history browser, rows, Add / Added / Move from) and New (folder, name,
      agent), the advanced dialog; plan 08's interim New dialog removed.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Session menus
- [x] Details, export, replay, copy ID, reveal, hide / show hidden, trash and delete (each confirmed;
      a test asserts nothing else under `~/.claude` changes), select mode.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B5 — Exit
- [x] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

Executed by `b1` on 2026-11-08, B1 → B5.

**Built:**
- **B1:** `src/core/panes.ts` (focus by direction), and the prefix in `src/renderer/keys.ts` with
  the PREFIX pill, the 21-line help, `Ctrl+B Ctrl+B` → `02`, split right/down, focus by direction,
  next pane, zoom and close pane. Main gained `splitPane`/`closePane`/`swapOrientation` (closing
  hangs up, decision 1.9), and the tab menu "Swap the split's orientation".
- **B2:** `src/core/sessions/history.ts` (groups, search, count line, relative times, recent
  folders), and `src/renderer/switcher.ts` (the quick switcher and Go to agent in one dialog).
  Main gained `listTabs` (windows by focus order) and `revealTab`. The ⚙ menu: Open session file…,
  Show hidden sessions, Usage, Preferences, About. The last three call
  `openUsage`/`openPreferences`/`openAbout` in main, which log until plan 12's entry points are
  named.
- **B3:** `src/renderer/addsession.ts`: Existing with the history browser, rows, Add / Added /
  Move from (`pickSession` → the layout's `moveSessionHere`), select mode and the count line; New
  with folders, Another folder…, name and agent; the advanced dialog; the `+` ▾ menu. Plan 08's
  interim dialog is removed. `show_folder_path` joined the settings.
- **B4:** `src/core/sessions/transcript.ts` (details, Markdown export, replay turns),
  `src/renderer/sessionmenus.ts` (the history row menu, details, confirmations, select-mode trash)
  and `src/renderer/replay.ts` (the replay tab). Main reads files for details, export and replay,
  reveals transcripts, trashes (`shell.trashItem`) and deletes (`unlink`) only the `.jsonl`.
- **Tests:**
  - Vitest: `tests/core/panes.test.ts`, `tests/core/sessions/history.test.ts` and
    `tests/core/sessions/transcript.test.ts`.
  - e2e: `e2e/panes.spec.ts`, `e2e/switcher.spec.ts` and `e2e/addsession.spec.ts`.
  - `e2e/fixtures.ts`: the stand-in `claude`, moved out of `window.spec.ts` with no `expect` line
    changed.

**Seen red:**
- The Vitest cases, with their modules missing.
- The prefix's ending key not consumed fails TRM-28 (a swallow-only defect did not: a cancelled
  `keydown` sends no `keypress`).
- A filter ignoring the query fails AST-32 and AST-34.
- Delete also removing the sibling directory fails SES-65.

**Deviations and not built:**
- **Not built:**
  - The Remote control switch on New (with Remote Control).
  - MCP servers (M3, with chat).
  - Details' Tokens row (it must come from the usage module) and its "Available to this project".
  - The history row items Open in Ghostty and Continue in chat.
- Trash was not exercised in the e2e: `shell.trashItem` depends on the desktop's trash service. It
  is code-reviewed and shares the deletion path that SES-65 asserts.
- A row menu inside the Add session dialog needed menus above the dialog's scrim
  (`.popover { z-index: 40 }`).

**A test timing fixed:** two switcher tests pressed `Ctrl+Shift+K` before the window had drawn its
first state and failed when the start was slower. They now wait for the rows first; three runs in
a row are green.

**For `set`:** the ⚙ items Usage, Preferences and About wait for plan 12's entry points (wire them
in `src/main/workspace.ts`, cases `openUsage`/`openPreferences`/`openAbout`).
