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
  the two Catppuccin themes and VS Code's two palettes, derived from `bg`/`fg` for the Solarized
  pair (mantle is HSL lightness and saturation × 0.85; the surfaces are mixes toward `fg`). It also
  gives the terminals' palette (below). Classic keeps libadwaita's stock chrome. A test holds the
  four spec themes against the spec's table to ±1 per channel.
- **Five themes, VS Code by default** (decision 1.41 as amended, 2026-11-10): VS Code, Catppuccin
  Mocha, Catppuccin Latte, Solarized Dark and Solarized Light. "VS Code" follows the scheme, Dark
  Modern when it resolves dark and Light Modern when light; the others are one palette each. A
  first start chooses VS Code, and a saved theme the app no longer has ("Default", "VS Code Dark",
  the seven removed, "Ubuntu", anything unknown) reads as VS Code (`knownTheme`).
- **Terminal colors** (decision 1.42, 2026-11-10), an Appearance dropdown saved as
  `terminal_colors`: whose colours every terminal takes (agents, shells, the drawer), in both
  styles, live; the theme still paints the rest of the window and the editor.
  - **Ubuntu terminal**, the default: GNOME Terminal on Ubuntu with Yaru-dark's colours, `#300a24`,
    white and GNOME's 16-colour palette, the same in either scheme (`UBUNTU_TERMINAL`).
  - **Neutral (VTE)**: no palette (`look.terminal` null); the terminal draws black on white in
    light and white on `#1e1e1e` in dark, close to VTE's defaults (decision 1.10).
  - **Same as theme**: the chosen theme's terminal palette.
  - A saved value that is not one of the three reads as Ubuntu terminal.
- `src/renderer/look.ts` writes the roles as CSS custom properties on `<html>`, with a `tui` or
  `classic` class. `style.css` uses only those variables, so a theme or scheme change (including
  the desktop flipping light/dark) re-colors the open window at once.
- The empty states show Menkar's star (decision 1.12), inlined with `fill="currentColor"`.
- **No "Ubuntu" theme** (decision 1.40, 2026-11-10, amending 1.35): it was removed; a saved one
  reads as the fallback theme (above). Every pty still says `COLORTERM=truecolor` (below).
- **VS Code** (decisions 1.39 and 1.41, 2026-11-10) is VS Code 1.105.1's default themes, Dark
  Modern and Light Modern, taken from its MIT theme files. Its terminal palettes are the panel's
  background (`#181818`, `#f8f8f8`), since the terminal has none of its own, its text colour, and
  the workbench's 16 dark or light ANSI defaults. In Terminal workspace its chrome roles are its own
  (sidebar, border, input border, line-number, inactive text and focus colours) rather than
  derived, and the editor takes its syntax colours in both schemes (below).
