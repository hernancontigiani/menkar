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

- [x] `docs/spec/README.md`: every feature, shortcut and menu item of agent-tablet, from the README,
      the docs and the code, each assigned to an area file. Counted: the number of menu items and
      shortcuts, compared with what the code registers (actions and accelerators), so none is missed.
- **Verification:** the counts match the code's; `set` reviews the index before B2.

### B2 — The area files

- [x] Each file of the table with its four parts; screenshots in `docs/spec/img/`.
- **Verification:** every acceptance case is concrete (an input and an expected output); every
  screenshot is referenced; `npm run ci` passes.

### B3 — Deferred entries

- [x] agent-tablet's `docs/NOT_BUILT_YET.md` entries that still apply to Menkar, rewritten for it, in
      Menkar's `docs/NOT_BUILT_YET.md`; the ones that do not apply listed in the log with why.
- **Verification:** the history check passes.

## Execution log

Executed by `b2`, 2026-11-08.

**B1.** The index (`docs/spec/README.md`): 58 features, 42 key rows, 45 menu-item templates, 3
commands, each counted against what agent-tablet's code registers (window shortcut controller,
application accelerator, file-tab, terminal, prefix, chat and switcher key handlers; the five
`Gio.Menu`s; the 46 registered actions). Reviewed by `set`. Two conflicts with Menkar's rules went to
the human and became decisions 1.7 (the question card is not carried over) and 1.8 (import
agent-tablet's data on first start). agent-tablet's README says `Ctrl+Shift+F` focuses the history
search; the code opens Add session on Existing; the spec follows the code.

**B2.** Twelve area files, written in parallel by seven subagents from one brief, each file checked
by `b2` before it was accepted: sessions 84 cases, terminal 57, projects 57, agent-state 39,
context 39, usage 70, classifier 39, files 39, remote-control 27, chat 50, preferences 36, look 52.
44 screenshots in `docs/spec/img/` (22 views, dark and light, from agent-tablet's `make ui-check`
on demo data); every one is referenced. Corrections made on review: index rows F4 (the count line
carries the total size), F34 (`Ctrl+B g` lists every tab of every window), F48 ("Open session
file…" opens a replay, not a session), F54 (scrollback lines); `terminal.md` claimed no scrollback
control in Preferences, there is one.

Not anticipated:
- **Screenshots the capture cannot take right**: under Broadway the Preferences dialog's rows are
  laid out too narrow (titles wrap one letter per line) and the Markdown preview cannot start
  (WebKit's sandbox), so `integrations-*`, `preferences-*` and `file-preview-*` carry a caveat
  where they are referenced. They need retaking by hand, on a real display, with demo data.
- **agent-tablet bugs found while reading**, each marked in its area file as not to be carried:
  a split shell pane is typed ` && exit` (bash prints an error); opening a session whose project is
  open in another window also opens a second tab here; deleting a project open in another window
  stops only this window's sessions; a new session joins the project last chosen in any window;
  moving a session out of a two-pane tab moves the whole tab; trash/delete close the tab only in
  this window; Preferences re-colors only the opening window's terminals; Details over-counts
  tokens; Cursor's export is empty; a rescan requested during a scan is dropped; untranslated
  strings and raw error texts in chat and dialogs.
- **Decisions left open, flagged in their files**: graceful close types `/exit` (and `exit` into
  leftover shells) into running agents, against `CLAUDE.md`'s rule (`terminal.md`); `unknown`
  turns get a category from the backfill that no report shows (`classifier.md`, `usage.md`); the
  import's details beyond 1.8 (`sessions.md`, `usage.md`: what marks a first start, partly valid
  files keep their good entries, `current` and `classify_since` imported, the window layout and
  `integrations.json` not); the integrations record and backups placed under
  `$XDG_STATE_HOME/menkar/`, a directory `CLAUDE.md` does not name (`context.md`); the Classic
  style's terminal colors with theme Default, and popover menus in the sans font (`look.md`);
  Menkar's About links and copyright lines (`preferences.md`).

**B3.** Thirteen of agent-tablet's deferred entries carried to Menkar's `docs/NOT_BUILT_YET.md`,
rewritten (no agent-tablet paths, numbers attributed or dropped). Not carried: "A packaged release
(`.deb`, PyPI)" — packaging for Ubuntu is on Menkar's roadmap (`plans/00-STATUS.md` §3), not
deferred; "Running natively on Windows and macOS" — Menkar is that port; its findings already live
in Menkar's `CLAUDE.md` (the xterm.js key handler) and §2 (the Windows shell), and the rest
(Chromium's sandbox on Ubuntu, `electron/install.js`, node-pty rebuild, the fit addon's padding, a
statusline that is not Python) stays readable in agent-tablet's file for the plans that need it.

Verification: `npm run ci` passes (history check: 5 documents, 0 lines lost).
