# The window — look, project view, tabs with live sessions, several windows

How the main window is built and why that way. The behaviour it follows is in `docs/spec/`
(`look.md`, `projects.md`, `terminal.md`, the session rows of `sessions.md`); decisions 1.9–1.12 in
`plans/00-STATUS.md` override the spec where they differ.

## Who owns what

- **`src/main/workspace.ts` is the one owner of the live state**: the projects in memory, the
  layout of every window (`src/core/projects/layout.ts`), each pane's pty, and the transient tabs'
  titles. Every window gets the same shape, `WindowState` (`src/shared/workspace.ts`), pushed
  after every change. A window asks for anything through one typed channel, `window:action`, with
  an `Action` union; refusals come back as `t()` keys.
- **The renderer draws, and keeps nothing else.** The sidebar, header and tab strip are redrawn
  from each `WindowState`. Only the xterm.js instances persist, keyed by pane id
  (`src/renderer/terminals.ts`), and they move between tab bodies as the layout changes.
- **`state.json` has one writer in memory**, the sessions service (`updateState`). Names, hidden
  sessions, the sidebar width and the remembered folder all go through it, so two writers never
  save from different copies.

## Look

- `src/core/theme.ts` resolves the look from `ui_style`, `terminal_theme` and `color_scheme` plus
  the system's dark preference. In Terminal workspace it gives the eight chrome roles: exact for
  the two Catppuccin themes, derived from `bg`/`fg` for the rest (mantle is HSL lightness and
  saturation × 0.85; the surfaces are mixes toward `fg`). It also gives the terminal's palette.
  Classic keeps libadwaita's stock chrome. A test holds all eleven themes against the spec's table
  to ±1 per channel.
- `src/renderer/look.ts` writes the roles as CSS custom properties on `<html>`, with a `tui` or
  `classic` class. `style.css` uses only those variables, so a theme or scheme change (including
  the desktop flipping light/dark) re-colors the open window at once.
- Classic with Default leaves the terminal without a theme: Menkar uses black on white in light
  and white on `#1e1e1e` in dark, close to VTE's defaults (decision 1.10).
- The empty states show Menkar's star (decision 1.12), inlined with `fill="currentColor"`.

## Panes and terminals

- **One pty per pane** (`src/main/terminal.ts`) runs the user's `$SHELL` (`/bin/bash` when unset)
  in the session's folder, or in `HOME` with the app's warning when that folder is gone. The
  agent's command line (`src/core/command.ts`, the spec's table, shell-quoted, ending in
  ` && exit`) is typed into it. A missing agent CLI leaves a plain shell with the app's warning.
  Claude's lines always end with `--settings <sessionSettingsFile()>`; Cursor's never carry it.
- **Closing hangs up** (decision 1.9): closing a tab, Stop, closing a window and quitting send
  SIGHUP to the pane's shell. Nothing is typed into a running agent, neither `/exit` nor `exit`.
- **"Running"** means the pty's foreground process is not the shell itself. node-pty reports the
  foreground process's `argv[0]`, so it is compared by base name (and `-bash` counts as `bash`).
- Output is kept per pane (512 KiB). A window that shows a pane later (a moved tab, a reopened one)
  attaches and replays it; events that arrive before the attach answers are already in that
  buffer, because IPC keeps the order.
- Each agent pane is registered for the agent-state module (`src/main/panes.ts`): its screen
  mirror, whether its agent owns the foreground, whether it is seen, and `reveal()`.

## A new session joining its project

A new, forked or continued tab is transient until its session has a typed message. While one
waits, the workspace asks the sessions service for a rescan every 1.5 s. A known id (a new Claude
session or a fork) waits until the tab closes, then one last check. An unknown id (Continue last,
Cursor) takes the newest session of that folder modified since the tab started, and gives up after
120 tries. It then joins the project the tab was started in (`joinTarget`).

## Windows and quitting

- Every window is a `BrowserWindow` on the same workspace. A project is in one window at most
  (the layout's `holder`).
- Closing a window asks first when any pane runs something (`window:confirm-close` → the renderer's
  dialog → `confirmClose`). A window that is not the last leaves the saved layout. The last one
  keeps it and **waits for that save before the app quits**: a write cut short left its temporary
  file instead of the new `projects.json`.
- Projects, groups and membership are saved at once; the layout 500 ms after its last change.

## Checks

- Vitest: the themes, settings and command lines (`tests/core/{theme,settings,command}.test.ts`).
- e2e under `xvfb-run` only: `e2e/app.ts` refuses to launch without `MENKAR_E2E_XVFB=1`, which only
  `npm run ui-check` and `npm run package:smoke` set inside `xvfb-run`. A session started
  Playwright directly twice, and each time a window opened on the human's screen.
  - `e2e/look.spec.ts`: the computed colors of the main roles, plus screenshots of each look in
    `test-results/look/` to compare with `docs/spec/img/`.
  - `e2e/window.spec.ts`: the dropdown, resume, a new session joining, and closing with a running
    agent. It uses a stand-in `claude` written in Node that records its arguments, never the real
    one.

## Keys, panes and jumping

- **The `Ctrl+B` prefix** (`src/renderer/keys.ts`) is caught on the document in the capture phase,
  so the terminal never sees it or the key that follows. It is not taken while the focus is in a
  text field (not counting xterm's own helper textarea) or a dialog. Modifiers alone keep it
  waiting. The key that ends it runs its command or nothing. Its `keydown` is cancelled, so the
  browser sends no `keypress`, and a swallow flag guards xterm's handler until the key goes up.
- **Split panes**: main opens a plain shell pane (nothing typed into it) in the primary pane's
  folder. A tab holds two panes at most (`layout.twoPanesMax`). The orientation is stored on the
  layout's session tab, so it is saved and restored. Closing a pane hangs it up (decision 1.9).
- Focus by direction is `src/core/panes.ts` (`focusTarget`: ahead + 2 × sideways, nearest wins),
  given the visible panes' rectangles. Zoom and the focused pane are per tab in the renderer, and
  not saved.
- **The quick switcher** (`Ctrl+Shift+K`) and **Go to agent** (`Ctrl+B g`) share one jump dialog
  (`src/renderer/switcher.ts`). Only one opens at a time. Go to agent asks main for every tab of
  every window (`listTabs`, the most recently focused window first) and reveals the chosen one.
- **The ⚙ main menu**: Open session file… (a chosen `.jsonl` as a replay), Show hidden sessions (a
  check per window, not saved), Usage, Preferences, About. The last three call
  `openUsage`/`openPreferences`/`openAbout` in main, which log until plan 12 provides their
  windows.
