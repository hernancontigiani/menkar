# History of `docs/window.md`

## A new session joining its project

> Left on 2026-11-09: one New ▾ menu; the advanced new session, Continue last and New chat removed (decision 1.30).
session or a fork) waits until the tab closes, then one last check. An unknown id (Continue last,
Cursor) takes the newest session of that folder modified since the tab started, and gives up after

> Replaced 2026-11-10: Preferences, About and MCP became the Settings window, which has no segmented page switch. It was:
- Preferences, Usage, About and MCP keep the system's frame.
- Every segmented control (Add session's Existing / New, Usage's rows, Preferences' pages) shares

## The frame (2026-11-09)

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
- "Close all" in the content header is a text button (2026-11-09): its ✕ icon read as the window's
  close. Being text among icons it has a resting fill and a 1 px edge, so it reads as a button; the
  icon buttons stay flat. It still closes every tab with no question, and shows with two tabs or
  more.
- "New ▾" is the header's one menu for starting things (decision 1.30, 2026-11-09), a text button in
  Close all's look: New session, Terminal in this tab, Open file…, New window, each showing its
  key. The agent is picked on Add session → New, not per menu item.

## Keys, panes and jumping

> Left on 2026-11-10: the header reorganized and the main menu removed (plan 24).
- **The ⚙ main menu**: Open session file… (a chosen `.jsonl` as a replay), Show hidden sessions (a
  check per window, not saved), Usage, Preferences, About. The last three call
  `openUsage`/`openPreferences`/`openAbout` in main, which log until plan 12 provides their
  windows.

> Replaced 2026-11-10: plan 24 was closed, and its lines name decision 1.34 instead. It was:
- **The header's text buttons** (plan 24, 2026-11-10), each an icon with its word, with a resting
  (plan 24, 2026-11-10).

## The frame (2026-11-09)

> Left on 2026-11-10: replay removed from Menkar (decision 1.33).
    Open file…, Open session file…, New window, each with its key where it has one. The agent is

## Look

> Left on 2026-11-10: the Ubuntu theme was removed (decision 1.40, amending 1.35).
- **Ubuntu** (2026-11-10) is the human's GNOME Terminal on Ubuntu with the desktop's colours:
  Yaru-dark's aubergine `#300a24` and white, with GNOME's own 16-colour palette. It works in both
  styles, and its chrome roles are derived like the others'.

## Look

> Left on 2026-11-10: six themes kept, VS Code Dark the default (decision 1.41).
  the two Catppuccin themes, derived from `bg`/`fg` for the rest (mantle is HSL lightness and
  saturation × 0.85; the surfaces are mixes toward `fg`). It also gives the terminal's palette.
  Classic keeps libadwaita's stock chrome. A test holds all eleven themes against the spec's table
  to ±1 per channel.
- **No "Ubuntu" theme** (decision 1.40, 2026-11-10, amending 1.35): it was removed, and a saved
  `terminal_theme` of "Ubuntu" loads as Default, as any unknown name does. Every pty still says
  `COLORTERM=truecolor` (below).

## The frame (2026-11-09)

> Left on 2026-11-10: six themes kept, VS Code Dark the default (decision 1.41).
  dark accent such as Tango's purple takes the light text).

## Look

> Left on 2026-11-10: one VS Code theme by the scheme, no Default (1.41 as amended), and a Terminal colors setting (1.42).
- Classic with Default leaves the terminal without a theme: Menkar uses black on white in light
  and white on `#1e1e1e` in dark, close to VTE's defaults (decision 1.10).
- **VS Code Dark** (decision 1.39, 2026-11-10) is VS Code 1.105.1's default dark, Dark Modern,
  taken from its MIT theme files. The terminal gets `#181818`, the panel's background, since the
  terminal has none of its own, `#cccccc` text, and the workbench's 16 dark ANSI defaults. In
  Terminal workspace its chrome roles are its own (sidebar, input, border, line-number,
  description and focus colours) rather than derived, and the editor takes its syntax colours
  (below).
  theme.

## The drawer

> Left on 2026-11-10: Ctrl+` also found on the layout's dead-key ` (Spanish, right of P), through the keyboard layout map.
- **`Ctrl+`` ` `` toggles it** for the selected tab (by `event.code`, so it is the key left of `1`
  on any layout); the window action is `{ type: 'toggleDrawer', pane }`, which the New menu can
  call too. The key never reaches a terminal.