- **Every pty says `COLORTERM=truecolor`** (2026-11-10). xterm.js draws 24-bit colour, but a
  Menkar started from the desktop has no `COLORTERM` of its own to pass on. Without it Claude
  Code drops to 256 colours (Node's colour depth reads `TERM=xterm-256color` as 8 bits) instead
  of painting its own RGB theme. That theme is what a reply's colours are: white text, `#b1b9f9`
  inline code, `#999999` greys. Only the background and the 16-colour palette come from Menkar's
  terminal colours.

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
- **Jump to the bottom** (2026-11-10): every terminal (agent pane, shell, drawer) scrolled up from
  its end shows a round button with a down arrow at its lower right, left of the scrollbar, so it
  never covers the thumb. A click or `Ctrl+Shift+End` goes to the end and the button hides; output
  that arrives while scrolled up keeps the view where it is and puts an accent dot on the button.
  Every other modified End goes to the agent (xterm sends it on), so only `Ctrl+Shift+End` is
  caught, for every key event type.
- Each agent pane is registered for the agent-state module (`src/main/panes.ts`): its screen
  mirror, whether its agent owns the foreground, whether it is seen, and `reveal()`.

## The drawer terminal

Decision 1.29 (2026-11-09): each tab can open a shell under its panes for a moment's work (git in
the session's folder) without a terminal tab piling up.

- **`Ctrl+`` ` `` toggles it** for the selected tab (by `event.code`, so it is the key left of `1`
  on any layout), and also on the key the active layout types `` ` `` with when the event leaves
  it unnamed. On Spanish that key is a dead key right of `P`, and on the human's desktop (Wayland
  with ibus, 2026-11-10) its keydown is key `Process`, keyCode 229, and starts a composition; key
  `Dead` comes only on the keyup. It is found through Chromium's keyboard layout map
  (`src/renderer/keyboard-layout.ts`), which gives `` ` `` for that key. The map is read again on
  focus and whenever Ctrl goes down, since it follows the layout of the last key event. Only an
  unnamed key (`Process` or `Dead`) is matched this way, so US `Ctrl+[` (the terminal's Esc,
  arriving named `[`) stays out even when the map is stale after a layout switch. The composition
  the shortcut's key starts is kept from the terminal and ended by taking the focus off its element
  and back, so no `` ` `` lands there and the next vowel is not accented. The window action is
  `{ type: 'toggleDrawer', pane }`, which the New menu can call too. The key never reaches a
  terminal.
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

## The start (plan 25, 2026-11-10)

- **The window does not wait for the first scan** of the agents' folders. The workspace starts
  from `state.json` and `projects.json` alone. The sessions service announces no list until its
  first scan ends, so an empty list never reads as "no sessions". When the scan ends, a saved tab
  whose sessions are all gone is dropped, and the shown project's saved tabs start (decision 1.32).
  Measured over a 2 GB history: the first window went from about 6.3 s to 0.5 s.
- **While that scan runs** (`sessionsLoading` in the window's state), the content shows the logo
  star turning, and the session list a small turning star with "Loading sessions…". Both appear
  only after 300 ms, so a fast start never flashes them, and the star stays still with reduced
  motion. A failed first scan ends the wait all the same.
- **The start's timings** (`src/main/startup.ts`): each phase is an info line as it ends, and one
  `start timings` notice line, written at the default level, lists every phase in ms when the
  first window shows, so a slow start names its slow phase in the user's own log. A
  `first sessions scan` notice line says when the scan ended and how many sessions it found.

## Windows and quitting

- Every window is a `BrowserWindow` on the same workspace. A project is in one window at most
  (the layout's `holder`).
- Closing a window asks first when any pane runs something (`window:confirm-close` → the renderer's
  dialog → `confirmClose`). A window that is not the last leaves the saved layout. The last one
  keeps it and **waits for that save before the app quits**: a write cut short left its temporary
  file instead of the new `projects.json`.
- Settings' Restart now quits every window at once without that question (`quitApp()`, 2026-11-10):
  the same save and hang-up, then the relaunch. Unsaved edits are asked about first, on Settings
  (`docs/preferences.md`).
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
- Settings and Usage keep the system's frame.
- **The header's text buttons** (decision 1.34, 2026-11-10), each an icon with its word, with a resting
  fill and a 1 px edge so text among icons reads as a button; the icon buttons stay flat:
  - "+ New ▾", the one menu for starting things (decision 1.30): New session, Terminal in this tab,
    Open file…, New window, each with its key. The agent is
    picked on Add session → New, which preselects the agent last started while it is installed
    (`last_agent` in `state.json`, decision 1.31).
  - "⚙ Settings" in the sidebar header opens the Settings window (`openSettings`), with no menu.
  - "Usage" (a chart icon) sits right after New ▾; it opens Usage. The title stays alone in the
    centre.
- There is no main menu. Show hidden sessions (the history's own hide, a check per window, not
  saved) is a switch at the foot of Add session → Existing.
- **Closing tabs from a tab's menu**: Close, Close other tabs, Close all tabs, none of them asking
  (decision 1.34, 2026-11-10).
- **The sidebar** starts at 250 px and stops at 180 px; a double click on the divider puts it back
  at 250 and saves that. A width saved before is kept (2026-11-10).
- Every segmented control (Add session's Existing / New, Usage's rows) shares
  one style (2026-11-09): a bordered group with a line between segments; the unchosen segments a
  translucent step off the page with dimmed text, the chosen one in the accent, bold. Text on the
  accent is the theme's background or its text, whichever has more contrast with the accent (a
  dark accent takes the light text).
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

- **One table of keys** (decision 1.37, `src/core/shortcuts.ts`): every key Menkar handles is a
  row, with its group (window, file tab, terminal, find bar, after `Ctrl+B`, switchers, chat), its
  chords and its description.
  - The handlers (`main.ts`, `keys.ts`, `terminals.ts`, `switcher.ts`, `chat.ts`) find their
    command with `matchShortcut` and run it from a record typed by the table, so a row without an
    action does not compile.
  - Settings' Keyboard shortcuts and the `Ctrl+B ?` help are drawn from the table.
  - A test that reads the source refuses any other key literal in those handlers. The three left
    each name why: the prefix's own `Ctrl+B`, a held switcher's release, and switcherMove's
    direction.
- **The project switcher** (`Ctrl+Shift+E`, decision 1.38) lists the projects in use: the one this
  window shows, then those with a tab open in any window, the most recently shown or focused first
  (`activeProjects`, `src/core/projects/switching.ts`). Main keeps the recent order.
  - It opens on the previous project. As with Alt+Tab, letting `Ctrl` go jumps, so a quick press
    goes straight back; held, each `E` moves down, round. `↑`, `↓`, `Enter` and `Esc` work as in
    the other switchers, with any modifier held.
  - Jumping is `switchProject`: a project another window holds brings that window forward.

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
