# Plan 02 — agent-tablet's behaviour and look, as Menkar's specification

> **Status:** written 2026-11-08, ready to execute. Executed by `b2`, beside plan 01 (`b1`): the two
> share no file.
>
> **Exit, when executed:** `docs/spec/` is permanent until each feature is built (each feature plan
> then moves what it built into its own `docs/<subsystem>.md` and trims the spec); the deferred
> entries carried from agent-tablet → `docs/NOT_BUILT_YET.md`; the rest → `git log`.

## Goal

Every feature plan of Menkar is designed from one place: `docs/spec/`, a complete, testable
description of what agent-tablet does and how it looks — written as behaviour and data contracts,
not as code — so Menkar can be written from scratch with all of agent-tablet's features and its look.

## Sources (read only)

agent-tablet at `~/git/agent-tablet`, `main` at `2f6e564` or later:

- `README.md` — the user-facing feature list, upstream's included (chat and replay tabs, session
  details, export, hide/trash/delete, select mode, MCP servers, the quick switcher, keyboard keys).
- `CLAUDE.md` "Product rules", `plans/00-STATUS.md` §1 (every decision row, with its date).
- `docs/projects.md`, `docs/context.md`, `docs/usage.md`, `docs/files.md`, `docs/ui-verification.md`,
  `docs/NOT_BUILT_YET.md`.
- The code, **to learn behaviour and data formats only** — what a transcript line looks like, which
  flags a command carries, which keys do what, the CSS values of the look. **Never copy code or
  paste functions into the spec**; describe what happens. Code that came from Agent Session Manager
  is read the same way.
- The running app's screens: `make ui-check` in agent-tablet writes screenshots of the main window,
  menus, Preferences, Add session, Usage (totals, by day, months), file tabs; `make ui` serves it for
  more. Copy the screenshots the spec needs into `docs/spec/img/` (demo data only, never the human's).

## What each spec file holds

One file per area, each with the same four parts:

1. **Behaviour** — what the user does and sees, every case, including edge cases and errors (our
   sentences).
2. **Data contracts** — what is read and written: Claude Code's transcript fields and their meaning
   (e.g. `turnOrigin`, `custom-title`, `ai-title`, `message.usage`, `isSidechain`), the CLI flags and
   their checked behaviour, the app's own state files and their fields, the statusline JSON.
3. **Acceptance cases** — numbered, concrete, testable: input → expected result. These become the
   feature plans' tests.
4. **Look** — the screenshot(s) and the measurable details: layout, sizes, spacing, colors (both
   themes), fonts, icons, the states of each widget.

## The files

`docs/spec/README.md` (the index: each area in one line, and a table of every keyboard shortcut and
every menu item with its area) and one file per area:

| File | Area |
|---|---|
| `sessions.md` | Finding sessions (Claude Code's and Cursor's), their names, the session list's rows, details, export, replay, hide/trash/delete, select mode, the Add session dialog (Existing, New) |
| `terminal.md` | Starting, resuming, forking and continuing a session (commands, flags, `--settings`, `&& exit`), the embedded terminal, keys (Shift+Enter, copy/paste, the `Ctrl+B` prefix), close and stop, graceful exit |
| `projects.md` | Projects, groups, tabs of up to two panes, several windows, the layout saved and reopened, the decisions 1.13–1.19 of agent-tablet |
| `agent-state.md` | Working / blocked / idle / done detection from the terminal's title and screen, the counts, notifications and sound, the quick switcher |
| `context.md` | The context ring, the statusline script and what it writes, `--settings`, the integrations menu |
| `usage.md` | The turn, execution and blocked time, tokens and deduplication, prices, the history, the Usage window (periods, months, chart), `usage` CLI |
| `classifier.md` | The opt-in SDLC classification, its invocation, the earlier-turns backfill, the evaluation |
| `files.md` | File tabs, the editor, the Markdown preview, `open` CLI |
| `remote-control.md` | Remote Control per session |
| `chat.md` | The native chat tabs and anything else upstream offers that is not a terminal (MCP servers, Ghostty) |
| `preferences.md` | Every setting, its default and where it shows; themes and color schemes; languages |
| `look.md` | The whole window's look: header, sidebar, rows, tab strip, panes, dialogs, both themes, fonts, icons, the TUI-style interface vs classic |

If the code shows a feature the sources above do not name, it goes in the right file and in the
index, marked "found in the code".

## Out of scope

Any design for Menkar (how to build it in TypeScript); judging which features to keep — all are kept
(the human, 2026-11-08); Windows or macOS behaviour agent-tablet does not have.

## Do not touch

`package.json`, `src/`, `tests/`, `e2e/`, `scripts/` (plan 01, `b1`); agent-tablet's tree (read only;
`make ui-check` writes only under its own temporary directories); the human's `~/.claude` and the app
directories.

## Execution blocks

### B1 — Inventory

- [ ] `docs/spec/README.md`: every feature, shortcut and menu item of agent-tablet, from the README,
      the docs and the code, each assigned to an area file. Counted: the number of menu items and
      shortcuts, compared with what the code registers (actions and accelerators), so none is missed.
- **Verification:** the counts match the code's; `set` reviews the index before B2.

### B2 — The area files

- [ ] Each file of the table with its four parts; screenshots in `docs/spec/img/`.
- **Verification:** every acceptance case is concrete (an input and an expected output); every
  screenshot is referenced; `npm run ci`'s history check (or `python3 docs/history/nothing_lost.py`
  until plan 01 ports it) passes.

### B3 — Deferred entries

- [ ] agent-tablet's `docs/NOT_BUILT_YET.md` entries that still apply to Menkar, rewritten for it, in
      Menkar's `docs/NOT_BUILT_YET.md`; the ones that do not apply listed in the log with why.
- **Verification:** the history check passes.

## Execution log

(Written by the session that executes it.)
