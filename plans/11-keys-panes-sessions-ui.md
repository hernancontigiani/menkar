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
- [ ] The prefix, its pill and help, `Ctrl+B Ctrl+B`, split panes, swap orientation, zoom.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B2 — Switcher, Go to agent, the main menu
- [ ] The quick switcher, Go to agent, the ⚙ menu with its items.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B3 — Add session
- [ ] The dialog with Existing (history browser, rows, Add / Added / Move from) and New (folder, name,
      agent), the advanced dialog; plan 08's interim New dialog removed.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B4 — Session menus
- [ ] Details, export, replay, copy ID, reveal, hide / show hidden, trash and delete (each confirmed;
      a test asserts nothing else under `~/.claude` changes), select mode.
- **Verification:** `npm run ci`; `npm run ui-check`.

### B5 — Exit
- [ ] The exit's files.
- **Verification:** `npm run ci`.

## Execution log

(Written by the session that executes it.)
