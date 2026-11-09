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

## The drawer terminal

Decision 1.29 (2026-11-09): each tab can open a shell under its panes for a moment's work (git in
the session's folder) without a terminal tab piling up.

- **`Ctrl+`` ` `` toggles it** for the selected tab (by `event.code`, so it is the key left of `1`
  on any layout); the window action is `{ type: 'toggleDrawer', pane }`, which the New menu can
  call too. The key never reaches a terminal.
- **Its folder** is chosen once, when its shell starts (`drawerFolder` in `src/core/drawers.ts`):
  the focused agent pane's folder, else another agent of the tab, else the tab's shell, else a file
  tab's folder, else `HOME`. A chat tab's drawer starts in `HOME`.
- **Main keeps one per tab** (`DrawerRegistry`, `src/core/drawers.ts`), apart from the panes: a
  plain `Terminal` with no command, never in the layout, `projects.json`, Usage or agent state. Its
  id travels on the panes' `pty:*` channels, which fall back to the drawers when no pane has the id.
  `TabView.drawer` carries its id, whether it is shown, and its label, `shell · <folder>`.
- **Hiding keeps it running**, scrollback and cwd included. `exit` closes it for real, and the next
  toggle starts a fresh shell. Closing the tab, its window or the app hangs it up with SIGHUP, as a
  pane's shell; it never adds a "running" question.
- **The renderer** puts it at the bottom of the tab body, full width, as an absolutely placed pane
  whose height the body keeps free with `padding-bottom`, so no pane node moves. It opens at 30 % of
  the tab; the divider on its top edge resizes it, and that height holds for the window while the
  app runs. Opening focuses it; hiding it (or its exit) focuses the pane that had the focus.
- **A ⌄ button hides it too** (2026-11-09), for whoever does not know the key: on the frame's top
  line at its right end, or the drawer's top-right corner in Classic, which has no frame. It only
  hides; `exit` is still what ends the shell.

## A new session joining its project

A new, forked or continued tab is transient until its session has a typed message. While one
waits, the workspace asks the sessions service for a rescan every 1.5 s. A known id (a new Claude
session or a fork) waits until the tab closes, then one last check. An unknown id (a Cursor
session) takes the newest session of that folder modified since the tab started, and gives up after
120 tries. It then joins the project the tab was started in (`joinTarget`).

## Windows and quitting

- Every window is a `BrowserWindow` on the same workspace. A project is in one window at most
  (the layout's `holder`).
- Closing a window asks first when any pane runs something (`window:confirm-close` → the renderer's
  dialog → `confirmClose`). A window that is not the last leaves the saved layout. The last one
  keeps it and **waits for that save before the app quits**: a write cut short left its temporary
  file instead of the new `projects.json`.
- Projects, groups and membership are saved at once; the layout 500 ms after its last change.

## The frame (2026-11-09)

- **No application menu** (`Menu.setApplicationMenu(null)`): its bar was a third one between the
  frame and the header, and its accelerators (reload, DevTools, close the window, quit) fired over
  the terminal's keys. No key of Menkar's came from it; copy and paste are Chromium's own in fields
  and the editor, and the terminal's `Ctrl+Shift+C` / `Ctrl+Shift+V`.
- **The main window has no system frame**: the headers are its title bar (`titleBarStyle: 'hidden'`
  with `titleBarOverlay`). The system draws only minimize, maximize and close over the header's
  right end, and the renderer sends their colors and height (`titleBar`) as the header is drawn,
  so they follow the style and the scheme. The content header keeps clear of them through
  `env(titlebar-area-width)`.
- The headers are `-webkit-app-region: drag`; their buttons and the tab strip are `no-drag`. A
  double click on a header's empty space asks main to maximize or restore; main skips a toggle right
  after the system's own, so a desktop that also maximizes on a caption double click does not
  undo it.
- The two headers are one surface (2026-11-09): a background a step from the content's toward the
  text color, with a 1 px line under it, derived from the theme's roles so every theme and scheme
  gets it. The window buttons take that background and stop above the line. A window that does not
  fill the screen draws a 1 px edge around itself, since without a system frame nothing else ends
  it; maximized or full screen (`maximized` in the window's state) it has none.
- Preferences, Usage, About and MCP keep the system's frame.
- "Close all" in the content header is a text button (2026-11-09): its ✕ icon read as the window's
  close. Being text among icons it has a resting fill and a 1 px edge, so it reads as a button; the
  icon buttons stay flat. It still closes every tab with no question, and shows with two tabs or
  more.
- "New ▾" is the header's one menu for starting things (decision 1.30, 2026-11-09), a text button in
  Close all's look: New session, Terminal in this tab, Open file…, New window, each showing its
  key. The agent is picked on Add session → New, not per menu item.
- Every segmented control (Add session's Existing / New, Usage's rows, Preferences' pages) shares
  one style (2026-11-09): a bordered group with a line between segments; the unchosen segments a
  translucent step off the page with dimmed text, the chosen one in the accent, bold. Text on the
  accent is the theme's background or its text, whichever has more contrast with the accent (a
  dark accent such as Tango's purple takes the light text).
- Buttons, text fields and segmented groups round their corners even in Terminal workspace
  (`--control-radius`, 4 px there, Classic's own 6 px; 2026-11-09); a group rounds only its
  outline. Tabs, rows, the terminal frame and the dialog's response row keep the style's corners.
- A right click on a terminal opens its menu (decision 1.20, 2026-11-09): Copy (off with no
  selection), Paste, Select all, Find…, each with its keys; it opens on `contextmenu`, after xterm
  handled the press, so the selection stays. Paste is the user's own action, as `Ctrl+Shift+V` is.
  Esc closes any open menu and goes no further.
- The button that opened a menu or popover closes it again, by mouse or keyboard (2026-11-09): a
  press on that button is left to its click, which would otherwise reopen what the press outside
  had just closed.
- A session row shows its context ring only while its agent runs (decision 1.21, 2026-11-09): a
  stopped session's estimate is too often wrong. The windows hear of an agent reaching or leaving
  the foreground from a short poll of the panes in main, since nothing else marks that moment.
- Tabs reorder by dragging within their strip (decision 1.23, 2026-11-09): past a few pixels a
  press becomes a drag with a marker in the gap it would drop into; let go outside the strip and
  nothing moves; no tab leaves its window. The order is the layout's, saved like the rest.
- Under `xvfb-run` there is no window manager: maximize, minimize, edge resize and snapping are the
  human's check on a real desktop.

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
